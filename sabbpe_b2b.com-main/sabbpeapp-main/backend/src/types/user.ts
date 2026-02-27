// backend/src/types/user.ts

// Update UserRole to include support
export type UserRole = 'merchant' | 'admin' | 'distributor' | 'support_admin' | 'support_staff';

export interface User {
    id: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    phone?: string;
    isActive: boolean;
    emailVerified: boolean;
    lastLoginAt?: string;
    createdAt: string;
    updatedAt: string;
}

// Keep UserSession as is (it already has role!)
export interface UserSession {
    userId: string;
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
}

// NEW: Extend for Support-specific data
export interface SupportUserSession extends UserSession {
    supportStaffId: string;
    role: 'support_admin' | 'support_staff';
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role?: UserRole;
}

export interface AuthToken {
    token: string;
    expiresAt: string;
    user: UserSession;
}

// NEW: Support auth response
export interface SupportAuthToken {
    token: string;
    expiresAt: string;
    user: SupportUserSession;
}