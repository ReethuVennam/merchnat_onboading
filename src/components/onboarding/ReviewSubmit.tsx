import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import MERCHANT_AGREEMENT_TERMS from '@/constants/merchantAgreementTerms';
import { Separator } from '@/components/ui/separator';
import {
    User,
    Building,
    CreditCard,
    FileText,
    CheckCircle,
    Shield,
    AlertCircle,
    Package,
    IndianRupee,
    PenTool
} from 'lucide-react';
import { OnboardingData } from '@/pages/EnhancedMerchantOnboarding';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import type { Product, SelectedProduct, CostSummary } from '@/types/products';
import { formatPrice } from '@/types/products';

interface ReviewSubmitProps {
    data: OnboardingData;
    onDataChange: (data: Partial<OnboardingData>) => void;
    onSubmit: () => Promise<void>;
    onPrev: () => void;
    isSubmitting?: boolean;
}

export const ReviewSubmit: React.FC<ReviewSubmitProps> = ({
    data,
    onDataChange,
    onSubmit,
    onPrev,
    isSubmitting = false,
}) => {
    const { toast } = useToast();

    // Agreement dialog state
    const [showAgreementDialog, setShowAgreementDialog] = useState(false);
    const [hasReadAgreement, setHasReadAgreement] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [signature, setSignature] = useState('');
    const [signingAgreement, setSigningAgreement] = useState(false);

    // Products state (fetch from data or API)
    const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
    const [costs, setCosts] = useState<CostSummary>({
        monthlyTotal: 0,
        onetimeTotal: 0,
        integrationTotal: 0,
        grandTotal: 0,
        breakdown: { monthly: [], onetime: [], integration: [] }
    });
    const [loadingProducts, setLoadingProducts] = useState(false);

    // Fetch selected products when component mounts
    React.useEffect(() => {
        fetchSelectedProducts();
    }, []);

    const fetchSelectedProducts = async () => {
        setLoadingProducts(true);
        try {
            const response = await apiClient.get('/api/products/merchant/selected-products');
            if (response.data?.selectedProducts) {
                setSelectedProducts(response.data.selectedProducts);
                setCosts(response.data.costs);
            }
        } catch (error) {
            console.error('Error fetching selected products:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to load selected products',
            });
        } finally {
            setLoadingProducts(false);
        }
    };

    const handleSignAgreement = async () => {
        // Validation
        if (!hasReadAgreement) {
            toast({
                variant: 'destructive',
                title: 'Agreement Not Read',
                description: 'Please scroll through and read the entire agreement',
            });
            return;
        }

        if (!agreedToTerms) {
            toast({
                variant: 'destructive',
                title: 'Terms Not Accepted',
                description: 'Please check the box to agree to the terms and conditions',
            });
            return;
        }

        if (!signature.trim()) {
            toast({
                variant: 'destructive',
                title: 'Signature Required',
                description: 'Please enter your full name as signature',
            });
            return;
        }

        setSigningAgreement(true);
        try {
            // Call API to sign agreement
            await apiClient.post('/api/products/merchant/sign-agreement', {
                signatureName: signature,
                selectedProducts,
                costs: {
                    monthlyTotal: costs.monthlyTotal,
                    onetimeTotal: costs.onetimeTotal,
                    integrationTotal: costs.integrationTotal,
                },
            });

            // Mark agreement as signed
            onDataChange({ agreementAccepted: true });
            setShowAgreementDialog(false);

            toast({
                title: 'Agreement Signed',
                description: 'Your merchant agreement has been signed successfully',
            });
        } catch (error: any) {
            console.error('Error signing agreement:', error);
            toast({
                variant: 'destructive',
                title: 'Signature Failed',
                description: error?.message || 'Failed to sign agreement. Please try again.',
            });
        } finally {
            setSigningAgreement(false);
        }
    };

    const handleSubmit = async () => {
        console.log('Documents state:', data.documents);
        console.log('Has panCard?', !!data.documents?.panCard);
        console.log('Has aadhaarCard?', !!data.documents?.aadhaarCard);
        console.log('Has cancelledCheque?', !!data.documents?.cancelledCheque);

        if (!data.agreementAccepted) {
            toast({
                variant: 'destructive',
                title: 'Agreement Required',
                description: 'Please sign the merchant agreement before submitting',
            });
            return;
        }

        if (!isSubmitting) {
            await onSubmit();
        }
    };

    const getUploadedDocumentCount = () => {
        const docs = data.documents;
        return Object.values(docs).filter(doc => doc !== undefined).length;
    };

    // Track when user scrolls to bottom of agreement
    const handleAgreementScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const element = e.currentTarget;
        const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
        if (isAtBottom && !hasReadAgreement) {
            setHasReadAgreement(true);
        }
    };

    return (
        <div className="space-y-8">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">
                    Review & Submit
                </h2>
                <p className="text-muted-foreground">
                    Please review all your information before submitting
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Personal & Business Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            Personal Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Full Name:</span>
                            <span className="font-medium">{data.fullName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Mobile:</span>
                            <span className="font-medium">{data.mobileNumber}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Email:</span>
                            <span className="font-medium">{data.email}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">PAN:</span>
                            <span className="font-medium">{data.panNumber}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Aadhaar:</span>
                            <span className="font-medium">
                                {data.aadhaarNumber.replace(/(\d{4})(\d{4})(\d{4})/, '****-****-$3')}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building className="h-5 w-5 text-primary" />
                            Business Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Business Name:</span>
                            <span className="font-medium">{data.business_name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">GST Number:</span>
                            <span className="font-medium">{data.gstNumber}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Bank Details */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-primary" />
                            Bank Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Bank Name:</span>
                            <span className="font-medium">{data.bankDetails.bankName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Account Number:</span>
                            <span className="font-medium">
                                ****{data.bankDetails.accountNumber.slice(-4)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">IFSC Code:</span>
                            <span className="font-medium">{data.bankDetails.ifscCode}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Verification Status */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            Verification Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">KYC Verification:</span>
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-primary" />
                                <span className="text-primary font-medium">Completed</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Video KYC:</span>
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-primary" />
                                <span className="text-primary font-medium">Completed</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Location Verified:</span>
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-primary" />
                                <span className="text-primary font-medium">Completed</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Documents:</span>
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-primary" />
                                <span className="text-primary font-medium">
                                    {getUploadedDocumentCount()} Uploaded
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Selected Products Summary */}
            {selectedProducts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            Selected Products & Services
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 mb-4">
                            {selectedProducts.map((product, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                                    <span className="font-medium">{product.product_name}</span>
                                    <div className="text-right">
                                        <div className="font-semibold text-primary">
                                            {formatPrice(product.price)}
                                        </div>
                                        <div className="text-xs text-muted-foreground capitalize">
                                            {product.pricing_type}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Separator className="my-4" />

                        <div className="grid grid-cols-3 gap-4">
                            {costs.monthlyTotal > 0 && (
                                <div className="text-center">
                                    <div className="text-xs text-muted-foreground mb-1">Monthly</div>
                                    <div className="text-lg font-bold text-primary">
                                        {formatPrice(costs.monthlyTotal)}
                                        <span className="text-xs font-normal">/mo</span>
                                    </div>
                                </div>
                            )}
                            {costs.onetimeTotal > 0 && (
                                <div className="text-center">
                                    <div className="text-xs text-muted-foreground mb-1">One-Time</div>
                                    <div className="text-lg font-bold text-green-600">
                                        {formatPrice(costs.onetimeTotal)}
                                    </div>
                                </div>
                            )}
                            {costs.integrationTotal > 0 && (
                                <div className="text-center">
                                    <div className="text-xs text-muted-foreground mb-1">Integration</div>
                                    <div className="text-lg font-bold text-orange-600">
                                        {formatPrice(costs.integrationTotal)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Merchant Agreement - SIGN HERE */}
            <Card className={data.agreementAccepted ? 'border-green-500 bg-green-50' : 'border-primary'}>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Merchant Service Agreement
                        </div>
                        {data.agreementAccepted && (
                            <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle className="h-5 w-5" />
                                <span className="text-sm font-medium">Signed</span>
                            </div>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!data.agreementAccepted ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-yellow-800">
                                    <strong>Action Required:</strong> Please review and sign the merchant service
                                    agreement to continue. This includes your selected products and pricing terms.
                                </div>
                            </div>

                            <Button
                                onClick={() => setShowAgreementDialog(true)}
                                className="w-full"
                                size="lg"
                            >
                                <FileText className="h-5 w-5 mr-2" />
                                Review & Sign Agreement
                            </Button>
                        </div>
                    ) : (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 text-green-800 mb-2">
                                <CheckCircle className="h-5 w-5" />
                                <span className="font-semibold">Agreement Signed Successfully</span>
                            </div>
                            <p className="text-sm text-green-700">
                                You have accepted the terms and conditions. You can now proceed with submission.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-3"
                                onClick={() => setShowAgreementDialog(true)}
                            >
                                View Signed Agreement
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Agreement Dialog */}
            <Dialog open={showAgreementDialog} onOpenChange={setShowAgreementDialog}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Merchant Terms and Conditions</DialogTitle>
                        <DialogDescription>
                            One78 SabbPe Technology Solutions India Private Limited
                        </DialogDescription>
                    </DialogHeader>

                    {/* Scrollable Agreement Content */}
                    <div
                        className="flex-1 overflow-y-auto border rounded-lg p-6 bg-gray-50"
                        onScroll={handleAgreementScroll}
                    >
                        <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-gray-800">
                            {MERCHANT_AGREEMENT_TERMS}
                        </pre>
                    </div>

                    {/* Signature Section */}
                    {!data.agreementAccepted && (
                        <div className="border-t pt-4 space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="read-agreement"
                                    checked={hasReadAgreement}
                                    onCheckedChange={(checked) => setHasReadAgreement(!!checked)}
                                />
                                <Label
                                    htmlFor="read-agreement"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    I confirm that I have read the entire agreement
                                    {!hasReadAgreement && " (scroll to bottom)"}
                                </Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="agree-terms"
                                    checked={agreedToTerms}
                                    onCheckedChange={(checked) => setAgreedToTerms(!!checked)}
                                    disabled={!hasReadAgreement}
                                />
                                <Label
                                    htmlFor="agree-terms"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    I agree to all terms and conditions stated in this agreement
                                </Label>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="signature" className="text-sm font-medium">
                                    Digital Signature (Enter your full name)
                                </Label>
                                <div className="relative">
                                    <PenTool className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="signature"
                                        type="text"
                                        placeholder="Enter your full legal name"
                                        value={signature}
                                        onChange={(e) => setSignature(e.target.value)}
                                        disabled={!agreedToTerms}
                                        className="pl-10"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    By entering your name, you agree that this constitutes a legal signature
                                </p>
                            </div>

                            <div className="flex gap-3 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowAgreementDialog(false);
                                        setHasReadAgreement(false);
                                        setAgreedToTerms(false);
                                        setSignature('');
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSignAgreement}
                                    disabled={!hasReadAgreement || !agreedToTerms || !signature.trim() || signingAgreement}
                                    className="bg-primary"
                                >
                                    {signingAgreement ? (
                                        <>Signing...</>
                                    ) : (
                                        <>
                                            <PenTool className="h-4 w-4 mr-2" />
                                            Sign Agreement
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* If already signed, just show close button */}
                    {data.agreementAccepted && (
                        <div className="border-t pt-4 flex justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setShowAgreementDialog(false)}
                            >
                                Close
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Navigation */}
            <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={onPrev} className="px-8">
                    Back
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={!data.agreementAccepted || isSubmitting}
                    className="px-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                    style={{ background: 'var(--gradient-primary)' }}
                >
                    {isSubmitting ? 'Submitting...' : 'Submit for Verification'}
                </Button>
            </div>
        </div>
    );
};

export default ReviewSubmit;
