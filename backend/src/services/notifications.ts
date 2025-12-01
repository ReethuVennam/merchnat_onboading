// src/services/notifications.ts
import { MerchantProfile, OnboardingStatus } from '../types/merchant';
import { logger } from '../utils/logger';

export interface NotificationPayload {
    to: string;
    subject: string;
    body: string;
    type: 'email' | 'sms' | 'push';
}

export class NotificationService {
    /**
     * Send notification to merchant about status change
     */
    async notifyMerchantStatusChange(
        merchant: MerchantProfile,
        oldStatus: OnboardingStatus,
        newStatus: OnboardingStatus
    ): Promise<void> {
        const notification = this.buildStatusChangeNotification(
            merchant,
            oldStatus,
            newStatus
        );

        await this.sendNotification(notification);

        logger.info('Status change notification sent', {
            merchantId: merchant.id,
            email: merchant.email,
            oldStatus,
            newStatus
        });
    }

    /**
     * Build notification for status change
     */
    private buildStatusChangeNotification(
        merchant: MerchantProfile,
        oldStatus: OnboardingStatus,
        newStatus: OnboardingStatus
    ): NotificationPayload {
        const subject = this.getSubjectForStatus(newStatus);
        const body = this.getBodyForStatus(merchant, newStatus);

        return {
            to: merchant.email,
            subject,
            body,
            type: 'email'
        };
    }

    /**
     * Get email subject for status
     */
    private getSubjectForStatus(status: OnboardingStatus): string {
        const subjects: Record<OnboardingStatus, string> = {
            draft: 'Application Saved as Draft',
            submitted: 'Application Submitted Successfully',
            validating: 'Application Under Review',
            pending_bank_approval: 'Bank Approval Pending',
            approved: 'Application Approved!',
            rejected: 'Application Requires Updates',
            validation_failed: 'Validation Failed',          // ADD THIS
            bank_rejected: 'Bank Approval Declined',         // ADD THIS
            verified: 'Account Verified'                     // ADD THIS
        };

        return subjects[status];
    }

    /**
     * Get email body for status
     */
    private getBodyForStatus(
        merchant: MerchantProfile,
        status: OnboardingStatus
    ): string {
        const bodies: Record<OnboardingStatus, string> = {
            draft: `Hi ${merchant.business_name}...`,
            submitted: `Hi ${merchant.business_name}...`,
            validating: `Hi ${merchant.business_name}...`,
            pending_bank_approval: `Hi ${merchant.business_name}...`,
            approved: `Hi ${merchant.business_name}...`,
            rejected: `Hi ${merchant.business_name}...`,
            validation_failed: `Hi ${merchant.business_name}, your application failed validation...`, // ADD
            bank_rejected: `Hi ${merchant.business_name}, bank approval was declined...`,            // ADD
            verified: `Hi ${merchant.business_name}, your account is now verified!`                 // ADD
        };

        return bodies[status];
    }

    /**
     * Send notification (mock implementation)
     */
    private async sendNotification(notification: NotificationPayload): Promise<void> {
        // In production, integrate with email service (SendGrid, AWS SES, etc.)
        logger.debug('Sending notification', {
            to: notification.to,
            subject: notification.subject,
            type: notification.type
        });

        // Mock send delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Log as sent
        console.log(`?? Email sent to ${notification.to}: ${notification.subject}`);
    }

    /**
     * Send admin notification
     */
    async notifyAdminNewSubmission(merchant: MerchantProfile): Promise<void> {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@sabbpe.com';

        const notification: NotificationPayload = {
            to: adminEmail,
            subject: 'New merchant application submitted',
            body: `A new merchant application has been submitted:\n\nBusiness: ${merchant.business_name}\nEmail: ${merchant.email}\nSubmitted: ${merchant.submittedAt}`,
            type: 'email'
        };

        await this.sendNotification(notification);

        logger.info('Admin notification sent', {
            merchantId: merchant.id,
            adminEmail
        });
    }
}

export const notificationService = new NotificationService();