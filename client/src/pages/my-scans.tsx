import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScanComparison } from "@/components/scan-comparison";
import { ScanCategoryBadge } from "@/components/scan-classification-warning";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDexaScanSchema } from "@shared/schema";
import { Upload as UploadIcon, CloudUpload, Save, FileText, Edit, Trash2, Eye } from "lucide-react";
import { type DexaScan, type UserWithStats, type InsertDexaScan } from "@shared/schema";
import { z } from "zod";
import type { UploadResult } from "@uppy/core";

const scanFormSchema = z.object({
  scanDate: z.string().min(1, "Scan date is required"),
  bodyFatPercent: z.number().min(0).max(100, "Body fat percent must be between 0 and 100"),
  leanMass: z.number().min(0, "Lean mass must be positive"),
  totalWeight: z.number().min(0, "Total weight must be positive"),
  fatMass: z.number().min(0, "Fat mass must be positive"),
  rmr: z.number().min(0).optional(),
  scanName: z.string().optional(),
  scanImagePath: z.string().optional(),
  notes: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  // Target goals - optional fields
  targetBodyFatPercent: z.number().optional(),
  targetLeanMass: z.number().optional(),
});

type ScanFormData = z.infer<typeof scanFormSchema>;

export default function MyScans() {
  const { toast } = useToast();
  const { user: authUser, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  
  // Upload form state
  const [formData, setFormData] = useState({
    scanDate: new Date().toISOString().split('T')[0],
    bodyFatPercent: 0,
    leanMass: 0,
    totalWeight: 0,
    fatMass: 0,
    rmr: 0,
    scanName: '',
    firstName: '',
    lastName: '',
    scanImagePath: undefined as string | undefined,
    isBaseline: false,
    notes: '',
    targetBodyFatPercent: 0,
    targetLeanMass: 0,
  });

  // Edit scan state
  const [editingScan, setEditingScan] = useState<DexaScan | null>(null);
  const [targetBodyFat, setTargetBodyFat] = useState<string>('');
  const [targetLeanMass, setTargetLeanMass] = useState<string>('');
  
  const [uploadedScanId, setUploadedScanId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  const { data: user, isLoading: userLoading } = useQuery<UserWithStats>({
    queryKey: ["/api/user"],
    enabled: !!authUser,
  });

  const { data: scans, isLoading: scansLoading } = useQuery<DexaScan[]>({
    queryKey: ["/api/users", authUser?.id, "scans"],
    enabled: !!authUser?.id,
  });

  const isFirstScan = scans?.length === 0;
  const needsTargetGoals = isFirstScan; // Show header only for first scan

  // Mutation to update user target goals
  const updateUserTargetsMutation = useMutation({
    mutationFn: async (data: { targetBodyFatPercent: number; targetLeanMass: number }) => {
      const response = await apiRequest("PUT", "/api/user/targets", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
  });

  // Create scan mutation
  const createScanMutation = useMutation({
    mutationFn: async (data: ScanFormData) => {
      // If target goals are provided, update user targets first
      if ((data.targetBodyFatPercent && data.targetBodyFatPercent > 0) || (data.targetLeanMass && data.targetLeanMass > 0)) {
        await updateUserTargetsMutation.mutateAsync({
          targetBodyFatPercent: data.targetBodyFatPercent || user?.targetBodyFatPercent || 0,
          targetLeanMass: data.targetLeanMass || user?.targetLeanMass || 0,
        });
      }
      
      // Remove target goals from scan data before sending
      const { targetBodyFatPercent, targetLeanMass, ...scanData } = data;
      const response = await apiRequest("POST", "/api/scans", scanData);
      return response.json();
    },
    onSuccess: (scan) => {
      setUploadedScanId(scan.id);
      toast({
        title: "Success",
        description: "DEXA scan data saved successfully!",
      });
      
      // Invalidate all relevant caches to refresh Dashboard, Profile, and Leaderboard
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      if (authUser?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/users", authUser.id, "scans"] });
        queryClient.invalidateQueries({ queryKey: ["/api/scoring", authUser.id] });
      }
      
      // Reset form
      setFormData({
        scanDate: new Date().toISOString().split('T')[0],
        bodyFatPercent: 0,
        leanMass: 0,
        totalWeight: 0,
        fatMass: 0,
        rmr: 0,
        scanName: '',
        firstName: '',
        lastName: '',
        scanImagePath: undefined as string | undefined,
        isBaseline: false,
        notes: '',
        targetBodyFatPercent: 0,
        targetLeanMass: 0,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to save scan data. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update scan image mutation
  const updateScanImageMutation = useMutation({
    mutationFn: async ({ scanId, imageURL }: { scanId: string; imageURL: string }) => {
      const response = await apiRequest("PUT", "/api/scan-images", {
        scanId,
        scanImageURL: imageURL,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Scan image uploaded successfully!",
      });
      
      // Invalidate caches again after image upload to refresh all pages
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      if (authUser?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/users", authUser.id, "scans"] });
        queryClient.invalidateQueries({ queryKey: ["/api/scoring", authUser.id] });
      }
      
      setUploadedScanId(null);
      setIsUploading(false);
    },
    onError: (error) => {
      console.error("Error uploading scan image:", error);
      toast({
        title: "Error",
        description: "Failed to upload scan image. The scan data was saved without the image.",
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  // Edit scan mutation
  const editScanMutation = useMutation({
    mutationFn: async ({ scanId, updates, firstName, lastName }: { 
      scanId: string; 
      updates: Partial<InsertDexaScan>; 
      firstName?: string; 
      lastName?: string; 
    }) => {
      const res = await apiRequest("PUT", `/api/scans/${scanId}`, {
        ...updates,
        firstName,
        lastName,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", authUser?.id, "scans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scoring", authUser?.id] });
      setEditingScan(null);
      toast({
        title: "Scan updated",
        description: "Your DEXA scan has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete scan mutation
  const deleteScanMutation = useMutation({
    mutationFn: async (scanId: string) => {
      await apiRequest("DELETE", `/api/scans/${scanId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", authUser?.id, "scans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scoring", authUser?.id] });
      toast({
        title: "Scan deleted",
        description: "Your DEXA scan has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user target goals mutation (for edit dialog)
  const updateUserMutation = useMutation({
    mutationFn: async (updates: { targetBodyFatPercent?: number; targetLeanMass?: number }) => {
      const res = await apiRequest("PUT", "/api/user/targets", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Target goals updated",
        description: "Your target goals have been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed", 
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editFormSchema = insertDexaScanSchema.partial().extend({
    scanDate: z.union([z.string(), z.date()]).optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  });

  const form = useForm<z.infer<typeof editFormSchema>>({
    resolver: zodResolver(editFormSchema),
  });

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = scanFormSchema.parse(formData);
      createScanMutation.mutate(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0]?.message || "Please check your input data.",
          variant: "destructive",
        });
      }
    }
  };

  const handleEditScan = (scan: DexaScan) => {
    setEditingScan(scan);
    // Set target goals from user profile
    setTargetBodyFat(user?.targetBodyFatPercent?.toString() || '');
    setTargetLeanMass(user?.targetLeanMass?.toString() || '');
    
    // Try to split the scan name into first and last name
    const nameParts = scan.scanName ? scan.scanName.split(/[,\s]+/).filter(part => part.trim()) : [];
    const firstName = nameParts.length > 1 ? nameParts[1] : nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[0] : '';
    
    form.reset({
      bodyFatPercent: scan.bodyFatPercent,
      leanMass: scan.leanMass,
      totalWeight: scan.totalWeight,
      fatMass: scan.fatMass || 0,
      rmr: scan.rmr || 0,
      firstName: firstName,
      lastName: lastName,
      scanDate: new Date(scan.scanDate).toISOString().split('T')[0],
      isBaseline: scan.isBaseline,
      notes: scan.notes || '',
    });
  };

  const onSubmitEdit = (data: z.infer<typeof editFormSchema>) => {
    if (!editingScan) return;
    
    // Extract the scan update data (excluding firstName/lastName which are for profile)
    const { firstName, lastName, ...scanUpdateData } = data;
    
    // Update target goals if they changed
    const targetGoalsChanged = 
      (targetBodyFat && parseFloat(targetBodyFat) !== user?.targetBodyFatPercent) ||
      (targetLeanMass && parseFloat(targetLeanMass) !== user?.targetLeanMass);
      
    if (targetGoalsChanged) {
      const updates: { targetBodyFatPercent?: number; targetLeanMass?: number } = {};
      if (targetBodyFat) updates.targetBodyFatPercent = parseFloat(targetBodyFat);
      if (targetLeanMass) updates.targetLeanMass = parseFloat(targetLeanMass);
      updateUserMutation.mutate(updates);
    }
    
    editScanMutation.mutate({
      scanId: editingScan.id,
      updates: {
        ...scanUpdateData,
        scanDate: scanUpdateData.scanDate ? (typeof scanUpdateData.scanDate === 'string' ? new Date(scanUpdateData.scanDate) : scanUpdateData.scanDate) : undefined,
      },
      // Pass firstName and lastName separately for profile update  
      firstName,
      lastName,
    });
  };

  const handleDeleteScan = (scanId: string) => {
    if (confirm("Are you sure you want to delete this scan? This action cannot be undone.")) {
      deleteScanMutation.mutate(scanId);
    }
  };

  const extractDataFromImage = async (file: File) => {
    setIsExtracting(true);
    setExtractedData(null);
    
    try {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File too large. Please use a file under 10MB.");
      }
      
      // Validate file type (accept both images and PDFs)
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        throw new Error("Please select an image file (JPG, PNG, etc.) or PDF file");
      }

      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const response = await apiRequest("POST", "/api/extract-dexa-data", {
        imageBase64: base64,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to extract data");
      }
      
      const extractedData = await response.json();
      setExtractedData(extractedData);
      
      // Auto-fill form with extracted data only if confidence is reasonable
      if (extractedData.confidence > 0.3) {
        setFormData(prev => ({
          ...prev,
          bodyFatPercent: extractedData.bodyFatPercent || 0,
          leanMass: extractedData.leanMass || 0,
          totalWeight: extractedData.totalWeight || 0,
          fatMass: extractedData.fatMass || 0,
          rmr: extractedData.rmr || 0,
          scanName: extractedData.scanName || '',
          scanDate: extractedData.scanDate || prev.scanDate,
          firstName: extractedData.firstName || '',
          lastName: extractedData.lastName || '',
        }));

        const confidenceEmoji = extractedData.confidence > 0.7 ? '✅' : extractedData.confidence > 0.4 ? '⚠️' : '🔍';
        const vendorInfo = extractedData.detectedVendor && extractedData.detectedVendor !== 'Unknown' ? ` • ${extractedData.detectedVendor}` : '';
        
        toast({
          title: `${confidenceEmoji} Extraction completed!`,
          description: `Body Fat: ${extractedData.bodyFatPercent}% • Lean Mass: ${extractedData.leanMass}lbs • Total: ${extractedData.totalWeight}lbs${extractedData.rmr ? ` • RMR: ${extractedData.rmr}cal` : ''}${vendorInfo} (${Math.round(extractedData.confidence * 100)}% confidence)`,
        });
      } else {
        const vendorInfo = extractedData.detectedVendor && extractedData.detectedVendor !== 'Unknown' ? ` (${extractedData.detectedVendor} format detected)` : '';
        
        toast({
          title: "🔍 Low confidence extraction",
          description: `AI extraction completed but with low confidence${vendorInfo}. Please carefully verify all values manually before submitting.`,
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Failed to extract data:", error);
      const errorMessage = error instanceof Error ? error.message : "Could not extract data from file. Please enter manually.";
      toast({
        title: "Extraction failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleGetUploadParameters = async () => {
    try {
      const response = await apiRequest("POST", "/api/objects/upload");
      const data = await response.json();
      return {
        method: "PUT" as const,
        url: data.uploadURL,
      };
    } catch (error) {
      console.error("Error getting upload parameters:", error);
      throw error;
    }
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0 && uploadedScanId) {
      const uploadedFile = result.successful[0];
      const imageURL = uploadedFile.uploadURL;
      
      if (imageURL) {
        updateScanImageMutation.mutate({
          scanId: uploadedScanId,
          imageURL,
        });
      }
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (authLoading || userLoading) {
    return <MyScansSkeleton />;
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p>User data not found. Please try refreshing the page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto mobile-padding pb-20 md:pb-8 prevent-overflow">
      {/* Upload DEXA Scan Section */}
      <Card className="card-mobile mb-8">
        <div className="px-4 md:px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg md:text-xl font-semibold text-gray-900 flex items-center">
            <UploadIcon className="h-5 w-5 mr-2 text-secondary" />
            Upload DEXA Scan
          </h3>
        </div>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {/* File Upload Area */}
            <div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 md:p-8 text-center hover:border-secondary transition-colors">
                <CloudUpload className="h-10 md:h-12 w-10 md:w-12 text-gray-400 mx-auto mb-3 md:mb-4" />
                <h4 className="text-base md:text-lg font-medium text-gray-900 mb-2">Upload DEXA Scan Report</h4>
                <p className="text-sm text-gray-600 mb-4">
                  <span className="text-green-600 font-medium">✅ Images:</span> Automatic data extraction<br/>
                  <span className="text-green-600 font-medium">📄 PDFs:</span> Automatic text extraction
                </p>
                
                <div className="space-y-4">
                  {/* Extract Data from Image Button */}
                  <div>
                    <Label htmlFor="scan-extract" className="sr-only">Extract data from scan</Label>
                    <input
                      id="scan-extract"
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          extractDataFromImage(file);
                        }
                      }}
                    />
                    <Button 
                      type="button"
                      onClick={() => document.getElementById('scan-extract')?.click()}
                      disabled={isExtracting}
                      className="bg-blue-600 text-white hover:bg-blue-700 mb-2"
                    >
                      {isExtracting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Extracting Data...
                        </>
                      ) : (
                        <>
                          <UploadIcon className="h-4 w-4 mr-2" />
                          Upload & Extract Data
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Save & Upload Image Button */}
                  {uploadedScanId && (
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={10485760} // 10MB
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleUploadComplete}
                      buttonClassName="bg-secondary text-white hover:bg-emerald-700"
                    >
                      Upload Scan Image
                    </ObjectUploader>
                  )}
                </div>
                
                <p className="text-xs text-gray-500 mt-2">Supports JPG, PNG, PDF up to 10MB</p>
                
                {/* Enhanced Extraction Results */}
                {extractedData && (
                  <div className="mt-4 space-y-3">
                    {/* Main Results */}
                    <div className={`p-3 border rounded-md text-left ${
                      extractedData.confidence > 0.7 ? 'bg-green-50 border-green-200' :
                      extractedData.confidence > 0.4 ? 'bg-yellow-50 border-yellow-200' :
                      'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <h5 className={`text-sm font-medium ${
                          extractedData.confidence > 0.7 ? 'text-green-800' :
                          extractedData.confidence > 0.4 ? 'text-yellow-800' :
                          'text-red-800'
                        }`}>
                          Extracted Data
                        </h5>
                        <div className="flex items-center space-x-2">
                          {extractedData.detectedVendor && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {extractedData.detectedVendor}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            extractedData.confidence > 0.7 ? 'bg-green-100 text-green-700' :
                            extractedData.confidence > 0.4 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {Math.round(extractedData.confidence * 100)}% confidence
                          </span>
                        </div>
                      </div>
                      
                      <div className={`text-xs space-y-1 ${
                        extractedData.confidence > 0.7 ? 'text-green-700' :
                        extractedData.confidence > 0.4 ? 'text-yellow-700' :
                        'text-red-700'
                      }`}>
                        {extractedData.scanName && <div>Name: {extractedData.scanName}</div>}
                        {(extractedData.firstName || extractedData.lastName) && (
                          <div>Extracted Name: {extractedData.firstName} {extractedData.lastName}</div>
                        )}
                        {extractedData.scanDate && <div>Date: {extractedData.scanDate}</div>}
                        <div>Body Fat: {extractedData.bodyFatPercent}%</div>
                        <div>Lean Mass: {extractedData.leanMass} lbs</div>
                        <div>Total Weight: {extractedData.totalWeight} lbs</div>
                        <div>Fat Mass: {extractedData.fatMass} lbs</div>
                        {extractedData.rmr && <div>RMR: {extractedData.rmr} cal/day</div>}
                      </div>

                      {/* Confidence Factors */}
                      {extractedData.debugInfo?.confidenceFactors && extractedData.debugInfo.confidenceFactors.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="text-xs text-gray-600 space-y-1">
                            <div className="font-medium">Quality Assessment:</div>
                            {extractedData.debugInfo.confidenceFactors.map((factor: string, index: number) => (
                              <div key={index} className="flex items-center space-x-1">
                                <span className={factor.includes('Valid') || factor.includes('Reasonable') ? 'text-green-600' : 'text-orange-600'}>
                                  {factor.includes('Valid') || factor.includes('Reasonable') ? '✓' : '⚠'}
                                </span>
                                <span>{factor}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Low Confidence Warning */}
                    {extractedData.confidence < 0.4 && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                        <div className="text-sm font-medium text-orange-800 mb-1">
                          ⚠ Low Confidence Extraction
                        </div>
                        <div className="text-xs text-orange-700">
                          The AI extraction had difficulty reading this scan. Please carefully verify all values manually before submitting.
                          {extractedData.detectedVendor && extractedData.detectedVendor !== 'Unknown' && 
                            ` The scan was identified as ${extractedData.detectedVendor} format.`
                          }
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {isUploading && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>Uploading...</span>
                  </div>
                  <Progress value={75} className="w-full" />
                </div>
              )}
            </div>
            
            {/* Manual Entry Form */}
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Enter Scan Data</h4>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="scanDate">Scan Date</Label>
                  <Input
                    id="scanDate"
                    type="date"
                    value={formData.scanDate}
                    onChange={(e) => handleInputChange('scanDate', e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="First name"
                      value={formData.firstName || ''}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Last name"
                      value={formData.lastName || ''}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                    />
                  </div>
                </div>

                {/* Target Goals Section - Show for first scan */}
                {needsTargetGoals && (
                  <div className="border-t pt-4 mt-4">
                    <h5 className="font-medium text-gray-900 mb-3">Set Your Target Goals</h5>
                    <p className="text-sm text-gray-600 mb-4">Define your body composition targets for the 100-day challenge</p>
                  </div>
                )}
                
                {/* Body Fat % - Current and Target side by side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bodyFat">Body Fat % (Current)</Label>
                    <Input
                      id="bodyFat"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="15.2"
                      value={formData.bodyFatPercent || ''}
                      onChange={(e) => handleInputChange('bodyFatPercent', parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="targetBodyFat">[Optional] Target Body Fat %</Label>
                    <Input
                      id="targetBodyFat"
                      type="number"
                      step="0.1"
                      min="1"
                      max="50"
                      placeholder="Enter Target Goal"
                      className="placeholder:text-gray-400"
                      value={formData.targetBodyFatPercent && formData.targetBodyFatPercent > 0 ? formData.targetBodyFatPercent : ''}
                      onChange={(e) => handleInputChange('targetBodyFatPercent', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                
                {/* Lean Mass - Current and Target side by side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="leanMass">Lean Mass (lbs)</Label>
                    <Input
                      id="leanMass"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="142.5"
                      value={formData.leanMass || ''}
                      onChange={(e) => handleInputChange('leanMass', parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="targetLeanMass">[Optional] Target Lean Mass (lbs)</Label>
                    <Input
                      id="targetLeanMass"
                      type="number"
                      step="0.1"
                      min="50"
                      placeholder="Enter Target Goal"
                      className="placeholder:text-gray-400"
                      value={formData.targetLeanMass && formData.targetLeanMass > 0 ? formData.targetLeanMass : ''}
                      onChange={(e) => handleInputChange('targetLeanMass', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="totalWeight">Total Weight (lbs)</Label>
                  <Input
                    id="totalWeight"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="178.0"
                    value={formData.totalWeight || ''}
                    onChange={(e) => handleInputChange('totalWeight', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="fatMass">Fat Mass (lbs)</Label>
                  <Input
                    id="fatMass"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="30.7"
                    value={formData.fatMass || ''}
                    onChange={(e) => handleInputChange('fatMass', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="rmr">Resting Metabolic Rate (RMR)</Label>
                  <Input
                    id="rmr"
                    type="number"
                    min="0"
                    placeholder="1650 (calories/day)"
                    value={formData.rmr || ''}
                    onChange={(e) => handleInputChange('rmr', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    placeholder="Additional notes about this scan..."
                    value={formData.notes || ''}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-blue-700"
                  disabled={createScanMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createScanMutation.isPending ? "Saving..." : "Save Scan Data"}
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* My Profile & Progress Section */}
      <Card className="overflow-hidden card-mobile">
        <div className="px-4 md:px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg md:text-xl font-semibold text-gray-900">My Profile & Progress</h3>
        </div>
        
        <CardContent className="p-4 md:p-6">
          {/* Profile Header */}
          <div className="flex items-center space-x-4 md:space-x-6 mb-6 md:mb-8">
            <Avatar className="h-20 md:h-24 w-20 md:w-24">
              <AvatarImage 
                src={user.profileImageUrl || undefined} 
                alt={user.name || user.username || user.email || 'User'}
              />
              <AvatarFallback className="text-lg md:text-xl">
                {user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 
                 user.username?.charAt(0).toUpperCase() || 
                 user.email?.charAt(0).toUpperCase() || 
                 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h4 className="text-lg md:text-xl font-bold text-gray-900 truncate">{user.name || user.username || user.email || 'User'}</h4>
              <p className="text-gray-600 capitalize text-sm md:text-base">{user.gender || 'Not specified'}</p>
              <div className="mt-2 flex flex-col md:flex-row md:items-center md:space-x-4 text-xs md:text-sm text-gray-500 space-y-1 md:space-y-0">
                <span>Height: {user.height || 'Not specified'}</span>
                <span>Weight: {user.startingWeight || '--'} lbs</span>
                <span className="hidden md:inline">Joined: {user.createdAt ? formatDate(user.createdAt) : '--'}</span>
              </div>
            </div>
          </div>
          
          {/* Scan History */}
          <div className="mb-8">
            <h5 className="text-lg font-medium text-gray-900 mb-4">DEXA Scan History</h5>
            {scansLoading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : scans && scans.length > 0 ? (
              <div className="space-y-4">
                {scans.map((scan) => (
                  <div 
                    key={scan.id} 
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-lg ${scan.isBaseline ? 'bg-gray-100' : 'bg-primary bg-opacity-10'}`}>
                        <FileText className={`h-5 w-5 ${scan.isBaseline ? 'text-gray-400' : 'text-primary'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {formatDate(scan.scanDate)}
                        </p>
                        <p className="text-sm text-gray-600">
                          {scan.scanName && <span className="font-medium">{scan.scanName} - </span>}
                          BF: {scan.bodyFatPercent.toFixed(1)}% | LM: {scan.leanMass.toFixed(1)} lbs | Weight: {scan.totalWeight.toFixed(1)} lbs
                        </p>
                        {(scan.fatMass || scan.rmr) && (
                          <p className="text-xs text-gray-500">
                            {scan.fatMass && `Fat Mass: ${scan.fatMass.toFixed(1)} lbs`}
                            {scan.fatMass && scan.rmr && ' | '}
                            {scan.rmr && `RMR: ${scan.rmr.toFixed(0)} cal/day`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {scan.isBaseline ? (
                        <Badge variant="secondary">Baseline</Badge>
                      ) : scans[0].id === scan.id ? (
                        <Badge className="bg-success text-white">Latest</Badge>
                      ) : null}
                      <ScanCategoryBadge scan={scan} />
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditScan(scan)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteScan(scan.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {scan.scanImagePath && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => window.open(scan.scanImagePath!, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">No scans uploaded yet</p>
                <p className="text-sm text-gray-400 mt-2">Upload your first DEXA scan above to get started!</p>
              </div>
            )}
          </div>
          
          {/* Side-by-side Comparison */}
          {user.baselineScan && user.latestScan && (
            <ScanComparison 
              baselineScan={user.baselineScan}
              latestScan={user.latestScan}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Scan Dialog */}
      <Dialog open={!!editingScan} onOpenChange={() => setEditingScan(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit DEXA Scan</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitEdit)} className="space-y-4">
              <FormField
                control={form.control}
                name="scanDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scan Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field}
                        value={typeof field.value === 'string' ? field.value : field.value?.toISOString().split('T')[0] || ''}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="First name"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Last name"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bodyFatPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Body Fat %</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1" 
                          placeholder="19.1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="leanMass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lean Mass (lbs)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1" 
                          placeholder="123.5"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fatMass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fat Mass (lbs)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1" 
                          placeholder="30.7"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rmr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RMR (cal/day)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="1650"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="totalWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Weight (lbs)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1" 
                        placeholder="160.4"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Target Goals Section */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">Update Target Goals (Optional)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target Body Fat %
                    </label>
                    <Input 
                      type="number" 
                      step="0.1" 
                      placeholder="13"
                      value={targetBodyFat}
                      onChange={(e) => setTargetBodyFat(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target Lean Mass (lbs)
                    </label>
                    <Input 
                      type="number" 
                      step="0.1" 
                      placeholder="125"
                      value={targetLeanMass}
                      onChange={(e) => setTargetLeanMass(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional notes about this scan..."
                        className="resize-none"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isBaseline"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Baseline Scan</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Mark this as your starting/baseline scan
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value || false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingScan(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={editScanMutation.isPending}
                >
                  {editScanMutation.isPending ? "Updating..." : "Update Scan"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MyScansSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <Skeleton className="h-6 w-48" />
        </div>
        <CardContent className="p-6">
          <div className="flex items-center space-x-6 mb-8">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}