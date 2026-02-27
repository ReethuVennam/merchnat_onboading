const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/bank';

export interface BankLoginPayload {
    email: string;
    password: string;
}

export interface BankLoginResponse {
    success: boolean;
    message: string;
    token: string;
    user: {
        userId: string;
        email: string;
        role: string;
        name: string;
        bankStaffId: string;
    };
}

export interface Application {
    id: string;
    full_name: string;
    email: string;
    business_name: string;
    onboarding_status: string;
    created_at: string;
    updated_at: string;
}

export interface ApplicationDecision {
    decision: 'approve' | 'reject';
    notes: string;
}

export const bankLogin = async (payload: BankLoginPayload): Promise<BankLoginResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Login failed');
    return response.json();
};

export const getPendingApplications = async (token: string): Promise<Application[]> => {
    const response = await fetch(`${API_BASE_URL}/applications/pending`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch pending KYCs');
    }
    const data = await response.json();
    return data.data || [];
};

export const decideApplication = async (token: string, appId: string, payload: ApplicationDecision): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/applications/decide/${appId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Decision failed');
    return response.json();
};

export const handleError = (error: unknown): string => {
    return error instanceof Error ? error.message : 'Error occurred';
};