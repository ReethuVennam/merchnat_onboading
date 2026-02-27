{/* ...existing code... */}
// At the end of the main return (before last closing tag):
        {/* WhatsApp Support (bottom of onboarding step) */}
        <div style={{marginTop: '2rem', textAlign: 'center'}}>
            <a
                href={`https://wa.me/919958750013?text=${encodeURIComponent(`Hi SabPe Support,\n\nI need help with merchant onboarding.\n\nApplication ID: {{applicationId}}\nCurrent Step: {{currentStep}}\nUser ID: {{userId}}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#25D366', color: 'white', fontWeight: 600, fontSize: 16, padding: '12px 28px', borderRadius: 8, textDecoration: 'none', marginTop: 8, gap: '10px', boxShadow: '0 2px 8px rgba(37,211,102,0.15)'}}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><g><path d="M17.472 14.382c-.297-.149-1.758-.867-2.031-.967-.273-.099-.471-.148-.67.15-.198.297-.767.967-.94 1.166-.173.198-.347.223-.644.075-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.372-.01-.571-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.099 3.2 5.077 4.363.71.306 1.263.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.288.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#fff"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12.004 2.003c-5.514 0-9.997 4.483-9.997 9.997 0 1.762.462 3.484 1.34 4.997L2.003 22l5.122-1.342c1.46.799 3.09 1.222 4.879 1.222 5.514 0 9.997-4.483 9.997-9.997 0-2.662-1.037-5.164-2.921-7.047-1.884-1.884-4.386-2.921-7.048-2.921zm-8.063 14.47c-.807-1.357-1.237-2.908-1.237-4.473 0-4.411 3.588-7.999 7.999-7.999 2.137 0 4.146.832 5.656 2.343 1.511 1.51 2.343 3.519 2.343 5.656 0 4.411-3.588 7.999-7.999 7.999-1.437 0-2.84-.387-4.062-1.126l-.282-.167-3.718.974.8-3.207-.2-.304z" fill="#fff"/></g></svg>
                WhatsApp Support
            </a>
        </div>
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMerchantData } from '@/hooks/useMerchantData';
import { supabase } from '@/lib/supabase';
import {
    CreditCard,
    QrCode,
    Volume2,
    Globe,
    Building2,
    CheckCircle,
    Loader2,
    Check
} from 'lucide-react';

type ProductType = 'upi_qr' | 'upi_qr_soundbox' | 'pos' | 'payment_gateway' | 'current_account';
type SettlementType = 'same_day' | 'next_day';

interface ProductSelectionProps {
    onNext: () => void;
    onPrev: () => void;
    data?: {
        selectedProducts?: ProductType[];
        settlementType?: SettlementType;
    };
    onDataChange?: (data: {
        selectedProducts?: ProductType[];
        settlementType?: SettlementType;
    }) => void;
}

interface Product {
    id: ProductType;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    features: string[];
}

const products: Product[] = [
    {
        id: 'upi_qr',
        name: 'UPI QR',
        icon: QrCode,
        description: 'Accept payments via UPI QR code',
        features: ['Instant payment collection', 'No hardware required', 'Low transaction fees']
    },
    {
        id: 'upi_qr_soundbox',
        name: 'UPI QR + Soundbox',
        icon: Volume2,
        description: 'QR with audio payment confirmation',
        features: ['Audio payment alerts', 'No phone needed', 'Battery powered']
    },
    {
        id: 'pos',
        name: 'POS Terminal',
        icon: CreditCard,
        description: 'Accept card payments with POS machine',
        features: ['Card payments', 'EMI options', 'Receipt printer']
    },
    {
        id: 'payment_gateway',
        name: 'Payment Gateway',
        icon: Globe,
        description: 'Online payment integration',
        features: ['Multiple payment modes', 'API integration', 'Checkout page']
    },
    {
        id: 'current_account',
        name: 'Current Account',
        icon: Building2,
        description: 'Business banking account',
        features: ['No balance limit', 'Free transactions', 'Overdraft facility']
    }
];

// Type guard to validate ProductType
const isValidProductType = (value: string): value is ProductType => {
    return ['upi_qr', 'upi_qr_soundbox', 'pos', 'payment_gateway', 'current_account'].includes(value);
};

export const ProductSelection: React.FC<ProductSelectionProps> = ({
    onNext,
    onPrev,
    data,
    onDataChange
}) => {
    const { toast } = useToast();
    const { merchantProfile } = useMerchantData();

    // Initialize with proper type validation
    const [selectedProducts, setSelectedProducts] = useState<Set<ProductType>>(() => {
        const validProducts = (data?.selectedProducts || []).filter(isValidProductType);
        return new Set(validProducts);
    });

    const [settlementType, setSettlementType] = useState<SettlementType>(
        data?.settlementType || 'next_day'
    );
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Auto-save with debounce
    useEffect(() => {
        if (!merchantProfile || selectedProducts.size === 0) return;

        const timeoutId = setTimeout(() => {
            void saveToDatabase();
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [selectedProducts, settlementType, merchantProfile]);

    const saveToDatabase = async () => {
        if (!merchantProfile || selectedProducts.size === 0) return;

        setSaveStatus('saving');

        try {
            const productRecords = Array.from(selectedProducts).map(productType => ({
                merchant_id: merchantProfile.id,
                product_type: productType,
                settlement_type: settlementType,
                status: 'pending' as const,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }));

            // Delete existing products
            const { error: deleteError } = await supabase
                .from('merchant_products')
                .delete()
                .eq('merchant_id', merchantProfile.id);

            if (deleteError) throw deleteError;

            // Insert new selections
            const { error: insertError } = await supabase
                .from('merchant_products')
                .insert(productRecords);

            if (insertError) throw insertError;

            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);

        } catch (error) {
            console.error('Auto-save error:', error);
            setSaveStatus('idle');
        }
    };

    const handleProductToggle = (productId: ProductType) => {
        const newSelected = new Set(selectedProducts);
        if (newSelected.has(productId)) {
            newSelected.delete(productId);
        } else {
            newSelected.add(productId);
        }
        setSelectedProducts(newSelected);

        onDataChange?.({
            selectedProducts: Array.from(newSelected),
            settlementType
        });
    };

    const handleSettlementChange = (value: string) => {
        const newSettlement = value as SettlementType;
        setSettlementType(newSettlement);

        onDataChange?.({
            selectedProducts: Array.from(selectedProducts),
            settlementType: newSettlement
        });
    };

    const handleNext = () => {
        if (selectedProducts.size === 0) {
            toast({
                variant: "destructive",
                title: "No Products Selected",
                description: "Please select at least one product",
            });
            return;
        }

        onNext();
    };

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
                {products.map((product) => {
                    const Icon = product.icon;
                    const isSelected = selectedProducts.has(product.id);

                    return (
                        <Card
                            key={product.id}
                            className={`cursor-pointer transition-all ${isSelected
                                    ? 'border-primary border-2 bg-primary/5'
                                    : 'hover:border-primary/50'
                                }`}
                            onClick={() => handleProductToggle(product.id)}
                        >
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-3 rounded-lg ${isSelected ? 'bg-primary text-white' : 'bg-muted'
                                            }`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <CardTitle className="text-lg">{product.name}</CardTitle>
                                    </div>
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => handleProductToggle(product.id)}
                                        className="mt-1"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {product.description}
                                </p>
                                <ul className="space-y-2">
                                    {product.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-sm">
                                            <CheckCircle className="h-4 w-4 text-primary" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Settlement Type */}
            <Card>
                <CardHeader>
                    <CardTitle>Settlement Preference</CardTitle>
                </CardHeader>
                <CardContent>
                    <RadioGroup value={settlementType} onValueChange={handleSettlementChange}>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2 p-4 border rounded-lg flex-1">
                                <RadioGroupItem value="same_day" id="same_day" />
                                <Label htmlFor="same_day" className="cursor-pointer flex-1">
                                    <div>
                                        <div className="font-semibold">Same Day Settlement</div>
                                        <div className="text-sm text-muted-foreground">
                                            Funds credited on the same day (T+0)
                                        </div>
                                    </div>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 p-4 border rounded-lg flex-1">
                                <RadioGroupItem value="next_day" id="next_day" />
                                <Label htmlFor="next_day" className="cursor-pointer flex-1">
                                    <div>
                                        <div className="font-semibold">Next Day Settlement</div>
                                        <div className="text-sm text-muted-foreground">
                                            Funds credited next business day (T+1)
                                        </div>
                                    </div>
                                </Label>
                            </div>
                        </div>
                    </RadioGroup>
                </CardContent>
            </Card>

            {/* Summary */}
            {selectedProducts.size > 0 && (
                <Card className="bg-primary/5 border-primary">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-4">
                            <CheckCircle className="h-5 w-5 text-primary" />
                            <span className="font-semibold">Selected Products:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {Array.from(selectedProducts).map((productId) => {
                                const product = products.find(p => p.id === productId);
                                return (
                                    <div
                                        key={productId}
                                        className="bg-white px-4 py-2 rounded-full border border-primary text-sm"
                                    >
                                        {product?.name}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-3 text-sm text-muted-foreground">
                            Settlement: <span className="font-medium text-foreground">
                                {settlementType.replace('_', ' ').toUpperCase()}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={onPrev}>
                    Back
                </Button>
                <Button
                    onClick={handleNext}
                    disabled={selectedProducts.size === 0}
                >
                    Continue to Bank Details
                </Button>
            </div>
            {/* WhatsApp Support (bottom of onboarding step) */}
            <div style={{marginTop: '2rem', textAlign: 'center'}}>
              <button
                onClick={() => {
                  const message = `Hello SabPe Support Team,\n\nI am currently in the process of completing my merchant onboarding application and have encountered an issue that is preventing me from proceeding further.\n\nI have carefully reviewed the information provided, but I am still unable to resolve the problem on my own. I kindly request your assistance in guiding me through the necessary steps to complete the onboarding successfully.\n\nPlease let me know the required actions or documents, if any.\n\nThank you for your time and support.`;
                  const encodedMessage = encodeURIComponent(message);
                  const whatsappUrl = `https://wa.me/919958750013?text=${encodedMessage}`;
                  window.open(whatsappUrl, '_blank');
                }}
                style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#25D366', color: 'white', fontWeight: 600, fontSize: 16, padding: '12px 28px', borderRadius: 8, textDecoration: 'none', marginTop: 8, gap: '10px', boxShadow: '0 2px 8px rgba(37,211,102,0.15)', border: 'none', cursor: 'pointer'}}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><g><path d="M17.472 14.382c-.297-.149-1.758-.867-2.031-.967-.273-.099-.471-.148-.67.15-.198.297-.767.967-.94 1.166-.173.198-.347.223-.644.075-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.372-.01-.571-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.099 3.2 5.077 4.363.71.306 1.263.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.288.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#fff"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12.004 2.003c-5.514 0-9.997 4.483-9.997 9.997 0 1.762.462 3.484 1.34 4.997L2.003 22l5.122-1.342c1.46.799 3.09 1.222 4.879 1.222 5.514 0 9.997-4.483 9.997-9.997 0-2.662-1.037-5.164-2.921-7.047-1.884-1.884-4.386-2.921-7.048-2.921zm-8.063 14.47c-.807-1.357-1.237-2.908-1.237-4.473 0-4.411 3.588-7.999 7.999-7.999 2.137 0 4.146.832 5.656 2.343 1.511 1.51 2.343 3.519 2.343 5.656 0 4.411-3.588 7.999-7.999 7.999-1.437 0-2.84-.387-4.062-1.126l-.282-.167-3.718.974.8-3.207-.2-.304z" fill="#fff"/></g></svg>
                WhatsApp Support
              </button>
            </div>
        </div>
    );
};