// src/pages/RoleSelection.tsx
import { useNavigate } from 'react-router-dom';
import { Building2, Store } from 'lucide-react';
import { Logo } from '@/components/ui/logo'; // import your Logo component

export default function RoleSelection() {
    const navigate = useNavigate();

    const selectRole = (role: 'merchant' | 'distributor') => {
        // Store role selection in sessionStorage
        sessionStorage.setItem('selected_role', role);
        // Navigate to auth page
        navigate('/auth');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-6">
            <div className="max-w-4xl w-full">
                <div className="text-center mb-12">
                    {/* Logo same size as in Index.tsx */}
                    <div className="mx-auto mb-6 w-64 h-24">
                        <Logo size="lg" />
                    </div>

                    <h1 className="text-4xl font-bold text-gray-900 mb-4">
                        Welcome to CitoNidhi
                    </h1>
                    <p className="text-xl text-gray-600">
                        Choose how you want to get started
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Merchant Card */}
                    <button
                        onClick={() => selectRole('merchant')}
                        className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-blue-500 group"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-500 transition-colors">
                                <Store className="w-10 h-10 text-blue-600 group-hover:text-white transition-colors" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">
                                I am a Customer
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Register your business to check eligibility for secured & unsecured loans
                            </p>
                            <ul className="text-left space-y-2 text-sm text-gray-500">
                                <li>✓ Complete quick digital verification for faster loan approvals</li>
                                <li>✓ Apply for working capital, term loans, or credit lines in minutes</li>
                                <li>✓ Track loan status, disbursals, and repayments in real time</li>
                                <li>✓ Monitor your EMIs, upcoming dues & repayment history in one dashboard</li>
                            </ul>
                        </div>
                    </button>

                    {/* Distributor Card */}
                    <button
                        onClick={() => selectRole('distributor')}
                        className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-indigo-500 group"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-indigo-500 transition-colors">
                                <Building2 className="w-10 h-10 text-indigo-600 group-hover:text-white transition-colors" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">
                                I am a SME
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Onboard and manage your own customers easily
                            </p>
                            <ul className="text-left space-y-2 text-sm text-gray-500">
                                <li>✓ Invite customers directly via WhatsApp</li>
                                <li>✓ Track each customer's onboarding progress</li>
                                <li>✓ Monitor customer activity and performance insights</li>
                                <li>✓ Manage your commissions from every customer transaction</li>
                            </ul>
                        </div>
                    </button>
                </div>

                <div className="text-center mt-8">
                    <button
                        onClick={() => navigate('/')}
                        className="text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        ← Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
}
