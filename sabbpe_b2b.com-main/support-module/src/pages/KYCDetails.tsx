


import React, { useEffect, useState } from "react";
import { useSupportAuth } from "../context/SupportAuthContext";
import { useNavigate } from "react-router-dom";

const KYCDetails: React.FC = () => {
  const { token } = useSupportAuth();
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMerchants();
  }, []);

  const fetchMerchants = async () => {
    try {
      const res = await fetch(
        "http://localhost:5000/api/tickets/kyc-list",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      setMerchants(data);
    } catch (err) {
      console.error("Failed to fetch KYC list");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">
        KYC Merchant List
      </h1>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="p-4 text-left">Name</th>
              <th className="p-4 text-left">Email</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Action</th>
            </tr>
          </thead>

          <tbody>
            {merchants.map((merchant) => (
              <tr key={merchant.user_id} className="border-b">
                <td className="p-4">{merchant.full_name}</td>
                <td className="p-4">{merchant.email}</td>
                <td className="p-4 capitalize">
                  {merchant.approval_status || "pending"}
                </td>
                <td className="p-4">
                  <button
                    onClick={() =>
                      navigate(
                        `/merchant-review/${merchant.user_id}`
                      )
                    }
                    className="px-4 py-1 bg-indigo-600 text-white rounded"
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default KYCDetails;