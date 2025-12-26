// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

// ❌ DON'T cache these at module load time
// const supabaseUrl = process.env.SUPABASE_URL || '';
// const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

const getSupabaseClient = () => {
    // ✅ Read env vars inside the function
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    console.log('🔍 Supabase config check:');
    console.log('URL:', supabaseUrl ? 'PRESENT' : 'MISSING');
    console.log('KEY:', supabaseKey ? 'PRESENT' : 'MISSING');

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
    }
    
    return createClient(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
        }
    });
};

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('❌ No valid authorization header');
            res.status(401).json({ message: 'No token provided' });
            return;
        }

        const token = authHeader.replace('Bearer ', '');
        console.log('🔑 Token received');

        const supabase = getSupabaseClient();

        // Verify token
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error) {
            console.error('❌ Token verification failed:', error.message);
            res.status(401).json({ message: 'Invalid token' });
            return;
        }

        if (!user) {
            console.log('❌ No user found');
            res.status(401).json({ message: 'Invalid token' });
            return;
        }

        console.log('✅ User authenticated:', user.id);

        // Get merchant profile
        const { data: merchantProfile } = await supabase
            .from('merchant_profiles')
            .select('id')
            .eq('user_id', user.id)
            .single();

        req.user = {
            user_id: user.id,
            email: user.email || '',
            role: 'merchant',
            merchantId: merchantProfile?.id || user.id,
        };

        next();
    } catch (error: any) {
        console.error('💥 Auth error:', error.message);
        res.status(401).json({ message: 'Authentication failed' });
    }
};

export const authorize = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ message: 'Insufficient permissions' });
            return;
        }
        next();
    };
};