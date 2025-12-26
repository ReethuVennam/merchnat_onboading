import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBankAuth } from '../context/BankAuthContext';
import { getPendingApplications, decideApplication, Application, handleError } from '../lib/bankApi';
import { CheckCircle, XCircle, Eye, Loader2, LogOut, AlertCircle, Search, Clock, FileText } from 'lucide-react';

export const BankDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user, token, logout } = useBankAuth();
    const [applications, setApplications] = useState<Application[]>([]);
    const [filteredApps, setFilteredApps] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedApp, setSelectedApp] = useState<Application | null>(null);
    const [deciding, setDeciding] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        fetchApplications();
    }, [token, navigate]);

    useEffect(() => {
        const filtered = applications.filter(app =>
            (app?.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (app?.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (app?.business_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        );
        setFilteredApps(filtered);
    }, [searchTerm, applications]);

    const fetchApplications = async () => {
        try {
            setLoading(true);
            setError('');
            if (!token) throw new Error('No token');
            const data = await getPendingApplications(token);
            setApplications(data);
            setFilteredApps(data);
        } catch (err) {
            setError(handleError(err));
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (appId: string) => {
        if (!window.confirm('Approve this application?')) return;
        try {
            setDeciding(true);
            setError('');
            if (!token) throw new Error('No token');
            await decideApplication(token, appId, { decision: 'approve', notes: notes || 'Approved' });
            alert('✅ Application Approved!');
            await fetchApplications();
            setSelectedApp(null);
            setNotes('');
        } catch (err) {
            alert(`❌ Error: ${handleError(err)}`);
        } finally {
            setDeciding(false);
        }
    };

    const handleReject = async (appId: string) => {
        if (!notes.trim()) {
            alert('⚠️ Please provide rejection reason');
            return;
        }
        if (!window.confirm('Reject this application?')) return;
        try {
            setDeciding(true);
            setError('');
            if (!token) throw new Error('No token');
            await decideApplication(token, appId, { decision: 'reject', notes });
            alert('❌ Application Rejected!');
            await fetchApplications();
            setSelectedApp(null);
            setNotes('');
        } catch (err) {
            alert(`❌ Error: ${handleError(err)}`);
        } finally {
            setDeciding(false);
        }
    };

    const handleLogout = () => {
        if (window.confirm('Logout?')) {
            logout();
            navigate('/login');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Bank Review Portal</h1>
                        <p className="text-sm text-gray-600">Welcome, {user?.name} • {user?.email}</p>
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border">
                        <LogOut className="w-5 h-5" /> Logout
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"><AlertCircle className="w-5 h-5 text-red-600 inline" /> {error}</div>}

                {selectedApp ? (
                    <div className="bg-white rounded-lg shadow-lg">
                        <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6 text-white flex justify-between">
                            <div>
                                <h2 className="text-2xl font-bold">{selectedApp.business_name}</h2>
                                <p className="text-purple-100">{selectedApp.full_name}</p>
                            </div>
                            <button onClick={() => { setSelectedApp(null); setNotes(''); }} className="text-2xl">✕</button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div>
                                <h3 className="font-semibold mb-4">📋 Application Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-xs text-gray-600">Name</p>
                                        <p className="font-medium">{selectedApp.full_name}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-xs text-gray-600">Email</p>
                                        <p className="font-medium">{selectedApp.email}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg col-span-2">
                                        <p className="text-xs text-gray-600">Business</p>
                                        <p className="font-medium">{selectedApp.business_name}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-2">📝 Review Notes</label>
                                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes..." rows={5} className="w-full px-4 py-3 border rounded-lg" disabled={deciding} />
                            </div>
                        </div>

                        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => { setSelectedApp(null); setNotes(''); }} className="px-6 py-3 border rounded-lg" disabled={deciding}>← Back</button>
                            <button onClick={() => handleReject(selectedApp.id)} className="px-6 py-3 bg-red-600 text-white rounded-lg" disabled={deciding || !notes.trim()}>Reject</button>
                            <button onClick={() => handleApprove(selectedApp.id)} className="px-6 py-3 bg-green-600 text-white rounded-lg" disabled={deciding}>Approve</button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-6 rounded-lg shadow"><p className="text-gray-600">Pending</p><p className="text-3xl font-bold">{filteredApps.length}</p></div>
                            <div className="bg-white p-6 rounded-lg shadow"><p className="text-gray-600">Total</p><p className="text-3xl font-bold">{applications.length}</p></div>
                            <div className="bg-white p-6 rounded-lg shadow"><p className="text-gray-600">Search</p><p className="text-3xl font-bold">{searchTerm ? '🔍' : '-'}</p></div>
                        </div>

                        <div className="bg-white p-4 rounded-lg shadow">
                            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-3 border rounded-lg" />
                        </div>

                        {filteredApps.length > 0 ? (
                            <div className="space-y-3">
                                {filteredApps.map((app) => (
                                    <div key={app.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                                        <div>
                                            <h3 className="font-semibold">{app.business_name}</h3>
                                            <p className="text-sm text-gray-600">{app.full_name} • {app.email}</p>
                                        </div>
                                        <button onClick={() => setSelectedApp(app)} className="px-4 py-2 bg-purple-600 text-white rounded-lg">Review</button>
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