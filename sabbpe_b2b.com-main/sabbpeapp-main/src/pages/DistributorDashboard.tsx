'use client';

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { API_BASE_URL } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, Users, CheckCircle, XCircle, MessageSquare, Settings, LogOut, Menu, X, Upload, CreditCard, Loader2 } from 'lucide-react';

type PayoutConfig = {
    minimum_payout_amount: number;
    vpid: string;
    notes: string;
};

type AutopayConfig = {
    settlement_frequency: string;
    minimum_payout_amount: number;
    vpid: string;
    notes: string;
};

type AadhaarConfig = {
    aadhaar_number: string;
    verification_level: string;
    notes: string;
};

type ProductConfigRow = {
    product_type: string;
    settlement_frequency: string;
    minimum_payout_amount: number;
    notes: string;
};

export default function DistributorDashboard() {
    const navigate = useNavigate();
    const { toast } = useToast();

    // Tab state
    const [activeTab, setActiveTab] = useState('dashboard');

    // Data states
    const [merchants, setMerchants] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [distributorId, setDistributorId] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [txLoading, setTxLoading] = useState(false);

    // UI states
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [inviteData, setInviteData] = useState({ name: '', mobile: '', email: '' });
    const [sending, setSending] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Bulk invite states
    const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
    const [bulkInviteCSVFile, setBulkInviteCSVFile] = useState<File | null>(null);
    const [bulkInviteSending, setBulkInviteSending] = useState(false);
    const [bulkInviteResults, setBulkInviteResults] = useState<any>(null);

    // Invitations list states
    const [invitationsList, setInvitationsList] = useState<any[]>([]);
    const [invitationsLoading, setInvitationsLoading] = useState(false);

    // Create Merchant form states
    const [createMerchantForm, setCreateMerchantForm] = useState({
        full_name: '',
        mobile_number: '',
        email: '',
        business_name: '',
        entity_type: 'sole_proprietor',
        pan_number: '',
        gst_number: '',
        password: '',
        confirm_password: '',
    });

    // Payout config state
    const [payoutForm, setPayoutForm] = useState<PayoutConfig>({
        minimum_payout_amount: 0,
        vpid: '',
        notes: '',
    });
    const [savingPayout, setSavingPayout] = useState(false);

    // Autopay config state
    const [autopayForm, setAutopayForm] = useState<AutopayConfig>({
        settlement_frequency: 'daily',
        minimum_payout_amount: 0,
        vpid: '',
        notes: '',
    });
    const [savingAutopay, setSavingAutopay] = useState(false);

    // Aadhaar config state
    const [aadhaarForm, setAadhaarForm] = useState<AadhaarConfig>({
        aadhaar_number: '',
        verification_level: 'basic',
        notes: '',
    });
    const [savingAadhaar, setSavingAadhaar] = useState(false);
    // Product assignment UI state
    const productsCatalog = [
        { id: 'upi_qr', name: 'UPI QR' },
        { id: 'upi_qr_soundbox', name: 'UPI QR + Soundbox' },
        { id: 'pos', name: 'POS Terminal' },
        { id: 'payment_gateway', name: 'Payment Gateway' },
        { id: 'current_account', name: 'Current Account' }
    ];

    const [activeProduct, setActiveProduct] = useState<string | null>(null);
    const [assignMerchantId, setAssignMerchantId] = useState<string | null>(null);
    const [assignForSelf, setAssignForSelf] = useState(false);
    const [assignSettlement, setAssignSettlement] = useState<'same_day' | 'next_day'>('next_day');
    const [assigning, setAssigning] = useState(false);

    // Utility function to extract error message
    const getErrorMessage = (error: any): string => {
        if (typeof error === 'string') return error;
        if (error?.message) return error.message;
        if (error?.details) return error.details;
        return 'An unknown error occurred';
    };

    // Ensure frontend URL is normalized (adds missing protocol or colon before port)
    const normalizeFrontendUrl = (raw?: string) => {
        let url = raw || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');
        if (!url) return 'http://localhost:5173';
        // add protocol if missing
        if (!/^[a-zA-Z]+:\/\//.test(url)) url = 'http://' + url;
        // fix missing colon before port, e.g. http://localhost5173 -> http://localhost:5173
        url = url.replace(/:\/\/([^:\/]+)(\d{2,5})/, '://$1:$2');
        // also handle localhost without colon but digits attached
        url = url.replace(/(localhost)(\d{2,5})/, '$1:$2');
        // strip trailing slash
        url = url.replace(/\/$/, '');
        return url;
    };

    // Fetch dashboard data
    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/auth');
                return;
            }

            setDistributorId(user.id);

            // Fetch merchant profiles
            const { data: merchantsData, error: merchantsError } = await supabase
                .from('merchant_profiles')
                .select('*')
                .eq('distributor_id', user.id);

            if (merchantsError) throw merchantsError;
            setMerchants(merchantsData || []);

            // Calculate stats
            const total_merchants = merchantsData?.length || 0;
            const pending_count = merchantsData?.filter((m: any) => m.onboarding_status === 'pending')?.length || 0;
            const approved_count = merchantsData?.filter((m: any) => m.onboarding_status === 'approved')?.length || 0;
            const rejected_count = merchantsData?.filter((m: any) => m.onboarding_status === 'rejected')?.length || 0;

            setStats({ total_merchants, pending_count, approved_count, rejected_count });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            toast({
                title: 'Error',
                description: getErrorMessage(error),
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [navigate, toast]);

    // Fetch invitations list
    const fetchInvitations = useCallback(async () => {
        if (!distributorId) return;
        try {
            setInvitationsLoading(true);
            const { data, error } = await supabase
                .from('merchant_invitations')
                .select('*')
                .eq('distributor_id', distributorId)
                .order('sent_at', { ascending: false });

            if (error) throw error;
            setInvitationsList(data || []);
        } catch (error) {
            console.error('Error fetching invitations:', error);
            toast({
                title: 'Error',
                description: 'Failed to load invitations',
                variant: 'destructive',
            });
        } finally {
            setInvitationsLoading(false);
        }
    }, [distributorId, toast]);

    // Handle create merchant
    const handleCreateMerchant = useCallback(async () => {
        try {
            if (!createMerchantForm.full_name || !createMerchantForm.mobile_number || !createMerchantForm.email) {
                toast({
                    title: 'Error',
                    description: 'Full name, email, and mobile are required',
                    variant: 'destructive',
                });
                return;
            }

            if (!createMerchantForm.email.includes('@')) {
                toast({
                    title: 'Error',
                    description: 'Please enter a valid email',
                    variant: 'destructive',
                });
                return;
            }

            // Use distributor-provided password
            const providedPassword = createMerchantForm.password?.trim();

            if (!providedPassword || providedPassword.length < 6) {
                toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
                return;
            }

            if (providedPassword !== createMerchantForm.confirm_password) {
                toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
                return;
            }

            // Call backend to create merchant auth user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.id) {
                toast({
                    title: 'Error',
                    description: 'Not authenticated',
                    variant: 'destructive',
                });
                return;
            }

            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;

            if (!token) {
                toast({
                    title: 'Error',
                    description: 'Session token not available',
                    variant: 'destructive',
                });
                return;
            }

            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8888';
            const url = `${backendUrl}/api/distributor/create-merchant`;
            
            console.log('🔵 Creating merchant with:', {
                backendUrl,
                url,
                email: createMerchantForm.email,
                fullName: createMerchantForm.full_name,
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    email: createMerchantForm.email,
                    password: providedPassword,
                    fullName: createMerchantForm.full_name,
                    mobileNumber: createMerchantForm.mobile_number,
                    distributorId: user.id,
                    businessName: createMerchantForm.business_name || null,
                    entityType: createMerchantForm.entity_type,
                    panNumber: createMerchantForm.pan_number || null,
                    gstNumber: createMerchantForm.gst_number || null,
                }),
            });

            console.log('✅ Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ API error:', errorData);
                throw new Error(errorData.error?.message || `Failed to create merchant: ${response.statusText}`);
            }

            const result = await response.json();
            const { merchantUserId, merchantProfileId } = result.data;

            console.log('✅ Merchant created:', { merchantUserId, merchantProfileId });

            toast({
                title: 'Success',
                description: 'Merchant account created. Opening onboarding in a new tab...',
            });

            // Open merchant onboarding in a new tab
            const onboardingUrl = `/distributor/merchant-onboarding?merchantUserId=${merchantUserId}&merchantEmail=${encodeURIComponent(createMerchantForm.email)}&merchantPassword=${encodeURIComponent(providedPassword)}&merchantName=${encodeURIComponent(createMerchantForm.full_name)}&distributorId=${user.id}&merchantProfileId=${merchantProfileId}`;
            
            // Open in new tab
            window.open(onboardingUrl, '_blank');
            
            // Reset form
            setCreateMerchantForm({
                full_name: '',
                mobile_number: '',
                email: '',
                business_name: '',
                entity_type: 'sole_proprietor',
                pan_number: '',
                gst_number: '',
                password: '',
                confirm_password: '',
            });
            
            toast({
                title: 'Info',
                description: 'New tab opened with onboarding form. Complete it and return here.',
            });
        } catch (error) {
            console.error('❌ Error creating merchant:', error);
            const message = error instanceof Error ? error.message : String(error);
            toast({
                title: 'Error',
                description: message || 'Failed to create merchant. Make sure backend is running.',
                variant: 'destructive',
            });
        }
    }, [createMerchantForm, navigate, toast]);

    // Handle send invitation
    const handleSendInvitation = useCallback(async () => {
        try {
            if (!inviteData.name || !inviteData.mobile || !inviteData.email) {
                toast({
                    title: 'Error',
                    description: 'Please fill in all invitation fields',
                    variant: 'destructive',
                });
                return;
            }

            setSending(true);

            // Get auth token
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                toast({
                    title: 'Error',
                    description: 'Not authenticated',
                    variant: 'destructive',
                });
                setSending(false);
                return;
            }

            // Call backend API to send SMS invite
            const response = await fetch(`${API_BASE_URL}/invites/bulk-send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    merchants: [{
                        fullName: inviteData.name,
                        mobileNumber: inviteData.mobile,
                        email: inviteData.email
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to send invitation');
            }

            const result = await response.json();

            toast({
                title: 'Success',
                description: `Invitation sent to ${inviteData.email} via SMS!`,
            });

            setInviteDialogOpen(false);
            setInviteData({ name: '', mobile: '', email: '' });

            // Refresh invitations list
            if (activeTab === 'invitations') {
                fetchInvitations();
            }
        } catch (error) {
            console.error('Error sending invitation:', error);
            toast({
                title: 'Error',
                description: getErrorMessage(error),
                variant: 'destructive',
            });
        } finally {
            setSending(false);
        }
    }, [inviteData, activeTab, fetchInvitations, toast]);

    // Handle bulk invite
    // Handle CSV file selection
    const handleCSVFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.name.endsWith('.csv')) {
                toast({
                    title: 'Error',
                    description: 'Please select a CSV file',
                    variant: 'destructive',
                });
                return;
            }
            setBulkInviteCSVFile(file);
        }
    }, [toast]);

    // Parse CSV file and create merchants
    const handleBulkInvite = useCallback(async () => {
        try {
            if (!bulkInviteCSVFile) {
                toast({
                    title: 'Error',
                    description: 'Please select a CSV file',
                    variant: 'destructive',
                });
                return;
            }

            setBulkInviteSending(true);

            // Read and parse CSV file
            const text = await bulkInviteCSVFile.text();
            const lines = text.trim().split('\n').filter(l => l.trim());

            if (lines.length < 2) {
                toast({
                    title: 'Error',
                    description: 'CSV must have header row and at least one data row',
                    variant: 'destructive',
                });
                setBulkInviteSending(false);
                return;
            }

            // Parse header
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const nameIndex = headers.findIndex(h => h.includes('name') || h.includes('merchant'));
            const mobileIndex = headers.findIndex(h => h.includes('mobile') || h.includes('phone'));
            const emailIndex = headers.findIndex(h => h.includes('email'));

            if (nameIndex === -1 || mobileIndex === -1 || emailIndex === -1) {
                toast({
                    title: 'Error',
                    description: 'CSV must contain columns: merchant_name, merchant_mobile, merchant_email',
                    variant: 'destructive',
                });
                setBulkInviteSending(false);
                return;
            }

            // Parse data rows
            const merchants = lines
                .slice(1)
                .map((line, idx) => {
                    const cols = line.split(',').map(c => c.trim());
                    return {
                        fullName: cols[nameIndex]?.trim() || '',
                        mobileNumber: cols[mobileIndex]?.trim() || '',
                        email: cols[emailIndex]?.trim() || '',
                        rowIndex: idx + 2 // Line number in file (accounting for header)
                    };
                })
                .filter(m => m.fullName && m.mobileNumber && m.email);

            if (merchants.length === 0) {
                toast({
                    title: 'Error',
                    description: 'No valid merchants found in CSV',
                    variant: 'destructive',
                });
                setBulkInviteSending(false);
                return;
            }

            // Call backend API to send SMS invites
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                toast({
                    title: 'Error',
                    description: 'Not authenticated',
                    variant: 'destructive',
                });
                setBulkInviteSending(false);
                return;
            }

            const response = await fetch(`${API_BASE_URL}/invites/bulk-send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ merchants })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to send invitations');
            }

            const result = await response.json();

            toast({
                title: 'Success',
                description: `Sent ${result.sent} invitations via SMS. ${result.failed} failed.`,
            });

            setBulkInviteCSVFile(null);
            // Reset file input
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

            // Refresh invitations list
            if (activeTab === 'invitations') {
                fetchInvitations();
            }
        } catch (error) {
            console.error('❌ Bulk invite error:', error);
            toast({
                title: 'Error',
                description: getErrorMessage(error),
                variant: 'destructive',
            });
        } finally {
            setBulkInviteSending(false);
        }
    }, [bulkInviteCSVFile, activeTab, fetchInvitations, toast]);

    // Handle payout configuration
    const handleSavePayoutConfig = useCallback(async () => {
        try {
            if (!distributorId) return;

            setSavingPayout(true);
            const { error } = await (supabase as any)
                .from('distributor_configs')
                .upsert(
                    [
                        {
                            distributor_id: distributorId,
                            config_type: 'payout',
                            config_data: payoutForm,
                        },
                    ],
                    { onConflict: 'distributor_id,config_type' }
                );

            if (error) throw error;

            toast({
                title: 'Success',
                description: 'Payout configuration saved',
            });
        } catch (error) {
            console.error('Error saving payout config:', error);
            toast({
                title: 'Error',
                description: getErrorMessage(error),
                variant: 'destructive',
            });
        } finally {
            setSavingPayout(false);
        }
    }, [payoutForm, distributorId, toast]);

    // Handle autopay configuration
    const handleSaveAutopayConfig = useCallback(async () => {
        try {
            if (!distributorId) return;

            setSavingAutopay(true);
            const { error } = await (supabase as any)
                .from('distributor_configs')
                .upsert(
                    [
                        {
                            distributor_id: distributorId,
                            config_type: 'autopay',
                            config_data: autopayForm,
                        },
                    ],
                    { onConflict: 'distributor_id,config_type' }
                );

            if (error) throw error;

            toast({
                title: 'Success',
                description: 'Autopay configuration saved',
            });
        } catch (error) {
            console.error('Error saving autopay config:', error);
            toast({
                title: 'Error',
                description: getErrorMessage(error),
                variant: 'destructive',
            });
        } finally {
            setSavingAutopay(false);
        }
    }, [autopayForm, distributorId, toast]);

    // Handle Aadhaar configuration
    const handleSaveAadhaarConfig = useCallback(async () => {
        try {
            if (!distributorId) return;

            setSavingAadhaar(true);
            const { error } = await (supabase as any)
                .from('distributor_configs')
                .upsert(
                    [
                        {
                            distributor_id: distributorId,
                            config_type: 'aadhaar',
                            config_data: aadhaarForm,
                        },
                    ],
                    { onConflict: 'distributor_id,config_type' }
                );

            if (error) throw error;

            toast({
                title: 'Success',
                description: 'Aadhaar configuration saved',
            });
        } catch (error) {
            console.error('Error saving Aadhaar config:', error);
            toast({
                title: 'Error',
                description: getErrorMessage(error),
                variant: 'destructive',
            });
        } finally {
            setSavingAadhaar(false);
        }
    }, [aadhaarForm, distributorId, toast]);

    // Fetch transactions for distributor
    const fetchTransactions = useCallback(async () => {
        try {
            setTxLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) return;

            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8888';
            const resp = await fetch(`${backendUrl}/api/distributor/transactions`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => null);
                throw new Error(err?.error?.message || resp.statusText);
            }

            const result = await resp.json();
            setTransactions(result.data || []);
        } catch (error) {
            console.error('Error fetching transactions:', error);
            toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
        } finally {
            setTxLoading(false);
        }
    }, [toast]);

    // Handle logout
    const handleLogout = useCallback(async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            navigate('/auth');
        } catch (error) {
            console.error('Error logging out:', error);
            toast({
                title: 'Error',
                description: getErrorMessage(error),
                variant: 'destructive',
            });
        }
    }, [navigate, toast]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    useEffect(() => {
        if (activeTab === 'transactions') {
            fetchTransactions();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'invitations') {
            fetchInvitations();
        }
    }, [activeTab, fetchInvitations]);


    const filteredMerchants = merchants.filter(m => {
        const matchesSearch = m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             m.business_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || m.onboarding_status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const chartData = [
        { name: 'Pending', value: stats?.pending_count || 0 },
        { name: 'Approved', value: stats?.approved_count || 0 },
        { name: 'Rejected', value: stats?.rejected_count || 0 },
    ];

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'chart' },
        { id: 'create-merchant', label: 'Create Merchant', icon: 'users' },
        { id: 'transactions', label: 'Transactions', icon: 'credit-card' },
        { id: 'invitations', label: 'Invitations', icon: 'mail' },
        { id: 'payments', label: 'Product Payments', icon: 'settings', hasSubmenu: true },
        { id: 'settings', label: 'Settings', icon: 'settings' },
    ];

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    {sidebarOpen && <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    </Button>
                </div>

                <nav className="flex-1 px-3 py-6 space-y-2">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                                activeTab === item.id
                                    ? 'bg-blue-50 text-blue-600 font-medium'
                                    : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            {item.id === 'chart' && <BarChart className="h-4 w-4" />}
                            {item.id === 'users' && <Users className="h-4 w-4" />}
                            {item.id === 'mail' && <MessageSquare className="h-4 w-4" />}
                            {item.id === 'settings' && <Settings className="h-4 w-4" />}
                            {sidebarOpen && <span>{item.label}</span>}
                        </button>
                    ))}
                </nav>

                <div className="p-3 border-t border-gray-200">
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleLogout}
                    >
                        {sidebarOpen ? (
                            <>
                                <LogOut className="h-4 w-4 mr-2" />
                                Logout
                            </>
                        ) : (
                            <LogOut className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-8 space-y-8">
                    {/* Dashboard Tab */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
                                <p className="text-gray-600">Welcome to your distributor dashboard</p>
                            </div>

                            {/* Stats Cards */}
                            {stats && (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <Card>
                                        <CardContent className="pt-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-gray-600 text-sm font-medium">Total Merchants</p>
                                                    <p className="text-3xl font-bold text-gray-900">{stats.total_merchants}</p>
                                                </div>
                                                <Users className="h-8 w-8 text-blue-500" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardContent className="pt-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-gray-600 text-sm font-medium">Pending</p>
                                                    <p className="text-3xl font-bold text-gray-900">{stats.pending_count}</p>
                                                </div>
                                                <Calendar className="h-8 w-8 text-yellow-500" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardContent className="pt-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-gray-600 text-sm font-medium">Approved</p>
                                                    <p className="text-3xl font-bold text-gray-900">{stats.approved_count}</p>
                                                </div>
                                                <CheckCircle className="h-8 w-8 text-green-500" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardContent className="pt-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-gray-600 text-sm font-medium">Rejected</p>
                                                    <p className="text-3xl font-bold text-gray-900">{stats.rejected_count}</p>
                                                </div>
                                                <XCircle className="h-8 w-8 text-red-500" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* Chart */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Merchant Status Overview</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip />
                                            <Bar dataKey="value" fill="#3b82f6" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            {/* Merchants List */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Merchants</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <Input
                                                placeholder="Search merchants..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="flex-1"
                                            />
                                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                                <SelectTrigger className="w-40">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Status</SelectItem>
                                                    <SelectItem value="pending">Pending</SelectItem>
                                                    <SelectItem value="approved">Approved</SelectItem>
                                                    <SelectItem value="rejected">Rejected</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="divide-y">
                                            {filteredMerchants.map(merchant => (
                                                <div key={merchant.id} className="py-4 flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium text-gray-900">{merchant.full_name}</p>
                                                        <p className="text-sm text-gray-600">{merchant.business_name}</p>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                            merchant.onboarding_status === 'approved' ? 'bg-green-100 text-green-800' :
                                                            merchant.onboarding_status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                            'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                            {merchant.onboarding_status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Create Merchant Tab */}
                    {activeTab === 'create-merchant' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-3xl font-bold text-gray-900">Create Merchant</h2>
                                <p className="text-gray-600">Add a new merchant to your network</p>
                            </div>

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="space-y-4">
                                        <Input
                                            placeholder="Full Name"
                                            value={createMerchantForm.full_name}
                                            onChange={(e) => setCreateMerchantForm({ ...createMerchantForm, full_name: e.target.value })}
                                        />
                                        <Input
                                            placeholder="Mobile Number"
                                            type="tel"
                                            value={createMerchantForm.mobile_number}
                                            onChange={(e) => setCreateMerchantForm({ ...createMerchantForm, mobile_number: e.target.value })}
                                        />
                                        <Input
                                            placeholder="Email"
                                            type="email"
                                            value={createMerchantForm.email}
                                            onChange={(e) => setCreateMerchantForm({ ...createMerchantForm, email: e.target.value })}
                                        />
                                        <Input
                                            placeholder="Business Name"
                                            value={createMerchantForm.business_name}
                                            onChange={(e) => setCreateMerchantForm({ ...createMerchantForm, business_name: e.target.value })}
                                        />
                                        <Select value={createMerchantForm.entity_type} onValueChange={(value) => setCreateMerchantForm({ ...createMerchantForm, entity_type: value })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="sole_proprietor">Sole Proprietor</SelectItem>
                                                <SelectItem value="partnership">Partnership</SelectItem>
                                                <SelectItem value="pvt_ltd">Pvt Ltd</SelectItem>
                                                <SelectItem value="llp">LLP</SelectItem>
                                                <SelectItem value="ngo">NGO</SelectItem>
                                                <SelectItem value="trust">Trust</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            placeholder="PAN Number"
                                            value={createMerchantForm.pan_number}
                                            onChange={(e) => setCreateMerchantForm({ ...createMerchantForm, pan_number: e.target.value })}
                                        />
                                        <Input
                                            placeholder="GST Number"
                                            value={createMerchantForm.gst_number}
                                            onChange={(e) => setCreateMerchantForm({ ...createMerchantForm, gst_number: e.target.value })}
                                        />
                                        <Input
                                            placeholder="Password (min 6 chars)"
                                            type="password"
                                            value={createMerchantForm.password}
                                            onChange={(e) => setCreateMerchantForm({ ...createMerchantForm, password: e.target.value })}
                                            autoComplete="new-password"
                                        />
                                        <Input
                                            placeholder="Confirm Password"
                                            type="password"
                                            value={createMerchantForm.confirm_password}
                                            onChange={(e) => setCreateMerchantForm({ ...createMerchantForm, confirm_password: e.target.value })}
                                            autoComplete="new-password"
                                        />
                                        <Button onClick={handleCreateMerchant} className="w-full">Create Merchant</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Transactions Tab */}
                    {activeTab === 'transactions' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-3xl font-bold text-gray-900">Transactions</h2>
                                <p className="text-gray-600">View all payments processed by your merchants</p>
                            </div>

                            {txLoading ? (
                                <div className="flex justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Recent Transactions</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {transactions.length === 0 ? (
                                            <p className="text-muted-foreground">No transactions found.</p>
                                        ) : (
                                            <div className="overflow-auto">
                                                <table className="w-full table-auto text-left">
                                                    <thead>
                                                        <tr className="bg-gray-100">
                                                            <th className="px-4 py-2">Merchant</th>
                                                            <th className="px-4 py-2">Amount</th>
                                                            <th className="px-4 py-2">Currency</th>
                                                            <th className="px-4 py-2">Status</th>
                                                            <th className="px-4 py-2">Date</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {transactions.map(tx => (
                                                            <tr key={tx.id}>
                                                                <td className="px-4 py-2">{tx.merchant_id}</td>
                                                                <td className="px-4 py-2">{tx.amount}</td>
                                                                <td className="px-4 py-2">{tx.currency}</td>
                                                                <td className="px-4 py-2">{tx.status}</td>
                                                                <td className="px-4 py-2">{new Date(tx.created_at).toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    {/* Invitations Tab */}
                    {activeTab === 'invitations' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-3xl font-bold text-gray-900">Send Invitations</h2>
                                    <p className="text-gray-600">Invite merchants to join your network</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={() => setInviteDialogOpen(true)}>Single Invite</Button>
                                    <Button onClick={() => setBulkInviteOpen(true)} variant="secondary">Bulk Invite</Button>
                                </div>
                            </div>

                            {/* Single Invite */}
                            {inviteDialogOpen && (
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="space-y-4">
                                            <Input
                                                placeholder="Merchant Name"
                                                value={inviteData.name}
                                                onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                                            />
                                            <Input
                                                placeholder="Mobile Number"
                                                value={inviteData.mobile}
                                                onChange={(e) => setInviteData({ ...inviteData, mobile: e.target.value })}
                                            />
                                            <Input
                                                placeholder="Email"
                                                type="email"
                                                value={inviteData.email}
                                                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                                            />
                                            <div className="flex gap-2">
                                                <Button onClick={handleSendInvitation} disabled={sending} className="flex-1">
                                                    {sending ? 'Sending...' : 'Send Invitation'}
                                                </Button>
                                                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Bulk Invite */}
                            {bulkInviteOpen && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Bulk Invite Merchants via CSV</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-4">
                                                Upload CSV File with Merchant Details
                                            </label>
                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition">
                                                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                                                <div className="flex items-center justify-center">
                                                    <label className="cursor-pointer">
                                                        <span className="text-blue-600 hover:text-blue-700 font-medium">
                                                            Click to upload
                                                        </span>
                                                        <input
                                                            type="file"
                                                            accept=".csv"
                                                            onChange={handleCSVFileChange}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                    <span className="text-gray-600 ml-2">or drag and drop</span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">CSV files only</p>
                                            </div>

                                            {bulkInviteCSVFile && (
                                                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm">
                                                            <p className="font-medium text-green-900">✅ {bulkInviteCSVFile.name}</p>
                                                            <p className="text-green-700 text-xs">
                                                                {(bulkInviteCSVFile.size / 1024).toFixed(2)} KB
                                                            </p>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setBulkInviteCSVFile(null)}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                                                <h4 className="font-semibold text-blue-900 mb-2 text-sm">Expected CSV Format:</h4>
                                                <pre className="text-xs bg-white p-2 rounded border border-blue-200 overflow-auto">
{`merchant_name,merchant_mobile,merchant_email
ABC Store,8639915897,abc@example.com
XYZ Mart,9876543210,xyz@example.com
PQR Shop,9123456789,pqr@example.com`}
                                                </pre>
                                                <p className="text-xs text-blue-700 mt-2">
                                                    ⚠️ First row must be headers. Columns must include: merchant_name, merchant_mobile, merchant_email
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handleBulkInvite}
                                                disabled={bulkInviteSending || !bulkInviteCSVFile}
                                                className="flex-1"
                                            >
                                                {bulkInviteSending ? 'Uploading...' : 'Upload & Send Invitations'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setBulkInviteOpen(false);
                                                    setBulkInviteCSVFile(null);
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Invitations List */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Sent Invitations</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {invitationsLoading ? (
                                        <div className="flex justify-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                        </div>
                                    ) : invitationsList.length === 0 ? (
                                        <p className="text-gray-500 text-center py-6">No invitations sent yet</p>
                                    ) : (
                                        <div className="overflow-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b">
                                                        <th className="text-left py-3 px-4 font-semibold">Merchant Name</th>
                                                        <th className="text-left py-3 px-4 font-semibold">Email</th>
                                                        <th className="text-left py-3 px-4 font-semibold">Mobile</th>
                                                        <th className="text-left py-3 px-4 font-semibold">Status</th>
                                                        <th className="text-left py-3 px-4 font-semibold">Sent Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {invitationsList.map(invitation => (
                                                        <tr key={invitation.id} className="hover:bg-gray-50">
                                                            <td className="py-3 px-4 font-medium text-gray-900">{invitation.merchant_name}</td>
                                                            <td className="py-3 px-4 text-gray-600">{invitation.merchant_email}</td>
                                                            <td className="py-3 px-4 text-gray-600">{invitation.merchant_mobile}</td>
                                                            <td className="py-3 px-4">
                                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                                    invitation.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                                                                    invitation.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                                                    invitation.status === 'registered' ? 'bg-green-100 text-green-800' :
                                                                    invitation.status === 'expired' ? 'bg-red-100 text-red-800' :
                                                                    'bg-gray-100 text-gray-800'
                                                                }`}>
                                                                    {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4 text-gray-600">{invitation.sent_at ? new Date(invitation.sent_at).toLocaleString() : 'N/A'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Payment Products Tab */}
                    {activeTab === 'payments' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-3xl font-bold text-gray-900">Payment Products</h2>
                                <p className="text-gray-600">Configure payment products and settlement settings</p>
                            </div>

                            {/* Products Catalog (quick actions) */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Products Catalog</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {productsCatalog.map(p => (
                                            <div key={p.id} className="p-4 border rounded-lg flex items-center justify-between hover:bg-gray-50 transition-colors">
                                                <div>
                                                    <div className="font-semibold text-gray-900">{p.name}</div>
                                                    <div className="text-sm text-gray-600">Click to configure or assign</div>
                                                </div>
                                                <div>
                                                    <Button size="sm" onClick={() => { setActiveProduct(p.id); setAssignMerchantId(merchants[0]?.id || null); setAssignForSelf(false); }}>
                                                        Action
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Assign Product Modal (simple) */}
                            {activeProduct && (
                                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                                    <div className="bg-white rounded-lg w-full max-w-md p-6">
                                        <h3 className="text-lg font-bold mb-4">Assign {productsCatalog.find(x => x.id === activeProduct)?.name}</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Assign To</label>
                                                <Select value={assignForSelf ? 'self' : (assignMerchantId || '')} onValueChange={(val) => { if (val === 'self') { setAssignForSelf(true); setAssignMerchantId(null); } else { setAssignForSelf(false); setAssignMerchantId(val); } }}>
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="self">Use for Myself</SelectItem>
                                                        {merchants.map(m => (
                                                            <SelectItem key={m.id} value={m.id}>{m.full_name} ({m.business_name || m.id})</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Settlement Type</label>
                                                <Select value={assignSettlement} onValueChange={(v) => setAssignSettlement(v as 'same_day' | 'next_day')}>
                                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="same_day">Same Day</SelectItem>
                                                        <SelectItem value="next_day">Next Day</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="flex gap-2 justify-end">
                                                <Button variant="ghost" onClick={() => setActiveProduct(null)}>Cancel</Button>
                                                <Button onClick={async () => {
                                                    try {
                                                        setAssigning(true);
                                                        const { data: sessionData } = await supabase.auth.getSession();
                                                        const token = sessionData?.session?.access_token || '';

                                                        const body = {
                                                            productType: activeProduct,
                                                            settlementType: assignSettlement,
                                                            assignTo: assignForSelf ? 'distributor' : 'merchant',
                                                            merchantId: assignForSelf ? undefined : assignMerchantId
                                                        };

                                                        const resp = await fetch(`${API_BASE_URL}/distributor/assign-product`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                                            body: JSON.stringify(body)
                                                        });

                                                        if (!resp.ok) {
                                                            const err = await resp.json().catch(() => ({ message: resp.statusText }));
                                                            throw new Error(err.error?.message || err.message || `HTTP ${resp.status}`);
                                                        }

                                                        toast({ title: 'Success', description: 'Product assigned' });
                                                        setActiveProduct(null);
                                                    } catch (err) {
                                                        console.error('Assign product error:', err);
                                                        toast({ title: 'Error', description: String(err), variant: 'destructive' });
                                                    } finally {
                                                        setAssigning(false);
                                                    }
                                                }} disabled={assigning}>
                                                    {assigning ? 'Assigning...' : 'Assign'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Payout Configuration - Combined Autopay & Payouts */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Payout Configuration</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-8">
                                    {/* Autopay (Collections) Section */}
                                    <div className="border-b pb-6">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Autopay (Collections)</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Settlement Frequency</label>
                                                <Select value={autopayForm.settlement_frequency} onValueChange={(value) => setAutopayForm({ ...autopayForm, settlement_frequency: value })}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="daily">Daily</SelectItem>
                                                        <SelectItem value="weekly">Weekly</SelectItem>
                                                        <SelectItem value="monthly">Monthly</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Debit Amount</label>
                                                <Input
                                                    type="number"
                                                    value={autopayForm.minimum_payout_amount}
                                                    onChange={(e) => setAutopayForm({ ...autopayForm, minimum_payout_amount: parseFloat(e.target.value) || 0 })}
                                                    placeholder="Enter minimum payout amount"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">VPID</label>
                                                <Input
                                                    type="text"
                                                    value={autopayForm.vpid}
                                                    onChange={(e) => setAutopayForm({ ...autopayForm, vpid: e.target.value })}
                                                    placeholder="Enter VPID"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                                                <Textarea
                                                    value={autopayForm.notes}
                                                    onChange={(e) => setAutopayForm({ ...autopayForm, notes: e.target.value })}
                                                    placeholder="Any additional autopay notes..."
                                                />
                                            </div>
                                            <Button onClick={handleSaveAutopayConfig} disabled={savingAutopay} className="w-full">
                                                {savingAutopay ? 'Saving...' : 'Initiate Autopay'}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Payouts (Settlements) Section */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payouts (Settlements)</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Payout Amount</label>
                                                <Input
                                                    type="number"
                                                    value={payoutForm.minimum_payout_amount}
                                                    onChange={(e) => setPayoutForm({ ...payoutForm, minimum_payout_amount: parseFloat(e.target.value) || 0 })}
                                                    placeholder="Enter minimum payout amount"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">VPID</label>
                                                <Input
                                                    type="text"
                                                    value={payoutForm.vpid}
                                                    onChange={(e) => setPayoutForm({ ...payoutForm, vpid: e.target.value })}
                                                    placeholder="Enter VPID"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                                                <Textarea
                                                    value={payoutForm.notes}
                                                    onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                                                    placeholder="Any additional payout notes..."
                                                />
                                            </div>
                                            <Button onClick={handleSavePayoutConfig} disabled={savingPayout} className="w-full">
                                                {savingPayout ? 'Saving...' : 'Initiate Payouts'}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Aadhaar Configuration */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Aadhaar Configuration</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Aadhaar Number(to verify)</label>
                                        <Input
                                            type="text"
                                            value={aadhaarForm.aadhaar_number}
                                            onChange={(e) => setAadhaarForm({ ...aadhaarForm, aadhaar_number: e.target.value })}
                                            placeholder="Enter Aadhaar number"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Verification Level</label>
                                        <Select value={aadhaarForm.verification_level} onValueChange={(value) => setAadhaarForm({ ...aadhaarForm, verification_level: value })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="basic">Basic</SelectItem>
                                                <SelectItem value="advanced">Advanced</SelectItem>
                                                <SelectItem value="full">Full</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                                        <Textarea
                                            id="aadhaar_notes"
                                            value={aadhaarForm.notes}
                                            onChange={(e) => setAadhaarForm({ ...aadhaarForm, notes: e.target.value })}
                                            placeholder="Any additional notes about Aadhaar validation..."
                                        />
                                    </div>
                                    <Button onClick={handleSaveAadhaarConfig} disabled={savingAadhaar} className="w-full">
                                        {savingAadhaar ? 'Saving...' : 'Initiate Aadhaar Verification'}
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
