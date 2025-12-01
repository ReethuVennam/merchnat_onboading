// src/components/onboarding/ProductSelection.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useMerchantData } from '@/hooks/useMerchantData';
import { apiClient } from '@/lib/api-client';
import {
    CreditCard,
    QrCode,
    Volume2,
    Globe,
    Building2,
    CheckCircle,
    Loader2,
    Check,
    Gift,
    Send,
    Lock,
    Shield,
    AlertCircle,
    IndianRupee,
    Info
} from 'lucide-react';
import type {
    Product,
    SelectedProduct,
    PricingOption,
    ProductPricingSelection,
    CostSummary,
    SettlementType
} from '@/types/products';
import { formatPrice, formatPriceRange, calculateTotalCosts } from '@/types/products';

interface ProductSelectionProps {
    onNext: () => void;
    onPrev: () => void;
}

// Product icons mapping
const productIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    'PROD_001': QrCode,
    'PROD_002': Volume2,
    'PROD_003': CreditCard,
    'PROD_004': Globe,
    'PROD_005': Building2,
    'PROD_006': Gift,
    'PROD_007': Send,
    'PROD_008': Lock,
    'PROD_009': Shield,
};

export const ProductSelectionEnhanced: React.FC<ProductSelectionProps> = ({ onNext, onPrev }) => {
    const { toast } = useToast();
    const { merchantProfile } = useMerchantData();

    // State management
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Product selection state
    const [selectedProductCodes, setSelectedProductCodes] = useState<Set<string>>(new Set());
    const [pricingSelections, setPricingSelections] = useState<Map<string, ProductPricingSelection>>(
        new Map()
    );

    // Settlement preference
    const [settlementType, setSettlementType] = useState<SettlementType>('next_day');

    // No agreement signing here - that happens in Review & Submit page

    // Cost calculation state
    const [costs, setCosts] = useState<CostSummary>({
        monthlyTotal: 0,
        onetimeTotal: 0,
        integrationTotal: 0,
        grandTotal: 0,
        breakdown: { monthly: [], onetime: [], integration: [] },
    });

    // Fetch products on mount
    useEffect(() => {
        fetchProducts();
    }, []);

    // Auto-calculate costs when selections change
    useEffect(() => {
        const selectedProducts = buildSelectedProductsArray();
        const calculatedCosts = calculateTotalCosts(selectedProducts);
        setCosts(calculatedCosts);
    }, [selectedProductCodes, pricingSelections]);

    // Auto-save with debounce
    useEffect(() => {
        if (selectedProductCodes.size === 0) return;

        const timeoutId = setTimeout(() => {
            void saveProductSelection();
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [selectedProductCodes, pricingSelections, settlementType]);

    const fetchProducts = async () => {
        try {
            const response = await apiClient.get('/api/products/catalog');
            setProducts(response.data.products || []);
        } catch (error) {
            console.error('Error fetching products:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to load products',
            });
        } finally {
            setLoading(false);
        }
    };

    const checkAgreementStatus = () => {
        if (merchantProfile?.agreement_signed) {
            setAgreementSigned(true);
        }
    };

    const handleProductToggle = (productCode: string) => {
        const newSelected = new Set(selectedProductCodes);

        if (newSelected.has(productCode)) {
            // Deselect product
            newSelected.delete(productCode);
            const newPricing = new Map(pricingSelections);
            newPricing.delete(productCode);
            setPricingSelections(newPricing);
        } else {
            // Select product with default pricing
            newSelected.add(productCode);
            const product = products.find(p => p.product_code === productCode);
            if (product) {
                setDefaultPricingForProduct(product);
            }
        }

        setSelectedProductCodes(newSelected);
    };

    const setDefaultPricingForProduct = (product: Product) => {
        const newPricing = new Map(pricingSelections);

        let defaultOption: PricingOption = 'monthly';

        // Determine default pricing option
        if (product.display_price === 0) {
            defaultOption = 'free';
        } else if (product.price_integration_fee) {
            defaultOption = 'integration';
        } else if (product.price_monthly_min) {
            defaultOption = 'monthly';
        } else if (product.price_onetime_min) {
            defaultOption = 'onetime';
        }

        newPricing.set(product.product_code, {
            product_code: product.product_code,
            selectedOption: defaultOption,
            includeSimCost: false,
        });

        setPricingSelections(newPricing);
    };

    const handlePricingChange = (
        productCode: string,
        option: PricingOption,
        additionalData?: Partial<ProductPricingSelection>
    ) => {
        const newPricing = new Map(pricingSelections);
        const existing = newPricing.get(productCode) || {
            product_code: productCode,
            selectedOption: option,
        };

        newPricing.set(productCode, {
            ...existing,
            selectedOption: option,
            ...additionalData,
        });

        setPricingSelections(newPricing);
    };

    const buildSelectedProductsArray = (): SelectedProduct[] => {
        return Array.from(selectedProductCodes).map(code => {
            const product = products.find(p => p.product_code === code);
            const pricing = pricingSelections.get(code);

            if (!product || !pricing) {
                return {
                    product_code: code,
                    product_name: '',
                    pricing_type: 'monthly',
                    price: 0,
                };
            }

            let price = 0;
            const pricingType = pricing.selectedOption;

            switch (pricingType) {
                case 'free':
                    price = 0;
                    break;
                case 'monthly':
                    price = product.price_monthly_min || 0;
                    break;
                case 'onetime':
                    price = product.price_onetime_min || 0;
                    break;
                case 'integration':
                    price = product.price_integration_fee || 0;
                    break;
            }

            const result: SelectedProduct = {
                product_code: code,
                product_name: product.product_name,
                pricing_type: pricingType,
                price,
            };

            // Add additional costs if applicable
            if (pricing.includeSimCost && product.price_sim_cost_min) {
                result.additional_costs = {
                    sim_cost: product.price_sim_cost_min,
                };
            }

            return result;
        });
    };

    const saveProductSelection = async () => {
        if (!merchantProfile) return;

        setSaveStatus('saving');
        try {
            const selectedProducts = buildSelectedProductsArray();

            await apiClient.post('/products/merchant/update-products', {
                products: selectedProducts,
               
            });

            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            console.error('Error saving products:', error);
            setSaveStatus('idle');
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: 'Failed to save product selection',
            });
        }
    };

    const handleNext = () => {
        if (selectedProductCodes.size === 0) {
            toast({
                variant: 'destructive',
                title: 'No Products Selected',
                description: 'Please select at least one product',
            });
            return;
        }

        onNext();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Auto-save indicator */}
            <div className="fixed top-4 right-4 z-50">
                {saveStatus === 'saving' && (
                    <div className="flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg shadow-lg">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">Saving...</span>
                    </div>
                )}
                {saveStatus === 'saved' && (
                    <div className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-lg shadow-lg">
                        <Check className="h-4 w-4" />
                        <span className="text-sm font-medium">Saved</span>
                    </div>
                )}
            </div>

            {/* Header */}
            <div className="text-center">
                <h2 className="text-3xl font-bold text-foreground mb-2">
                    Select Products & Services
                </h2>
                <p className="text-muted-foreground">
                    Choose the payment solutions you need for your business
                </p>
            </div>

            {/* Products Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                    <ProductCard
                        key={product.id}
                        product={product}
                        isSelected={selectedProductCodes.has(product.product_code)}
                        pricingSelection={pricingSelections.get(product.product_code)}
                        onToggle={handleProductToggle}
                        onPricingChange={handlePricingChange}
                    />
                ))}
            </div>

            {/* Settlement Preference */}
            {selectedProductCodes.size > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            Settlement Preference
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RadioGroup value={settlementType} onValueChange={(v) => setSettlementType(v as SettlementType)}>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:border-primary">
                                    <RadioGroupItem value="same_day" id="same_day" />
                                    <Label htmlFor="same_day" className="cursor-pointer flex-1">
                                        <div className="font-semibold">Same Day Settlement</div>
                                        <div className="text-sm text-muted-foreground">
                                            Funds credited on the same day (T+0)
                                        </div>
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:border-primary">
                                    <RadioGroupItem value="next_day" id="next_day" />
                                    <Label htmlFor="next_day" className="cursor-pointer flex-1">
                                        <div className="font-semibold">Next Day Settlement</div>
                                        <div className="text-sm text-muted-foreground">
                                            Funds credited next business day (T+1)
                                        </div>
                                    </Label>
                                </div>
                            </div>
                        </RadioGroup>
                    </CardContent>
                </Card>
            )}

            {/* Cost Summary */}
            {selectedProductCodes.size > 0 && (
                <CostSummaryCard costs={costs} products={products} selections={pricingSelections} />
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={onPrev}>
                    Back
                </Button>
                <Button onClick={handleNext} disabled={selectedProductCodes.size === 0}>
                    Continue to Bank Details
                </Button>
            </div>
        </div>
    );
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

interface ProductCardProps {
    product: Product;
    isSelected: boolean;
    pricingSelection?: ProductPricingSelection;
    onToggle: (productCode: string) => void;
    onPricingChange: (productCode: string, option: PricingOption, additional?: any) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
    product,
    isSelected,
    pricingSelection,
    onToggle,
    onPricingChange,
}) => {
    const Icon = productIcons[product.product_code] || CreditCard;
    const [showPricingOptions, setShowPricingOptions] = useState(false);

    const hasMultiplePricingOptions =
        (product.price_monthly_min && product.price_onetime_min) ||
        (product.price_integration_fee && product.price_monthly_min);

    return (
        <Card
            className={`cursor-pointer transition-all ${isSelected ? 'border-primary border-2 bg-primary/5' : 'hover:border-primary/50'
                }`}
        >
            <CardHeader onClick={() => onToggle(product.product_code)}>
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                        {/* Product Image or Icon */}
                        <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <img
                                src={product.product_image_url}
                                alt={product.product_name}
                                className="h-20 w-20 object-contain"
                            />
                        </div>

                        <div className="flex-1">
                            <CardTitle className="text-lg mb-1">{product.product_name}</CardTitle>

                            {/* Pricing Display */}
                            <div className="mb-2">
                                {product.display_price_type === 'Free' ? (
                                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                                        Free
                                    </Badge>
                                ) : product.display_price_type === 'Range' ? (
                                    <div className="text-sm font-semibold text-primary">
                                        {formatPriceRange(
                                            product.price_monthly_min || product.price_onetime_min || 0,
                                            product.price_monthly_max || product.price_onetime_max || 0
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-lg font-bold text-primary">
                                        {formatPrice(product.display_price)}
                                        <span className="text-xs font-normal text-muted-foreground ml-1">
                                            {product.display_price_type === 'Monthly' && '/mo'}
                                            {product.display_price_type === 'One-Time' && 'one-time'}
                                            {product.display_price_type === 'Integration Fee' && 'setup'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Category Badge */}
                            <Badge variant="outline" className="text-xs">
                                {product.category}
                            </Badge>
                        </div>
                    </div>

                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggle(product.product_code)}
                        className="mt-1"
                    />
                </div>
            </CardHeader>

            <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{product.product_description}</p>

                {/* Features */}
                <ul className="space-y-2 mb-4">
                    {product.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>

                {/* Pricing Note */}
                {product.pricing_note && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                        <Info className="h-3 w-3 inline mr-1" />
                        {product.pricing_note}
                    </div>
                )}

                {/* Pricing Options (if multiple options available) */}
                {isSelected && hasMultiplePricingOptions && (
                    <div className="mt-4 pt-4 border-t">
                        <PricingOptionsSelector
                            product={product}
                            selection={pricingSelection}
                            onChange={(option, additional) =>
                                onPricingChange(product.product_code, option, additional)
                            }
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

interface PricingOptionsSelectorProps {
    product: Product;
    selection?: ProductPricingSelection;
    onChange: (option: PricingOption, additional?: any) => void;
}

const PricingOptionsSelector: React.FC<PricingOptionsSelectorProps> = ({
    product,
    selection,
    onChange,
}) => {
    const currentOption = selection?.selectedOption || 'monthly';

    return (
        <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700">Choose Pricing Option:</div>
            <RadioGroup value={currentOption} onValueChange={(v) => onChange(v as PricingOption)}>
                {product.price_monthly_min && (
                    <div className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                        <RadioGroupItem value="monthly" id={`${product.product_code}-monthly`} />
                        <Label
                            htmlFor={`${product.product_code}-monthly`}
                            className="cursor-pointer flex-1"
                        >
                            <div className="flex justify-between">
                                <span>Monthly Rental</span>
                                <span className="font-semibold">
                                    {formatPriceRange(product.price_monthly_min, product.price_monthly_max!)}
                                </span>
                            </div>
                        </Label>
                    </div>
                )}
                {product.price_onetime_min && (
                    <div className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                        <RadioGroupItem value="onetime" id={`${product.product_code}-onetime`} />
                        <Label
                            htmlFor={`${product.product_code}-onetime`}
                            className="cursor-pointer flex-1"
                        >
                            <div className="flex justify-between">
                                <span>One-time Purchase</span>
                                <span className="font-semibold">
                                    {formatPriceRange(product.price_onetime_min, product.price_onetime_max!)}
                                </span>
                            </div>
                        </Label>
                    </div>
                )}
            </RadioGroup>

            {/* SIM Cost Option */}
            {product.price_sim_cost_min && (
                <div className="flex items-center space-x-2 mt-2">
                    <Checkbox
                        id={`${product.product_code}-sim`}
                        checked={selection?.includeSimCost || false}
                        onCheckedChange={(checked) =>
                            onChange(currentOption, { includeSimCost: checked })
                        }
                    />
                    <Label htmlFor={`${product.product_code}-sim`} className="text-sm cursor-pointer">
                        Include SIM Cost (
                        {formatPriceRange(product.price_sim_cost_min, product.price_sim_cost_max!)})
                    </Label>
                </div>
            )}
        </div>
    );
};

interface CostSummaryCardProps {
    costs: CostSummary;
    products: Product[];
    selections: Map<string, ProductPricingSelection>;
}

const CostSummaryCard: React.FC<CostSummaryCardProps> = ({ costs, products, selections }) => {
    return (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-primary">
            <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                    <IndianRupee className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-lg">Cost Summary</span>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-4">
                    {costs.monthlyTotal > 0 && (
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-xs text-muted-foreground mb-1">Monthly Recurring</div>
                            <div className="text-2xl font-bold text-primary">
                                {formatPrice(costs.monthlyTotal)}
                                <span className="text-sm font-normal">/mo</span>
                            </div>
                        </div>
                    )}
                    {costs.onetimeTotal > 0 && (
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-xs text-muted-foreground mb-1">One-Time Payment</div>
                            <div className="text-2xl font-bold text-green-600">
                                {formatPrice(costs.onetimeTotal)}
                            </div>
                        </div>
                    )}
                    {costs.integrationTotal > 0 && (
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-xs text-muted-foreground mb-1">Integration Fee</div>
                            <div className="text-2xl font-bold text-orange-600">
                                {formatPrice(costs.integrationTotal)}
                            </div>
                        </div>
                    )}
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700">Total Initial Cost</span>
                    <span className="text-2xl font-bold text-primary">
                        {formatPrice(costs.onetimeTotal + costs.integrationTotal)}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
};

export { ProductSelectionEnhanced as ProductSelection };
export default ProductSelectionEnhanced;
