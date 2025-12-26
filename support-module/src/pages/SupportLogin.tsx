// src/pages/SupportLogin.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupportAuth } from '../context/SupportAuthContext';
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

export const SupportLogin: React.FC = () => {
    const navigate = useNavigate();
    const { login, loading, error, clearError } = useSupportAuth();
    const [email, setEmail] = useState('support@sabbpe.com');
    const [password, setPassword] = useState('support123');
    const [localError, setLocalError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError('');
        clearError();

        if (!email || !password) {
            setLocalError('Email and password are required');
            return;
        }

        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err) {
            setLocalError(err instanceof Error ? err.message : 'Login failed');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <div className="bg-white rounded-lg p-4 inline-block shadow-lg">
                        <Lock className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mt-4">SabbPe Support</h1>
                    <p className="text-blue-100 mt-2">KYC Review Portal</p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-lg shadow-2xl p-8 space-y-6">
                    {/* Error Alert */}
                    {(error || localError) && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 animate-pulse">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-red-800">{error || localError}</div>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email Input */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setLocalError('');
                                        clearError();
                                    }}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="support@sabbpe.com"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setLocalError('');
                                        clearError();
                                    }}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 px-4 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In to Portal'
                            )}
                        </button>
                    </form>

                    {/* Demo Credentials Info */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs font-semibold text-blue-900 mb-2">📋 Demo Credentials</p>
                        <p className="text-xs text-blue-800">
                            <strong>Email:</strong> support@sabbpe.com<br />
                            <strong>Password:</strong> support123
                        </p>
                    </div>

                    {/* Footer */}
                    <div className="pt-4 border-t border-gray-200">
                        <p className="text-center text-xs text-gray-600">
                            🔒 Authorized personnel only<br />
                            Your login is secure and encrypted
                        </p>
                    </div>
                </div>

                {/* Info Footer */}
                <div className="mt-8 text-center text-blue-100 text-sm">
                    <p>Powered by SabbPe</p>
                    <p className="text-xs mt-2 opacity-75">Support Module v1.0</p>
                </div>
            </div>
        </div>
    );
};
