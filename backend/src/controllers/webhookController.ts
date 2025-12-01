// src/controllers/webhookController.ts
import { Request, Response, NextFunction } from 'express';
import { merchantService } from '../services/merchantService';
import { notificationService } from '../services/notifications';
import { logger } from '../utils/logger';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { MerchantProfile, OnboardingStatus } from '../types/merchant';

interface BankWebhookPayload {
    applicationId: string;
    merchantId: string;
    status: 'approved' | 'rejected';
    reason?: string;
    accountDetails?: {
        accountNumber: string;
        ifsc: string;
        bankName: string;
    };
    timestamp: string;
}

export class WebhookController {
    /**
     * Handle bank webhook for approval/rejection
     */
    async handleBankWebhook(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const payload: BankWebhookPayload = req.body;

            logger.info('Bank webhook received', {
                applicationId: payload.applicationId,
                merchantId: payload.merchantId,
                status: payload.status
            });

            // Get merchant
            const merchant = await merchantService.getMerchantById(payload.merchantId);

            // Verify application ID matches
            if (merchant.bankApplicationId !== payload.applicationId) {
                throw new BadRequestError(
                    'Application ID mismatch',
                    'INVALID_APPLICATION_ID',
                    {
                        expectedApplicationId: merchant.bankApplicationId,
                        receivedApplicationId: payload.applicationId
                    }
                );
            }

            const oldStatus = merchant.onboarding_status as OnboardingStatus;
            let newStatus: OnboardingStatus;
            let reason: string | undefined;

            if (payload.status === 'approved') {
                newStatus = 'approved';

                // Update merchant with bank account details
                await merchantService.updateStatus(
                    payload.merchantId,
                    newStatus,
                    undefined,
                    {
                        bankResponse: {
                            approved: true,
                            accountDetails: payload.accountDetails,
                            approvedAt: payload.timestamp
                        }
                    }
                );

                logger.business(
                    'bank_approval_received',
                    payload.merchantId,
                    'merchant',
                    {
                        applicationId: payload.applicationId
                    }
                );
            } else {
                newStatus = 'rejected';
                reason = payload.reason || 'Bank declined the application';

                await merchantService.updateStatus(
                    payload.merchantId,
                    newStatus,
                    reason,
                    {
                        bankResponse: {
                            approved: false,
                            reason: payload.reason,
                            rejectedAt: payload.timestamp
                        }
                    }
                );

                logger.business(
                    'bank_rejection_received',
                    payload.merchantId,
                    'merchant',
                    {
                        applicationId: payload.applicationId,
                        reason: payload.reason
                    }
                );
            }

            // Get updated merchant
            const updatedMerchant = await merchantService.getMerchantById(payload.merchantId);

            // Send notification to merchant
            await notificationService.notifyMerchantStatusChange(
                updatedMerchant,
                oldStatus,
                newStatus
            );

            // Respond to webhook
            res.json({
                success: true,
                message: 'Webhook processed successfully',
                merchantId: payload.merchantId,
                status: newStatus
            });
        } catch (error) {
            logger.error('Bank webhook processing failed', {
                error: error instanceof Error ? error.message : String(error),
                payload: req.body
            } as any);
            next(error);
        }
    }

    /**
     * Test webhook endpoint (development only)
     */
    async testWebhook(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { merchantId, status, reason } = req.body;

            if (!merchantId || !status) {
                throw new BadRequestError(
                    'merchantId and status are required',
                    'MISSING_REQUIRED_FIELDS'
                );
            }

            const merchant = await merchantService.getMerchantById(merchantId);

            const testPayload: BankWebhookPayload = {
                applicationId: merchant.bankApplicationId || 'test-app-id',
                merchantId,
                status: status as 'approved' | 'rejected',
                reason: reason || undefined,
                accountDetails: status === 'approved' ? {
                    accountNumber: '1234567890',
                    ifsc: 'TEST0001234',
                    bankName: 'Test Bank'
                } : undefined,
                timestamp: new Date().toISOString()
            };

            // Process as webhook
            await this.handleBankWebhook(
                { ...req, body: testPayload } as Request,
                res,
                next
            );
        } catch (error) {
            next(error);
        }
    }
}

export const webhookController = new WebhookController();
export default webhookController;