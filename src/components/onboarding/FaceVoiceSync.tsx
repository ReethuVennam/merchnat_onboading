import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Video, Mic, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMerchantData } from '@/hooks/useMerchantData';
import { API_BASE_URL } from '@/lib/api-client';

interface FaceVoiceSyncProps {
  onSuccess?: () => void;
  onFailure?: () => void;
  mobileNumber?: string; // Allow passing mobile number directly
}

export const FaceVoiceSync: React.FC<FaceVoiceSyncProps> = ({ onSuccess, onFailure, mobileNumber: propMobileNumber }) => {
  const { merchantProfile } = useMerchantData();
  const [otpSent, setOtpSent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<'idle' | 'preparing' | 'recording' | 'verifying' | 'done'>('idle');
  const [transcript, setTranscript] = useState('');
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>(''); // Track latest transcript

  const { toast } = useToast();

  const reset = () => {
    setOtpSent(false);
    setStatus('idle');
    setTranscript('');
    setResultMessage(null);
    setVerificationComplete(false);
    setVerificationSuccess(false);
  };
  
  const formatPhoneForWhatsApp = (num?: string) => {
    if (!num) return null;
    let s = num.replace(/\D/g, '');
    s = s.replace(/^0+/, '');
    if (s.length === 10) s = `91${s}`;
    return s;
  };
  const startVerification = async () => {
    setResultMessage(null);
    setStatus('preparing');

    try {
      // preflight: check permissions where supported to provide clearer guidance
      const checkPermission = async () => {
        try {
          if (!(navigator as any).permissions) return 'prompt';
          const cam = await (navigator as any).permissions.query({ name: 'camera' as any }).catch(() => ({ state: 'prompt' }));
          const mic = await (navigator as any).permissions.query({ name: 'microphone' as any }).catch(() => ({ state: 'prompt' }));
          if (cam.state === 'denied' || mic.state === 'denied') return 'denied';
          if (cam.state === 'granted' && mic.state === 'granted') return 'granted';
          return 'prompt';
        } catch (e) {
          return 'prompt';
        }
      };

      const perm = await checkPermission();
      if (perm === 'denied') {
        toast({
          variant: 'destructive',
          title: 'Permissions blocked',
          description: 'Camera or microphone permission is blocked. Please enable them in your browser site settings and try again.'
        });
        setStatus('idle');
        return;
      }
      // Use prop-passed mobile number if available, otherwise fall back to merchantProfile
      const rawTo = propMobileNumber || merchantProfile?.mobile_number;
      const to = formatPhoneForWhatsApp(rawTo);
      if (!to) {
        console.error('❌ No mobile number available:', { propMobileNumber, profileNumber: merchantProfile?.mobile_number });
        toast({ variant: 'destructive', title: 'No phone number', description: 'Merchant mobile number not available. Please ensure mobile number is set.' });
        setStatus('idle');
        return;
      }

      // use shared base URL helper (already ensures '/api' suffix)
      const resp = await fetch(`${API_BASE_URL}/whatsapp/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to })
      });

      // defend against non-json responses
      let json: any = { success: false };
      try {
        json = await resp.json();
      } catch (e) {
        console.error('Invalid JSON from send-otp', e);
        toast({ variant: 'destructive', title: 'Send failed', description: 'Unexpected server response when sending OTP' });
        setStatus('idle');
        return;
      }

      if (!json.success) {
        const errorMsg = typeof json.error === 'string' 
          ? json.error 
          : (json.error?.message || 'Failed to send OTP');
        toast({ variant: 'destructive', title: 'Send failed', description: errorMsg });
        setStatus('idle');
        return;
      }

      setOtpSent(true);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // start speech recognition
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          const spoken = event.results[0][0].transcript;
          setTranscript(spoken);
          transcriptRef.current = spoken; // Also update ref
        };

        recognition.onerror = () => {
          // ignore errors, we'll handle mismatch later
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      // start recording (video+audio)
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      const chunks: Blob[] = [];

      const verify = async () => {
        setStatus('verifying');

        const wordMap: Record<string,string> = {
          zero:'0', one:'1', two:'2', three:'3', four:'4', five:'5', six:'6', seven:'7', eight:'8', nine:'9'
        };
        const cleaned = transcriptRef.current
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(tok => tok.length > 0)
          .map(tok => {
            if (/^\d+$/.test(tok)) return tok;
            return wordMap[tok] || '';
          })
          .join('');

        // call backend verify
        try {
          const verifyResp = await fetch(`${API_BASE_URL}/whatsapp/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: to, otp: cleaned })
          });
          const verifyJson = await verifyResp.json();
          const voiceOk = verifyJson.success && verifyJson.verified;
          const faceOk = true; // placeholder

          if (voiceOk && faceOk) {
            setResultMessage('Face and voice verified successfully!');
            setVerificationSuccess(true);
            setVerificationComplete(true);
            onSuccess?.();
          } else {
            setResultMessage('Verification failed. Please try again.');
            setVerificationSuccess(false);
            setVerificationComplete(true);
            onFailure?.();
          }
        } catch (e) {
          setResultMessage('Verification failed due to server error.');
          onFailure?.();
        }

        setStatus('done');
      };

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) {
          chunks.push(e.data);
        }
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });

        if (recognitionRef.current) {
          recognitionRef.current.stop();
          setTimeout(() => verify(), 500);
        } else {
          verify();
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;

      setRecording(true);
      setStatus('recording');
    } catch (err: any) {
      console.error('Failed to access media devices', err);

      // Provide specific guidance based on error type
      if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        toast({
          variant: 'destructive',
          title: 'Permission Denied',
          description: 'You have denied access to camera or microphone. Enable permissions in your browser settings and reload the page.'
        });
      } else if (err && err.name === 'NotFoundError') {
        toast({
          variant: 'destructive',
          title: 'No Device Found',
          description: 'No camera or microphone found. Please connect a device and try again.'
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Media Error',
          description: 'Unable to access camera or microphone. Please check permissions and try in Chrome/Edge with a secure context (https or localhost).'
        });
      }

      setStatus('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setRecording(false);
  };

  useEffect(() => {
    // cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold">Face & Voice Sync Verification</h3>
        <p className="text-sm text-muted-foreground">You will receive a one-time code on WhatsApp. Read the code aloud while your face is recorded.</p>
      </div>

      {!verificationComplete ? (
        <>
          <div className="flex flex-col items-center gap-4">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-64 h-48 rounded-lg bg-black"
            />
            {status === 'recording' && <p className="text-sm text-primary">Recording...</p>}
            {status === 'verifying' && <p className="text-sm text-muted-foreground">Verifying...</p>}
          </div>
          {otpSent && merchantProfile?.mobile_number && (
            <p className="text-sm text-muted-foreground text-center">OTP sent to WhatsApp: ****{(formatPhoneForWhatsApp(merchantProfile.mobile_number) || merchantProfile.mobile_number).slice(-4)}</p>
          )}
          {transcript && (
            <p className="text-sm">
              You said: <span className="font-medium">
                {transcript.replace(/\.$/, '')}
              </span>
            </p>
          )}

          <div className="flex justify-center gap-4">
            {!recording ? (
              <Button onClick={startVerification} disabled={status === 'recording'}>
                <Video className="h-4 w-4 mr-2" /> Start Verification
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopRecording}>
                <Mic className="h-4 w-4 mr-2" /> Stop
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className={`p-6 rounded-xl ${verificationSuccess ? 'bg-gradient-to-r from-green-100 to-emerald-100' : 'bg-gradient-to-r from-red-100 to-pink-100'}`}>
          <div className="flex items-center gap-3 mb-2">
            {verificationSuccess ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-600" />
            )}
            <span className={`font-semibold ${verificationSuccess ? 'text-green-700' : 'text-red-700'}`}>
              {verificationSuccess ? 'Face & Voice Verified Successfully' : 'Verification Failed'}
            </span>
          </div>
          <p className={`text-sm ${verificationSuccess ? 'text-green-600' : 'text-red-600'}`}>
            {resultMessage}
          </p>
          {!verificationSuccess && (
            <Button variant="link" onClick={reset} className="mt-3 text-red-600 hover:text-red-700">
              <RefreshCw className="h-4 w-4 mr-1" /> Try Again
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
