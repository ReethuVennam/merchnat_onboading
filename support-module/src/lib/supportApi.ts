
// src/lib/supportApi.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8888/api/support';

export const getDocumentUrl = (filePath: string): string => {
    console.log('getDocumentUrl:', filePath);
    
    // If already a full URL
    if (filePath.startsWith('http')) {
        return filePath;
    }
    
    // Old format: /uploads/filename
    if (filePath.startsWith('/uploads/')) {
        return `${import.meta.env.VITE_BASE_URL}${filePath}`;
    }
    
    // Supabase format: uuid/folder/filename
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl && filePath && !filePath.startsWith('/')) {
        return `${supabaseUrl}/storage/v1/object/public/merchant-documents/${filePath}`;
    }
    
    return filePath;
};

export interface SupportLoginPayload {
    email: string;
    password: string;
}

export interface SupportLoginResponse {
    success: boolean;
    message: string;
    token: string;
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
    };
}

export interface PendingKYC {
    id: string;
    full_name: string;
    email: string;
    mobile_number: string;
    business_name: string;
    pan_number: string;
    aadhaar_number: string;
    created_at: string;
    merchant_kyc: {
        id: string;
        video_kyc_completed: boolean;
        location_captured: boolean;
        latitude: number;
        longitude: number;
        selfie_file_path: string;
        kyc_status: string;
    };
    merchant_documents: Array<{
        id: string;
        document_type: string;
        file_path: string;
        uploaded_at: string;
    }>;
}

export interface KYCReviewPayload {
    merchantId: string;
    decision: 'approve' | 'reject';
    reviewNotes: string;
}

export interface KYCReviewResponse {
    success: boolean;
    message: string;
    decision: string;
    kycStatus: string;
    merchantId: string;
}

export const supportLogin = async (payload: SupportLoginPayload): Promise<SupportLoginResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
    }
    return response.json();
};

export const getPendingKYCs = async (token: string): Promise<PendingKYC[]> => {
    const response = await fetch(`${API_BASE_URL}/kyc/pending`, {
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

export const reviewKYC = async (token: string, payload: KYCReviewPayload): Promise<KYCReviewResponse> => {
    const response = await fetch(`${API_BASE_URL}/kyc/review`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Review failed');
    }
    return response.json();
};

export const getKYCStatus = async (token: string, merchantId: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/kyc/status/${merchantId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) {
        throw new Error('Failed to fetch KYC status');
    }
    const data = await response.json();
    return data.data;
};

export const handleApiError = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred';
};
