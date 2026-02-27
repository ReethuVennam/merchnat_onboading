import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InviteData {
    id: string;
    merchant_email: string;
    merchant_name: string;
    merchant_mobile: string;
    business_name?: string;
    distributor_id: string;
    status: string;
}

export default function InvitePage() {
    const { inviteToken } = useParams<{ inviteToken: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [inviteData, setInviteData] = useState<InviteData | null>(null);
    const [accepting, setAccepting] = useState(false);

    useEffect(() => {
        const fetchInvite = async () => {
            if (!inviteToken) {
                setError('Invalid invite link');
                setLoading(false);
                return;
            }

            try {
                console.log('🔍 Fetching invite for token:', inviteToken);

                const { data, error: fetchError } = await supabase
                    .from('merchant_invitations')
                    .select('*')
                    .eq('invite_token', inviteToken)
                    .maybeSingle();

                if (fetchError) {
                    console.error('❌ Fetch error:', fetchError);
                    setError('Failed to load invite. Please check your link.');
                    return;
                }

                if (!data) {
                    console.error('❌ Invite not found');
                    setError('This invite does not exist or has expired.');
                    return;
                }

                console.log('✅ Invite found:', data);

                // Check if already accepted/clicked
                if (data.status === 'accepted' || data.status === 'registered') {
                    setError('This invite has already been used.');
                    return;
                }

                if (data.status === 'expired') {
                    setError('This invite has expired. Please contact your distributor for a new one.');
                    return;
                }

                // Store invite in localStorage for onboarding to use
                localStorage.setItem('invite_data', JSON.stringify({
                    email: data.merchant_email,
                    fullName: data.merchant_name,
                    mobileNumber: data.merchant_mobile,
                    businessName: data.business_name,
                    inviteToken
                }));

                setInviteData(data);
            } catch (err) {
                console.error('❌ Error loading invite:', err);
                setError('An error occurred. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchInvite();
    }, [inviteToken]);

    const handleAcceptInvite = async () => {
        if (!inviteData) return;

        try {
            setAccepting(true);

            // Mark invite as clicked (update to sent if still pending)
            const { error: updateError } = await supabase
                .from('merchant_invitations')
                .update({
                    updated_at: new Date().toISOString()
                })
                .eq('invite_token', inviteToken);

            if (updateError) {
                console.warn('⚠️ Failed to update invite status:', updateError);
                // Continue anyway - don't block onboarding  
            }

            // Redirect to auth signup with email pre-filled
            navigate('/auth', {
                state: {
                    mode: 'signup',
                    email: inviteData.merchant_email,
                    fullName: inviteData.merchant_name,
                    mobileNumber: inviteData.merchant_mobile,
                    inviteToken
                }
            });
        } catch (err) {
            console.error('❌ Error accepting invite:', err);
            toast({
                title: 'Error',
                description: 'Failed to accept invite. Please try again.',
                variant: 'destructive'
            });
            setAccepting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6 flex flex-col items-center space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <h2 className="font-semibold text-lg">Verifying Your Invite</h2>
                        <p className="text-sm text-muted-foreground text-center">Please wait while we verify your invitation link...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex items-center justify-center">
                            <AlertCircle className="w-12 h-12 text-red-500" />
                        </div>
                        <h2 className="font-semibold text-lg text-center text-red-700">{error}</h2>
                        <Button onClick={() => navigate('/auth')} className="w-full">
                            Go to Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4">
            <Card className="w-full max-w-md">
                <CardContent className="pt-6 space-y-6">
                    <div className="flex items-center justify-center">
                        <CheckCircle className="w-12 h-12 text-green-500" />
                    </div>

                    <div className="space-y-2 text-center">
                        <h1 className="text-2xl font-bold text-gray-900">Welcome to SabbPe!</h1>
                        <p className="text-gray-600">You've been invited to join our merchant network</p>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-4 space-y-3 text-sm">
                        <div>
                            <p className="font-medium text-gray-700">Name</p>
                            <p className="text-gray-900">{inviteData?.merchant_name}</p>
                        </div>
                        <div>
                            <p className="font-medium text-gray-700">Email</p>
                            <p className="text-gray-900">{inviteData?.merchant_email}</p>
                        </div>
                        <div>
                            <p className="font-medium text-gray-700">Mobile</p>
                            <p className="text-gray-900">{inviteData?.merchant_mobile}</p>
                        </div>
                        {inviteData?.business_name && (
                            <div>
                                <p className="font-medium text-gray-700">Business</p>
                                <p className="text-gray-900">{inviteData.business_name}</p>
                            </div>
                        )}
                    </div>

                    <div className="text-center text-sm text-gray-600">
                        <p>Click the button below to start your onboarding journey.</p>
                        <p>Your information will be pre-filled for convenience.</p>
                    </div>

                    <Button
                        onClick={handleAcceptInvite}
                        disabled={accepting}
                        className="w-full"
                        size="lg"
                    >
                        {accepting ? 'Processing...' : 'Start Onboarding'}
                    </Button>

                    <p className="text-xs text-gray-500 text-center">
                        Once you click above, you'll be able to create your account and complete the onboarding process.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
