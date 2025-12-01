import React, { useState } from 'react';
import { X } from 'lucide-react';
import { MandateVpaValidate } from './MandateVpaValidate';
import MandateCreate from './MandateCreate';

interface MandateFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;

  // NEW PROPS YOU MUST PASS FROM PARENT
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

  if (!isOpen) return null;

  const handleVpaSuccess = (vpa: string) => {
    setValidatedVpa(vpa);
    setStep('mandate');
  };

  const handleMandateSuccess = () => {
    onComplete(); // goes to dashboard from parent
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
          {step === 'validate' && (
            <MandateVpaValidate onSuccess={handleVpaSuccess} />
          )}

          {step === 'mandate' && (
            <MandateCreate
              vpa={validatedVpa}
              onSuccess={handleMandateSuccess}
              merchantProfile={merchantProfile}
              user={user}
              refetchMerchant={refetchMerchant}
            />
          )}
        </div>
      </div>
    </div>
  );
};
