import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SupportAuthProvider, useSupportAuth } from './context/SupportAuthContext';
import { SupportLogin } from './pages/SupportLogin';
import { SupportDashboard } from './pages/SupportDashboard';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, loading } = useSupportAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600 mt-4">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

function AppContent() {
    return (
        <Routes>
            <Route path="/login" element={<SupportLogin />} />
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <SupportDashboard />
                    </ProtectedRoute>
                }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
                path="*"
                element={
                    <div className="min-h-screen flex items-center justify-center bg-gray-50">
                        <div className="text-center">
                            <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
                            <p className="text-gray-600 mb-6">Page not found</p>
                            <a href="/" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Go Home</a>
                        </div>
                    </div>
                }
            />
        </Routes>
    );
}

function App() {
    return (
        <BrowserRouter>
            <SupportAuthProvider>
                <AppContent />
            </SupportAuthProvider>
        </BrowserRouter>
    );
}

export default App;