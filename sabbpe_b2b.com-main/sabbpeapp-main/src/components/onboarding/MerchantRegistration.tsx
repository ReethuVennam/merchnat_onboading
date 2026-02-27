// JavaScript source code
import React, { useState, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useMerchantData } from '@/hooks/useMerchantData';
import { RaiseTicketButton } from '../RaiseTicketButton';
import {
    Upload,
    FileText,
    User,
    Building,
    CheckCircle,
    RefreshCw,
    Sparkles,
    CreditCard,
    Camera,
    AlertTriangle,
    Settings
} from 'lucide-react';

import { supabase } from '@/lib/supabase';

interface ExtractedData {
    panNumber?: string;
    aadhaarNumber?: string;
    extractedName?: string;
    dateOfBirth?: string;
    confidence: number;
}

interface DocumentUploadCardProps {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    file: File | null;
    uploadStatus: 'idle' | 'uploading' | 'success' | 'failed';
    ocrStatus: 'idle' | 'processing' | 'success' | 'failed';
    ocrProgress?: number;
    onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    description: string;
    uploadError?: string;
    ocrError?: string;
}

interface AutoFillInputProps {
    label: string;
    value: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
    type?: string;
    maxLength?: number;
    required?: boolean;
    isAutoFilled: boolean;
}

interface FormData {
    fullName: string;
    panNumber: string;
    aadhaarNumber: string;
    mobileNumber: string;
    email: string;
    businessName: string;
    gstNumber: string;
    hasGST: boolean;
    documents?: {
        panCard?: { file: File; path: string };
        aadhaarCard?: { file: File; path: string };
        businessProof?: { file: File; path: string };
        bankStatement?: { file: File; path: string };  // ✅ Registration page
        cancelledCheque?: { file: File; path: string }; // ✅ Bank Details page
        [key: string]: { file: File; path: string } | undefined;
    };
}

interface MerchantRegistrationProps {
    onNext?: () => void;
    onPrev?: () => void;
    data?: FormData;
    onDataChange?: (data: Partial<FormData>) => void;
}

interface DocumentState {
    file: File | null;
    uploadStatus: 'idle' | 'uploading' | 'success' | 'failed';
    ocrStatus: 'idle' | 'processing' | 'success' | 'failed';
    ocrProgress: number;
    uploadPath?: string;
    uploadError?: string;
    ocrError?: string;
}

// Real OCR Service using OCR.space
class RealOCRService {
    private apiKey = 'K86775768388957';

    private async preprocessImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
        }

        img.onload = function () {
            console.log(`Original image size: ${img.width}x${img.height}`);

            // ✅ More aggressive size limits
            let scaleFactor = 1;
            const maxWidth = 1600;  // Reduced from 2048
            const maxHeight = 1600;

            if (img.width > maxWidth || img.height > maxHeight) {
                const scaleX = maxWidth / img.width;
                const scaleY = maxHeight / img.height;
                scaleFactor = Math.min(scaleX, scaleY);
            }

            canvas.width = Math.floor(img.width * scaleFactor);
            canvas.height = Math.floor(img.height * scaleFactor);

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Enhanced contrast
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;

                let enhanced = ((gray - 128) * 1.15) + 128;
                enhanced += 5;
                enhanced = Math.max(0, Math.min(255, enhanced));

                data[i] = data[i + 1] = data[i + 2] = enhanced;
            }

            ctx.putImageData(imageData, 0, 0);

            console.log(`Resized to: ${canvas.width}x${canvas.height} (${scaleFactor.toFixed(2)}x)`);

            // ✅ Iteratively reduce quality until under 1MB
            const quality = 0.85;  // Start lower
            const attemptCompression = (currentQuality: number) => {
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Failed to create image blob'));
                        return;
                    }

                    const sizeKB = blob.size / 1024;
                    console.log(`Compressed to ${sizeKB.toFixed(1)} KB at quality ${currentQuality}`);

                    if (sizeKB > 950 && currentQuality > 0.3) {
                        // Still too large, try lower quality
                        attemptCompression(currentQuality - 0.1);
                    } else if (sizeKB > 1024) {
                        // Can't compress enough, reject
                        reject(new Error(`Image too large: ${sizeKB.toFixed(1)} KB`));
                    } else {
                        // Success!
                        console.log(`✅ Final size: ${sizeKB.toFixed(1)} KB`);
                        resolve(blob);
                    }
                }, 'image/jpeg', currentQuality);  // ✅ Changed to JPEG
            };

            attemptCompression(quality);
        };

        img.onerror = () => reject(new Error('Failed to load image'));

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === 'string') {
                img.src = result;
            } else {
                reject(new Error('Failed to read file'));
            }
        };
        reader.readAsDataURL(file);
    });
}

    private detectDocumentType(text: string): 'pan_card' | 'aadhaar_card' | 'unknown' {
        const cleanText = text.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ');

        const panPatterns = [
            /INCOME\s*TAX\s*DEPARTMENT/,
            /PERMANENT\s*ACCOUNT\s*NUMBER/,
            /GOVT?\s*OF\s*INDIA/,
            /PAN/
        ];

        const aadhaarPatterns = [
            /UNIQUE\s*IDENTIFICATION\s*AUTHORITY/,
            /GOVERNMENT\s*OF\s*INDIA/,
            /AADHAAR/,
            /\bUID\b/
        ];

        const panMatches = panPatterns.filter(pattern => pattern.test(cleanText)).length;
        const aadhaarMatches = aadhaarPatterns.filter(pattern => pattern.test(cleanText)).length;

        const panNumberPattern = /[A-Z]{5}[0-9]{4}[A-Z]{1}/;
        const aadhaarNumberPattern = /[2-9]{1}[0-9]{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}/;

        const hasPanNumber = panNumberPattern.test(cleanText);
        const hasAadhaarNumber = aadhaarNumberPattern.test(cleanText);

        if ((panMatches >= 1 || hasPanNumber) && panMatches >= aadhaarMatches) {
            return 'pan_card';
        } else if ((aadhaarMatches >= 1 || hasAadhaarNumber) && aadhaarMatches >= panMatches) {
            return 'aadhaar_card';
        } else {
            return 'unknown';
        }
    }

    private extractPANData(text: string): ExtractedData {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const cleanText = text.replace(/[^\w\s/-]/g, ' ').replace(/\s+/g, ' ');

        const panMatch = cleanText.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
        const panNumber = panMatch ? panMatch[0] : undefined;

        const dobPatterns = [
            /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/,
            /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})/
        ];

        let dateOfBirth;
        for (const pattern of dobPatterns) {
            const dobMatch = cleanText.match(pattern);
            if (dobMatch) {
                dateOfBirth = dobMatch[0];
                break;
            }
        }

        const excludeWords = ['INCOME', 'TAX', 'DEPARTMENT', 'GOVT', 'GOVERNMENT', 'INDIA', 'PERMANENT', 'ACCOUNT', 'NUMBER', 'SIGNATURE', 'PAN'];
        let extractedName;
        let maxScore = 0;

        for (const line of lines) {
            const words = line.toUpperCase().split(/\s+/);
            const hasExcluded = words.some(word => excludeWords.some(exc => word.includes(exc)));
            const isAllCaps = line === line.toUpperCase();
            const hasLetters = /[A-Z]/.test(line);
            const hasNumbers = /[0-9]/.test(line);

            if (!hasExcluded && isAllCaps && hasLetters && !hasNumbers && line.length > 3) {
                const score = line.length + (words.length * 2);
                if (score > maxScore) {
                    maxScore = score;
                    extractedName = line.trim();
                }
            }
        }

        return {
            panNumber,
            extractedName,
            dateOfBirth,
            confidence: panNumber ? 85 : 40
        };
    }

    private extractAadhaarData(text: string): ExtractedData {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const cleanText = text.replace(/[^\w\s/-]/g, ' ').replace(/\s+/g, ' ');

        const aadhaarPatterns = [
            /[2-9]{1}[0-9]{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}/,
            /[2-9][0-9]{11}/
        ];

        let aadhaarNumber;
        for (const pattern of aadhaarPatterns) {
            const match = cleanText.match(pattern);
            if (match) {
                const rawNumber = match[0].replace(/[\s-]/g, '');
                aadhaarNumber = rawNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3');
                break;
            }
        }

        const dobPatterns = [
            /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/,
            /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})/
        ];

        let dateOfBirth;
        for (const pattern of dobPatterns) {
            const dobMatch = cleanText.match(pattern);
            if (dobMatch) {
                dateOfBirth = dobMatch[0];
                break;
            }
        }

        const excludeWords = ['UNIQUE', 'IDENTIFICATION', 'AUTHORITY', 'GOVERNMENT', 'INDIA', 'AADHAAR', 'MALE', 'FEMALE', 'DOB', 'VID'];
        let extractedName;
        let maxScore = 0;

        for (const line of lines) {
            const words = line.toUpperCase().split(/\s+/);
            const hasExcluded = words.some(word => excludeWords.some(exc => word.includes(exc)));
            const isAllCaps = line === line.toUpperCase();
            const hasLetters = /[A-Z]/.test(line);
            const hasNumbers = /[0-9]/.test(line);

            if (!hasExcluded && isAllCaps && hasLetters && !hasNumbers && line.length > 3) {
                const score = line.length + (words.length * 2);
                if (score > maxScore) {
                    maxScore = score;
                    extractedName = line.trim();
                }
            }
        }

        return {
            aadhaarNumber,
            extractedName,
            dateOfBirth,
            confidence: aadhaarNumber ? 85 : 40
        };
    }

    async processDocument(
        file: File,
        onProgress?: (progress: number) => void
    ): Promise<ExtractedData> {
        console.log('Starting OCR processing:', file.name);

        try {
            onProgress?.(10);

            const processedImage = await this.preprocessImage(file);
            onProgress?.(30);

            const formData = new FormData();
            formData.append('file', processedImage, 'document.png');
            formData.append('apikey', this.apiKey);
            formData.append('language', 'eng');
            formData.append('isOverlayRequired', 'false');
            formData.append('detectOrientation', 'true');
            formData.append('scale', 'true');
            formData.append('OCREngine', '2');

            onProgress?.(50);

            const response = await fetch('https://api.ocr.space/parse/image', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            onProgress?.(80);

            if (result.OCRExitCode === 1 && result.ParsedResults?.length > 0) {
                const extractedText = result.ParsedResults[0].ParsedText;
                console.log('OCR Text:', extractedText);

                const docType = this.detectDocumentType(extractedText);
                console.log('Document type detected:', docType);

                onProgress?.(100);

                if (docType === 'pan_card') {
                    return this.extractPANData(extractedText);
                } else if (docType === 'aadhaar_card') {
                    return this.extractAadhaarData(extractedText);
                } else {
                    throw new Error('Document type not recognized');
                }
            } else {
                throw new Error('OCR processing failed: ' + (result.ErrorMessage || 'Unknown error'));
            }

        } catch (error) {
            console.error('OCR processing error:', error);
            throw error;
        }
    }
}

const ocrService = new RealOCRService();

// ✅ AutoFillInput Component OUTSIDE MerchantRegistration
const AutoFillInput: React.FC<AutoFillInputProps> = ({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    maxLength,
    required = false,
    isAutoFilled
}) => {
    return (
        <div>
            <Label className="flex items-center gap-2 mb-2">
                {label} {required && <span className="text-red-500">*</span>}
                {isAutoFilled && (
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        <Sparkles className="h-3 w-3" />
                        Auto-filled
                    </span>
                )}
            </Label>
            <Input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                maxLength={maxLength}
                className={isAutoFilled ? 'border-green-300 bg-green-50' : ''}
            />
        </div>
    );
};

const MerchantRegistration: React.FC<MerchantRegistrationProps> = ({
    onNext,
    onPrev,
    data,
    onDataChange
}) => {
    const { toast } = useToast();
    const { user } = useAuth(); 
    const { merchantProfile } = useMerchantData();
    const [formData, setFormData] = useState<FormData>({
        fullName: data?.fullName || '',
        panNumber: data?.panNumber || '',
        aadhaarNumber: data?.aadhaarNumber || '',
        mobileNumber: data?.mobileNumber || '',
        email: data?.email || '',
        businessName: data?.businessName || '',
        gstNumber: data?.gstNumber || '',
        hasGST: data?.hasGST ?? true
    });

    const [panDocument, setPanDocument] = useState<DocumentState>({
        file: null,
        uploadStatus: 'idle',
        ocrStatus: 'idle',
        ocrProgress: 0
    });

    const [aadhaarDocument, setAadhaarDocument] = useState<DocumentState>({
        file: null,
        uploadStatus: 'idle',
        ocrStatus: 'idle',
        ocrProgress: 0
    });

    const [businessProof, setBusinessProof] = useState<File | null>(null);
    const [bankStatement, setBankStatement] = useState<File | null>(null);
    const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
    React.useEffect(() => {
        if (data?.documents) {
            // Sync PAN document
            if (data.documents.panCard) {
                setPanDocument({
                    file: data.documents.panCard.file,
                    uploadStatus: 'success',
                    ocrStatus: 'success',
                    ocrProgress: 100,
                    uploadPath: data.documents.panCard.path
                });
            }

            // Sync Aadhaar document
            if (data.documents.aadhaarCard) {
                setAadhaarDocument({
                    file: data.documents.aadhaarCard.file,
                    uploadStatus: 'success',
                    ocrStatus: 'success',
                    ocrProgress: 100,
                    uploadPath: data.documents.aadhaarCard.path
                });
            }

            // Sync Business Proof
            if (data.documents.businessProof) {
                setBusinessProof(data.documents.businessProof.file);
            }

            // Sync Bank Statement
            if (data.documents.bankStatement) {
                setBankStatement(data.documents.bankStatement.file);
            }
        }
    }, [data?.documents]);

    const uploadToSupabase = async (file: File, documentType: string): Promise<string> => {
    if (!user?.id) {
        throw new Error('User not authenticated');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${documentType}_${Date.now()}.${fileExt}`;
    
    // ✅ CRITICAL: Path must start with user ID
    const filePath = `${user.id}/${documentType}_${Date.now()}.${file.name.split('.').pop()}`;

    const { data, error } = await supabase.storage
        .from('merchant-documents')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
        });

    if (error) {
        console.error('Supabase upload error:', error);
        throw error;
    }

    return filePath;
};

    const applyOCRResults = useCallback((result: ExtractedData, docType: 'pan' | 'aadhaar') => {
        const updates: Partial<FormData> = {};
        const newAutoFilled = new Set(autoFilledFields);

        if (docType === 'pan' && result.panNumber) {
            updates.panNumber = result.panNumber;
            newAutoFilled.add('panNumber');
        }

        if (docType === 'aadhaar' && result.aadhaarNumber) {
            updates.aadhaarNumber = result.aadhaarNumber;
            newAutoFilled.add('aadhaarNumber');
        }

        if (result.extractedName && !formData.fullName) {
            updates.fullName = result.extractedName;
            newAutoFilled.add('fullName');
        }

        if (Object.keys(updates).length > 0) {
            setFormData(prev => {
                const newData = { ...prev, ...updates };
                onDataChange?.(newData);
                return newData;
            });
            setAutoFilledFields(newAutoFilled);
        }
    }, [formData.fullName, onDataChange, autoFilledFields]);

    const handlePanUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setPanDocument({
            file,
            uploadStatus: 'uploading',
            ocrStatus: 'processing',
            ocrProgress: 0
        });

        const uploadPromise = uploadToSupabase(file, 'pan-cards');
        const ocrPromise = ocrService.processDocument(file, (progress) => {
            setPanDocument(prev => ({ ...prev, ocrProgress: progress }));
        });

        try {
            const results = await Promise.allSettled([uploadPromise, ocrPromise]);

            const uploadResult = results[0];
            const ocrResult = results[1];

            const finalState: DocumentState = {
                file,
                uploadStatus: uploadResult.status === 'fulfilled' ? 'success' : 'failed',
                ocrStatus: ocrResult.status === 'fulfilled' ? 'success' : 'failed',
                ocrProgress: 100
            };

            if (uploadResult.status === 'fulfilled') {
                finalState.uploadPath = uploadResult.value;

                // ✅ NEW: Insert into merchant_documents table
                if (merchantProfile?.id) {
                    const { error: insertError } = await supabase
                        .from('merchant_documents')
                        .insert({
                            merchant_id: merchantProfile.id,
                            document_type: 'pan_card',
                            file_name: file.name,
                            file_path: uploadResult.value,
                            file_size: file.size,
                            mime_type: file.type,
                            status: 'uploaded',
                            uploaded_at: new Date().toISOString()
                        });

                    if (insertError) {
                        console.error('Database insert error:', insertError);
                    }
                }

                onDataChange?.({
                    documents: {
                        panCard: { file, path: uploadResult.value }
                    }
                });
                console.log('PAN card uploaded to:', uploadResult.value);
            } else {
                finalState.uploadError = 'Upload failed';
                console.error('Upload failed:', uploadResult.reason);
            }

            if (ocrResult.status === 'fulfilled') {
                applyOCRResults(ocrResult.value, 'pan');

                if (uploadResult.status === 'fulfilled') {
                    toast({
                        title: "PAN Card Processed Successfully",
                        description: `File uploaded and data extracted (${ocrResult.value.confidence}% confidence)`,
                    });
                } else {
                    toast({
                        title: "OCR Completed",
                        description: "Data extracted but upload failed. Please try uploading again.",
                        variant: "destructive"
                    });
                }
            } else {
                finalState.ocrError = ocrResult.reason instanceof Error ? ocrResult.reason.message : 'OCR failed';
                console.error('OCR failed:', ocrResult.reason);

                if (uploadResult.status === 'fulfilled') {
                    toast({
                        title: "File Uploaded Successfully",
                        description: "PAN card uploaded but OCR failed. Please enter details manually.",
                        variant: "default"
                    });
                } else {
                    toast({
                        title: "Processing Failed",
                        description: "Both upload and OCR failed. Please try again.",
                        variant: "destructive"
                    });
                }
            }

            setPanDocument(finalState);

        } catch (error) {
            console.error('Unexpected error:', error);
            setPanDocument({
                file,
                uploadStatus: 'failed',
                ocrStatus: 'failed',
                ocrProgress: 0,
                uploadError: 'Unexpected error occurred'
            });
            toast({
                variant: "destructive",
                title: "Processing Failed",
                description: "An unexpected error occurred. Please try again.",
            });
        }
    }, [applyOCRResults, toast, merchantProfile, onDataChange]);

    const handleAadhaarUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setAadhaarDocument({
            file,
            uploadStatus: 'uploading',
            ocrStatus: 'processing',
            ocrProgress: 0
        });

        const uploadPromise = uploadToSupabase(file, 'aadhaar-cards');
        const ocrPromise = ocrService.processDocument(file, (progress) => {
            setAadhaarDocument(prev => ({ ...prev, ocrProgress: progress }));
        });

        try {
            const results = await Promise.allSettled([uploadPromise, ocrPromise]);

            const uploadResult = results[0];
            const ocrResult = results[1];

            const finalState: DocumentState = {
                file,
                uploadStatus: uploadResult.status === 'fulfilled' ? 'success' : 'failed',
                ocrStatus: ocrResult.status === 'fulfilled' ? 'success' : 'failed',
                ocrProgress: 100
            };

            if (uploadResult.status === 'fulfilled') {
                finalState.uploadPath = uploadResult.value;

                // ✅ NEW: Insert into merchant_documents table
                if (merchantProfile?.id) {
                    const { error: insertError } = await supabase
                        .from('merchant_documents')
                        .insert({
                            merchant_id: merchantProfile.id,
                            document_type: 'aadhaar_card',
                            file_name: file.name,
                            file_path: uploadResult.value,
                            file_size: file.size,
                            mime_type: file.type,
                            status: 'uploaded',
                            uploaded_at: new Date().toISOString()
                        });

                    if (insertError) {
                        console.error('Database insert error:', insertError);
                    }
                }

                console.log('Aadhaar card uploaded to:', uploadResult.value);
                onDataChange?.({
                    documents: {
                        aadhaarCard: { file, path: uploadResult.value }
                    }
                });
            } else {
                finalState.uploadError = 'Upload failed';
                console.error('Upload failed:', uploadResult.reason);
            }

            if (ocrResult.status === 'fulfilled') {
                applyOCRResults(ocrResult.value, 'aadhaar');

                if (uploadResult.status === 'fulfilled') {
                    toast({
                        title: "Aadhaar Card Processed Successfully",
                        description: `File uploaded and data extracted (${ocrResult.value.confidence}% confidence)`,
                    });
                } else {
                    toast({
                        title: "OCR Completed",
                        description: "Data extracted but upload failed. Please try uploading again.",
                        variant: "destructive"
                    });
                }
            } else {
                finalState.ocrError = ocrResult.reason instanceof Error ? ocrResult.reason.message : 'OCR failed';
                console.error('OCR failed:', ocrResult.reason);

                if (uploadResult.status === 'fulfilled') {
                    toast({
                        title: "File Uploaded Successfully",
                        description: "Aadhaar card uploaded but OCR failed. Please enter details manually.",
                        variant: "default"
                    });
                } else {
                    toast({
                        title: "Processing Failed",
                        description: "Both upload and OCR failed. Please try again.",
                        variant: "destructive"
                    });
                }
            }

            setAadhaarDocument(finalState);

        } catch (error) {
            console.error('Unexpected error:', error);
            setAadhaarDocument({
                file,
                uploadStatus: 'failed',
                ocrStatus: 'failed',
                ocrProgress: 0,
                uploadError: 'Unexpected error occurred'
            });
            toast({
                variant: "destructive",
                title: "Processing Failed",
                description: "An unexpected error occurred. Please try again.",
            });
        }
    }, [applyOCRResults, toast, merchantProfile, onDataChange]);

    const handleDocUpload = useCallback((docType: 'business' | 'bank') => async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const folder = docType === 'business' ? 'business-proofs' : 'bank-statements';
            const uploadPath = await uploadToSupabase(file, folder);
            console.log(`${docType} document uploaded to:`, uploadPath);

            // ✅ Insert into merchant_documents table with type-safe values
            if (merchantProfile?.id) {
                const documentTypeMap = {
                    'business': 'business_proof' as const,
                    'bank': 'bank_statement' as const
                };

                const { error: insertError } = await supabase
                    .from('merchant_documents')
                    .insert({
                        merchant_id: merchantProfile.id,
                        document_type: documentTypeMap[docType],
                        file_name: file.name,
                        file_path: uploadPath,
                        file_size: file.size,
                        mime_type: file.type,
                        status: 'uploaded' as const,
                        uploaded_at: new Date().toISOString()
                    });

                if (insertError) {
                    console.error('Database insert error:', insertError);
                }
            }

            if (docType === 'business') {
                setBusinessProof(file);
                onDataChange?.({
                    documents: {
                        businessProof: { file, path: uploadPath }
                    }
                });
            } else {
                setBankStatement(file);
                onDataChange?.({
                    documents: {
                        bankStatement: { file, path: uploadPath }
                    }
                });
            }

            toast({
                title: "Document Uploaded",
                description: `${docType === 'business' ? 'Business proof' : 'Bank statement'} uploaded successfully`,
            });

        } catch (error) {
            console.error('Upload error:', error);
            toast({
                variant: "destructive",
                title: "Upload Failed",
                description: "Failed to upload document",
            });
        }
    }, [toast, merchantProfile, onDataChange]);

    const handleInputChange = useCallback((field: keyof FormData) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;

        setFormData(prev => {
            const newData = { ...prev, [field]: value };
            onDataChange?.(newData);
            return newData;
        });

        setAutoFilledFields(prev => {
            const updated = new Set(prev);
            updated.delete(field);
            return updated;
        });
    }, [onDataChange]);

    const handleGSTToggle = useCallback((checked: boolean) => {
        const newData = { ...formData, hasGST: checked, gstNumber: checked ? formData.gstNumber : '' };
        setFormData(newData);
        onDataChange?.(newData);
    }, [formData, onDataChange]);

    const DocumentUploadCard = ({
        title,
        icon: Icon,
        file,
        uploadStatus,
        ocrStatus,
        ocrProgress = 0,
        onUpload,
        description,
        uploadError,
        ocrError
    }: DocumentUploadCardProps) => {
        const fileInputRef = React.useRef<HTMLInputElement>(null);
        const isProcessing = uploadStatus === 'uploading' || ocrStatus === 'processing';

        const handleAreaClick = () => {
            if (isProcessing) return;
            fileInputRef.current?.click();
        };

        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            onUpload(e);
        };

        const getStatusIcon = () => {
            if (uploadStatus === 'failed' || ocrError) {
                return <AlertTriangle className="h-4 w-4 text-red-500 ml-auto" />;
            }
            if (isProcessing) {
                return <RefreshCw className="h-4 w-4 animate-spin text-blue-500 ml-auto" />;
            }
            if (uploadStatus === 'success') {
                return <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />;
            }
            return null;
        };

        const getStatusColor = () => {
            if (uploadStatus === 'failed' || ocrError) return 'border-red-300';
            if (isProcessing) return 'border-blue-300';
            if (uploadStatus === 'success') return 'border-green-300';
            return 'border-gray-300';
        };

        const getBackgroundColor = () => {
            if (uploadStatus === 'failed' || ocrError) return 'bg-red-50';
            if (isProcessing) return 'bg-blue-50';
            if (uploadStatus === 'success') return 'bg-green-50';
            return 'hover:bg-gray-50';
        };

        return (
            <Card className={`relative ${getStatusColor()}`}>
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Icon className="h-5 w-5 text-primary" />
                        {title}
                        {getStatusIcon()}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        disabled={isProcessing}
                    />

                    <div
                        onClick={handleAreaClick}
                        className={`
                            flex flex-col items-center justify-center w-full h-32 
                            border-2 border-dashed rounded-lg transition-colors
                            ${isProcessing ? 'cursor-not-allowed' : 'cursor-pointer'}
                            ${getStatusColor()} ${getBackgroundColor()}
                        `}
                    >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {isProcessing ? (
                                <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mb-2" />
                            ) : uploadStatus === 'success' ? (
                                <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                            ) : (uploadStatus === 'failed' || ocrError) ? (
                                <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
                            ) : (
                                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                            )}

                            <p className="mb-2 text-sm text-gray-500">
                                {isProcessing ? (
                                    <span className="font-semibold">Processing... {Math.round(ocrProgress)}%</span>
                                ) : uploadStatus === 'success' && !ocrError ? (
                                    <span className="font-semibold text-green-600">✓ {file?.name}</span>
                                ) : uploadStatus === 'success' && ocrError ? (
                                    <span className="font-semibold text-orange-600">⚠ Uploaded (OCR failed)</span>
                                ) : (uploadStatus === 'failed') ? (
                                    <span className="font-semibold text-red-600">Upload failed</span>
                                ) : (
                                    <span className="font-semibold">{description}</span>
                                )}
                            </p>
                        </div>
                    </div>

                    {(ocrStatus === 'processing' || uploadStatus === 'uploading') && (
                        <div className="mt-3">
                            <Progress value={ocrProgress} className="w-full h-2" />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>Upload: {uploadStatus === 'success' ? '✓' : uploadStatus}</span>
                                <span>OCR: {ocrProgress}%</span>
                            </div>
                        </div>
                    )}

                    {(uploadError || ocrError) && (
                        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            {uploadError && <div>Upload: {uploadError}</div>}
                            {ocrError && <div>OCR: {ocrError}</div>}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Merchant Registration</h1>
                <p className="text-gray-600">Upload your documents for automatic data extraction</p>
            </div>

            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Settings className="h-5 w-5 text-blue-600" />
                            <div>
                                <h4 className="font-semibold text-blue-900">Business Registration Type</h4>
                                <p className="text-sm text-blue-700">Choose your business registration status</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Label className={`text-sm ${!formData.hasGST ? 'font-semibold' : ''}`}>
                                Without GST
                            </Label>
                            <Switch
                                checked={formData.hasGST}
                                onCheckedChange={handleGSTToggle}
                            />
                            <Label className={`text-sm ${formData.hasGST ? 'font-semibold' : ''}`}>
                                With GST
                            </Label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <Camera className="h-5 w-5 text-primary" />
                    Upload Identity Documents
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <DocumentUploadCard
                        title="PAN Card"
                        icon={CreditCard}
                        file={panDocument.file}
                        uploadStatus={panDocument.uploadStatus}
                        ocrStatus={panDocument.ocrStatus}
                        ocrProgress={panDocument.ocrProgress}
                        onUpload={handlePanUpload}
                        description="Upload PAN Card for auto-fill"
                        uploadError={panDocument.uploadError}
                        ocrError={panDocument.ocrError}
                    />

                    <DocumentUploadCard
                        title="Aadhaar Card"
                        icon={CreditCard}
                        file={aadhaarDocument.file}
                        uploadStatus={aadhaarDocument.uploadStatus}
                        ocrStatus={aadhaarDocument.ocrStatus}
                        ocrProgress={aadhaarDocument.ocrProgress}
                        onUpload={handleAadhaarUpload}
                        description="Upload Aadhaar Card for auto-fill"
                        uploadError={aadhaarDocument.uploadError}
                        ocrError={aadhaarDocument.ocrError}
                    />
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Personal & Business Information
                </h2>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AutoFillInput
                        label="Full Name"
                        value={formData.fullName}
                        onChange={handleInputChange('fullName')}
                        placeholder="Enter your full name"
                        required={true}
                        isAutoFilled={autoFilledFields.has('fullName')}
                    />

                    <AutoFillInput
                        label="PAN Number"
                        value={formData.panNumber}
                        onChange={handleInputChange('panNumber')}
                        placeholder="ABCDE1234F"
                        maxLength={10}
                        required={true}
                        isAutoFilled={autoFilledFields.has('panNumber')}
                    />

                    <AutoFillInput
                        label="Aadhaar Number"
                        value={formData.aadhaarNumber}
                        onChange={handleInputChange('aadhaarNumber')}
                        placeholder="1234 5678 9012"
                        maxLength={14}
                        required={true}
                        isAutoFilled={autoFilledFields.has('aadhaarNumber')}
                    />

                    <AutoFillInput
                        label="Mobile Number"
                        value={formData.mobileNumber}
                        onChange={handleInputChange('mobileNumber')}
                        placeholder="+91 9876543210"
                        maxLength={10}
                        required={true}
                        isAutoFilled={autoFilledFields.has('mobileNumber')}
                    />

                    <AutoFillInput
                        label="Email Address"
                        value={formData.email}
                        onChange={handleInputChange('email')}
                        type="email"
                        placeholder="merchant@example.com"
                        required={true}
                        isAutoFilled={autoFilledFields.has('email')}
                    />

                    <AutoFillInput
                        label="Business Name"
                        value={formData.businessName}
                        onChange={handleInputChange('businessName')}
                        placeholder="Enter business name"
                        required={true}
                        isAutoFilled={autoFilledFields.has('businessName')}
                    />

                    {formData.hasGST && (
                        <AutoFillInput
                            label="GST Number"
                            value={formData.gstNumber}
                            onChange={handleInputChange('gstNumber')}
                            placeholder="22AAAAA0000A1Z5"
                            maxLength={15}
                            required={true}
                            isAutoFilled={autoFilledFields.has('gstNumber')}
                        />
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Supporting Documents
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <DocumentUploadCard
                        title="Business Proof"
                        icon={Building}
                        file={businessProof}
                        uploadStatus={businessProof ? 'success' : 'idle'}
                        ocrStatus="idle"
                        onUpload={handleDocUpload('business')}
                        description="Business registration certificate"
                    />

                    <DocumentUploadCard
                        title="Bank Statement"
                        icon={FileText}
                        file={bankStatement}
                        uploadStatus={bankStatement ? 'success' : 'idle'}
                        ocrStatus="idle"
                        onUpload={handleDocUpload('bank')}
                        description="Recent bank statement"
                    />
                </div>
            </div>

            {(panDocument.ocrStatus === 'processing' || aadhaarDocument.ocrStatus === 'processing') && (
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                            <span className="text-blue-800 font-medium">
                                Processing documents with OCR.space API...
                            </span>
                        </div>
                        <p className="text-blue-700 text-sm">
                            Files are uploaded to secure storage while OCR extracts data. Form fields will be auto-filled when complete.
                        </p>
                    </CardContent>
                </Card>
            )}

            {(autoFilledFields.size > 0) && panDocument.ocrStatus !== 'processing' && aadhaarDocument.ocrStatus !== 'processing' && (
                <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-green-800 font-medium">
                                Success! {autoFilledFields.size} field(s) have been auto-filled from your documents.
                            </span>
                        </div>
                        <p className="text-green-700 text-sm mt-1">
                            Please review the auto-filled information and make any necessary corrections.
                        </p>
                    </CardContent>
                </Card>
            )}

            <Card className="bg-gray-50">
                <CardContent className="p-4">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Tips for Better OCR Results
                    </h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Clear photos: Ensure good lighting and avoid shadows</li>
                        <li>• Flat documents: Keep documents flat without wrinkles or folds</li>
                        <li>• High resolution: Use high-quality images when possible</li>
                        <li>• Crop properly: Make sure the entire document is visible</li>
                        <li>• File size: Images are automatically resized to under 2MB for processing</li>
                        <li>• Storage: All documents are securely uploaded to Supabase storage immediately</li>
                    </ul>
                </CardContent>
            </Card>

            <div className="flex justify-between pt-6">
                <Button variant="outline" className="px-8" onClick={onPrev}>
                    Back
                </Button>
                <RaiseTicketButton
   module="merchant_onboarding"
   referenceId={merchantProfile?.id as string}
/>
                <Button
                    className="px-8"
                    onClick={onNext}
                    disabled={
                        !formData.fullName ||
                        !formData.panNumber ||
                        !formData.aadhaarNumber ||
                        !formData.mobileNumber ||
                        !formData.email ||
                        !formData.businessName ||
                        (formData.hasGST && !formData.gstNumber) ||
                        panDocument.uploadStatus !== 'success' ||
                        aadhaarDocument.uploadStatus !== 'success' ||
                        !businessProof
                    }
                    
                >
                 
                    Continue to KYC
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

export default MerchantRegistration;