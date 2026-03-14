// src/pages/DistributorMerchantOnboarding.tsx
//
// This page lets a distributor complete the full merchant onboarding
// on behalf of a merchant they just created. It reuses all the existing
// onboarding step components but overrides the user_id context so that
// all Supabase writes target the MERCHANT's profile, not the distributor.

import React, { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';

// Reuse all existing step components
import { WelcomeScreen } from '@/components/onboarding/WelcomeScreen';
import MerchantRegistration from '@/components/onboarding/MerchantRegistration';
import { KYCVerification } from '@/components/onboarding/KYCVerification';
import { BankDetails } from '@/components/onboarding/BankDetails';
import { ProductSelection } from '@/components/onboarding/ProductSelection';
import { ReviewSubmit } from '@/components/onboarding/ReviewSubmit';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingData {
    fullName: string;
    mobileNumber: string;
    email: string;
    panNumber: string;
    aadhaarNumber: string;
    businessName: string;
    gstNumber: string;
    hasGST: boolean;
    selectedProducts?: string[];
    settlementType?: 'same_day' | 'next_day';
    bankDetails: {
        accountNumber: string;
        ifscCode: string;
        bankName: string;
        accountHolderName: string;
        confirmAccountNumber?: string;
    };
    kycData: {
        isVideoCompleted: boolean;
        selfieUrl?: string;
        locationVerified?: boolean;
        latitude?: number;
        longitude?: number;
    };
    documents: {
        panCard?: { file: File; path: string };
        aadhaarCard?: { file: File; path: string };
        cancelledCheque?: { file: File; path: string };
        businessProof?: { file: File; path: string };
        [key: string]: { file: File; path: string } | undefined;
    };
    agreementAccepted: boolean;
    currentStep: number;
}

// State passed via navigation from DistributorDashboard after merchant creation
export interface DistributorMerchantState {
    merchantUserId: string;
    merchantProfileId: string;
    merchantEmail: string;
    merchantPassword: string;   // shown to distributor at end so they can hand over
    distributorId: string;
}

interface StepInfo {
    id: string;
    title: string;
    description: string;
    component: React.ComponentType<BaseStepProps>;
}

interface BaseStepProps {
    data?: OnboardingData | Record<string, unknown>;
    onDataChange?: (newData: Partial<OnboardingData> | Record<string, unknown>) => void;
    onNext?: (() => void) | ((data?: unknown) => void);
    onPrevious?: () => void;
    onPrev?: () => void;
    onGoToStep?: (stepId: string) => void;
    onSubmit?: () => Promise<void>;
    currentStep?: string;
    merchantProfile?: Record<string, unknown>;
    isSubmitting?: boolean;
}

const STEPS: StepInfo[] = [
    { id: 'welcome',      title: 'Welcome',          description: 'Introduction',             component: WelcomeScreen as unknown as React.ComponentType<BaseStepProps> },
    { id: 'products',     title: 'Products',          description: 'Choose Products',          component: ProductSelection as unknown as React.ComponentType<BaseStepProps> },
    { id: 'registration', title: 'Registration',      description: 'Business Details',         component: MerchantRegistration as unknown as React.ComponentType<BaseStepProps> },
    { id: 'kyc',          title: 'KYC',               description: 'Identity Verification',    component: KYCVerification as unknown as React.ComponentType<BaseStepProps> },
    { id: 'bank-details', title: 'Bank Details',      description: 'Settlement Setup',         component: BankDetails as unknown as React.ComponentType<BaseStepProps> },
    { id: 'review',       title: 'Review & Submit',   description: 'Final Review',             component: ReviewSubmit as unknown as React.ComponentType<BaseStepProps> },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function DistributorMerchantOnboarding() {
    const location = useLocation();
    const navigate = useNavigate();
    const { toast } = useToast();

    // Get merchant context from URL query params (new tab support) or location.state (legacy)
    const queryParams = new URLSearchParams(location.search);
    const merchantState: DistributorMerchantState | null = {
        merchantUserId: queryParams.get('merchantUserId') || (location.state as any)?.merchantUserId || '',
        merchantProfileId: queryParams.get('merchantProfileId') || (location.state as any)?.merchantProfileId || '',
        merchantEmail: queryParams.get('merchantEmail') || (location.state as any)?.merchantEmail || '',
        merchantPassword: queryParams.get('merchantPassword') || (location.state as any)?.merchantPassword || '',
        distributorId: queryParams.get('distributorId') || (location.state as any)?.distributorId || '',
    };

    const [stepIndex, setStepIndex] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [onboardingData, setOnboardingData] = useState<OnboardingData>({
        fullName: queryParams.get('merchantName') || '',
        mobileNumber: '',
        email: merchantState.merchantEmail || '',
        panNumber: '',
        aadhaarNumber: '',
        businessName: '',
        gstNumber: '',
        hasGST: false,
        selectedProducts: [],
        settlementType: undefined,
        bankDetails: { accountNumber: '', ifscCode: '', bankName: '', accountHolderName: '' },
        kycData: { isVideoCompleted: false, locationVerified: false },
        documents: {},
        agreementAccepted: false,
        currentStep: 0,
    });

    // Guard: if no merchant state, go back to distributor dashboard
    useEffect(() => {
        if (!merchantState?.merchantUserId) {
            toast({ title: 'Error', description: 'No merchant context found. Create a merchant first.', variant: 'destructive' });
            navigate('/distributor');
        }
    }, [merchantState, navigate, toast]);

    // Pre-fill name/mobile from merchant creation form data if available
    useEffect(() => {
        if (merchantState) {
            setOnboardingData(prev => ({
                ...prev,
                email: merchantState.merchantEmail,
            }));
        }
    }, [merchantState]);

    const handleDataChange = useCallback((newData: Partial<OnboardingData>) => {
        setOnboardingData(prev => ({
            ...prev,
            ...newData,
            documents: { ...(prev.documents ?? {}), ...(newData.documents ?? {}) }
        }));
    }, []);

    const currentStepId = STEPS[stepIndex]?.id ?? 'welcome';
    const progress = ((stepIndex) / (STEPS.length - 1)) * 100;

    const handleNext = useCallback(async () => {
        // Save registration data on registration step
        if (currentStepId === 'registration' && merchantState?.merchantUserId) {
            const { error } = await supabase
                .from('merchant_profiles')
                .update({
                    full_name: onboardingData.fullName,
                    mobile_number: onboardingData.mobileNumber,
                    business_name: onboardingData.businessName,
                    pan_number: onboardingData.panNumber,
                    aadhaar_number: onboardingData.aadhaarNumber,
                    gst_number: onboardingData.gstNumber,
                    onboarding_status: 'in_progress',
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', merchantState.merchantUserId);

            if (error) {
                toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
                return;
            }
        }

        setStepIndex(prev => Math.min(prev + 1, STEPS.length - 1));
    }, [currentStepId, merchantState, onboardingData, toast]);

    const handlePrev = useCallback(() => {
        setStepIndex(prev => Math.max(prev - 1, 0));
    }, []);

    const handleGoToStep = useCallback((stepId: string) => {
        const idx = STEPS.findIndex(s => s.id === stepId);
        if (idx >= 0) setStepIndex(idx);
    }, []);

    // ── Final Submit — writes to merchant's profile, not distributor ──────────
    const handleFinalSubmit = useCallback(async () => {
        if (!merchantState?.merchantUserId || !merchantState?.merchantProfileId) return;

        setIsSubmitting(true);
        try {
            // Validate required fields
            const errors: string[] = [];
            if (!onboardingData.fullName)                           errors.push('Full name');
            if (!onboardingData.mobileNumber)                       errors.push('Mobile number');
            if (!onboardingData.panNumber)                          errors.push('PAN number');
            if (!onboardingData.aadhaarNumber)                      errors.push('Aadhaar number');
            if (!onboardingData.businessName)                       errors.push('Business name');
            if (!onboardingData.bankDetails.accountNumber?.trim())  errors.push('Bank account number');
            if (!onboardingData.bankDetails.ifscCode?.trim())       errors.push('IFSC code');
            if (!onboardingData.bankDetails.bankName?.trim())       errors.push('Bank name');
            if (!onboardingData.bankDetails.accountHolderName?.trim()) errors.push('Account holder name');
            if (!onboardingData.kycData.isVideoCompleted)           errors.push('Video KYC');
            if (!onboardingData.kycData.locationVerified)           errors.push('Location verification');

            const requiredDocs = ['panCard', 'aadhaarCard', 'businessProof', 'cancelledCheque'];
            const missingDocs = requiredDocs.filter(d => !onboardingData.documents?.[d]?.path);
            if (missingDocs.length > 0) errors.push(`Documents: ${missingDocs.join(', ')}`);

            if (errors.length > 0) {
                toast({ title: 'Missing Required Fields', description: errors.join('; '), variant: 'destructive' });
                setIsSubmitting(false);
                return;
            }

            console.log('📤 Submitting merchant onboarding to backend...');

            // Call backend endpoint to save all data (uses service role, bypasses RLS)
            const response = await fetch(`${API_BASE_URL}/distributor/submit-merchant-onboarding`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token || '')}`
                },
                body: JSON.stringify({
                    merchantProfileId: merchantState.merchantProfileId,
                    fullName: onboardingData.fullName,
                    mobileNumber: onboardingData.mobileNumber,
                    email: onboardingData.email,
                    businessName: onboardingData.businessName,
                    panNumber: onboardingData.panNumber,
                    aadhaarNumber: onboardingData.aadhaarNumber,
                    gst_number: onboardingData.gstNumber,
                    bankDetails: onboardingData.bankDetails,
                    kycData: onboardingData.kycData,
                    documents: onboardingData.documents,
                    selectedProducts: onboardingData.selectedProducts,
                    settlementType: onboardingData.settlementType
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ Submission successful:', result);

            setSubmitted(true);

        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Submission failed. Please try again.';
            console.error('❌ Submission error:', msg);
            toast({ title: 'Submission Failed', description: msg, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    }, [merchantState, onboardingData, toast]);

    // ── Success screen ────────────────────────────────────────────────────────

    if (submitted && merchantState) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
                <Card className="w-full max-w-lg">
                    <CardContent className="pt-8 pb-8 text-center space-y-6">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-green-800">Application Submitted!</h2>
                            <p className="text-gray-600 mt-2">
                                The merchant onboarding has been completed and submitted for review.
                            </p>
                        </div>

                        {/* Credentials to hand over to merchant */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left space-y-2">
                            <p className="font-semibold text-blue-900 text-sm">Merchant Login Credentials</p>
                            <p className="text-sm text-blue-800">
                                <span className="font-medium">Email: </span>{merchantState.merchantEmail}
                            </p>
                            <p className="text-sm text-blue-800">
                                <span className="font-medium">Password: </span>
                                <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">
                                    {merchantState.merchantPassword}
                                </span>
                            </p>
                            <p className="text-xs text-blue-600 mt-2">
                                Share these credentials with the merchant so they can log in and view their dashboard.
                            </p>
                        </div>

                        <Button className="w-full" onClick={() => navigate('/distributor')}>
                            Back to Distributor Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!merchantState) return null;

    const CurrentStepComponent = STEPS[stepIndex].component;

    const stepProps: BaseStepProps = {
        data: onboardingData,
        onDataChange: handleDataChange,
        onNext: handleNext,
        onPrevious: handlePrev,
        onPrev: handlePrev,
        onGoToStep: handleGoToStep,
        onSubmit: handleFinalSubmit,
        currentStep: currentStepId,
        isSubmitting,
        merchantProfile: {
            id: merchantState?.merchantProfileId,
            user_id: merchantState?.merchantUserId,
            full_name: onboardingData.fullName,
            mobile_number: onboardingData.mobileNumber,
            email: onboardingData.email,
            pan_number: onboardingData.panNumber,
            aadhaar_number: onboardingData.aadhaarNumber,
            business_name: onboardingData.businessName,
            gst_number: onboardingData.gstNumber,
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b bg-white shadow-sm">
                <div className="flex items-center gap-4 px-6 py-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/distributor')}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-lg font-semibold">
                            Merchant Onboarding — {merchantState.merchantEmail}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Completing onboarding on behalf of merchant
                        </p>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="px-6 py-4 bg-white border-b">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                        Step {stepIndex + 1} of {STEPS.length}: {STEPS[stepIndex].title}
                    </span>
                    <span className="text-sm text-muted-foreground">{STEPS[stepIndex].description}</span>
                </div>
                <Progress value={progress} className="h-2" />

                {/* Step indicators */}
                <div className="flex justify-between mt-3">
                    {STEPS.map((step, idx) => (
                        <div
                            key={step.id}
                            className={`flex flex-col items-center text-xs gap-1 ${
                                idx < stepIndex ? 'text-green-600' :
                                idx === stepIndex ? 'text-primary font-semibold' :
                                'text-muted-foreground'
                            }`}
                        >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                idx < stepIndex ? 'bg-green-100 text-green-700' :
                                idx === stepIndex ? 'bg-primary text-white' :
                                'bg-gray-100 text-gray-500'
                            }`}>
                                {idx < stepIndex ? '✓' : idx + 1}
                            </div>
                            <span className="hidden md:block">{step.title}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Current Step */}
            <div className="max-w-4xl mx-auto p-6">
                {isSubmitting ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                        <p className="text-lg font-medium">Submitting application...</p>
                    </div>
                ) : (
                    <CurrentStepComponent {...stepProps} />
                )}
            </div>
        </div>
    );
}
