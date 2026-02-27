// AdminDashboard.tsx - Production Ready
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    CheckCircle,
    XCircle,
    Clock,
    Search,
    Filter,
    Download,
    Eye,
    AlertCircle,
    PlayCircle,
    FileText,
    Image as ImageIcon,
    ExternalLink
} from 'lucide-react';

// Types
interface MerchantDocument {
    id: string;
    document_type: string;
    file_name: string;
    file_path: string;
    status: string;
    uploaded_at: string;
    verified_at: string | null;
    rejection_reason: string | null;
}

interface MerchantKYC {
    id: string;
    video_kyc_completed: boolean;
    location_captured: boolean;
    latitude: number | null;
    longitude: number | null;
    video_kyc_file_path: string | null;
    selfie_file_path: string | null;
    kyc_status: string;
    completed_at: string | null;
    verified_at: string | null;
    rejection_reason: string | null;
}

interface MerchantApplication {
    id: string;
    full_name: string;
    email: string;
    mobile_number: string;
    business_name: string;
    gst_number: string;
    aadhaar_number: string;
    pan_number: string;
    onboarding_status: 'pending' | 'in_progress' | 'submitted' | 'validating' | 'pending_bank_approval' | 'verification_failed' | 'bank_rejected' | 'verified' | 'approved' | 'rejected';
    entity_type: string;
    created_at: string;
    updated_at: string;
    submitted_at: string | null;
    rejection_reason: string | null;
    merchant_bank_details: {
        bank_name: string;
        account_number: string;
        ifsc_code: string;
        account_holder_name: string;
    } | null;
    merchant_documents?: MerchantDocument[];
    merchant_kyc?: MerchantKYC | null;
}

// Stat Card Component
interface StatCardProps {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: 'blue' | 'yellow' | 'purple' | 'green' | 'red';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
    const colorClasses = {
        blue: 'bg-blue-100 text-blue-600',
        yellow: 'bg-yellow-100 text-yellow-600',
        purple: 'bg-purple-100 text-purple-600',
        green: 'bg-green-100 text-green-600',
        red: 'bg-red-100 text-red-600'
    };

    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600 mb-1">{title}</p>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                </div>
                <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

// Detail Item Component
function DetailItem({ label, value }: { label: string; value: string | React.ReactNode }) {
    return (
        <div>
            <p className="text-sm text-gray-600 mb-1">{label}</p>
            <p className="font-medium text-gray-900">{value}</p>
        </div>
    );
}

// Detail Section Component
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {children}
            </div>
        </div>
    );
}

// Application Detail Modal
interface ApplicationDetailModalProps {
    application: MerchantApplication;
    onClose: () => void;
    onValidate: (id: string) => void;
    onReject: (id: string) => void;
    onApprove: (id: string) => void;
}

function ApplicationDetailModal({ application, onClose, onValidate, onReject, onApprove }: ApplicationDetailModalProps) {
    const getDocumentIcon = (type: string) => {
        if (type.includes('video') || type.includes('selfie')) {
            return <ImageIcon className="w-4 h-4" />;
        }
        return <FileText className="w-4 h-4" />;
    };

    const formatDocumentType = (type: string) => {
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <h2 className="text-2xl font-bold text-gray-900">Application Details</h2>
                    <div className="mt-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${application.onboarding_status === 'approved' ? 'bg-green-100 text-green-800' :
                                application.onboarding_status === 'rejected' ? 'bg-red-100 text-red-800' :
                                    application.onboarding_status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-gray-100 text-gray-800'
                            }`}>
                            {application.onboarding_status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Personal Information */}
                    <DetailSection title="Personal Information">
                        <DetailItem label="Full Name" value={application.full_name} />
                        <DetailItem label="Email" value={application.email} />
                        <DetailItem label="Mobile" value={application.mobile_number} />
                        <DetailItem label="PAN Number" value={application.pan_number || 'N/A'} />
                        <DetailItem label="Aadhaar" value={application.aadhaar_number || 'N/A'} />
                    </DetailSection>

                    {/* Business Information */}
                    <DetailSection title="Business Information">
                        <DetailItem label="Business Name" value={application.business_name} />
                        <DetailItem label="Entity Type" value={application.entity_type} />
                        <DetailItem label="GST Number" value={application.gst_number || 'N/A'} />
                    </DetailSection>

                    {/* Banking Details */}
                    <DetailSection title="Banking Details">
                        <DetailItem label="Bank Name" value={application.merchant_bank_details?.bank_name || 'N/A'} />
                        <DetailItem label="Account Holder" value={application.merchant_bank_details?.account_holder_name || 'N/A'} />
                        <DetailItem label="Account Number" value={application.merchant_bank_details?.account_number || 'N/A'} />
                        <DetailItem label="IFSC Code" value={application.merchant_bank_details?.ifsc_code || 'N/A'} />
                    </DetailSection>

                    {/* Documents */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents Uploaded</h3>
                        {application.merchant_documents && application.merchant_documents.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3">
                                {application.merchant_documents.map((doc) => (
                                    <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                                        <div className="flex items-center gap-3">
                                            {getDocumentIcon(doc.document_type)}
                                            <div>
                                                <div className="font-medium text-gray-900">
                                                    {formatDocumentType(doc.document_type)}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {doc.file_name}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    Uploaded: {new Date(doc.uploaded_at).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 text-xs rounded ${doc.status === 'verified' ? 'bg-green-100 text-green-800' :
                                                    doc.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {doc.status}
                                            </span>
                                            <a
                                                href={doc.file_path}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                                title="View Document"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 italic">No documents uploaded</p>
                        )}
                    </div>

                    {/* KYC Status */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">KYC Status</h3>
                        {application.merchant_kyc ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg">
                                <DetailItem
                                    label="KYC Status"
                                    value={
                                        <span className={`px-2 py-1 text-xs rounded ${application.merchant_kyc.kyc_status === 'verified' ? 'bg-green-100 text-green-800' :
                                                application.merchant_kyc.kyc_status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {application.merchant_kyc.kyc_status.toUpperCase()}
                                        </span>
                                    }
                                />
                                <DetailItem
                                    label="Video KYC"
                                    value={application.merchant_kyc.video_kyc_completed ? '✓ Completed' : '✗ Not Completed'}
                                />
                                <DetailItem
                                    label="Location Captured"
                                    value={application.merchant_kyc.location_captured ? '✓ Yes' : '✗ No'}
                                />
                                {application.merchant_kyc.latitude && application.merchant_kyc.longitude && (
                                    <DetailItem
                                        label="Location"
                                        value={`${application.merchant_kyc.latitude}, ${application.merchant_kyc.longitude}`}
                                    />
                                )}
                                {application.merchant_kyc.completed_at && (
                                    <DetailItem
                                        label="Completed At"
                                        value={new Date(application.merchant_kyc.completed_at).toLocaleString()}
                                    />
                                )}
                                {application.merchant_kyc.rejection_reason && (
                                    <div className="col-span-2">
                                        <DetailItem
                                            label="Rejection Reason"
                                            value={application.merchant_kyc.rejection_reason}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-gray-500 italic">KYC not initiated</p>
                        )}
                    </div>

                    {/* Rejection Reason if exists */}
                    {application.rejection_reason && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                            <h3 className="text-lg font-semibold text-red-900 mb-2">Rejection Reason</h3>
                            <p className="text-red-800">{application.rejection_reason}</p>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="p-6 border-t border-gray-200 flex justify-end gap-4 sticky bottom-0 bg-white">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>

                    {application.onboarding_status === 'submitted' && (
                        <>
                            <button
                                onClick={() => {
                                    onValidate(application.id);
                                    onClose();
                                }}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                Validate & Send to Bank
                            </button>
                            <button
                                onClick={() => {
                                    onReject(application.id);
                                    onClose();
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                Reject Application
                            </button>
                        </>
                    )}

                    {application.onboarding_status !== 'approved' && application.onboarding_status !== 'rejected' && (
                        <button
                            onClick={() => {
                                onApprove(application.id);
                                onClose();
                            }}
                            className="px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                        >
                            Manual Override Approve
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// Main Component
export default function AdminDashboard() {
    const [applications, setApplications] = useState<MerchantApplication[]>([]);
    const [filteredApps, setFilteredApps] = useState<MerchantApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedApp, setSelectedApp] = useState<MerchantApplication | null>(null);

    useEffect(() => {
        fetchApplications();
    }, []);

    useEffect(() => {
        filterApplications();
    }, [searchTerm, statusFilter, applications]);

    const fetchApplications = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('merchant_profiles')
                .select(`
                    *,
                    merchant_bank_details (
                        bank_name,
                        account_number,
                        ifsc_code,
                        account_holder_name
                    ),
                    merchant_documents (
                        id,
                        document_type,
                        file_name,
                        file_path,
                        status,
                        uploaded_at,
                        verified_at,
                        rejection_reason
                    ),
                    merchant_kyc (
                        id,
                        video_kyc_completed,
                        location_captured,
                        latitude,
                        longitude,
                        video_kyc_file_path,
                        selfie_file_path,
                        kyc_status,
                        completed_at,
                        verified_at,
                        rejection_reason
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedData = data?.map(item => ({
                ...item,
                entity_type: item.entity_type || 'individual',
                merchant_bank_details: Array.isArray(item.merchant_bank_details)
                    ? item.merchant_bank_details[0]
                    : item.merchant_bank_details,
                merchant_documents: item.merchant_documents || [],
                merchant_kyc: Array.isArray(item.merchant_kyc)
                    ? item.merchant_kyc[0]
                    : item.merchant_kyc
            })) as MerchantApplication[];

            setApplications(mappedData || []);
        } catch (error) {
            console.error('Error fetching applications:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterApplications = () => {
        let filtered = applications;

        if (searchTerm) {
            filtered = filtered.filter(app =>
                app.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.business_name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(app => app.onboarding_status === statusFilter);
        }

        setFilteredApps(filtered);
    };

    const validateMerchant = async (merchantId: string) => {
        if (!confirm('Validate this merchant and send to bank for approval?')) return;

        try {
            const { error } = await supabase
                .from('merchant_profiles')
                .update({
                    onboarding_status: 'validating',
                    updated_at: new Date().toISOString()
                })
                .eq('id', merchantId);

            if (error) throw error;

            alert('Merchant validation started! Backend will process and send to bank.');
            fetchApplications();
        } catch (error) {
            console.error('Error validating merchant:', error);
            alert('Failed to validate merchant');
        }
    };

    const rejectMerchant = async (merchantId: string) => {
        const reason = prompt('Enter rejection reason:');
        if (!reason) return;

        try {
            const { error } = await supabase
                .from('merchant_profiles')
                .update({
                    onboarding_status: 'rejected',
                    rejection_reason: reason,
                    updated_at: new Date().toISOString()
                })
                .eq('id', merchantId);

            if (error) throw error;

            alert('Merchant rejected successfully');
            fetchApplications();
        } catch (error) {
            console.error('Error rejecting merchant:', error);
            alert('Failed to reject merchant');
        }
    };

    const manualApprove = async (merchantId: string) => {
        if (!confirm('Manually approve this merchant (bypass bank approval)?')) return;

        try {
            const { error } = await supabase
                .from('merchant_profiles')
                .update({
                    onboarding_status: 'approved',
                    updated_at: new Date().toISOString()
                })
                .eq('id', merchantId);

            if (error) throw error;

            alert('Merchant manually approved!');
            fetchApplications();
        } catch (error) {
            console.error('Error approving merchant:', error);
            alert('Failed to approve merchant');
        }
    };

    const getStatusBadge = (status: MerchantApplication['onboarding_status']) => {
        const styles = {
            pending: 'bg-gray-100 text-gray-800',
            in_progress: 'bg-blue-100 text-blue-800',
            submitted: 'bg-yellow-100 text-yellow-800',
            validating: 'bg-purple-100 text-purple-800',
            pending_bank_approval: 'bg-orange-100 text-orange-800',
            verified: 'bg-green-100 text-green-800',
            approved: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800',
            bank_rejected: 'bg-red-100 text-red-800',
            verification_failed: 'bg-red-100 text-red-800'
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
                {status.replace(/_/g, ' ').toUpperCase()}
            </span>
        );
    };

    const exportToCSV = () => {
        const headers = ['Name', 'Email', 'Mobile', 'Business', 'Status', 'Created Date'];
        const rows = filteredApps.map(app => [
            app.full_name,
            app.email,
            app.mobile_number,
            app.business_name,
            app.onboarding_status,
            new Date(app.created_at).toLocaleDateString()
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'merchant_applications.csv';
        a.click();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Merchant Applications</h1>
                    <p className="text-gray-600">Review and manage merchant onboarding applications</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                    <StatCard
                        title="Total"
                        value={applications.length}
                        icon={<AlertCircle className="w-6 h-6" />}
                        color="blue"
                    />
                    <StatCard
                        title="Submitted"
                        value={applications.filter(a => a.onboarding_status === 'submitted').length}
                        icon={<Clock className="w-6 h-6" />}
                        color="yellow"
                    />
                    <StatCard
                        title="Validating"
                        value={applications.filter(a => a.onboarding_status === 'validating' || a.onboarding_status === 'pending_bank_approval').length}
                        icon={<PlayCircle className="w-6 h-6" />}
                        color="purple"
                    />
                    <StatCard
                        title="Approved"
                        value={applications.filter(a => a.onboarding_status === 'approved' || a.onboarding_status === 'verified').length}
                        icon={<CheckCircle className="w-6 h-6" />}
                        color="green"
                    />
                    <StatCard
                        title="Rejected"
                        value={applications.filter(a => a.onboarding_status === 'rejected' || a.onboarding_status === 'bank_rejected').length}
                        icon={<XCircle className="w-6 h-6" />}
                        color="red"
                    />
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search by name, email, or business..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                                <option value="submitted">Submitted</option>
                                <option value="validating">Validating</option>
                                <option value="pending_bank_approval">Pending Bank Approval</option>
                                <option value="verified">Verified</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>

                        <button
                            onClick={exportToCSV}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Download className="w-5 h-5" />
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Applications Table */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Merchant Details
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Business Info
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Applied On
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredApps.map((app) => (
                                    <tr key={app.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-medium text-gray-900">{app.full_name}</div>
                                                <div className="text-sm text-gray-500">{app.email}</div>
                                                <div className="text-sm text-gray-500">{app.mobile_number}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-medium text-gray-900">{app.business_name}</div>
                                                <div className="text-sm text-gray-500">GST: {app.gst_number || 'N/A'}</div>
                                                <div className="text-sm text-gray-500">Type: {app.entity_type}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(app.onboarding_status)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(app.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {/* View Details - Always Available */}
                                                <button
                                                    onClick={() => setSelectedApp(app)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-5 h-5" />
                                                </button>

                                                {/* Validate & Reject - For SUBMITTED status */}
                                                {app.onboarding_status === 'submitted' && (
                                                    <>
                                                        <button
                                                            onClick={() => validateMerchant(app.id)}
                                                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                                            title="Validate & Send to Bank"
                                                        >
                                                            Validate
                                                        </button>
                                                        <button
                                                            onClick={() => rejectMerchant(app.id)}
                                                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                                            title="Reject Application"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}

                                                {/* Processing Status */}
                                                {(app.onboarding_status === 'validating' || app.onboarding_status === 'pending_bank_approval') && (
                                                    <span className="px-3 py-1 text-sm text-purple-700 bg-purple-50 rounded">
                                                        Processing...
                                                    </span>
                                                )}

                                                {/* Manual Override - Always Available for Admin */}
                                                {app.onboarding_status !== 'approved' && app.onboarding_status !== 'rejected' && (
                                                    <button
                                                        onClick={() => manualApprove(app.id)}
                                                        className="px-3 py-1 text-sm border border-green-600 text-green-600 rounded hover:bg-green-50 transition-colors"
                                                        title="Manual Override Approve"
                                                    >
                                                        Override
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Detail Modal */}
                {selectedApp && (
                    <ApplicationDetailModal
                        application={selectedApp}
                        onClose={() => setSelectedApp(null)}
                        onValidate={validateMerchant}
                        onReject={rejectMerchant}
                        onApprove={manualApprove}
                    />
                )}
            </div>
        </div>
    );
}