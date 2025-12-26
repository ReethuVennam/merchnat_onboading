// backend/src/services/merchantProductService.ts
import { getSupabaseClient } from '../routes/supabase';
import type {
    IMerchantProductService,
    SelectedProductData,
    MerchantProductColumns,
    MerchantAgreementRow,
    SignAgreementRequest,
    CostCalculationResponse
} from '../types/products';
import { AgreementAlreadySignedError } from '../types/products';

export class MerchantProductService implements IMerchantProductService {
async updateMerchantProducts(
    merchantId: string,
    products: SelectedProductData[]
): Promise<MerchantProductColumns> {
    const supabase = getSupabaseClient();

    console.log('💾 Updating products for merchant:', merchantId);
    console.log('📦 Products:', JSON.stringify(products, null, 2));

    // Calculate costs
    const costs = this.calculateCosts(products);

    const { data, error } = await supabase
        .from('merchant_profiles')
        .update({
            selected_products: products, // Supabase handles JSONB automatically
            total_monthly_cost: costs.monthly_cost,
            total_onetime_cost: costs.onetime_cost,
            total_integration_cost: costs.integration_cost,
            updated_at: new Date().toISOString()
        })
        .eq('id', merchantId)
        .select('selected_products, total_monthly_cost, total_onetime_cost, total_integration_cost, agreement_signed, agreement_signed_at, agreement_ip_address, agreement_signature')
        .single();

    if (error) {
        console.error('❌ Supabase update error:', error);
        throw error;
    }

    console.log('✅ Products updated successfully');
    return data as MerchantProductColumns;
}

    async getMerchantProducts(merchantId: string): Promise<SelectedProductData[]> {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('merchant_profiles')
            .select('selected_products')
            .eq('id', merchantId)
            .single();

        if (error) throw error;
        return (data?.selected_products || []) as SelectedProductData[];
    }

    calculateCosts(products: SelectedProductData[]): CostCalculationResponse {
        const monthly = products
            .filter(p => p.pricing_type === 'monthly')
            .reduce((sum, p) => sum + p.price, 0);  // ✅ Fixed

        const onetime = products
            .filter(p => p.pricing_type === 'onetime')
            .reduce((sum, p) => sum + p.price, 0);  // ✅ Fixed

        const integration = products
            .filter(p => p.pricing_type === 'integration')
            .reduce((sum, p) => sum + p.price, 0);  // ✅ Fixed

        return {
            monthly_cost: monthly,
            onetime_cost: onetime,
            integration_cost: integration
        };
    }

    async signAgreement(
        merchantId: string,
        data: SignAgreementRequest,
        ipAddress: string,
        userAgent: string
    ): Promise<MerchantAgreementRow> {
        const supabase = getSupabaseClient();

        // Check if already signed
        const { data: agreement, error } = await supabase
            .from('merchant_agreements')
            .insert({
                merchant_id: merchantId,
                agreement_type: 'product_selection',
                selected_products: data.selectedProducts,
                monthly_rental_cost: data.monthlyCost || 0,
                one_time_cost: data.onetimeCost || 0,
                total_integration_cost: data.integrationCost || 0,
                total_monthly_cost: data.monthlyCost || 0,
                total_onetime_cost: data.onetimeCost || 0,
                signed: true,
                signed_at: new Date().toISOString(),
                signature_name: data.signatureName,
                ip_address: ipAddress,
                user_agent: userAgent
            })
            .select()
            .single();

        if (error) throw error;

        // Update merchant profile with latest agreement
        await supabase
            .from('merchant_profiles')
            .update({
                agreement_signed: true,
                agreement_signed_at: new Date().toISOString(),
                agreement_signature: data.signatureName,
                agreement_ip_address: ipAddress,
                selected_products: data.selectedProducts,  // ✅ Update products too
                total_monthly_cost: data.monthlyCost || 0,
                total_onetime_cost: data.onetimeCost || 0,
                total_integration_cost: data.integrationCost || 0
            })
            .eq('id', merchantId);

        return agreement as MerchantAgreementRow;
    }

    async getMerchantAgreements(merchantId: string): Promise<MerchantAgreementRow[]> {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('merchant_agreements')
            .select('*')
            .eq('merchant_id', merchantId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as MerchantAgreementRow[];
    }
}

export const merchantProductService = new MerchantProductService();
