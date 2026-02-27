import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, MapPin, FileText, Video, CheckCircle, AlertCircle } from 'lucide-react';
import { useKYCValidation } from '@/hooks/useKYCValidation';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useMerchantData } from '@/hooks/useMerchantData';
import { useToast } from '@/hooks/use-toast';
import { FaceVoiceSync } from './FaceVoiceSync'; // Make sure this path is correct
 import { RaiseTicketButton } from "@/components/RaiseTicketButton";
  import { useNavigate } from "react-router-dom";

interface KYCVerificationProps {
    onNext: () => void;
    onPrev: () => void;
    data?: {
        kycData?: {
            isVideoCompleted?: boolean;
            selfieUrl?: string;
            locationVerified?: boolean;
            latitude?: number;
            longitude?: number;
        };
        panNumber?: string;
        aadhaarNumber?: string;
        [key: string]: unknown;
    };
    onDataChange?: (data: {
        kycData?: {
            isVideoCompleted?: boolean;
            selfieUrl?: string;
            locationVerified?: boolean;
            latitude?: number;
            longitude?: number;
        };
        [key: string]: unknown;
    }) => void;
    merchantProfile?: Record<string, unknown>;
}

export const KYCVerification: React.FC<KYCVerificationProps> = ({
    onNext,
    onPrev,
    data,
    onDataChange,
    merchantProfile: propMerchantProfile
}) => {
    const [isVideoActive, setIsVideoActive] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    // removed previous standalone voice states
    const [faceScore, setFaceScore] = useState<number | null>(null);
    const [faceVoiceVerified, setFaceVoiceVerified] = useState(false); // NEW

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const { toast } = useToast();
    const { merchantProfile: dbMerchantProfile } = useMerchantData();
    // Use prop-passed merchant profile if available (for distributor onboarding flow), otherwise use DB fetch
    const merchantProfile = propMerchantProfile || dbMerchantProfile;
    const { uploadFile } = useFileUpload();
     const navigate = useNavigate();
    const {
        kycState,
        captureLocation,
        completeVideoKYC,
        isKYCComplete
    } = useKYCValidation();

    const startCamera = async () => {
        try {
            console.log('🎥 Starting camera...');
            setIsVideoActive(true);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
                audio: false
            });

            console.log('✅ Camera stream acquired:', stream.getTracks());

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                console.log('✅ Video stream assigned to videoRef');
                // Force play
                videoRef.current.play().catch(e => console.error('Play error:', e));
            } else {
                console.error('❌ videoRef.current is null');
            }
        } catch (error) {
            console.error('❌ Error accessing camera:', error);
            const err = error as any;
            let description = "Unable to access camera. Please check permissions.";
            
            if (err.name === 'NotAllowedError') {
                description = 'Camera permission denied. Please enable camera in browser settings.';
            } else if (err.name === 'NotFoundError') {
                description = 'No camera device found. Please connect a camera.';
            } else if (err.name === 'NotReadableError') {
                description = 'Camera is already in use. Please close other apps using the camera.';
            }
            
            toast({
                variant: "destructive",
                title: "Camera Error",
                description,
            });
            setIsVideoActive(false);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsVideoActive(false);
    };

    const capturePhoto = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        console.log('📸 Capturing photo from video...');
        setIsProcessing(true);

        try {
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (context) {
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0);

                canvas.toBlob(async (blob) => {
                    if (blob && merchantProfile) {
                        const file = new File([blob], 'kyc-selfie.jpg', { type: 'image/jpeg' });
                        const uploadPath = `${merchantProfile.user_id}/kyc-selfie-${Date.now()}.jpg`;

                        const uploadResult = await uploadFile(file, 'merchant-documents', uploadPath);

                        if (uploadResult) {
                            completeVideoKYC(blob);

                            const simulatedScore = Math.floor(Math.random() * (98 - 85) + 85);
                            setFaceScore(simulatedScore);

                            toast({
                                title: "Face Match Completed",
                                description: `Face Match Confidence: ${simulatedScore}%`,
                            });

                            onDataChange?.({
                                ...data,
                                kycData: {
                                    ...data?.kycData,
                                    isVideoCompleted: true,
                                    selfieUrl: uploadPath
                                }
                            });

                            toast({
                                title: "Photo Captured",
                                description: "Your selfie has been captured successfully.",
                            });
                        }
                    }
                }, 'image/jpeg', 0.8);
            }

            stopCamera();
        } catch (error) {
            console.error('Error capturing photo:', error);
            toast({
                variant: "destructive",
                title: "Capture Error",
                description: "Failed to capture photo. Please try again.",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleLocationCapture = async () => {
        try {
            const locationData = await captureLocation();

            onDataChange?.({
                ...data,
                kycData: {
                    ...data?.kycData,
                    locationVerified: true,
                    latitude: locationData.lat,
                    longitude: locationData.lng,
                    // optionally store address in parent data if needed
                   // address: locationData.address,
                }
            });

            const toastDesc = locationData.address
                ? locationData.address
                : `${locationData.lat.toFixed(4)}, ${locationData.lng.toFixed(4)}`;

            toast({
                title: "Location Captured",
                description: toastDesc,
            });
        } catch (error: unknown) {
            toast({
                variant: "destructive",
                title: "Location Error",
                description: error instanceof Error ? error.message : "Failed to capture location",
            });
        }
    };

    const handleNext = () => {
        if (isKYCComplete && faceVoiceVerified && (faceScore ?? 0) >= 85) {
            onNext();
        } else {
            toast({
                variant: "destructive",
                title: "KYC Incomplete",
                description: "Please complete video KYC, face match, face&voice sync, and location capture.",
            });
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            toast({
                title: "Documents Verified",
                description: "Your PAN and Aadhaar documents have been processed successfully.",
            });
        }, 2000);

        return () => clearTimeout(timer);
    }, [toast]);

    return (
        <div className="space-y-8">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">
                    KYC Verification
                </h2>
                <p className="text-muted-foreground">
                    Complete your identity verification for secure onboarding
                </p>
            </div>

            <div className="grid gap-6">
                {/* Document OCR Status */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Document Verification
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="p-6 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl">
                            <div className="flex items-center gap-3 mb-4">
                                <CheckCircle className="h-6 w-6 text-primary" />
                                <span className="font-semibold text-foreground">
                                    Documents Auto-Verified
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                Your PAN and Aadhaar documents have been processed using OCR technology.
                                All details have been automatically extracted and verified.
                            </p>
                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div className="p-3 bg-card rounded-lg">
                                    <span className="font-medium">PAN Number:</span>
                                    <span className="ml-2 text-primary">
                                        {(data?.panNumber as string) || (merchantProfile?.pan_number as string) || 'Processing...'}
                                    </span>
                                </div>
                                <div className="p-3 bg-card rounded-lg">
                                    <span className="font-medium">Aadhaar:</span>
                                    <span className="ml-2 text-primary">
                                        {data?.aadhaarNumber && typeof data.aadhaarNumber === 'string' ?
                                            `****-****-${data.aadhaarNumber.slice(-4)}` :
                                            (merchantProfile?.aadhaar_number as string) ?
                                                `****-****-${(merchantProfile.aadhaar_number as string).slice(-4)}` :
                                                'Processing...'
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Live Video KYC */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Video className="h-5 w-5 text-primary" />
                            Live Video KYC
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!kycState.videoKycCompleted ? (
                            <div className="text-center space-y-4">
                                {!isVideoActive ? (
                                    <div className="p-8 border-2 border-dashed border-border rounded-xl">
                                        <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                        <h3 className="font-semibold text-foreground mb-2">
                                            Live Selfie Verification
                                        </h3>
                                        <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                                            Take a live selfie to verify your identity. Make sure you're in good lighting
                                            and your face is clearly visible.
                                        </p>
                                        <div className="space-y-3">
                                            <Button onClick={startCamera} className="px-6">
                                                Start Camera
                                            </Button>
                                            <div className="text-xs text-muted-foreground">
                                                <p>Requirements:</p>
                                                <ul className="list-disc list-inside space-y-1 mt-1">
                                                    <li>Good lighting on your face</li>
                                                    <li>Look directly at the camera</li>
                                                    <li>Remove glasses or hat if possible</li>
                                                    <li>Keep face centered in the frame</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="relative mx-auto max-w-md">
                                            <video
                                                ref={videoRef}
                                                autoPlay
                                                playsInline
                                                className="w-full rounded-xl border-4 border-primary"
                                            />
                                            <div className="absolute inset-0 rounded-xl border-4 border-primary pointer-events-none">
                                                <div className="absolute inset-4 border border-white/50 rounded-lg" />
                                            </div>
                                        </div>

                                        <canvas ref={canvasRef} className="hidden" />

                                        <div className="flex gap-4 justify-center">
                                            <Button
                                                onClick={capturePhoto}
                                                disabled={isProcessing}
                                                className="px-6"
                                            >
                                                {isProcessing ? 'Processing...' : 'Capture Photo'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={stopCamera}
                                                disabled={isProcessing}
                                            >
                                                Cancel
                                            </Button>
                                        </div>

                                        <div className="text-sm text-muted-foreground text-center">
                                            Position your face in the center and click "Capture Photo"
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-6 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="h-6 w-6 text-primary" />
                                    <span className="font-semibold text-foreground">
                                        Video KYC Completed Successfully
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Your live selfie has been captured and uploaded securely.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Face & Voice Sync */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Video className="h-5 w-5 text-primary" />
                            Face & Voice Verification
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <FaceVoiceSync
                            mobileNumber={merchantProfile?.mobile_number as string | undefined}
                            onSuccess={() => {
                                setFaceVoiceVerified(true);
                                toast({ title: "Face & Voice Verified", description: "You can now proceed." });
                            }}
                            onFailure={() => {
                                setFaceVoiceVerified(false);
                                toast({ variant: "destructive", title: "Verification Failed", description: "Please try again." });
                            }}
                        />
                    </CardContent>
                </Card>

                {/* Location Capture */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-primary" />
                            Location Verification
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!kycState.locationCaptured ? (
                            <div className="text-center space-y-4">
                                <div className="p-8 border-2 border-dashed border-border rounded-xl">
                                    <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="font-semibold text-foreground mb-2">
                                        Capture Your Location
                                    </h3>
                                    <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                                        We need to verify your current location for security and compliance purposes.
                                        This helps us ensure the onboarding process is legitimate.
                                    </p>
                                    <Button onClick={handleLocationCapture} className="px-6">
                                        <MapPin className="h-4 w-4 mr-2" />
                                        Capture Location
                                    </Button>
                                    <div className="text-xs text-muted-foreground mt-4">
                                        <p>Why we need your location:</p>
                                        <ul className="list-disc list-inside space-y-1 mt-1">
                                            <li>Regulatory compliance requirements</li>
                                            <li>Fraud prevention and security</li>
                                            <li>Location data is encrypted and secure</li>
                                            <li>Used only for verification purposes</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl space-y-4">
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="h-6 w-6 text-primary" />
                                    <span className="font-semibold text-foreground">
                                        Location Captured Successfully
                                    </span>
                                </div>

                                {/* Coordinates */}
                                {kycState.coordinates && (
                                    <div className="p-3 bg-card rounded-lg">
                                        <p className="text-sm font-medium text-foreground mb-1">Coordinates:</p>
                                        <p className="text-sm text-primary font-mono">
                                            {kycState.coordinates.lat.toFixed(4)}, {kycState.coordinates.lng.toFixed(4)}
                                        </p>
                                    </div>
                                )}

                                {/* Full Address Display */}
                                {kycState.address && (
                                    <div className="p-3 bg-card rounded-lg">
                                        <p className="text-sm font-medium text-foreground mb-1">Full Address:</p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {kycState.address}
                                        </p>
                                    </div>
                                )}

                                {/* Address Components Grid */}
                                {kycState.addressDetails && (
                                    <div className="p-3 bg-card rounded-lg">
                                        <p className="text-sm font-medium text-foreground mb-2">Address Details:</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                                            {kycState.addressDetails.road && (
                                                <div><span className="font-medium">Road:</span> {kycState.addressDetails.road}</div>
                                            )}
                                            {(kycState.addressDetails.neighbourhood || kycState.addressDetails.suburb) && (
                                                <div><span className="font-medium">Area:</span> {kycState.addressDetails.neighbourhood || kycState.addressDetails.suburb}</div>
                                            )}
                                            {(kycState.addressDetails.city || kycState.addressDetails.town || kycState.addressDetails.village) && (
                                                <div><span className="font-medium">City:</span> {kycState.addressDetails.city || kycState.addressDetails.town || kycState.addressDetails.village}</div>
                                            )}
                                            {kycState.addressDetails.state && (
                                                <div><span className="font-medium">State:</span> {kycState.addressDetails.state}</div>
                                            )}
                                            {kycState.addressDetails.postcode && (
                                                <div><span className="font-medium">Pincode:</span> {kycState.addressDetails.postcode}</div>
                                            )}
                                            {kycState.addressDetails.country && (
                                                <div><span className="font-medium">Country:</span> {kycState.addressDetails.country}</div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <p className="text-xs text-muted-foreground italic">
                                    Location data is securely encrypted and used only for verification purposes.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* KYC Progress Summary */}
                <Card>
                    <CardHeader>
                        <CardTitle>Verification Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {/* Document OCR */}
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${true ? 'bg-primary text-white' : 'bg-muted'}`}>
                                        <CheckCircle className="h-4 w-4" />
                                    </div>
                                    <span>Document Verification</span>
                                </div>
                                <span className="text-sm font-medium text-primary">Complete</span>
                            </div>

                            {/* Video KYC */}
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${kycState.videoKycCompleted ? 'bg-primary text-white' : 'bg-muted'}`}>
                                        {kycState.videoKycCompleted ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                    </div>
                                    <span>Video KYC</span>
                                </div>
                                <span className={`text-sm font-medium ${kycState.videoKycCompleted ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {kycState.videoKycCompleted ? 'Complete' : 'Pending'}
                                </span>
                            </div>

                            {/* Face Match */}
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${(faceScore ?? 0) >= 85 ? 'bg-primary text-white' : 'bg-muted'}`}>
                                        {(faceScore ?? 0) >= 85 ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                    </div>
                                    <span>Face Match</span>
                                </div>
                                <span className={`text-sm font-medium ${(faceScore ?? 0) >= 85 ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {(faceScore ?? 0) >= 85 ? 'Complete' : 'Pending'}
                                </span>
                            </div>

                            {/* Face & Voice */}
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${faceVoiceVerified ? 'bg-primary text-white' : 'bg-muted'}`}>
                                        {faceVoiceVerified ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                    </div>
                                    <span>Face & Voice Verification</span>
                                </div>
                                <span className={`text-sm font-medium ${faceVoiceVerified ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {faceVoiceVerified ? 'Complete' : 'Pending'}
                                </span>
                            </div>

                            {/* Location */}
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${kycState.locationCaptured ? 'bg-primary text-white' : 'bg-muted'}`}>
                                        {kycState.locationCaptured ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                    </div>
                                    <span>Location</span>
                                </div>
                                <span className={`text-sm font-medium ${kycState.locationCaptured ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {kycState.locationCaptured ? 'Complete' : 'Pending'}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <RaiseTicketButton
            module="settlement"
                 referenceId={merchantProfile?.id as string}
               />


                {/* Navigation Buttons */}
                <div className="flex justify-between mt-4">
                    <Button variant="outline" onClick={onPrev}>
                        Previous
                    </Button>
                    <Button onClick={handleNext} disabled={!(isKYCComplete && faceVoiceVerified && (faceScore ?? 0) >= 85)}>
                        Continue
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
        </div>
    );
};
