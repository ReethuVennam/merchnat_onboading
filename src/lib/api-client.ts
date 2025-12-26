import { supabase } from './supabase';
import { MerchantFormData } from '@/schemas/merchantValidation';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8888';
console.log('API_BASE_URL:', API_BASE_URL);

class ApiClient {
    private async getAuthHeader(): Promise<HeadersInit> {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
            throw new Error('Not authenticated. Please log in.');
        }

        return {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
        };
    }

    // Generic GET method
    async get(url: string) {
        try {
            const headers = await this.getAuthHeader();
            // Add /api prefix if not present
            const fullUrl = url.startsWith('/api') ? url : `/api${url}`;

            console.log('GET request to:', `${API_BASE_URL}${fullUrl}`);

            const response = await fetch(`${API_BASE_URL}${fullUrl}`, {
                method: 'GET',
                headers
            });

            console.log('GET response status:', response.status);

            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    message: `Request failed with status ${response.status}`
                }));
                throw new Error(error.message || 'Request failed');
            }

            const data = await response.json();
            return { data }; // Wrap in { data } to match axios pattern
        } catch (error) {
            console.error('GET request error:', error);
            throw error;
        }
    }

    // Generic POST method
    async post(url: string, body?: any) {
        try {
            const headers = await this.getAuthHeader();
            // Add /api prefix if not present
            const fullUrl = url.startsWith('/api') ? url : `/api${url}`;

            console.log('POST request to:', `${API_BASE_URL}${fullUrl}`);
            console.log('POST body:', body);

            const response = await fetch(`${API_BASE_URL}${fullUrl}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            console.log('POST response status:', response.status);

            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    message: `Request failed with status ${response.status}`
                }));
                throw new Error(error.message || 'Request failed');
            }

            const data = await response.json();
            return { data }; // Wrap in { data } to match axios pattern
        } catch (error) {
            console.error('POST request error:', error);
            throw error;
        }
    }

    // Specific methods (keeping existing functionality)
    async submitMerchantApplication(data: MerchantFormData) {
        try {
            const headers = await this.getAuthHeader();
            console.log('🔵 Calling API:', `/api/merchants/submit`);
            console.log('🔵 Data:', data);

            const response = await fetch(`${API_BASE_URL}/api/merchants/submit`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });

            console.log('Response Status:', response.status);
            const result = await response.json();
            console.log('Response Result:', result);

            if (!response.ok) {
                throw new Error(result.error?.message || 'Failed to submit application');
            }

            console.log('✅ Application submitted successfully');
            return result;
        } catch (error) {
            console.error('❌ Submit error:', error);
            throw error;
        }
    }

    async getMerchantProfile() {
        try {
            const headers = await this.getAuthHeader();
            console.log('🔵 Fetching profile from:', `/api/merchants/profile`);

            const response = await fetch(`${API_BASE_URL}/api/merchants/profile`, {
                method: 'GET',
                headers
            });

            if (response.status === 404) {
                return { success: true, data: null };
            }

            if (!response.ok) {
                throw new Error('Failed to fetch merchant profile');
            }

            return response.json();
        } catch (error) {
            console.error('❌ Profile fetch error:', error);
            throw error;
        }
    }

    async getMerchantStatus() {
        try {
            const headers = await this.getAuthHeader();
            console.log('🔵 Fetching status from:', `/api/merchants/status`);

            const response = await fetch(`${API_BASE_URL}/api/merchants/status`, {
                method: 'GET',
                headers
            });

            if (response.status === 404) {
                return { success: true, data: null };
            }

            if (!response.ok) {
                throw new Error('Failed to fetch merchant status');
            }

            return response.json();
        } catch (error) {
            console.error('❌ Status fetch error:', error);
            throw error;
        }
    }

    async getStatusHistory() {
        try {
            const headers = await this.getAuthHeader();
            console.log('🔵 Fetching status history from:', `/api/merchants/status-history`);

            const response = await fetch(`${API_BASE_URL}/api/merchants/status-history`, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                throw new Error('Failed to fetch status history');
            }

            return response.json();
        } catch (error) {
            console.error('❌ History fetch error:', error);
            throw error;
        }
    }
}

export const apiClient = new ApiClient();