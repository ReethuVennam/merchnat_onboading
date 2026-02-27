import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase";
import { logger } from "../utils/logger";

const router = Router();

function getAdminSupabaseClient(): SupabaseClient {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Supabase URL or Service Key not configured");
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

type SupportUserRequest = Request & {
    supportUser?: {
        userId: string;
        email: string;
        role: string;
        firstName: string;
        lastName: string;
        supportStaffId?: string;
    };
};

router.post(
    "/auth/login",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                res.status(400).json({
                    success: false,
                    message: "Email and password required"
                });
                return;
            }

            logger.info("🔐 Support login attempt:", { email });

            const supabase = getAdminSupabaseClient();

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error || !data.user) {
                logger.warn("❌ Supabase auth failed:", { email, error: error?.message });
                res.status(401).json({
                    success: false,
                    message: "Invalid email or password"
                });
                return;
            }

            logger.info("✅ Supabase auth succeeded:", { userId: data.user.id });

            const { data: supportUser, error: roleError } = await supabase
                .from("support_staff")
                .select("*")
                .eq("user_id", data.user.id)
                .single();

            if (roleError || !supportUser) {
                logger.warn("❌ User not in support_staff table:", {
                    userId: data.user.id,
                    email,
                    error: roleError?.message
                });
                res.status(403).json({
                    success: false,
                    message: "Not authorized as support staff"
                });
                return;
            }

            if (supportUser.status !== "active") {
                logger.warn("❌ Support staff account not active:", {
                    userId: data.user.id,
                    status: supportUser.status
                });
                res.status(403).json({
                    success: false,
                    message: `Account is ${supportUser.status}. Contact administrator.`
                });
                return;
            }

            const validRoles = ["support_admin", "support_staff"];
            if (!validRoles.includes(supportUser.role)) {
                logger.warn("❌ User has invalid role:", {
                    userId: data.user.id,
                    role: supportUser.role
                });
                res.status(403).json({
                    success: false,
                    message: "Insufficient permissions"
                });
                return;
            }

            const nameParts = supportUser.name ? supportUser.name.split(" ") : ["Support", "Staff"];

            const token = jwt.sign(
                {
                    userId: data.user.id,
                    email: data.user.email,
                    role: supportUser.role,
                    firstName: nameParts[0] || "Support",
                    lastName: nameParts[1] || "Staff",
                    supportStaffId: supportUser.id
                },
                process.env.JWT_SECRET || "your-secret-key-change-this",
                { expiresIn: "24h" }
            );

            logger.info("✅ Support login successful:", {
                email,
                userId: data.user.id,
                role: supportUser.role
            });

            res.json({
                success: true,
                message: "Login successful",
                token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                user: {
                    userId: data.user.id,
                    email: data.user.email,
                    role: supportUser.role,
                    firstName: nameParts[0] || "Support",
                    lastName: nameParts[1] || "Staff",
                    supportStaffId: supportUser.id
                }
            });

        } catch (error) {
            const errorToLog = error instanceof Error ? error : new Error(String(error));
            logger.error("Support login error:", errorToLog);
            next(error);
        }
    }
);

export const verifySupportToken = (
    req: SupportUserRequest,
    res: Response,
    next: NextFunction
): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            logger.warn("❌ No authorization header");
            res.status(401).json({
                success: false,
                message: "No token provided"
            });
            return;
        }

        const token = authHeader.substring(7);

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "your-secret-key-change-this"
        ) as { userId: string; email: string; role: string; firstName?: string; lastName?: string; supportStaffId?: string };

        const validRoles = ["support_admin", "support_staff"];
        if (!validRoles.includes(decoded.role)) {
            logger.warn("❌ Invalid role in token:", {
                userId: decoded.userId,
                role: decoded.role
            });
            res.status(403).json({
                success: false,
                message: "Not authorized"
            });
            return;
        }

        logger.info("✅ Token verified:", {
            userId: decoded.userId,
            role: decoded.role
        });

        req.supportUser = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            firstName: decoded.firstName || '',
            lastName: decoded.lastName || '',
            supportStaffId: decoded.supportStaffId
        };

        next();

    } catch (error) {
        const errorToLog = error instanceof Error ? error : new Error("Token verification failed");
        logger.error("Token verification failed:", errorToLog);
        res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

router.get(
    "/kyc/pending",
    verifySupportToken,
    async (req: SupportUserRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            logger.info("Support fetching pending KYCs:", {
                supportStaffId: req.supportUser?.supportStaffId,
                email: req.supportUser?.email
            });
            const supabase = getAdminSupabaseClient();
            
            const { data: merchants, error: merchantError } = await supabase
                .from("merchant_profiles")
                .select("*")
                .eq("onboarding_status", "submitted")
                .order("created_at", { ascending: false });
            
            if (merchantError) throw merchantError;
            
            const pendingKYCs = [];
            for (const merchant of merchants || []) {
                const { data: kyc, error: kycError } = await supabase
                    .from("merchant_kyc")
                    .select("*")
                    .eq("merchant_id", merchant.id)
                    .single();
                
                const { data: documents, error: docError } = await supabase
                    .from("merchant_documents")
                    .select("*")
                    .eq("merchant_id", merchant.id);
                
                if (!kycError && kyc) {
                    pendingKYCs.push({
                        id: merchant.id,
                        full_name: merchant.full_name,
                        email: merchant.email,
                        mobile_number: merchant.mobile_number,
                        business_name: merchant.business_name,
                        pan_number: merchant.pan_number,
                        aadhaar_number: merchant.aadhaar_number,
                        created_at: merchant.created_at,
                        merchant_kyc: kyc,
                        merchant_documents: documents || []
                    });
                }
            }
            
            logger.info("Found pending KYCs:", { count: pendingKYCs?.length });
            
            res.json({
                success: true,
                data: pendingKYCs,
                count: pendingKYCs?.length || 0
            });
        } catch (error) {
            const errorToLog = error instanceof Error ? error : new Error("Error fetching pending KYCs");
            logger.error("Error fetching pending KYCs:", errorToLog);
            next(error);
        }
    }
);

router.post(
    "/kyc/review",
    verifySupportToken,
    async (req: SupportUserRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { merchantId, decision, reviewNotes } = req.body;
            const supportStaffId = req.supportUser?.userId;
            const supportStaffName = `${req.supportUser?.firstName} ${req.supportUser?.lastName}`;

            if (!merchantId || !decision) {
                res.status(400).json({
                    success: false,
                    message: "Missing merchantId or decision"
                });
                return;
            }

            if (!["approve", "reject"].includes(decision)) {
                res.status(400).json({
                    success: false,
                    message: "Decision must be approve or reject"
                });
                return;
            }

            logger.info("🔍 Support Review Started:", {
                merchantId,
                decision,
                supportStaff: supportStaffId,
                staffName: supportStaffName
            });

            const supabase = getSupabaseClient();

            const kycStatus = decision === "approve" ? "verified" : "rejected";

            logger.info("📝 STEP 1: Updating KYC Status", { merchantId, kycStatus });

            const { error: kycError } = await supabase
                .from("merchant_kyc")
                .update({
                    kyc_status: kycStatus,
                    review_notes: reviewNotes,
                    reviewed_by_admin: supportStaffId,
                    verified_at: decision === "approve" ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq("merchant_id", merchantId);

            if (kycError) {
                logger.error("❌ KYC update failed:", new Error("KYC update failed"));
                throw kycError;
            }

            logger.info("✅ KYC Status Updated:", { kycStatus });

            const { error: auditError } = await supabase
                .from("support_kyc_actions")
                .insert({
                    support_staff_id: req.supportUser?.supportStaffId,
                    merchant_id: merchantId,
                    action: "review",
                    decision: kycStatus,
                    notes: reviewNotes
                });

            if (auditError) {
                logger.error("❌ Failed To Audit Log", new Error("Failed To Audit Log"));
            }

            logger.info("✅ Audit logged");

            if (decision === "approve") {
                logger.info("✅ Approved - Updating status to pending_bank_approval");

                const { data: merchants, error: fetchError } = await supabase
                    .from("merchant_profiles")
                    .select("*")
                    .eq("id", merchantId);

                if (fetchError) throw fetchError;

                if (!merchants || merchants.length === 0) {
                    throw new Error(`Merchant not found: ${merchantId}`);
                }

                const merchant = merchants[0];

                if (!merchant.upi_vpa || !merchant.upi_qr_string) {
                    const namePrefix = merchant.full_name.slice(0, 4).toLowerCase();
                    const phoneSuffix = merchant.mobile_number.slice(-4);
                    const upiVpa = `${namePrefix}${phoneSuffix}@nsdl`;
                    const upiQrString = `upi://pay?pa=${upiVpa}&pn=${encodeURIComponent(merchant.full_name)}&tr=${merchant.application_id}&cu=INR`;

                    await supabase
                        .from("merchant_profiles")
                        .update({
                            upi_vpa: upiVpa,
                            upi_qr_string: upiQrString
                        })
                        .eq("id", merchantId);

                    merchant.upi_vpa = upiVpa;
                    merchant.upi_qr_string = upiQrString;
                }

                const { error: statusError } = await supabase
                    .from("merchant_profiles")
                    .update({
                        onboarding_status: "pending_bank_approval",
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", merchantId);

                if (statusError) throw statusError;

                logger.info("✅ Application sent to bank for review:", { merchantId });

            } else {
                const { error: statusError } = await supabase
                    .from("merchant_profiles")
                    .update({
                        onboarding_status: "rejected",
                        rejection_reason: reviewNotes,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", merchantId);

                if (statusError) throw statusError;

                logger.info("✅ Merchant status updated to rejected");
            }

            logger.info("✅ Support Review Completed:", {
                merchantId,
                decision,
                newStatus: kycStatus,
                approvedBy: supportStaffName
            });

            res.json({
                success: true,
                message: `Application ${decision}ed successfully`,
                decision,
                kycStatus,
                merchantId
            });

        } catch (error) {
            const errorToLog = error instanceof Error ? error : new Error(String(error));
            logger.error("Support review error:", errorToLog);
            next(error);
        }
    }
);

router.get(
    "/kyc/status/:merchantId",
    verifySupportToken,
    async (req: SupportUserRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { merchantId } = req.params;
            const supabase = getSupabaseClient();

            const { data: kycData, error: fetchError } = await supabase
                .from("merchant_kyc")
                .select("*")
                .eq("merchant_id", merchantId)
                .single();

            if (fetchError) throw fetchError;

            res.json({
                success: true,
                data: kycData
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;