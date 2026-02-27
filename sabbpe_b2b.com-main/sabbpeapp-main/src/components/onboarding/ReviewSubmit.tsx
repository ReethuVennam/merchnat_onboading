import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { User, Building, CreditCard, FileText, CheckCircle, Shield } from 'lucide-react';
import { OnboardingData } from '@/pages/EnhancedMerchantOnboarding';
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
  const { user } = useAuth();
  const merchantId = user?.id;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [raiseModalOpen, setRaiseModalOpen] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAgreementChange = (checked: boolean | 'indeterminate') => {
    onDataChange({ agreementAccepted: checked === true });
  };

  const getUploadedDocumentCount = () => {
    const docs = data.documents ?? {};
    return Object.values(docs).filter(Boolean).length;
  };

  /* ============================================
     RAISE TICKET
  ============================================ */
  const handleRaiseTicket = async () => {
    if (!title || !description || !merchantId) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('http://localhost:5000/api/tickets/merchant', {
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
      });

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

  /* ============================================
     FETCH MERCHANT TICKETS
  ============================================ */
  const fetchTickets = async () => {
    if (!merchantId) return;
    setLoadingTickets(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`http://localhost:5000/api/tickets/merchant/${merchantId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

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

  useEffect(() => {
    if (ticketModalOpen) fetchTickets();
  }, [ticketModalOpen]);

  /* ============================================
     SUBMIT FOR VERIFICATION
  ============================================ */

  const handleSubmit = async () => {
  if (!data.agreementAccepted || isSubmitting || !merchantId) return;

  try {
    // 1️⃣ Update merchant profile
    const { error } = await supabase
      .from("merchant_profiles")
      .update({
        verification_submitted: true,
        onboarding_status: "submitted"
      }as any)
      .eq("user_id", merchantId);

    if (error) {
      console.error("Failed to update verification status:", error);
      return;
    }

    console.log("Verification submitted successfully");

    // 2️⃣ Continue existing submit logic
    await onSubmit();

  } catch (err) {
    console.error("Submit error:", err);
  }
};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">Review & Submit</h2>
        <p className="text-muted-foreground">
          Please review all your information before submitting
        </p>
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Full Name:</span> <span className="font-medium">{data.fullName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Mobile:</span> <span className="font-medium">{data.mobileNumber}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email:</span> <span className="font-medium">{data.email}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">PAN:</span> <span className="font-medium">{data.panNumber}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Aadhaar:</span> <span className="font-medium">{data.aadhaarNumber.replace(/(\d{4})(\d{4})(\d{4})/, '****-****-$3')}</span></div>
          </CardContent>
        </Card>

        {/* Business Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" /> Business Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Business Name:</span> <span className="font-medium">{data.businessName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GST Number:</span> <span className="font-medium">{data.gstNumber}</span></div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Bank Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Bank Name:</span> <span className="font-medium">{data.bankDetails.bankName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Account Number:</span> <span className="font-medium">****{data.bankDetails.accountNumber.slice(-4)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">IFSC Code:</span> <span className="font-medium">{data.bankDetails.ifscCode}</span></div>
          </CardContent>
        </Card>

        {/* Verification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Verification Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Documents:</span>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-primary font-medium">{getUploadedDocumentCount()} Uploaded</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Terms */}
     <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Terms & Conditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-6 bg-muted/30 rounded-xl mb-4">
            <h4 className="font-semibold text-foreground mb-3">Merchant Agreement Summary</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• I agree to SabbPe's Terms of Service and Privacy Policy</li>
              <li>• I understand the transaction fees and settlement terms</li>
              <li>• I authorize SabbPe to verify my business and bank details</li>
              <li>• I confirm that all provided information is accurate and up-to-date</li>
              <li>• I understand that false information may lead to account suspension</li>
            </ul>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="agreement"
              checked={data.agreementAccepted}
              onCheckedChange={handleAgreementChange}
              className="mt-1"
            />
            <Label 
              htmlFor="agreement" 
              className="text-sm text-foreground cursor-pointer leading-relaxed"
            >
              I have read and agree to all the terms and conditions, privacy policy, and 
              merchant agreement. I confirm that all the information provided is accurate 
              and I understand the responsibilities as a SabbPe merchant partner.
            </Label>
          </div>

        </CardContent>
      </Card>
      

      {/* Ticket Buttons */}
      <div className="flex gap-4">
        <Button onClick={() => setRaiseModalOpen(true)}>Raise Support Ticket</Button>
        <Button onClick={() => setTicketModalOpen(true)}>View My Tickets</Button>
      </div>

      {/* Raise Ticket Modal */}
      {raiseModalOpen && (
        <div className="p-6 bg-white border rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold mb-4">Raise Support Ticket</h3>
          <input type="text" placeholder="Issue title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border px-3 py-2 rounded mb-3" />
          <textarea placeholder="Describe your issue..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border px-3 py-2 rounded mb-3" />
          <div className="flex gap-3">
            <Button onClick={handleRaiseTicket} disabled={loading}>{loading ? 'Submitting...' : 'Submit Ticket'}</Button>
            <Button variant="outline" onClick={() => setRaiseModalOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* View Tickets Modal */}
      {ticketModalOpen && (
        <div className="p-6 bg-white border rounded-xl shadow-lg mt-6">
          <h3 className="text-lg font-semibold mb-4">My Support Tickets</h3>
          {loadingTickets ? (
            <div>Loading...</div>
          ) : tickets.length === 0 ? (
            <div>No tickets raised yet.</div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="p-4 border rounded-lg">
                  <div className="font-semibold">{ticket.title}</div>
                  <div className="text-sm text-gray-500">Status: {ticket.status}</div>
                  <div className="text-xs text-gray-400">ID: {ticket.id}</div>
                </div>
              ))}
            </div>
          )}
          <Button className="mt-4" variant="outline" onClick={() => setTicketModalOpen(false)}>Close</Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onPrev}>Back</Button>
        <Button onClick={handleSubmit} disabled={!data.agreementAccepted || isSubmitting}>
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