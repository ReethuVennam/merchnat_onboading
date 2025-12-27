// src/pages/IntegrationPaymentResult.tsx
import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function IntegrationPaymentResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [decryptedOrderNumber, setDecryptedOrderNumber] = useState<string>("");
  const [savingTransaction, setSavingTransaction] = useState(false);

  // Parse URL parameters
  const paymentData = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const transactionId = params.get("txnId"); // This is the transaction ID from payment gateway
    const error = params.get("error");

    console.log("💳 Integration Payment callback params:", {
      transactionId,
      error,
      allParams: Object.fromEntries(params.entries()),
    });

    let status = "success";
    let message = "";

    if (error) {
      status = "error";
      switch (error) {
        case "invalid_signature":
          message = "Payment verification failed. Invalid signature.";
          break;
        case "txn_not_found":
          message = "Transaction not found in our records.";
          break;
        case "callback_processing_failed":
          message = "Failed to process payment callback.";
          break;
        default:
          message = "Payment failed. Please try again.";
      }
    } else if (transactionId) {
      status = "success";
      message = "Your integration fee payment has been completed successfully!";
    } else {
      status = "error";
      message = "Invalid payment response.";
    }

    return { status, message, transactionId };
  }, [location.search]);

  // Set transaction ID directly
  useEffect(() => {
    if (paymentData.transactionId) {
      setDecryptedOrderNumber(paymentData.transactionId);
    }
  }, [paymentData.transactionId]);

  // ✅ Save transaction ID to backend
  const saveTransactionToBackend = async (transactionId: string) => {
    try {
      setSavingTransaction(true);
      console.log("💾 Saving transaction ID to backend:", transactionId);

      // Get auth token from Supabase
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.error("❌ No auth token found");
        toast({
          title: "Authentication Error",
          description: "Please login again to save payment details.",
          variant: "destructive",
        });
        return false;
      }

      // Call backend API to update transaction ID
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/transaction/update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            transactionId: transactionId,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        console.log("✅ Transaction ID saved successfully:", transactionId);
        toast({
          title: "Payment Saved",
          description: "Your payment details have been saved successfully.",
        });
        return true;
      } else {
        console.error("❌ Failed to save transaction ID:", data);
        toast({
          title: "Save Failed",
          description: data.message || "Failed to save payment details.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error("❌ Error saving transaction ID:", error);
      toast({
        title: "Error",
        description: "Failed to save payment details. Please contact support.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSavingTransaction(false);
    }
  };

  // Stop loading after delay and save transaction if successful
  useEffect(() => {
    const processPayment = async () => {
      // Wait for loading animation
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setLoading(false);

      // If payment successful, save transaction ID
      if (
        paymentData.status === "success" &&
        paymentData.transactionId &&
        !savingTransaction
      ) {
        const saved = await saveTransactionToBackend(paymentData.transactionId);

        // Redirect to dashboard after 2 seconds if saved successfully
if (saved) {
  setTimeout(() => {
    window.location.href = "/merchant-onboarding?step=dashboard"; // ✅ Add query param
  }, 2000);
}
      }
    };

    processPayment();
  }, [paymentData.status, paymentData.transactionId]);

  const getStatusIcon = () => {
    if (loading || savingTransaction) {
      return <Loader2 className="h-24 w-24 text-blue-500 animate-spin" />;
    }

    switch (paymentData.status) {
      case "success":
        return <CheckCircle2 className="h-24 w-24 text-green-500" />;
      case "error":
        return <XCircle className="h-24 w-24 text-red-500" />;
      default:
        return <AlertCircle className="h-24 w-24 text-yellow-500" />;
    }
  };

  const getStatusTitle = () => {
    if (loading) return "Processing Payment...";
    if (savingTransaction) return "Saving Payment Details...";

    switch (paymentData.status) {
      case "success":
        return "Payment Successful!";
      case "error":
        return "Payment Failed";
      default:
        return "Payment Status Unknown";
    }
  };

  const getStatusColor = () => {
    switch (paymentData.status) {
      case "success":
        return "text-green-600 dark:text-green-400";
      case "error":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-yellow-600 dark:text-yellow-400";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-6">{getStatusIcon()}</div>
          <CardTitle className={`text-3xl font-bold ${getStatusColor()}`}>
            {getStatusTitle()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-lg mb-4">{paymentData.message}</p>

            {paymentData.transactionId && (
              <div className="bg-muted p-4 rounded-lg border mb-4">
                <p className="text-sm text-muted-foreground mb-1">
                  Transaction ID
                </p>
                <p className="text-lg font-mono font-semibold break-all">
                  {decryptedOrderNumber || "Loading..."}
                </p>
              </div>
            )}

            {paymentData.status === "success" && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  ✅ Your integration fee has been successfully processed. You
                  can now proceed with your merchant setup.
                </p>
              </div>
            )}

            {!loading && !paymentData.transactionId && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Transaction ID not found. Please contact support.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            {paymentData.status === "success" ? (
              <>
                <Button
                  size="lg"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                  onClick={() => navigate("/merchant-onboarding?step=dashboard")}
                  disabled={savingTransaction}
                >
                  {savingTransaction ? "Saving..." : "Go to Dashboard"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/")}
                  disabled={savingTransaction}
                >
                  Go Home
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                  onClick={() => navigate("/merchant-onboarding?step=dashboard")}
                >
                  Back to Dashboard
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/")}
                >
                  Go Home
                </Button>
              </>
            )}
          </div>

          {paymentData.status === "error" && (
            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground">
                Need help? Contact our support team at{" "}
                <a
                  href="mailto:support@sabbpe.com"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  support@sabbpe.com
                </a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
