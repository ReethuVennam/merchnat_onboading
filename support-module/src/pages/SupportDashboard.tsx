
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupportAuth } from '../context/SupportAuthContext';
import { getPendingKYCs, reviewKYC, PendingKYC, handleApiError, getDocumentUrl } from '../lib/supportApi';
import { Loader2, LogOut, AlertCircle } from 'lucide-react';

export const SupportDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user, token, logout } = useSupportAuth();
    const [pendingKYCs, setPendingKYCs] = useState<PendingKYC[]>([]);
    const [filteredKYCs, setFilteredKYCs] = useState<PendingKYC[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMerchant, setSelectedMerchant] = useState<PendingKYC | null>(null);
    const [reviewing, setReviewing] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [reviewNotes, setReviewNotes] = useState('');

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        fetchPendingKYCs();
    }, [token, navigate]);

    useEffect(() => {
        const filtered = pendingKYCs.filter(kyc =>
            (kyc?.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (kyc?.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (kyc?.business_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        );
        setFilteredKYCs(filtered);
    }, [searchTerm, pendingKYCs]);

    const fetchPendingKYCs = async () => {
        try {
            setLoading(true);
            setError('');
            if (!token) throw new Error('No authentication token');
            const data = await getPendingKYCs(token);
            setPendingKYCs(data);
            setFilteredKYCs(data);
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (merchantId: string) => {
        if (!window.confirm('Are you sure you want to APPROVE this KYC?')) return;
        try {
            setReviewing(true);
            setError('');
            if (!token) throw new Error('No authentication token');
            await reviewKYC(token, {
                merchantId,
                decision: 'approve',
                reviewNotes: reviewNotes || 'Approved by support staff'
            });
            alert('✅ KYC Approved Successfully!');
            await fetchPendingKYCs();
            setSelectedMerchant(null);
            setReviewNotes('');
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            alert(`❌ Error: ${errorMessage}`);
        } finally {
            setReviewing(false);
        }
    };

    const handleReject = async (merchantId: string) => {
        if (!reviewNotes.trim()) {
            alert('⚠️ Please provide a rejection reason');
            return;
        }
        if (!window.confirm('Are you sure you want to REJECT this KYC?')) return;
        try {
            setReviewing(true);
            setError('');
            if (!token) throw new Error('No authentication token');
            await reviewKYC(token, {
                merchantId,
                decision: 'reject',
                reviewNotes
            });
            alert('❌ KYC Rejected Successfully!');
            await fetchPendingKYCs();
            setSelectedMerchant(null);
            setReviewNotes('');
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            alert(`❌ Error: ${errorMessage}`);
        } finally {
            setReviewing(false);
        }
    };

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to logout?')) {
            logout();
            navigate('/login');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">KYC Review Portal</h1>
                        <p className="text-sm text-gray-600">Welcome, {user?.name} • {user?.email}</p>
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300">
                        <LogOut className="w-5 h-5" /> Logout
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"><AlertCircle className="w-5 h-5 text-red-600 inline" /> {error}</div>}

                {selectedMerchant ? (
                    <div className="bg-white rounded-lg shadow-lg">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white flex justify-between">
                            <div>
                                <h2 className="text-2xl font-bold">{selectedMerchant.business_name}</h2>
                                <p className="text-blue-100">{selectedMerchant.full_name}</p>
                            </div>
                            <button onClick={() => { setSelectedMerchant(null); setReviewNotes(''); }} className="text-2xl">✕</button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div>
                                <h3 className="font-semibold mb-4">📋 Merchant Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-xs text-gray-600">Full Name</p>
                                        <p>{selectedMerchant.full_name}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-xs text-gray-600">Email</p>
                                        <p>{selectedMerchant.email}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-xs text-gray-600">Mobile</p>
                                        <p>{selectedMerchant.mobile_number}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-xs text-gray-600">Business</p>
                                        <p>{selectedMerchant.business_name}</p>
                                    </div>
                                </div>
                            </div>

                            {selectedMerchant.merchant_documents && selectedMerchant.merchant_documents.length > 0 && (
                                <div>
                                    <h3 className="font-semibold mb-4">📄 Documents</h3>
                                    <div className="space-y-2">
                                        {selectedMerchant.merchant_documents.map((doc) => (
                                            <div key={doc.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                                                <div>
                                                    <p className="font-medium">{doc.document_type.replace(/_/g, ' ').toUpperCase()}</p>
                                                    <p className="text-xs text-gray-600">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const url = getDocumentUrl(doc.file_path);
                                                        console.log('Opening:', url);
                                                        window.open(url, '_blank');
                                                    }}
                                                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold mb-2">📝 Review Notes</label>
                                <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Add review notes..." rows={5} className="w-full px-4 py-3 border rounded-lg" disabled={reviewing} />
                            </div>
                        </div>

                        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => { setSelectedMerchant(null); setReviewNotes(''); }} className="px-6 py-3 border rounded-lg" disabled={reviewing}>← Back</button>
                            <button onClick={() => handleReject(selectedMerchant.id)} className="px-6 py-3 bg-red-600 text-white rounded-lg" disabled={reviewing || !reviewNotes.trim()}>Reject</button>
                            <button onClick={() => handleApprove(selectedMerchant.id)} className="px-6 py-3 bg-green-600 text-white rounded-lg" disabled={reviewing}>Approve</button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-6 rounded-lg shadow"><p className="text-gray-600">Pending</p><p className="text-3xl font-bold">{filteredKYCs.length}</p></div>
                            <div className="bg-white p-6 rounded-lg shadow"><p className="text-gray-600">Total</p><p className="text-3xl font-bold">{pendingKYCs.length}</p></div>
                            <div className="bg-white p-6 rounded-lg shadow"><p className="text-gray-600">Search</p><p className="text-3xl font-bold">{searchTerm ? '🔍' : '-'}</p></div>
                        </div>

                        <div className="bg-white p-4 rounded-lg shadow">
                            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-3 border rounded-lg" />
                        </div>

                        {filteredKYCs.length > 0 ? (
                            <div className="space-y-3">
                                {filteredKYCs.map((kyc) => (
                                    <div key={kyc.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                                        <div>
                                            <h3 className="font-semibold">{kyc.business_name}</h3>
                                            <p className="text-sm text-gray-600">{kyc.full_name}</p>
                                        </div>
                                        <button onClick={() => setSelectedMerchant(kyc)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Review</button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-12 bg-white rounded-lg">No pending applications</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
