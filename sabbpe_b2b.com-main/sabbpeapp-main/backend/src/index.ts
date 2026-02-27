// backend/src/index.ts

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import merchantRoutes from './routes/merchant';
import supportRoutes from './routes/support';
import adminRoutes from './routes/admin';
import webhookRoutes from './routes/webhook';
import supabaseRoutes from './routes/supabase';  // ✅ Added
import bankRoutes from './routes/bank';
import whatsappRoutes from './routes/whatsapp';
import distributorRoutes from './routes/distributor';
import debugRoutes from './routes/debug';
import inviteRoutes from './routes/invites';
import { logger } from './utils/logger';
import {
    AppError,
    isOperationalError
} from './utils/errors';

const app: Express = express();
const PORT = process.env.PORT || 8080;

// Handle unhandled rejections and uncaught exceptions
process.on('unhandledRejection', (reason: unknown) => {
    logger.error(
        'Unhandled Promise Rejection',
        reason instanceof Error ? reason : undefined
    );

    if (reason instanceof Error && !isOperationalError(reason)) {
        process.exit(1);
    }
});

process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', error);
    process.exit(1);
});

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:5173',
        'https://sabbpe-frontend-988626072499.asia-south1.run.app'
    ],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.request(
            req.method,
            req.path,
            res.statusCode,
            duration
        );
    });

    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/supabase', supabaseRoutes);
app.use('/api/bank', bankRoutes);// ✅ Added
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/distributor', distributorRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/invites', inviteRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
    logger.warn(`Route not found: ${req.method} ${req.path}`);

    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`
        }
    });
});

// Global error handler
app.use((err: Error | AppError, req: Request, res: Response, next: NextFunction) => {
    const context = {
        method: req.method,
        path: req.path,
        userId: req.user?.userId
    };

    if (err instanceof AppError) {
        logger.error(
            `Application error: ${err.message}`,
            err,
            {
                ...context,
                statusCode: err.statusCode,
                code: err.code
            }
        );

        res.status(err.statusCode).json(err.toJSON());
        return;
    }

    // Unexpected errors
    logger.error(
        `Unexpected error: ${err.message}`,
        err,
        context
    );

    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        }
    });
});

// Start server
app.listen(PORT, () => {
    logger.info('Server started successfully', {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
    });

    console.log('');
    console.log('✅ SabbPe Backend Server Running');
    console.log('================================');
    console.log(`📡 API: http://localhost:${PORT}/api`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
    console.log(`🔗 Supabase Webhook: http://localhost:${PORT}/api/supabase/merchant-webhook`);  // ✅ Added
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('================================');
    console.log('📲 MSG91 Configuration:');
    console.log(`   Invite Template: ${process.env.MSG91_INVITE_TEMPLATE || 'merchantinv'}`);
    console.log(`   Invite Namespace: ${process.env.MSG91_INVITE_NAMESPACE || 'b893736c_3468_4686_bdc8_462e51c78510'}`);
    console.log('================================');
    console.log('');
});

export default app;