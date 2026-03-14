import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const router = Router();

// Supabase admin client — uses service role key for storage access
const getAdminClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
};

/**
 * POST /api/upload/file
 * 
 * Accepts a file upload and stores it in Supabase Storage using service role credentials.
 * This bypasses RLS policies since the backend has elevated permissions.
 * 
 * Required form fields:
 *   - file: the file to upload (multipart/form-data)
 *   - bucket: storage bucket name (e.g., 'merchant-documents')
 *   - path: storage path (e.g., 'user-id/file-name.jpg')
 */
router.post('/file', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { bucket, path } = req.body;
        const file = (req as any).file;

        console.log('📤 File upload request received:', { bucket, path, fileName: file?.originalname });

        if (!bucket || !path) {
            res.status(400).json({ success: false, error: { message: 'bucket and path are required' } });
            return;
        }

        if (!file) {
            res.status(400).json({ success: false, error: { message: 'No file provided' } });
            return;
        }

        const adminClient = getAdminClient();

        console.log('📝 Uploading to Supabase Storage:', { bucket, path, size: file.size });

        const { data, error } = await adminClient.storage
            .from(bucket)
            .upload(path, file.buffer, {
                contentType: file.mimetype,
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('❌ Supabase storage upload failed:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
            return;
        }

        console.log('✅ File uploaded successfully:', data);

        res.status(200).json({
            success: true,
            data: {
                path: data.path,
                fullPath: `${bucket}/${data.path}`
            }
        });

    } catch (error) {
        console.error('❌ Upload handler error:', error);
        next(error);
    }
});

export default router;
