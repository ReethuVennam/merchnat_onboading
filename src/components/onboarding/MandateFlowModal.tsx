import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { MandateVpaValidate } from './MandateVpaValidate';
import MandateCreate from './MandateCreate';
import { supabase } from '@/lib/supabase';

interface MandateFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  merchantProfile: any;
  user: any;
  refetchMerchant: () => void;
}

type Step = 'validate' | 'mandate';

export const MandateFlowModal: React.FC<MandateFlowModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  merchantProfile,
  user,
  refetchMerchant,
}) => {
  const [step, setStep] = useState<Step>('validate');
  const [validatedVpa, setValidatedVpa] = useState('');
  const [freshProfile, setFreshProfile] = useState(merchantProfile);
  const [loading, setLoading] = useState(false);

  // ✅ CRITICAL FIX: Fetch directly from Supabase when modal opens
  useEffect(() => {
    const fetchFreshProfile = async () => {
      if (isOpen && user?.id) {
        setLoading(true);
        console.log("🔄 MandateFlowModal - Fetching FRESH data directly from Supabase...");
        
        try {
          const { data, error } = await supabase
            .from('merchant_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (error) {
            console.error("❌ Error fetching merchant profile:", error);
            setFreshProfile(merchantProfile); // Fallback to prop
          } else {
            console.log("✅ Fresh data from Supabase:", data);
            console.log("💰 Fresh total_monthly_cost:", data.total_monthly_cost);
            setFreshProfile(data);
          }
        } catch (err) {
          console.error("❌ Exception fetching merchant profile:", err);
          setFreshProfile(merchantProfile);
        } finally {
          setLoading(false);
        }
      }
    };

    if (isOpen) {
      fetchFreshProfile();
    }
  }, [isOpen, user?.id, merchantProfile]);

  if (!isOpen) return null;

  const handleVpaSuccess = (vpa: string) => {
    setValidatedVpa(vpa);
    setStep('mandate');
  };

  const handleMandateSuccess = () => {
    onComplete();
  };

  const handleClose = () => {
    setStep('validate');
    setValidatedVpa('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in zoom-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              UPI Autopay Mandate
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {step === 'validate' ? 'Step 1 of 2' : 'Step 2 of 2'}
            </p>
          </div>

          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-0">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">Loading fresh data...</p>
            </div>
          ) : (
            <>
              {step === 'validate' && (
                <MandateVpaValidate onSuccess={handleVpaSuccess} />
              )}

              {step === 'mandate' && (
                <MandateCreate
                  vpa={validatedVpa}
                  onSuccess={handleMandateSuccess}
                  merchantProfile={freshProfile}
                  user={user}
                  refetchMerchant={refetchMerchant}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};