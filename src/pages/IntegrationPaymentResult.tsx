// src/pages/IntegrationPaymentResult.tsx
import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
// import { decrypt } from "@/utils/encryption";

export default function IntegrationPaymentResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [decryptedOrderNumber, setDecryptedOrderNumber] = useState<string>("");

  // Parse URL parameters
  const paymentData = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const encryptedTransactionId = params.get("txnId");
    const error = params.get("error");

    console.log("Integration Payment callback params:", {
      encryptedTransactionId,
      error,
      allParams: Object.fromEntries(params.entries()),
    });

    let status: "success" | "error" = "error";
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
    } else if (encryptedTransactionId) {
      status = "success";
      message = "Your integration fee payment has been completed successfully!";
    } else {
      status = "error";
      message = "Invalid payment response.";
    }

    return {
      status,
      message,
      encryptedTransactionId,
    };
  }, [location.search]);

  // Decrypt transaction ID
  useEffect(() => {
    const decryptTransactionId = async () => {
      if (paymentData.encryptedTransactionId) {
        try {
          const decrypted = await decrypt(paymentData.encryptedTransactionId);
          console.log("🔓 Decrypted data:", decrypted);
          
          // Extract order number (before the |)
          const orderNumber = decrypted.split("|")[0];
          setDecryptedOrderNumber(orderNumber);
        } catch (error) {
          console.error("❌ Failed to decrypt transaction ID:", error);
          setDecryptedOrderNumber(paymentData.encryptedTransactionId);
        }
      }
    };

    decryptTransactionId();
  }, [paymentData.encryptedTransactionId]);

  // Stop loading after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Show success toast
  useEffect(() => {
    if (!loading && paymentData.status === "success") {
      toast({
        title: "Integration Fee Paid",
        description: "Your integration fee has been successfully processed.",
      });
    }
  }, [loading, paymentData.status, toast]);

  const getStatusIcon = () => {
    if (loading) {
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

            {paymentData.encryptedTransactionId && (
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
                  ✅ Your integration fee has been successfully processed. You can now proceed with your merchant setup.
                </p>
              </div>
            )}

            {!loading && !paymentData.encryptedTransactionId && (
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
                  onClick={() => navigate("/merchant-dashboard")}
                >
                  Go to Dashboard
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
            ) : (
              <>
                <Button
                  size="lg"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                  onClick={() => navigate("/merchant-dashboard")}
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