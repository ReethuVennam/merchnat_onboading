import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { getSupabaseClient } from './supabase';
import { logger } from '../utils/logger';

const router = Router();

// ============================================
// Update Transaction ID
// ============================================

router.post(
    '/update',
    authenticate,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { transactionId } = req.body;
            const merchantId = req.user?.merchantId;

            // Validate inputs
            if (!transactionId) {
                res.status(400).json({
                    success: false,
                    message: 'Transaction ID is required'
                });
                return;
            }

            if (!merchantId) {
                res.status(401).json({
                    success: false,
                    message: 'Merchant ID not found'
                });
                return;
            }

            logger.info('💳 Updating transaction ID:', {
                merchantId,
                transactionId
            });

            const supabase = getSupabaseClient();

            // Update the transaction ID
            const { data, error } = await supabase
                .from('merchant_profiles')
                .update({
                    'Transaction Id': transactionId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', merchantId)
                .select()
                .single();

            if (error) {
                logger.error('❌ Error updating transaction ID:', error);
                throw error;
            }

            logger.info('✅ Transaction ID updated successfully:', {
                merchantId,
                transactionId
            });

            res.json({
                success: true,
                message: 'Transaction ID updated successfully',
                data: {
                    merchantId,
                    transactionId
                }
            });

        } catch (error) {
            const errorToLog = error instanceof Error ? error : new Error('Error updating transaction ID');
            logger.error('Transaction update error:', errorToLog);
            next(error);
        }
    }
);

// ============================================
// Get Transaction ID
// ============================================

router.get(
    '/get',
    authenticate,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const merchantId = req.user?.merchantId;

            if (!merchantId) {
                res.status(401).json({
                    success: false,
                    message: 'Merchant ID not found'
                });
                return;
            }

            const supabase = getSupabaseClient();

            const { data, error } = await supabase
                .from('merchant_profiles')
                .select('"Transaction Id"')
                .eq('id', merchantId)
                .single();

            if (error) throw error;

            res.json({
                success: true,
                data: {
                    transactionId: data?.['Transaction Id'] || null
                }
            });

        } catch (error) {
            const errorToLog = error instanceof Error ? error : new Error('Error fetching transaction ID');
            logger.error('Transaction fetch error:', errorToLog);
            next(error);
        }
    }
);

export default router;