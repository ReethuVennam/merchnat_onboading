// backend/src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const getSupabaseClient = () => {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
    }
    return createClient(supabaseUrl, supabaseKey);
};

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        console.log('🔑 Auth middleware - Token present:', !!token);

        if (!token) {
            console.log('❌ No token provided');
            res.status(401).json({ message: 'No token provided' });
            return;
        }

        const supabase = getSupabaseClient();
        console.log('✅ Supabase client created');

        // Verify with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        console.log('👤 User from token:', user?.id);
        console.log('❌ Auth error:', error?.message);

        if (error || !user) {
            console.log('❌ Invalid token');
            res.status(401).json({ message: 'Invalid token' });
            return;
        }

        // Get merchant profile to get merchantId
        const { data: merchantProfile } = await supabase
            .from('merchant_profiles')
            .select('id')
            .eq('user_id', user.id)
            .single();

        console.log('🏪 Merchant profile ID:', merchantProfile?.id);

        req.user = {
            user_id: user.id,
            email: user.email || '',
            role: 'merchant',
            merchantId: merchantProfile?.id || user.id,
        };

        console.log('✅ Auth successful - merchantId:', req.user.merchantId);
        next();
    } catch (error) {
        console.error('💥 Auth middleware error:', error);
        res.status(401).json({ message: 'Authentication failed' });
        return;
    }
};

// Authorize middleware for role-based access
export const authorize = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ message: 'Insufficient permissions' });
            return;
        }

        next();
    };
};