
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSupportAuth } from "../context/SupportAuthContext";

interface MerchantProfile {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string;
  business_name: string;
  pan_number: string;
  aadhaar_number: string;
  gst_number?: string;
  verification_submitted?: boolean;   
}

interface MerchantDocument {
  id: string;
  document_type: string;
  public_url: string;
  file_name: string;
}

const MerchantReview: React.FC = () => {
  const { merchantId } = useParams();
  const navigate = useNavigate();
  const { user } = useSupportAuth();

  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [documents, setDocuments] = useState<MerchantDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!merchantId) return;
    fetchMerchantData();
  }, [merchantId]);

  const fetchMerchantData = async () => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `http://localhost:5000/api/tickets/merchant-review/${merchantId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch merchant");
      }

      const data = await response.json();

      setProfile(data.profile);
      setDocuments(data.documents || []);
      setLoading(false);
    } catch (error: any) {
      alert(error.message);
      setLoading(false);
    }
  };

  const handleView = (type: string) => {
    const doc = documents.find((d) => d.document_type === type);

    if (!doc || !doc.public_url) {
      alert("Document not available");
      return;
    }

    window.open(doc.public_url, "_blank");
  };

  const handleApprove = async () => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        "http://localhost:5000/api/tickets/merchant-review",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            merchant_id: merchantId,
            status: "approved",
            review_notes: "",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Approval failed");
      }

      alert("✅ Merchant approved successfully");
      navigate("/admin");
    } catch (error: any) {
      alert("❌ " + error.message);
    }
  };

  const handleReject = async () => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        "http://localhost:5000/api/tickets/merchant-review",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            merchant_id: merchantId,
            status: "rejected",
            review_notes: reason,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Rejection failed");
      }

      alert("❌ Merchant rejected successfully");
      navigate("/admin");
    } catch (error: any) {
      alert("❌ " + error.message);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!profile) return <div className="p-6">Merchant not found</div>;

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-bold">Merchant Review</h1>

      {/* Merchant Details */}
      <div className="grid grid-cols-2 gap-6 bg-gray-100 p-6 rounded-lg">
        <div>
          <p className="text-sm text-gray-500">Full Name</p>
          <p className="font-semibold">{profile.full_name}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Email</p>
          <p className="font-semibold">{profile.email}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Mobile</p>
          <p className="font-semibold">{profile.mobile_number}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Business Name</p>
          <p className="font-semibold">{profile.business_name}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">PAN Number</p>
          <p className="font-semibold">{profile.pan_number}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Aadhaar Number</p>
          <p className="font-semibold">{profile.aadhaar_number}</p>
        </div>
        {profile.gst_number && (
          <div>
            <p className="text-sm text-gray-500">GST Number</p>
            <p className="font-semibold">{profile.gst_number}</p>
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Uploaded Documents</h2>

        {[
          { label: "PAN Card", type: "pan_card" },
          { label: "Aadhaar Card", type: "aadhaar_card" },
          { label: "Business Proof", type: "business_proof" },
          { label: "Bank Statement", type: "bank_statement" },
          { label: "Cancelled Cheque", type: "cancelled_cheque" },
        ].map((doc) => (
          <div
            key={doc.type}
            className="flex justify-between items-center bg-gray-100 p-4 rounded-lg"
          >
            <span className="font-medium">{doc.label}</span>
            <button
              onClick={() => handleView(doc.type)}
              className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
            >
              View
            </button>
          </div>
        ))}
      </div>

      {/* Back Button */}
      <div className="mt-6">
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2 border rounded"
        >
          Back
        </button>
      </div>
      {(user?.role === "admin" || user?.role === "super_admin") && (
  <div className="flex gap-4 mt-6">

    {profile?.verification_submitted === true && (
      <button
        onClick={handleApprove}
        className="px-6 py-2 bg-green-600 text-white rounded-lg"
      >
        Approve
      </button>
    )}

    <button
      onClick={handleReject}
      className="px-6 py-2 bg-red-600 text-white rounded-lg"
    >
      Reject
    </button>

  </div>
)}
    </div>
  );
};

export default MerchantReview;