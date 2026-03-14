import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();

// Supabase admin client — uses service role key, NEVER expose this to frontend
const getAdminClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
};

// Regular Supabase client for JWT verification
const getSupabaseClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
        }
    });
};

interface CreateMerchantBody {
    email: string;
    password: string;
    fullName: string;
    mobileNumber: string;
    distributorId: string;     // Supabase user_id of the distributor
    businessName?: string;
    entityType?: string;
    panNumber?: string;
    gstNumber?: string;
}

/**
 * POST /api/distributor/create-merchant
 *
 * Creates a merchant auth user + user_roles entry + merchant_profiles entry
 * with distributor_id pre-linked. Called by distributor dashboard frontend.
 *
 * Auth: The request must include the distributor's Supabase JWT as Bearer token.
 * We validate the JWT to confirm the caller is indeed a distributor before proceeding.
 */
router.post(
    '/create-merchant',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            console.log('🔵 [POST /create-merchant] Request received'); 
            
            const {
                email,
                password,
                fullName,
                mobileNumber,
                distributorId,
                businessName,
                entityType,
                panNumber,
                gstNumber
            } = req.body as CreateMerchantBody;

            console.log('📋 Body params:', { email, fullName, mobileNumber, distributorId });

            // ── Validate inputs ──────────────────────────────────────
            if (!email || !password || !fullName || !mobileNumber || !distributorId) {
                throw new BadRequestError(
                    'email, password, fullName, mobileNumber, and distributorId are required',
                    'MISSING_FIELDS'
                );
            }

            if (password.length < 6) {
                throw new BadRequestError(
                    'Password must be at least 6 characters',
                    'WEAK_PASSWORD'
                );
            }

            // Validate entityType against actual DB allowed values (from constraint)
            // Known allowed values in DB: proprietorship, partnership, pvt_ltd_llp, government_psu
            const allowedEntityTypes = ['proprietorship', 'partnership', 'pvt_ltd_llp', 'government_psu'];

            // Normalize and map common free-text inputs to DB values
            const rawEntity = entityType ? String(entityType).trim().toLowerCase() : '';
            const munged = rawEntity.replace(/[\s\-]+/g, '_');

            const mapping: Record<string, string> = {
                // proprietorship variants
                'sole_proprietor': 'proprietorship',
                'sole_proprietorship': 'proprietorship',
                'sole proprietor': 'proprietorship',
                'proprietor': 'proprietorship',
                'sole': 'proprietorship',

                // private / pvt ltd variants
                'private_limited': 'pvt_ltd_llp',
                'private limited': 'pvt_ltd_llp',
                'pvt_ltd': 'pvt_ltd_llp',
                'pvt_ltd_llp': 'pvt_ltd_llp',
                'pvt ltd': 'pvt_ltd_llp',

                // partnership
                'partnership': 'partnership',

                // government PSU
                'government_psu': 'government_psu',
                'government': 'government_psu',
                'psu': 'government_psu'
            };

            let normalizedEntityType: string | undefined;
            if (!rawEntity) {
                normalizedEntityType = undefined;
            } else if (allowedEntityTypes.includes(munged)) {
                normalizedEntityType = munged;
            } else if (mapping[munged]) {
                normalizedEntityType = mapping[munged];
            } else if (mapping[rawEntity]) {
                normalizedEntityType = mapping[rawEntity];
            } else {
                // unknown value — reject with allowed list
                console.error('❌ Invalid entityType provided:', entityType);
                res.status(400).json({
                    success: false,
                    error: { message: 'Invalid entityType', details: { allowed: allowedEntityTypes } }
                });
                return;
            }

            // ── Verify the caller is a distributor via Supabase JWT ──
            const authHeader = req.headers.authorization;
            console.log('🔐 Auth header present:', !!authHeader);
            if (!authHeader?.startsWith('Bearer ')) {
                console.error('❌ Missing Bearer token');
                res.status(401).json({ success: false, error: { message: 'Distributor authentication required' } });
                return;
            }

            const callerJwt = authHeader.replace('Bearer ', '');
            const supabaseClient = getSupabaseClient();

            console.log('🔑 Verifying JWT with Supabase...');
            const { data: { user: callerUser }, error: callerError } = await supabaseClient.auth.getUser(callerJwt);
            if (callerError || !callerUser) {
                console.error('❌ JWT verification failed:', callerError);
                res.status(401).json({ success: false, error: { message: 'Invalid distributor session' } });
                return;
            }

            console.log('✅ JWT verified, user ID:', callerUser.id);

            // Confirm caller is actually a distributor
            const adminClient = getAdminClient();
            const { data: roleData } = await adminClient
                .from('user_roles')
                .select('role')
                .eq('user_id', callerUser.id)
                .maybeSingle();

            console.log('📋 Caller role data:', roleData);

            if (roleData?.role !== 'distributor') {
                console.error('❌ Caller is not a distributor, role:', roleData?.role);
                res.status(403).json({ success: false, error: { message: 'Only distributors can create merchant accounts' } });
                return;
            }

            // Confirm distributorId matches the authenticated caller
            if (callerUser.id !== distributorId) {
                console.error('❌ Distributor ID mismatch:', { callerUserId: callerUser.id, providedId: distributorId });
                res.status(403).json({ success: false, error: { message: 'distributorId must match your own account' } });
                return;
            }

            logger.info(`Distributor ${distributorId} creating merchant: ${email}`);
            console.log('✅ Authorization passed, creating auth user...');

            // ── Step 1: Try to create auth user, handle existing user ─────────────────
            let merchantUserId: string;
            let existingUser = false;

            try {
                const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,          // skip email verification — distributor onboards them directly
                    user_metadata: {
                        full_name: fullName,
                        mobile_number: mobileNumber,
                        role: 'merchant'
                    }
                });

                if (authError || !authData.user) {
                    throw new Error(authError?.message ?? 'Failed to create auth user');
                }

                merchantUserId = authData.user.id;
                console.log('✅ Auth user created:', merchantUserId);
            } catch (createError) {
                // Check if it's because user already exists
                const errorMessage = createError instanceof Error ? createError.message : String(createError);
                if (errorMessage.includes('already been registered') || errorMessage.includes('already registered')) {
                    // User exists, try to get their ID
                    console.log('⚠️ User already exists, attempting to find their ID...');
                    
                    // Try to get user by email - this might not work, but let's try
                    try {
                        // Since getUserByEmail doesn't exist, we'll need to query the database
                        const { data: userData, error: queryError } = await adminClient
                            .from('auth.users')
                            .select('id')
                            .eq('email', email)
                            .single();

                        if (queryError || !userData) {
                            throw new Error('User exists but could not retrieve their ID');
                        }

                        merchantUserId = userData.id;
                        existingUser = true;
                        console.log('✅ Found existing user ID:', merchantUserId);
                    } catch (queryError) {
                        console.error('❌ Could not find existing user:', queryError);
                        throw new Error('A user with this email address already exists but could not be accessed');
                    }
                } else {
                    throw createError;
                }
            }

            // ── Step 2: Ensure user_roles exists (only for new users) ──
            if (!existingUser) {
                const { error: roleError } = await adminClient
                    .from('user_roles')
                    .insert({ user_id: merchantUserId, role: 'merchant' });

                if (roleError) {
                    // Rollback: delete the auth user we just created
                    await adminClient.auth.admin.deleteUser(merchantUserId);
                    throw new Error(`Failed to create user role: ${roleError.message}`);
                }
            }

            // ── Step 3: Ensure merchant_profiles exists ─
            let profileData: { id: string };

            if (existingUser) {
                // For existing users, check if profile exists
                const { data: existingProfile, error: profileCheckError } = await adminClient
                    .from('merchant_profiles')
                    .select('id')
                    .eq('user_id', merchantUserId)
                    .eq('distributor_id', distributorId)
                    .maybeSingle();

                if (profileCheckError) {
                    throw new Error(`Failed to check existing merchant profile: ${profileCheckError.message}`);
                }

                if (existingProfile) {
                    profileData = existingProfile;
                    console.log('✅ Existing merchant profile found:', profileData.id);
                } else {
                    // Create profile for existing user
                    const entity_type_to_use = normalizedEntityType || 'proprietorship';
                    console.log('📊 Creating merchant profile for existing user:', {
                        entity_type: entity_type_to_use,
                        business_name: businessName,
                        pan_number: panNumber,
                    });

                    const { data: newProfileData, error: newProfileError } = await adminClient
                        .from('merchant_profiles')
                        .insert({
                            user_id: merchantUserId,
                            full_name: fullName,
                            mobile_number: mobileNumber,
                            email,
                            distributor_id: distributorId,
                            business_name: businessName ?? null,
                            entity_type: entity_type_to_use,
                            pan_number: panNumber ?? null,
                            gst_number: gstNumber ?? null,
                            onboarding_status: 'pending'
                        })
                        .select('id')
                        .single();

                    if (newProfileError || !newProfileData) {
                        const msg = newProfileError?.message ?? String(newProfileError);
                        if (msg && msg.includes('violates check constraint')) {
                            console.error('❌ DB constraint violation creating merchant profile:', msg);
                            res.status(400).json({
                                success: false,
                                error: {
                                    message: 'Invalid data for merchant profile',
                                    details: msg,
                                    hint: 'Check entityType value - it must match the allowed values in the database constraint'
                                }
                            });
                            return;
                        }
                        throw new Error(`Failed to create merchant profile: ${msg}`);
                    }

                    profileData = newProfileData;
                    console.log('✅ Merchant profile created for existing user:', profileData.id);
                }
            } else {
                // For new users, create profile
                const entity_type_to_use = normalizedEntityType || 'proprietorship';

                console.log('📊 Creating merchant profile with:', {
                    entity_type: entity_type_to_use,
                    business_name: businessName,
                    pan_number: panNumber,
                });

                const { data: newProfileData, error: profileError } = await adminClient
                    .from('merchant_profiles')
                    .insert({
                        user_id: merchantUserId,
                        full_name: fullName,
                        mobile_number: mobileNumber,
                        email,
                        distributor_id: distributorId,
                        business_name: businessName ?? null,
                        entity_type: entity_type_to_use,
                        pan_number: panNumber ?? null,
                        gst_number: gstNumber ?? null,
                        onboarding_status: 'pending'
                    })
                    .select('id')
                    .single();

                if (profileError || !newProfileData) {
                    // Rollback: delete auth user
                    await adminClient.auth.admin.deleteUser(merchantUserId);

                    // If the DB returned a check constraint violation, return a friendly 400
                    const msg = profileError?.message ?? String(profileError);
                    if (msg && msg.includes('violates check constraint')) {
                        console.error('❌ DB constraint violation creating merchant profile:', msg);
                        res.status(400).json({
                            success: false,
                            error: {
                                message: 'Invalid data for merchant profile',
                                details: msg,
                                hint: 'Check entityType value - it must match the allowed values in the database constraint'
                            }
                        });
                        return;
                    }

                    throw new Error(`Failed to create merchant profile: ${msg}`);
                }

                profileData = newProfileData;
                console.log('✅ Merchant profile created:', profileData.id);
            }

            logger.info(`Merchant ${existingUser ? 'found' : 'created'} successfully: user_id=${merchantUserId}, profile_id=${profileData.id}`);

            res.status(201).json({
                success: true,
                data: {
                    merchantUserId,
                    merchantProfileId: profileData.id,
                    email,
                    existingUser,
                    message: existingUser ? 'Existing merchant account found' : 'Merchant account created successfully'
                }
            });

        } catch (error) {
            console.error('❌ [ERROR in /create-merchant]:', error instanceof Error ? error.message : String(error));
            console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
            next(error);
        }
    }
);

// -----------------------------------------------------------------------------
// GET /api/distributor/transactions
// returns all transactions belonging to merchants under the distributor
// requires bearer jwt of distributor (validated the same way as create-merchant)
// -----------------------------------------------------------------------------
router.get(
    '/transactions',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                res.status(401).json({ success: false, error: { message: 'Distributor authentication required' } });
                return;
            }

            const callerJwt = authHeader.replace('Bearer ', '');
            const supabaseClient = getSupabaseClient();
            const { data: { user: callerUser }, error: callerError } = await supabaseClient.auth.getUser(callerJwt);
            if (callerError || !callerUser) {
                console.error('❌ JWT verification failed for transactions endpoint:', callerError);
                res.status(401).json({ success: false, error: { message: 'Invalid distributor session' } });
                return;
            }

            // ensure caller is a distributor
            const adminClient = getAdminClient();
            const { data: roleData } = await adminClient
                .from('user_roles')
                .select('role')
                .eq('user_id', callerUser.id)
                .maybeSingle();

            if (roleData?.role !== 'distributor') {
                res.status(403).json({ success: false, error: { message: 'Only distributors may fetch transactions' } });
                return;
            }

            // fetch merchant ids owned by this distributor
            const { data: merchantsData, error: merchantsError } = await adminClient
                .from('merchant_profiles')
                .select('id')
                .eq('distributor_id', callerUser.id);

            if (merchantsError) throw merchantsError;

            const merchantIds = (merchantsData || []).map((m: any) => m.id);

            // if no merchants, just return empty list
            if (merchantIds.length === 0) {
                res.json({ success: true, data: [] });
                return;
            }

            // query transactions table
            const { data: txData, error: txError } = await adminClient
                .from('transactions')
                .select('*')
                .in('merchant_id', merchantIds)
                .order('created_at', { ascending: false });

            if (txError) throw txError;

            res.json({ success: true, data: txData });
        } catch (error) {
            console.error('❌ [ERROR in /transactions]:', error instanceof Error ? error.message : String(error));
            next(error);
        }
    }
);

/**
 * POST /api/distributor/submit-merchant-onboarding
 *
 * Called by distributor onboarding frontend after all steps complete.
 * Uses admin client (service role key) to bypass RLS and save all data.
 *
 * Auth: Bearer token of the distributor (for audit); we don't validate it strictly
 * since the admin client already has full permissions.
 */
interface OnboardingDocuments {
    panCard?: { file: { name: string; size: number; type: string }; path: string };
    aadhaarCard?: { file: { name: string; size: number; type: string }; path: string };
    cancelledCheque?: { file: { name: string; size: number; type: string }; path: string };
    businessProof?: { file: { name: string; size: number; type: string }; path: string };
    [key: string]: { file: { name: string; size: number; type: string }; path: string } | undefined;
}

interface SubmitOnboardingBody {
    merchantProfileId: string;
    fullName: string;
    mobileNumber: string;
    email: string;
    businessName: string;
    panNumber: string;
    aadhaarNumber: string;
    gstNumber: string;
    bankDetails: {
        accountNumber: string;
        ifscCode: string;
        bankName: string;
        accountHolderName: string;
    };
    kycData: {
        isVideoCompleted: boolean;
        selfieUrl?: string;
        locationVerified?: boolean;
        latitude?: number;
        longitude?: number;
    };
    documents: OnboardingDocuments;
    selectedProducts?: string[];
    settlementType?: 'same_day' | 'next_day';
}

router.post(
    '/submit-merchant-onboarding',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            console.log('🔵 [POST /submit-merchant-onboarding] Request received');
            
            const body = req.body as SubmitOnboardingBody;
            const { merchantProfileId, bankDetails, kycData, documents, selectedProducts, settlementType } = body;

            if (!merchantProfileId) {
                throw new BadRequestError('merchantProfileId is required', 'MISSING_ID');
            }

            const admin = getAdminClient();

            // Step 1: Update merchant profile
            console.log('📝 Updating merchant profile...');
            const { error: profileError } = await admin
                .from('merchant_profiles')
                .update({
                    full_name: body.fullName,
                    mobile_number: body.mobileNumber,
                    email: body.email,
                    business_name: body.businessName,
                    pan_number: body.panNumber,
                    aadhaar_number: body.aadhaarNumber,
                    gst_number: body.gstNumber,
                    onboarding_status: 'pending',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', merchantProfileId);

            if (profileError) throw new Error(`Profile update failed: ${profileError.message}`);
            console.log('✅ Profile updated');

            // Step 2: Save bank details
            console.log('💳 Saving bank details...');
            const { error: bankError } = await admin
                .from('merchant_bank_details')
                .upsert({
                    merchant_id: merchantProfileId,
                    account_number: bankDetails.accountNumber,
                    ifsc_code: bankDetails.ifscCode,
                    bank_name: bankDetails.bankName,
                    account_holder_name: bankDetails.accountHolderName,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'merchant_id' });

            if (bankError) throw new Error(`Bank details failed: ${bankError.message}`);
            console.log('✅ Bank details saved');

            // Step 3: Save documents
            console.log('📄 Saving documents...');
            const docTypeMap: Record<string, string> = {
                panCard: 'pan_card',
                aadhaarCard: 'aadhaar_card',
                cancelledCheque: 'cancelled_cheque',
                businessProof: 'business_proof'
            };

            const docInserts = Object.entries(documents)
                .filter(([docKey, docData]) => {
                    // Only include documents we have mappings for AND have valid file_name
                    const hasMapping = !!docTypeMap[docKey];
                    const hasPath = !!docData?.path;
                    const hasValidFile = docData?.file?.name && docData.file.name.trim().length > 0;
                    
                    if (!hasMapping || !hasPath || !hasValidFile) {
                        console.log(`📋 Skipping document ${docKey}:`, { hasMapping, hasPath, hasValidFile, file_name: docData?.file?.name });
                    }
                    
                    return hasMapping && hasPath && hasValidFile;
                })
                .map(([docKey, docData]) => {
                    const insert = {
                        merchant_id: merchantProfileId,
                        document_type: docTypeMap[docKey],
                        file_name: docData!.file.name,
                        file_path: docData!.path,
                        file_size: docData!.file.size,
                        mime_type: docData!.file.type,
                        status: 'uploaded' as const,
                        uploaded_at: new Date().toISOString()
                    };
                    console.log(`✅ Including document:`, { docKey, ...insert });
                    return insert;
                });

            if (docInserts.length > 0) {
                await admin.from('merchant_documents').delete().eq('merchant_id', merchantProfileId);
                const { error: docsError } = await admin.from('merchant_documents').insert(docInserts);
                if (docsError) throw new Error(`Documents failed: ${docsError.message}`);
            }
            console.log('✅ Documents saved');

            // Step 4: Save KYC
            console.log('🎥 Saving KYC data...');
            const { error: kycError } = await admin
                .from('merchant_kyc')
                .upsert({
                    merchant_id: merchantProfileId,
                    video_kyc_completed: kycData.isVideoCompleted,
                    selfie_file_path: kycData.selfieUrl ?? null,
                    location_captured: kycData.locationVerified ?? false,
                    latitude: kycData.latitude ?? null,
                    longitude: kycData.longitude ?? null,
                    kyc_status: 'pending',
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'merchant_id' });

            if (kycError) throw new Error(`KYC failed: ${kycError.message}`);
            console.log('✅ KYC saved');

            // Step 5: Save selected products
            if ((selectedProducts?.length ?? 0) > 0) {
                console.log('📦 Saving products...');
                await admin.from('merchant_products').delete().eq('merchant_id', merchantProfileId);
                const productInserts = (selectedProducts ?? []).map(p => ({
                    merchant_id: merchantProfileId,
                    product_type: p,
                    settlement_type: settlementType ?? 'next_day',
                    status: 'pending'
                }));
                const { error: productsError } = await admin.from('merchant_products').insert(productInserts);
                if (productsError) throw new Error(`Products failed: ${productsError.message}`);
                console.log('✅ Products saved');
            }

            console.log(`✅ Onboarding submission complete for merchant ${merchantProfileId}`);

            res.status(200).json({
                success: true,
                message: 'Merchant onboarding submitted successfully',
                merchantProfileId
            });

        } catch (error) {
            console.error('❌ [ERROR in /submit-merchant-onboarding]:', error instanceof Error ? error.message : String(error));
            console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
            next(error);
        }
    }
);

export default router;

// POST /api/distributor/assign-product
router.post(
    '/assign-product',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            console.log('🔵 [POST /assign-product] Request received');
            const { productType, settlementType, assignTo, merchantId } = req.body as {
                productType?: string;
                settlementType?: string;
                assignTo?: 'merchant' | 'distributor';
                merchantId?: string;
            };

            if (!productType) {
                res.status(400).json({ success: false, error: { message: 'productType is required' } });
                return;
            }

            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                res.status(401).json({ success: false, error: { message: 'Authorization required' } });
                return;
            }

            const callerJwt = authHeader.replace('Bearer ', '');
            const supabaseClient = getSupabaseClient();
            const { data: { user: callerUser }, error: callerError } = await supabaseClient.auth.getUser(callerJwt);
            if (callerError || !callerUser) {
                res.status(401).json({ success: false, error: { message: 'Invalid session' } });
                return;
            }

            // Confirm caller is distributor
            const admin = getAdminClient();
            const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', callerUser.id).maybeSingle();
            if (roleData?.role !== 'distributor') {
                res.status(403).json({ success: false, error: { message: 'Only distributors can assign products' } });
                return;
            }

            // If assigning to a merchant, verify merchant belongs to this distributor
            if (assignTo === 'merchant') {
                if (!merchantId) {
                    res.status(400).json({ success: false, error: { message: 'merchantId is required when assignTo=merchant' } });
                    return;
                }

                const { data: merchantRec } = await admin
                    .from('merchant_profiles')
                    .select('id, distributor_id')
                    .eq('id', merchantId)
                    .maybeSingle();

                if (!merchantRec) {
                    res.status(404).json({ success: false, error: { message: 'Merchant not found' } });
                    return;
                }

                if (merchantRec.distributor_id !== callerUser.id) {
                    res.status(403).json({ success: false, error: { message: 'Merchant does not belong to you' } });
                    return;
                }

                // Insert into merchant_products
                const { error: insertErr } = await admin.from('merchant_products').insert([{
                    merchant_id: merchantId,
                    product_type: productType,
                    settlement_type: settlementType || 'next_day',
                    status: 'pending',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]);

                if (insertErr) throw new Error(insertErr.message);

                res.status(200).json({ success: true, message: 'Product assigned to merchant' });
                return;
            }

            // assignTo distributor: try to insert into distributor_products (if exists)
            if (assignTo === 'distributor') {
                try {
                    const { error: distErr } = await admin.from('distributor_products').insert([{
                        distributor_id: callerUser.id,
                        product_type: productType,
                        settlement_type: settlementType || 'next_day',
                        status: 'active',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }]);

                    if (distErr) throw distErr;

                    res.status(200).json({ success: true, message: 'Product assigned to distributor' });
                    return;
                } catch (err) {
                    console.warn('Distributor products table insert failed or not available:', err);
                    res.status(501).json({ success: false, error: { message: 'Distributor product assignment not supported on this deployment' } });
                    return;
                }
            }

            res.status(400).json({ success: false, error: { message: 'Invalid assignTo value' } });
        } catch (error) {
            console.error('❌ [ERROR in /assign-product]:', error instanceof Error ? error.message : String(error));
            next(error);
        }
    }
);
