// backend/src/routes/products.ts

import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { productService } from '../services/productService';
import { merchantProductService } from '../services/merchantProductService';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * GET /api/products/catalog
 * Get all active products from catalog
 * Public or authenticated route
 */
router.get('/catalog', async (req: Request, res: Response): Promise<void> => {
    try {
        const products = await productService.getAllActiveProducts();

        res.json({
            success: true,
            products
        });
    } catch (error) {
        logger.error('Error fetching product catalog', error as Error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch products'
        });
    }
});

/**
 * POST /api/products/merchant/update-products
 * Update merchant's selected products
 * Requires authentication
 */
router.post('/merchant/update-products', authenticate, async (req: Request, res: Response): Promise<void> => {
    try {
        const merchantId = req.user?.merchantId;  // ✅ Use merchantId (matches interface)
        const { products } = req.body;

        if (!merchantId) {
            res.status(401).json({
                success: false,
                message: 'Merchant ID not found'
            });
            return;
        }

        if (!products || !Array.isArray(products)) {
            res.status(400).json({
                success: false,
                message: 'Products array is required'
            });
            return;
        }

        // Update merchant products
        const result = await merchantProductService.updateMerchantProducts(merchantId, products);

        // Calculate costs
        const costs = merchantProductService.calculateCosts(products);

        res.json({
            success: true,
            data: result,
            costs
        });
    } catch (error) {
        logger.error('Error updating merchant products', error as Error);
        res.status(500).json({
            success: false,
            message: 'Failed to update products'
        });
    }
});

/**
 * GET /api/products/merchant/selected-products
 * Get merchant's selected products
 * Requires authentication
 */
router.get('/merchant/selected-products', authenticate, async (req: Request, res: Response): Promise<void> => {
    try {
        const merchantId = req.user?.merchantId;  // ✅ Use merchantId (matches interface)

        if (!merchantId) {
            res.status(401).json({
                success: false,
                message: 'Merchant ID not found'
            });
            return;
        }

        // Get merchant's selected products
        const selectedProducts = await merchantProductService.getMerchantProducts(merchantId);

        // Calculate costs
        const costs = merchantProductService.calculateCosts(selectedProducts);

        res.json({
            success: true,
            selectedProducts,
            costs: {
                monthlyTotal: costs.monthly_cost,
                onetimeTotal: costs.onetime_cost,
                integrationTotal: costs.integration_cost,
                grandTotal: costs.monthly_cost + costs.onetime_cost + costs.integration_cost,
                breakdown: {
                    monthly: selectedProducts.filter(p => p.pricing_type === 'monthly'),
                    onetime: selectedProducts.filter(p => p.pricing_type === 'onetime'),
                    integration: selectedProducts.filter(p => p.pricing_type === 'integration')
                }
            }
        });
    } catch (error) {
        logger.error('Error fetching merchant products', error as Error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch selected products'
        });
    }
});

/**
 * POST /api/products/merchant/sign-agreement
 * Sign merchant agreement with selected products
 * Requires authentication
 */
router.post('/merchant/sign-agreement', authenticate, async (req: Request, res: Response): Promise<void> => {
    try {
        const merchantId = req.user?.merchantId;  // ✅ Use merchantId (matches interface)
        const { signatureName, selectedProducts, costs } = req.body;

        if (!merchantId) {
            res.status(401).json({
                success: false,
                message: 'Merchant ID not found'
            });
            return;
        }

        if (!signatureName || !signatureName.trim()) {
            res.status(400).json({
                success: false,
                message: 'Signature name is required'
            });
            return;
        }

        // Get IP address and user agent
        const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        // Sign agreement
        const agreement = await merchantProductService.signAgreement(
            merchantId,
            {
                signatureName: signatureName.trim(),
                selectedProducts: selectedProducts || [],
                monthlyCost: costs?.monthlyTotal,
                onetimeCost: costs?.onetimeTotal,
                integrationCost: costs?.integrationTotal,
            },
            ipAddress,
            userAgent
        );

        res.json({
            success: true,
            message: 'Agreement signed successfully',
            agreement
        });
    } catch (error: any) {
        logger.error('Error signing merchant agreement', error as Error);

        // Check for specific error types
        if (error.message?.includes('already signed')) {
            res.status(409).json({
                success: false,
                message: 'Agreement has already been signed'
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Failed to sign agreement'
        });
    }
});

/**
 * GET /api/products/merchant/agreements
 * Get merchant's agreement history
 * Requires authentication
 */
router.get('/merchant/agreements', authenticate, async (req: Request, res: Response): Promise<void> => {
    try {
        const merchantId = req.user?.merchantId;  // ✅ Use merchantId (matches interface)

        if (!merchantId) {
            res.status(401).json({
                success: false,
                message: 'Merchant ID not found'
            });
            return;
        }

        const agreements = await merchantProductService.getMerchantAgreements(merchantId);

        res.json({
            success: true,
            agreements
        });
    } catch (error) {
        logger.error('Error fetching merchant agreements', error as Error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch agreements'
        });
    }
});

export default router;