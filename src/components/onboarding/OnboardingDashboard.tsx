// src/pages/OnboardingDashboard.tsx
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UPIQRCode } from "@/components/onboarding/UPIQRCode";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Phone,
  Mail,
  Upload,
  RefreshCw,
  ArrowLeft,
  CreditCard,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { useMerchantData } from "@/hooks/useMerchantData";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { MandateFlowModal } from "@/components/onboarding/MandateFlowModal";
import { useExternalScript } from "@/hooks/useExternalScript";
import { useGeneratePaymentToken } from "@/hooks/useGeneratePaymentToken";
import { useInitiatePayment } from "@/hooks/useInitiatePayment";
import { supabase } from "@/lib/supabase";

type KYCStatus = "pending" | "verified" | "approved" | "rejected";

const OnboardingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { merchantProfile, kycData, loading, refetch } = useMerchantData();

  const [user, setUser] = useState<any>(null);

  const [showMandateFlow, setShowMandateFlow] = useState(false);
  const { toast } = useToast();

  // ⭐ PAYMENT INTEGRATION HOOKS
  const scriptStatus = useExternalScript(import.meta.env.VITE_ATOM_SCRIPT_URL);
  const generateTokenMutation = useGeneratePaymentToken();
  const paymentMutation = useInitiatePayment();

  useEffect(() => {
    console.log("🔍 Dashboard Status Check:", {
      status: merchantProfile?.onboarding_status,
      upi_vpa: merchantProfile?.upi_vpa,
      upi_qr_string: merchantProfile?.upi_qr_string,
      upi_mandate_status: merchantProfile?.upi_mandate_status,
    });
  }, [merchantProfile]);

  useEffect(() => {
  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };
  fetchUser();
}, []);

  const getStatusInfo = (status: KYCStatus) => {
    switch (status) {
      case "pending":
        return {
          icon: Clock,
          color: "bg-yellow-500",
          badgeVariant: "secondary" as const,
          title: "Application Submitted",
          description:
            "Your application is submitted. KYC Under Review by SabbPe",
          timeframe: "KYC Review in progress ~5min",
        };
      case "verified":
        return {
          icon: RefreshCw,
          color: "bg-blue-500",
          badgeVariant: "default" as const,
          title: "KYC Verified ✅",
          description:
            "Your KYC has been verified. Awaiting bank approval for account activation.",
          timeframe: "Bank review in progress ~15min",
        };
      case "approved":
        return {
          icon: CheckCircle,
          color: "bg-green-500",
          badgeVariant: "default" as const,
          title: "Account Approved!",
          description:
            "Congratulations! Your merchant account has been approved.",
          timeframe: "You can now start accepting payments",
        };
      case "rejected":
        return {
          icon: AlertCircle,
          color: "bg-red-500",
          badgeVariant: "destructive" as const,
          title: "Application Rejected",
          description:
            "Your application has been rejected. Please contact support for more details.",
          timeframe: "Contact support for clarification",
        };
    }
  };

  const kycStatus: KYCStatus =
    merchantProfile?.onboarding_status === "pending_bank_approval"
      ? "verified"
      : merchantProfile?.onboarding_status === "verified"
        ? "verified"
        : merchantProfile?.onboarding_status === "approved"
          ? "approved"
          : merchantProfile?.onboarding_status === "rejected"
            ? "rejected"
            : "pending";

  const applicationId =
    merchantProfile?.id?.slice(-6).toUpperCase() || "LOADING";
  const statusInfo = getStatusInfo(kycStatus);
  const StatusIcon = statusInfo.icon;

  const upiMandateStatus = merchantProfile?.upi_mandate_status;

  const verificationSteps = [
    {
      name: "Document Upload",
      status:
        merchantProfile?.pan_number && merchantProfile?.aadhaar_number
          ? "completed"
          : "pending",
    },
    {
      name: "KYC Verification",
      status: kycData?.video_kyc_completed ? "completed" : "pending",
    },
    {
      name: "Bank Verification",
      status: kycStatus === "approved" ? "completed" : "pending",
    },
    {
      name: "UPI Auto Mandate",
      status:
        upiMandateStatus === "active"
          ? "completed"
          : upiMandateStatus === "failed"
            ? "failed"
            : "pending",
    },
    {
      name: "Final Review",
      status: kycStatus === "approved" ? "completed" : "pending",
    },
  ];

  // ⭐ PAYMENT HANDLER - Generate unique order number for integration fee
  const handleIntegrationPayment = async () => {
    if (!merchantProfile?.total_integration_cost || merchantProfile.total_integration_cost <= 0) {
      toast({
        title: "Error",
        description: "Invalid integration cost",
        variant: "destructive",
      });
      return;
    }

        console.log("💳 Starting integration fee payment:", {
  amount: merchantProfile.total_integration_cost,
  clientId: user.id,  // ✅ Changed from user.clientId
});

    if (!user?.id) {  // ✅ Changed from user?.clientId
      toast({
        title: "Error",
        description: "User information missing. Please login again.",
        variant: "destructive",
      });
      return;
    }


    // Check if script is loaded
    if (scriptStatus !== "ready") {
      toast({
        title: "Payment system loading",
        description: "Please wait a moment and try again.",
        variant: "destructive",
      });
      return;
    }

    // Generate unique order number for integration fee payment
    const timestamp = Date.now();
    const orderNumber = `INT-${timestamp}`;

    console.log("💳 Starting integration fee payment:", {
      amount: merchantProfile.total_integration_cost,
      orderNumber,
      clientId: user.clientId,
    });

    // Step 1: Generate payment token
    generatePaymentToken(merchantProfile.total_integration_cost, orderNumber);
  };

  // Step 1: Generate Token
  const generatePaymentToken = (amount: number, orderNumber: string) => {
    console.log("🔑 Generating payment token for order:", orderNumber);

    generateTokenMutation.mutate(undefined, {
      onSuccess: (token) => {
        console.log("✅ Payment token generated successfully:", token);

        toast({
          title: "Token Generated",
          description: "Payment token generated successfully.",
        });

        // Step 2: Initiate payment with token
        initiatePayment(amount, orderNumber, token);
      },
      onError: (error) => {
        console.error("❌ Token generation error:", error);
        toast({
          title: "Token generation failed",
          description: "Failed to generate payment token. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  // Step 2: Initiate Payment
  const initiatePayment = async (
    amount: number,
    orderNumber: string,
    token: string
  ) => {
    console.log("💰 Initiating payment with token:", token);

    // Check if AtomPaynetz is available
    if (typeof window.AtomPaynetz !== "function") {
      console.error("❌ AtomPaynetz not available:", window.AtomPaynetz);
      toast({
        title: "Payment system error",
        description:
          "Payment gateway not initialized. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

if (!user?.id) {  // ✅ Changed from user?.clientId
  toast({
    title: "Error",
    description: "User information missing. Please login again.",
    variant: "destructive",
  });
  return;
}

    // Encrypt data: orderNumber|clientId
    // const dataToEncrypt = `${orderNumber}|${user.id}`;
    // const encryptedData = await encrypt(dataToEncrypt);

    console.log("🔐 Encrypted data created");
    const encryptedData = orderNumber;

    // Call the payment process API
    paymentMutation.mutate(
      { amount, orderNumber, encryptedData, token },
      {
        onSuccess: (data) => {
          console.log("✅ Payment process response:", data);

          if (data.responseDetails?.txnStatusCode !== "OTS0000") {
            toast({
              title: "Payment initiation failed",
              description:
                data.responseDetails?.txnDescription || "Please try again",
              variant: "destructive",
            });
            return;
          }

          const options = {
            atomTokenId: data.atomTokenId,
            merchId: import.meta.env.VITE_PAYMENT_TRANSACTION_MERCHANTID,
            custEmail: import.meta.env.VITE_PAYMENT_CUSTEMAIL,
            custMobile: import.meta.env.VITE_PAYMENT_CUSTMOBILE,
            returnUrl: import.meta.env.VITE_PAYMENT_RETURN_BACKEND_URL,
          };

          console.log("🚀 Opening payment gateway:", options);

          try {
            new window.AtomPaynetz(options, import.meta.env.VITE_PAYMENT_ENV);

            toast({
              title: "Payment Gateway Opened",
              description: "Please complete your payment in the popup window.",
            });
          } catch (error) {
            console.error("❌ Payment gateway error:", error);
            toast({
              title: "Payment error",
              description: "Failed to open payment gateway. Please try again.",
              variant: "destructive",
            });
          }
        },
        onError: (error) => {
          console.error("❌ Payment process error:", error);
          toast({
            title: "Payment failed",
            description: "Failed to initiate payment. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const isProcessing =
    generateTokenMutation.isPending || paymentMutation.isPending;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes blink-red {
          0%, 100% {
            opacity: 1;
            border-color: #ef4444;
            background-color: #fef2f2;
          }
          50% {
            opacity: 0.6;
            border-color: #dc2626;
            background-color: #fee2e2;
          }
        }
        
        .blink-red-alert {
          animation: blink-red 1.5s ease-in-out infinite !important;
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="container max-w-6xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </div>

          <div className="text-center mb-8">
            <Logo size="lg" className="mb-4" />
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Merchant Dashboard
            </h1>
            <p className="text-muted-foreground">
              Track your onboarding progress and account status
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="shadow-[var(--shadow-card)]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Application Status</CardTitle>
                    <Badge variant={statusInfo.badgeVariant}>
                      {kycStatus.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-4 mb-6">
                    <div
                      className={`p-3 rounded-full ${statusInfo.color} text-white`}
                    >
                      <StatusIcon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        {statusInfo.title}
                      </h3>
                      <p className="text-muted-foreground mb-2">
                        {statusInfo.description}
                      </p>
                      <p className="text-sm font-medium text-primary">
                        {statusInfo.timeframe}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-semibold text-foreground mb-4">
                      Verification Progress
                    </h4>
                    <div className="space-y-3">
                      {verificationSteps.map((step, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${step.status === "completed"
                              ? "bg-primary text-white"
                              : step.status === "failed"
                                ? "bg-red-500 text-white"
                                : "bg-muted text-muted-foreground"
                              }`}
                          >
                            {step.status === "completed" ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : step.status === "failed" ? (
                              <AlertCircle className="h-4 w-4" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                          </div>
                          <span
                            className={
                              step.status === "completed"
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }
                          >
                            {step.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {kycStatus === "rejected" && (
                    <div className="mt-6">
                      <Button
                        className="w-full"
                        onClick={() => navigate("/merchant-onboarding")}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Re-upload Documents
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {kycStatus === "approved" &&
                merchantProfile?.upi_qr_string &&
                merchantProfile?.upi_vpa && (
                  <UPIQRCode
                    upiString={merchantProfile.upi_qr_string}
                    vpa={merchantProfile.upi_vpa}
                    merchantName={merchantProfile.business_name || "Merchant"}
                  />
                )}

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => refetch()}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Status
                  </Button>

                  {(kycStatus === "pending" || kycStatus === "rejected") && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => navigate("/merchant-onboarding")}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Continue Onboarding
                    </Button>
                  )}

                  {merchantProfile?.upi_mandate_status === "failed" && (
                    <Button
                      variant="outline"
                      className="w-full justify-start border-2 border-red-500 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 blink-red-alert"
                      onClick={() => setShowMandateFlow(true)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry UPI Mandate
                    </Button>
                  )}

{/* Integration Payment Button - Show based on Transaction ID status */}
{merchantProfile?.total_integration_cost !== undefined &&
  merchantProfile?.total_integration_cost !== null &&
  merchantProfile.total_integration_cost > 0 && (
    <>
      {/* Show GREEN PAID button if Transaction ID exists */}
      {merchantProfile?.["Transaction Id"] ? (
        <div className="w-full p-4 bg-green-50 border-2 border-green-500 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-700 font-semibold">
                Integration Fee Paid
              </span>
            </div>
            <span className="text-lg font-bold text-green-700">
              ₹{merchantProfile.total_integration_cost.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-green-600 mt-2 font-mono">
            Txn ID: {merchantProfile["Transaction Id"]}
          </p>
        </div>
      ) : (
        /* Show RED PAYMENT button if not paid */
        <Button
          variant="outline"
          className="w-full justify-between border-2 border-red-500 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 blink-red-alert h-auto py-3"
          onClick={handleIntegrationPayment}
          disabled={isProcessing || scriptStatus !== "ready"}
        >
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 flex-shrink-0" />
            <span className="text-left">
              {scriptStatus === "loading"
                ? "Loading Payment System..."
                : scriptStatus === "error"
                ? "Payment System Error"
                : generateTokenMutation.isPending
                ? "Generating Token..."
                : paymentMutation.isPending
                ? "Initiating Payment..."
                : !isProcessing && scriptStatus === "ready"
                ? "Pay One Time Integration Fee"
                : ""}
            </span>
          </div>
          <span className="font-semibold ml-2 whitespace-nowrap">
            ₹{merchantProfile.total_integration_cost.toLocaleString()}
          </span>
        </Button>
      )}
    </>
  )}

                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Need Help?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground mb-3">
                    We're available 24/7 for any support queries.
                  </div>

                  <Button variant="outline" className="w-full justify-start">
                    <Phone className="h-4 w-4 mr-2" />
                    Call Support
                  </Button>

                  <Button variant="outline" className="w-full justify-start">
                    <Mail className="h-4 w-4 mr-2" />
                    Email Support
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <MandateFlowModal
          isOpen={showMandateFlow}
          onClose={() => setShowMandateFlow(false)}
          onComplete={() => {
            setShowMandateFlow(false);
            refetch();
          }}
          merchantProfile={merchantProfile}
          user={user}
          refetchMerchant={refetch}
        />
      </div>
    </>
  );
};

export default OnboardingDashboard;