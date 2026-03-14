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
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

interface ReviewSubmitProps {
    data: OnboardingData;
    onDataChange: (data: Partial<OnboardingData>) => void;
    onSubmit: () => Promise<void>;
    onPrev: () => void;
    isSubmitting?: boolean;
}
interface Ticket {
  id: string;
  title: string;
  status: string;
  created_at: string;
}
export const ReviewSubmit: React.FC<ReviewSubmitProps> = ({
    data,
    onDataChange,
    onSubmit,
    onPrev,
    isSubmitting = false,
}) => {
    const { toast } = useToast();

    const { user } = useAuth();
const merchantId = user?.id;

// Ticket states
const [tickets, setTickets] = useState<Ticket[]>([]);
const [ticketModalOpen, setTicketModalOpen] = useState(false);
const [raiseModalOpen, setRaiseModalOpen] = useState(false);
const [loadingTickets, setLoadingTickets] = useState(false);

const [title, setTitle] = useState('');
const [description, setDescription] = useState('');
const [loading, setLoading] = useState(false);

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

    const handleRaiseTicket = async () => {
  if (!title || !description || !merchantId) return;

  setLoading(true);

  try {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(
      'http://localhost:5000/api/tickets/merchant',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          merchant_id: merchantId,
          title,
          description,
        }),
      }
    );

    if (!response.ok) {
      console.error('Ticket creation failed');
      return;
    }

    setTitle('');
    setDescription('');
    setRaiseModalOpen(false);

    fetchTickets();

  } catch (error) {
    console.error('Raise ticket error:', error);
  } finally {
    setLoading(false);
  }
};

const fetchTickets = async () => {
  if (!merchantId) return;

  setLoadingTickets(true);

  try {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(
      `http://localhost:5000/api/tickets/merchant/${merchantId}`,
      {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch tickets');
      return;
    }

    const result = await response.json();

    setTickets(result || []);

  } catch (error) {
    console.error('Fetch tickets error:', error);
  } finally {
    setLoadingTickets(false);
  }
};
React.useEffect(() => {
  if (ticketModalOpen) {
    fetchTickets();
  }
}, [ticketModalOpen]);

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
                            <span className="font-medium">{data.businessName}</span>
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
           
            {/* Ticket Buttons */}
<div className="flex gap-4">
  <Button onClick={() => setRaiseModalOpen(true)}>
    Raise Support Ticket
  </Button>

  <Button onClick={() => setTicketModalOpen(true)}>
    View My Tickets
  </Button>
</div>

{/* Raise Ticket Modal */}
{raiseModalOpen && (
  <div className="p-6 bg-white border rounded-xl shadow-lg">
    <h3 className="text-lg font-semibold mb-4">
      Raise Support Ticket
    </h3>

    <input
      type="text"
      placeholder="Issue title"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      className="w-full border px-3 py-2 rounded mb-3"
    />

    <textarea
      placeholder="Describe your issue..."
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      className="w-full border px-3 py-2 rounded mb-3"
    />

    <div className="flex gap-3">
      <Button onClick={handleRaiseTicket} disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Ticket'}
      </Button>

      <Button
        variant="outline"
        onClick={() => setRaiseModalOpen(false)}
      >
        Cancel
      </Button>
    </div>
  </div>
)}

{/* View Tickets Modal */}
{ticketModalOpen && (
  <div className="p-6 bg-white border rounded-xl shadow-lg mt-6">
    <h3 className="text-lg font-semibold mb-4">
      My Support Tickets
    </h3>

    {loadingTickets ? (
      <div>Loading...</div>
    ) : tickets.length === 0 ? (
      <div>No tickets raised yet.</div>
    ) : (
      <div className="space-y-3">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="p-4 border rounded-lg">
            <div className="font-semibold">
              {ticket.title}
            </div>

            <div className="text-sm text-gray-500">
              Status: {ticket.status}
            </div>

            <div className="text-xs text-gray-400">
              ID: {ticket.id}
            </div>
          </div>
        ))}
      </div>
    )}

    <Button
      className="mt-4"
      variant="outline"
      onClick={() => setTicketModalOpen(false)}
    >
      Close
    </Button>
  </div>
)}

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
             {/* WhatsApp Support (bottom of onboarding step) */}
      <div style={{marginTop: '2rem', textAlign: 'center'}}>
        <button
          onClick={() => {
            const message = `Hello SabPe Support Team,\n\nI am currently in the process of completing my merchant onboarding application and have encountered an issue that is preventing me from proceeding further.\n\nI have carefully reviewed the information provided, but I am still unable to resolve the problem on my own. I kindly request your assistance in guiding me through the necessary steps to complete the onboarding successfully.\n\nPlease let me know the required actions or documents, if any.\n\nThank you for your time and support.`;
            const encodedMessage = encodeURIComponent(message);
            const whatsappUrl = `https://wa.me/919958750013?text=${encodedMessage}`;
            window.open(whatsappUrl, '_blank');
          }}
          style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#25D366', color: 'white', fontWeight: 600, fontSize: 16, padding: '12px 28px', borderRadius: 8, textDecoration: 'none', marginTop: 8, gap: '10px', boxShadow: '0 2px 8px rgba(37,211,102,0.15)', border: 'none', cursor: 'pointer'}}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><g><path d="M17.472 14.382c-.297-.149-1.758-.867-2.031-.967-.273-.099-.471-.148-.67.15-.198.297-.767.967-.94 1.166-.173.198-.347.223-.644.075-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.372-.01-.571-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.099 3.2 5.077 4.363.71.306 1.263.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.288.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#fff"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12.004 2.003c-5.514 0-9.997 4.483-9.997 9.997 0 1.762.462 3.484 1.34 4.997L2.003 22l5.122-1.342c1.46.799 3.09 1.222 4.879 1.222 5.514 0 9.997-4.483 9.997-9.997 0-2.662-1.037-5.164-2.921-7.047-1.884-1.884-4.386-2.921-7.048-2.921zm-8.063 14.47c-.807-1.357-1.237-2.908-1.237-4.473 0-4.411 3.588-7.999 7.999-7.999 2.137 0 4.146.832 5.656 2.343 1.511 1.51 2.343 3.519 2.343 5.656 0 4.411-3.588 7.999-7.999 7.999-1.437 0-2.84-.387-4.062-1.126l-.282-.167-3.718.974.8-3.207-.2-.304z" fill="#fff"/></g></svg>
          WhatsApp Support
        </button>
      </div>
        </div>
    );
};

export default ReviewSubmit;


