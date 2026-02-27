import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UPIQRCode } from '@/components/onboarding/UPIQRCode';
import {
    CheckCircle,
    Clock,
    AlertCircle,
    Phone,
    Mail,
    Upload,
    RefreshCw,
    ArrowLeft
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { useMerchantData } from '@/hooks/useMerchantData';
import { useNavigate } from 'react-router-dom';

type KYCStatus = 'pending' | 'verified' | 'approved' | 'rejected';

export const OnboardingDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { merchantProfile, kycData, loading, refetch } = useMerchantData();

    // Debug log
    useEffect(() => {
        console.log('🔍 Dashboard Status Check:', {
            status: merchantProfile?.onboarding_status,
            upi_vpa: merchantProfile?.upi_vpa,
            upi_qr_string: merchantProfile?.upi_qr_string,
            fullProfile: merchantProfile
        });
    }, [merchantProfile]);

    const getStatusInfo = (status: KYCStatus) => {
        switch (status) {
            case 'pending':
                return {
                    icon: Clock,
                    color: 'bg-yellow-500',
                    badgeVariant: 'secondary' as const,
                    title: 'Application Submitted',
                    description: 'Your application is submitted. KYC Under Review by SabbPe',
                    timeframe: 'KYC Review in progress ~5min'
                };
            case 'verified':
                return {
                    icon: RefreshCw,
                    color: 'bg-blue-500',
                    badgeVariant: 'default' as const,
                    title: 'KYC Verified ✅',
                    description: 'Your KYC has been verified. Awaiting bank approval for account activation.',
                    timeframe: 'Bank review in progress ~15min'
                };
            case 'approved':
                return {
                    icon: CheckCircle,
                    color: 'bg-green-500',
                    badgeVariant: 'default' as const,
                    title: 'Account Approved!',
                    description: 'Congratulations! Your merchant account has been approved.',
                    timeframe: 'You can now start accepting payments'
                };
            case 'rejected':
                return {
                    icon: AlertCircle,
                    color: 'bg-red-500',
                    badgeVariant: 'destructive' as const,
                    title: 'Application Rejected',
                    description: 'Your application has been rejected. Please contact support for more details.',
                    timeframe: 'Contact support for clarification'
                };
        }
    };

    // Map database status to dashboard status
    const kycStatus: KYCStatus = merchantProfile?.onboarding_status === 'pending_bank_approval' ? 'verified' :
        merchantProfile?.onboarding_status === 'verified' ? 'verified' :
            merchantProfile?.onboarding_status === 'approved' ? 'approved' :
                merchantProfile?.onboarding_status === 'rejected' ? 'rejected' :
                    'pending';

    const applicationId = merchantProfile?.id?.slice(-6).toUpperCase() || 'LOADING';

    const statusInfo = getStatusInfo(kycStatus);
    const StatusIcon = statusInfo.icon;

    // Determine verification steps based on actual data
    const verificationSteps = [
        {
            name: 'Document Upload',
            status: (merchantProfile?.pan_number && merchantProfile?.aadhaar_number) ? 'completed' : 'pending'
        },
        {
            name: 'KYC Verification',
            status: kycData?.video_kyc_completed ? 'completed' : 'pending'
        },
        {
            name: 'Bank Verification',
            status: kycStatus === 'approved' ? 'completed' : 'pending'
        },
        {
            name: 'Final Review',
            status: kycStatus === 'approved' ? 'completed' : 'pending'
        },
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5">
            <div className="container max-w-6xl mx-auto px-4 py-8">
                {/* Back Button */}
                <div className="mb-6">
                    <Button
                        variant="outline"
                        onClick={() => navigate('/')}
                        className="gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Button>
                </div>

                {/* Header */}
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
                    {/* Main Status Card */}
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
                                    <div className={`p-3 rounded-full ${statusInfo.color} text-white`}>
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

                                {/* Application Details */}
                                <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl">
                                    <div>
                                        <span className="text-sm text-muted-foreground">Application ID:</span>
                                        <div className="font-mono text-foreground">SABBPE{applicationId}</div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-muted-foreground">Submitted On:</span>
                                        <div className="text-foreground">
                                            {merchantProfile?.created_at ?
                                                new Date(merchantProfile.created_at).toLocaleDateString() :
                                                new Date().toLocaleDateString()
                                            }
                                        </div>
                                    </div>
                                </div>

                                {/* Verification Progress */}
                                <div className="mt-6">
                                    <h4 className="font-semibold text-foreground mb-4">Verification Progress</h4>
                                    <div className="space-y-3">
                                        {verificationSteps.map((step, index) => (
                                            <div key={index} className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step.status === 'completed'
                                                    ? 'bg-primary text-white'
                                                    : 'bg-muted text-muted-foreground'
                                                    }`}>
                                                    {step.status === 'completed' ? (
                                                        <CheckCircle className="h-4 w-4" />
                                                    ) : (
                                                        <Clock className="h-4 w-4" />
                                                    )}
                                                </div>
                                                <span className={step.status === 'completed' ? 'text-foreground' : 'text-muted-foreground'}>
                                                    {step.name}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                {kycStatus === 'rejected' && (
                                    <div className="mt-6">
                                        <Button
                                            className="w-full"
                                            onClick={() => navigate('/merchant-onboarding')}
                                        >
                                            <Upload className="h-4 w-4 mr-2" />
                                            Re-upload Documents
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar - Right Column */}
                    <div className="space-y-6">
                        {/* UPI QR Code - Top Right when approved */}
                        {kycStatus === 'approved' && merchantProfile?.upi_qr_string && merchantProfile?.upi_vpa && (
                            <UPIQRCode
                                upiString={merchantProfile.upi_qr_string}
                                vpa={merchantProfile.upi_vpa}
                                merchantName={merchantProfile.business_name || 'Merchant'}
                            />
                        )}

                        {/* Quick Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Quick Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => {
                                        refetch();
                                        window.location.reload();
                                    }}
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Refresh Status
                                </Button>

                                {(kycStatus === 'pending' || kycStatus === 'rejected') && (
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start"
                                        onClick={() => navigate('/merchant-onboarding')}
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Continue Onboarding
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        {/* Support */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Need Help?</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="text-sm text-muted-foreground mb-3">
                                    Our customer support team is here to help you 24/7
                                </div>

                                <Button variant="outline" className="w-full justify-start">
                                    <Phone className="h-4 w-4 mr-2" />
                                    Call Support
                                </Button>

                                <Button variant="outline" className="w-full justify-start">
                                    <Mail className="h-4 w-4 mr-2" />
                                    Email Support
                                </Button>
                                <Button
                                                                    variant="outline"
                                                                    className="w-full justify-start"
                                                                    style={{ color: '#25D366', fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer' }}
                                                                    onClick={() => {
                                                                        const message = `Hello SabPe Support Team,\n\nI am currently in the process of completing my merchant onboarding application and have encountered an issue that is preventing me from proceeding further.\n\nI have carefully reviewed the information provided, but I am still unable to resolve the problem on my own. I kindly request your assistance in guiding me through the necessary steps to complete the onboarding successfully.\n\nPlease let me know the required actions or documents, if any.\n\nThank you for your time and support.`;
                                                                        const encodedMessage = encodeURIComponent(message);
                                                                        const whatsappUrl = `https://wa.me/919958750013?text=${encodedMessage}`;
                                                                        window.open(whatsappUrl, '_blank');
                                                                    }}
                                                                >
                                                                    <svg style={{marginRight: 8}} xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24"><path fill="#25D366" d="M12 2C6.477 2 2 6.477 2 12c0 1.85.504 3.59 1.38 5.08L2.05 22.05l5.08-1.33A9.953 9.953 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Zm0 18a7.952 7.952 0 0 1-4.07-1.13l-.29-.17-3.02.79.8-2.95-.18-.3A7.963 7.963 0 1 1 20 12c0 4.418-3.582 8-8 8Zm4.29-5.71c-.2-.1-1.18-.58-1.36-.65-.18-.07-.31-.1-.44.1-.13.2-.5.65-.62.78-.12.13-.23.15-.43.05-.2-.1-.84-.31-1.6-.98-.59-.53-.99-1.18-1.11-1.38-.12-.2-.01-.3.09-.4.09-.09.2-.23.3-.34.1-.11.13-.19.2-.32.07-.13.04-.24-.02-.34-.06-.1-.44-1.06-.6-1.45-.16-.39-.32-.34-.44-.35-.11-.01-.24-.01-.37-.01-.13 0-.34.05-.52.24.-.18.19-.7.68-.7 1.66 0 .98.72 1.93.82 2.07.1.14 1.41 2.16 3.42 2.95.48.17.85.27 1.14.34.48.1.92.09 1.27.06.39-.04 1.18-.48 1.35-.94.17-.46.17-.85.12-.94.-.05-.09-.18.-.13.-.38.-.23Z"/></svg>
                                                                        WhatsApp Support
                                                                </Button>
                                {/* WhatsApp Help at the bottom of every step */}
                                <div style={{marginTop: '2rem', textAlign: 'center'}}>
                                    <p style={{fontWeight: 500, marginBottom: 8}}>Need Help on WhatsApp?</p>
                                    <button
                                        onClick={() => {
                                            const message = `Hello SabPe Support Team,\n\nI am currently in the process of completing my merchant onboarding application and have encountered an issue that is preventing me from proceeding further.\n\nI have carefully reviewed the information provided, but I am still unable to resolve the problem on my own. I kindly request your assistance in guiding me through the necessary steps to complete the onboarding successfully.\n\nPlease let me know the required actions or documents, if any.\n\nThank you for your time and support.`;
                                            const encodedMessage = encodeURIComponent(message);
                                            const whatsappUrl = `https://wa.me/919958750013?text=${encodedMessage}`;
                                            window.open(whatsappUrl, '_blank');
                                        }}
                                        style={{color: '#25D366', fontWeight: 600, fontSize: 16, border: 'none', background: 'transparent', cursor: 'pointer'}}
                                    >
                                        Chat with SabPe Support
                                    </button>
                                </div>


                                <div className="pt-3 border-t">
                                    <div className="text-sm">
                                        <div className="font-medium text-foreground">Support Hours:</div>
                                        <div className="text-muted-foreground">24/7 - All days</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Next Steps */}
                        {kycStatus === 'approved' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Next Steps</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="text-sm text-muted-foreground mb-3">
                                        Your account is ready! Here's what you can do next:
                                    </div>

                                    <Button className="w-full">
                                        Access Merchant Portal
                                    </Button>

                                    <Button variant="outline" className="w-full">
                                        Download POS App
                                    </Button>

                                    <Button variant="outline" className="w-full">
                                        Integration Docs
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};