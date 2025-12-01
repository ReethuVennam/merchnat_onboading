// backend/src/services/productService.ts
import { getSupabaseClient } from '../routes/supabase';
import type {
    IProductService,
    ProductCatalogRow,
    CreateProductDTO,
    UpdateProductDTO
} from '../types/products';
import { ProductNotFoundError } from '../types/products';

export class ProductService implements IProductService {
    async getAllActiveProducts(): Promise<ProductCatalogRow[]> {
        const supabase = getSupabaseClient(); // ✅ Get client lazily

        const { data, error } = await supabase
            .from('product_catalog')
            .select('*')
            .eq('is_active', true)
            .order('display_order');

        if (error) throw error;
        return data as ProductCatalogRow[];
    }

    async getProductByCode(productCode: string): Promise<ProductCatalogRow | null> {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('product_catalog')
            .select('*')
            .eq('product_code', productCode)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data as ProductCatalogRow;
    }

    async createProduct(dto: CreateProductDTO): Promise<ProductCatalogRow> {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('product_catalog')
            .insert(dto)
            .select()
            .single();

        if (error) throw error;
        return data as ProductCatalogRow;
    }

    async updateProduct(dto: UpdateProductDTO): Promise<ProductCatalogRow> {
        const supabase = getSupabaseClient();
        const { id, ...updates } = dto;

        const { data, error } = await supabase
            .from('product_catalog')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as ProductCatalogRow;
    }

    async deleteProduct(id: string): Promise<void> {
        const supabase = getSupabaseClient();

        const { error } = await supabase
            .from('product_catalog')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
}

export const productService = new ProductService();
