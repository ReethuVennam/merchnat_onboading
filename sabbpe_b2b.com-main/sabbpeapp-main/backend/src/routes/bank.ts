import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';
import { logger } from '../utils/logger';

const router = Router();

function getAdminSupabaseClient(): SupabaseClient {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase URL or Service Key not configured');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

type BankUserRequest = Request & {
    bankUser?: {
        userId: string;
        email: string;
        role: string;
        bankStaffId?: string;
    };
};

// ============================================
// Bank: Login Endpoint
// ============================================

router.post(
    '/auth/login',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                res.status(400).json({
                    success: false,
                    message: 'Email and password required'
                });
                return;
            }

            logger.info('🏦 Bank login attempt:', { email });

            const supabase = getAdminSupabaseClient();

            // Authenticate with Supabase Auth
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error || !data.user) {
                logger.warn('❌ Bank auth failed:', { email, error: error?.message });
                res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
                return;
            }

            logger.info('✅ Bank auth succeeded:', { userId: data.user.id });

            // Check bank_staff Table
            const { data: bankUser, error: roleError } = await supabase
                .from('bank_staff')
                .select('*')
                .eq('user_id', data.user.id)
                .single();

            if (roleError || !bankUser) {
                logger.warn('❌ User not in bank_staff table:', {
                    userId: data.user.id,
                    email,
                    error: roleError?.message
                });
                res.status(403).json({
                    success: false,
                    message: 'Not authorized as bank staff'
                });
                return;
            }

            // Verify Status
            if (bankUser.status !== 'active') {
                logger.warn('❌ Bank staff account not active:', {
                    userId: data.user.id,
                    status: bankUser.status
                });
                res.status(403).json({
                    success: false,
                    message: `Account is ${bankUser.status}. Contact administrator.`
                });
                return;
            }

            const validRoles = ['bank_admin', 'bank_staff'];
            if (!validRoles.includes(bankUser.role)) {
                logger.warn('❌ User has invalid role:', {
                    userId: data.user.id,
                    role: bankUser.role
                });
                res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions'
                });
                return;
            }

            // Generate JWT Token
            const nameParts = bankUser.name ? bankUser.name.split(' ') : ['Bank', 'Staff'];

            const token = jwt.sign(
                {
                    userId: data.user.id,
                    email: data.user.email,
                    role: bankUser.role,
                    bankStaffId: bankUser.id
                },
                process.env.JWT_SECRET || 'your-secret-key-change-this',
                { expiresIn: '24h' }
            );

            logger.info('✅ Bank login successful:', {
                email,
                userId: data.user.id,
                role: bankUser.role
            });

            res.json({
                success: true,
                message: 'Login successful',
                token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                user: {
                    userId: data.user.id,
                    email: data.user.email,
                    role: bankUser.role,
                    name: bankUser.name,
                    bankStaffId: bankUser.id
                }
            });

        } catch (error) {
            const errorToLog = error instanceof Error ? error : new Error(String(error));
            logger.error('Bank login error:', errorToLog);
            next(error);
        }
    }
);

// ============================================
// Middleware: Verify Bank Token
// ============================================

export const verifyBankToken = (
    req: BankUserRequest,
    res: Response,
    next: NextFunction
): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('❌ No authorization header');
            res.status(401).json({
                success: false,
                message: 'No token provided'
            });
            return;
        }

        const token = authHeader.substring(7);

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'your-secret-key-change-this'
        ) as { userId: string; email: string; role: string; bankStaffId?: string };

        req.bankUser = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            bankStaffId: decoded.bankStaffId
        };

        next();
    } catch (error) {
        console.warn('❌ Token verification failed:', error instanceof Error ? error.message : String(error));
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

// ============================================
// Bank: Get Pending Applications
// ============================================

router.get(
    '/applications/pending',
    verifyBankToken,
    async (req: BankUserRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            logger.info('🏦 Bank fetching pending applications:', {
                bankStaffId: req.bankUser?.bankStaffId,
                email: req.bankUser?.email
            });

            const supabase = getSupabaseClient();

            // Get all applications with status = 'pending_bank_approval'
            const { data: applications, error: fetchError } = await supabase
                .from('merchant_profiles')
                .select('*')
                .eq('onboarding_status', 'pending_bank_approval')
                .order('updated_at', { ascending: false });

            if (fetchError) throw fetchError;

            logger.info('✅ Found pending applications:', { count: applications?.length || 0 });

            res.json({
                success: true,
                data: applications || [],
                count: applications?.length || 0
            });

        } catch (error) {
            const errorToLog = error instanceof Error ? error : new Error('Error fetching applications');
            logger.error('Error fetching pending applications:', errorToLog);
            next(error);
        }
    }
);

// ============================================
// Bank: Get Application Details
// ============================================

router.get(
    '/applications/:applicationId',
    verifyBankToken,
    async (req: BankUserRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { applicationId } = req.params;
            const supabase = getSupabaseClient();

            const { data: application, error: fetchError } = await supabase
                .from('merchant_profiles')
                .select('*')
                .eq('id', applicationId)
                .single();

            if (fetchError) throw fetchError;

            res.json({
                success: true,
                data: application
            });

        } catch (error) {
            const errorToLog = error instanceof Error ? error : new Error('Error fetching application');
            logger.error('Error fetching application:', errorToLog);
            next(error);
        }
    }
);

// ============================================
// Bank: Approve/Reject Application
// ============================================

router.post(
    '/applications/decide/:applicationId',
    verifyBankToken,
    async (req: BankUserRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { applicationId } = req.params;
            const { decision, notes } = req.body; // 'approve' or 'reject'

            if (!['approve', 'reject'].includes(decision)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid decision. Use approve or reject'
                });
                return;
            }

            const supabase = getSupabaseClient();

            const newStatus = decision === 'approve' ? 'approved' : 'bank_rejected';

            logger.info('🏦 Bank processing application:', {
                applicationId,
                decision,
                bankStaffId: req.bankUser?.bankStaffId
            });

            // Update application status
            const { error: updateError } = await supabase
                .from('merchant_profiles')
                .update({
                    onboarding_status: newStatus,
                    bank_decision_notes: notes,
                    bank_approved_at: decision === 'approve' ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', applicationId);

            if (updateError) throw updateError;

            logger.info('✅ Application status updated:', { applicationId, newStatus });

            res.json({
                success: true,
                message: `Application ${decision}ed successfully`,
                decision,
                newStatus,
                applicationId
            });

        } catch (error) {
            const errorToLog = error instanceof Error ? error : new Error('Error processing application');
            logger.error('Error processing application:', errorToLog);
            next(error);
        }
    }
);
export default router;