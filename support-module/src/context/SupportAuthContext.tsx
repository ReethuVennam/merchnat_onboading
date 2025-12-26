// src/context/SupportAuthContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supportLogin, handleApiError } from '../lib/supportApi';

export interface SupportUser {
    id: string;
    email: string;
    name: string;
    role: string;
}

interface SupportAuthContextType {
    user: SupportUser | null;
    token: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    clearError: () => void;
}

const SupportAuthContext = createContext<SupportAuthContextType | undefined>(undefined);

export const SupportAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<SupportUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize from localStorage
    useEffect(() => {
        const storedToken = localStorage.getItem('support_token');
        const storedUser = localStorage.getItem('support_user');

        if (storedToken && storedUser) {
            try {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            } catch (err) {
                console.error('Failed to parse stored user:', err);
                localStorage.removeItem('support_token');
                localStorage.removeItem('support_user');
            }
        }
    }, []);

    const login = async (email: string, password: string) => {
        try {
            setLoading(true);
            setError(null);

            const response = await supportLogin({ email, password });

            setToken(response.token);
            setUser(response.user);

            // Store in localStorage
            localStorage.setItem('support_token', response.token);
            localStorage.setItem('support_user', JSON.stringify(response.user));
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        setError(null);
        localStorage.removeItem('support_token');
        localStorage.removeItem('support_user');
    };

    const clearError = () => {
        setError(null);
    };

    const value: SupportAuthContextType = {
        user,
        token,
        isAuthenticated: !!token,
        loading,
        error,
        login,
        logout,
        clearError
    };

    return (
        <SupportAuthContext.Provider value={value}>
            {children}
        </SupportAuthContext.Provider>
    );
};

export const useSupportAuth = () => {
    const context = useContext(SupportAuthContext);
    if (!context) {
        throw new Error('useSupportAuth must be used within SupportAuthProvider');
    }
    return context;
};
