import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ObjectUploader } from "@/components/ObjectUploader";
import { ScanClassificationWarning } from "@/components/scan-classification-warning";
import { Upload as UploadIcon, CloudUpload, Save } from "lucide-react";
import { type DexaScan } from "@shared/schema";
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
  gender: z.enum(["male", "female"]).optional(),
  // Target goals - optional fields
  targetBodyFatPercent: z.number().optional(),
  targetLeanMass: z.number().optional(),
});

type ScanFormData = z.infer<typeof scanFormSchema>;

export default function Upload() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  
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
    gender: '',
    scanImagePath: undefined as string | undefined,
    isBaseline: false,
    notes: '',
    targetBodyFatPercent: 0,
    targetLeanMass: 0,
  });

  // Don't auto-populate target fields - always start with empty placeholders
  
  const [uploadedScanId, setUploadedScanId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  // DEBUG: Force show gender field for testing
  const [forceShowGender, setForceShowGender] = useState(false);

  // Query user's existing scans to determine if this is their first scan
  const { data: userScans = [], isLoading: scansLoading } = useQuery<DexaScan[]>({
    queryKey: ["/api/users", user?.id, "scans"],
    enabled: !!user?.id,
  });

  // Query user profile to check if gender is set
  const { data: userProfile, isLoading: userProfileLoading } = useQuery<any>({
    queryKey: ["/api/user"],
    enabled: !!user,
  });

  // Gender field debugging - comprehensive logging
  useEffect(() => {
    console.log('=== UPLOAD DEBUG - User Profile Loading ===');
    console.log('user:', user);
    console.log('userProfile:', userProfile);
    console.log('userProfileLoading:', userProfileLoading);
    console.log('userProfile?.gender:', userProfile?.gender);
    console.log('typeof userProfile?.gender:', typeof userProfile?.gender);
    console.log('userProfile?.gender === null:', userProfile?.gender === null);
    console.log('userProfile?.gender === undefined:', userProfile?.gender === undefined);
    console.log('!userProfile?.gender:', !userProfile?.gender);
    console.log('isFirstScan:', isFirstScan);
    console.log('(!userProfile?.gender || isFirstScan):', (!userProfile?.gender || isFirstScan));
    console.log('==========================================');
  }, [user, userProfile, userProfileLoading, isFirstScan]);

  const isFirstScan = userScans.length === 0;
  const needsTargetGoals = isFirstScan; // Show header only for first scan

  // Pre-populate gender from user profile if available
  useEffect(() => {
    if (userProfile?.gender && !formData.gender) {
      setFormData(prev => ({ ...prev, gender: userProfile.gender }));
    }
  }, [userProfile?.gender]);

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

  const updateUserProfileMutation = useMutation({
    mutationFn: async (data: { gender?: string; firstName?: string; lastName?: string }) => {
      const response = await apiRequest("PUT", "/api/user/profile", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
    },
  });

  const createScanMutation = useMutation({
    mutationFn: async (data: ScanFormData) => {
      // If target goals are provided, update user targets first
      if ((data.targetBodyFatPercent && data.targetBodyFatPercent > 0) || (data.targetLeanMass && data.targetLeanMass > 0)) {
        await updateUserTargetsMutation.mutateAsync({
          targetBodyFatPercent: data.targetBodyFatPercent || user?.targetBodyFatPercent || 0,
          targetLeanMass: data.targetLeanMass || user?.targetLeanMass || 0,
        });
      }

      // Update user profile with gender and name if provided
      const profileUpdates: any = {};
      if (data.gender) profileUpdates.gender = data.gender;
      if (data.firstName) profileUpdates.firstName = data.firstName;
      if (data.lastName) profileUpdates.lastName = data.lastName;

      // Try to update profile first (preferred method)
      let profileUpdateSucceeded = false;
      if (Object.keys(profileUpdates).length > 0) {
        try {
          await updateUserProfileMutation.mutateAsync(profileUpdates);
          profileUpdateSucceeded = true;
        } catch (error) {
          console.warn("Profile update failed, will include data in scan creation as fallback:", error);
        }
      }

      // Prepare scan data - include gender and name as fallback if profile update failed
      const { targetBodyFatPercent, targetLeanMass, ...scanDataBase } = data;
      const scanData = { ...scanDataBase };

      // Include profile data as fallback if the profile update failed
      if (!profileUpdateSucceeded && data.gender) {
        scanData.gender = data.gender;
      }
      if (!profileUpdateSucceeded && data.firstName) {
        scanData.firstName = data.firstName;
      }
      if (!profileUpdateSucceeded && data.lastName) {
        scanData.lastName = data.lastName;
      }

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
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "scans"] });
        queryClient.invalidateQueries({ queryKey: ["/api/scoring", user.id] });
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
        gender: '',
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
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "scans"] });
        queryClient.invalidateQueries({ queryKey: ["/api/scoring", user.id] });
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
          gender: extractedData.gender || prev.gender,
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
      
      // Check if it's an authentication error
      const isAuthError = errorMessage.includes('401') || errorMessage.includes('authentication') || errorMessage.includes('Authentication');
      
      toast({
        title: isAuthError ? "Authentication required" : "Data extraction issue",
        description: isAuthError 
          ? "Please log in to use the DEXA extraction feature" 
          : errorMessage,
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

  // Enhanced loading state debugging
  useEffect(() => {
    console.log('=== UPLOAD LOADING STATES ===');
    console.log('authLoading:', authLoading);
    console.log('userProfileLoading:', userProfileLoading);
    console.log('scansLoading:', scansLoading);
    console.log('user exists:', !!user);
    console.log('userProfile exists:', !!userProfile);
    console.log('=============================');
  }, [authLoading, userProfileLoading, scansLoading, user, userProfile]);

  if (authLoading || userProfileLoading) {
    console.log('UPLOAD: Showing loading due to:', { authLoading, userProfileLoading });
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p>Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto mobile-padding pb-20 md:pb-8 prevent-overflow">
      {/* DEBUG PANEL - Remove after debugging */}
      <div style={{
        position: 'fixed',
        top: '10px',
        left: '10px',
        background: '#000',
        color: '#fff',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        zIndex: 9999,
        maxWidth: '300px'
      }}>
        <div><strong>🔍 UPLOAD DEBUG PANEL</strong></div>
        <div>authLoading: {String(authLoading)}</div>
        <div>userProfileLoading: {String(userProfileLoading)}</div>
        <div>scansLoading: {String(scansLoading)}</div>
        <div>user exists: {String(!!user)}</div>
        <div>userProfile exists: {String(!!userProfile)}</div>
        <div>userProfile.gender: {String(userProfile?.gender)} ({typeof userProfile?.gender})</div>
        <div>isFirstScan: {String(isFirstScan)}</div>
        <div>formData.gender: {String(formData.gender)}</div>
        <div>forceShowGender: {String(forceShowGender)}</div>
      </div>

      <Card className="card-mobile">
        <CardContent className="p-4 md:p-6">
          <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 md:mb-6 flex items-center">
            <UploadIcon className="h-5 w-5 mr-2 text-secondary" />
            Upload DEXA Scan
          </h3>
          
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
                
                {/* Enhanced Extraction Results with Debugging */}
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
                        {extractedData.scanName && <div>Scan ID: {extractedData.scanName}</div>}
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

                    {/* Technical Details (Collapsible) */}
                    {extractedData.debugInfo && (
                      <details className="bg-gray-50 border border-gray-200 rounded-md">
                        <summary className="p-2 text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 rounded-t-md">
                          Technical Details (Click to expand)
                        </summary>
                        <div className="p-3 border-t border-gray-200 text-xs text-gray-600 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>Method: {extractedData.extractionMethod}</div>
                            <div>Model: {extractedData.debugInfo.openaiModel}</div>
                            <div>Processing: {extractedData.debugInfo.processingTime}ms</div>
                            {extractedData.debugInfo.retryAttempts && (
                              <div>Retries: {extractedData.debugInfo.retryAttempts}</div>
                            )}
                          </div>
                          
                          {extractedData.debugInfo.tokenUsage && (
                            <div>
                              <div className="font-medium">Token Usage:</div>
                              <div className="pl-2">
                                Prompt: {extractedData.debugInfo.tokenUsage.promptTokens} | 
                                Response: {extractedData.debugInfo.tokenUsage.completionTokens} | 
                                Total: {extractedData.debugInfo.tokenUsage.totalTokens}
                              </div>
                            </div>
                          )}
                          
                          {extractedData.debugInfo.textLength > 0 && (
                            <div>
                              <div className="font-medium">Extracted Text ({extractedData.debugInfo.textLength} chars):</div>
                              <div className="p-2 bg-white border rounded text-xs font-mono max-h-20 overflow-y-auto">
                                {extractedData.debugInfo.extractedTextPreview}
                              </div>
                            </div>
                          )}

                          {extractedData.debugInfo.fallbackUsed && (
                            <div className="text-orange-600 font-medium">
                              ⚠ Fallback extraction method was used
                            </div>
                          )}
                        </div>
                      </details>
                    )}

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
                
                {/* Competition Date Validation Warning */}
                {formData.scanDate && (
                  <ScanClassificationWarning 
                    scanDate={new Date(formData.scanDate)} 
                    className="mt-2"
                  />
                )}

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

                {/* DEBUGGING: Force show gender field button */}
                <div style={{ marginBottom: '10px', padding: '10px', background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '5px' }}>
                  <div style={{ fontSize: '12px', color: '#856404', marginBottom: '5px' }}>
                    🔧 DEBUG TOOLS: Testing gender field visibility
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      console.log('=== MANUAL TRIGGER DEBUG ===');
                      console.log('Current userProfile:', userProfile);
                      console.log('Toggling forceShowGender');
                      setForceShowGender(prev => !prev);
                    }}
                    style={{
                      padding: '5px 10px',
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {forceShowGender ? 'Hide' : 'Force Show'} Gender Field
                  </button>
                  <div style={{ fontSize: '10px', marginTop: '5px' }}>forceShowGender: {String(forceShowGender)}</div>
                </div>

                {/* Gender Selection - Show if not already set */}
                {(() => {
                  // More robust gender check - handle null, undefined, and empty string
                  const gender = userProfile?.gender;
                  const hasValidGender = gender && gender !== '' && gender !== null && gender !== undefined;
                  const shouldShow = (!hasValidGender || isFirstScan);
                  const isDataReady = !userProfileLoading && userProfile !== undefined;

                  console.log('=== UPLOAD GENDER FIELD DEBUG ===');
                  console.log('userProfile:', userProfile);
                  console.log('userProfileLoading:', userProfileLoading);
                  console.log('userProfile?.gender:', userProfile?.gender);
                  console.log('gender variable:', gender);
                  console.log('hasValidGender:', hasValidGender);
                  console.log('isFirstScan:', isFirstScan);
                  console.log('isDataReady:', isDataReady);
                  console.log('shouldShow (!hasValidGender || isFirstScan):', shouldShow);
                  console.log('Final condition (shouldShow && isDataReady):', shouldShow && isDataReady);
                  console.log('===================================');

                  // Add fallback: if we're still loading or unsure, show the field anyway
                  const finalDecision = shouldShow && isDataReady;

                  // Fallback safety: Always show if we don't have clear user data yet
                  const fallbackShow = !userProfile && !userProfileLoading;

                  console.log('fallbackShow (!userProfile && !userProfileLoading):', fallbackShow);
                  console.log('forceShowGender:', forceShowGender);
                  console.log('FINAL DECISION (finalDecision || fallbackShow || forceShowGender):', finalDecision || fallbackShow || forceShowGender);

                  return finalDecision || fallbackShow || forceShowGender;
                })() && (
                  <div style={{ border: '2px solid red', padding: '8px', backgroundColor: '#ffe6e6' }}>
                    <Label htmlFor="gender">
                      Gender <span className="text-red-500">*</span>
                      <span className="text-xs text-gray-500 ml-2">(Required for accurate scoring)</span>
                    </Label>
                    <div style={{ fontSize: '12px', color: 'red', marginBottom: '4px' }}>
                      🔍 DEBUG: Field visible! userProfile.gender={String(userProfile?.gender)} (type: {typeof userProfile?.gender}) | formData.gender={String(formData.gender)} (type: {typeof formData.gender}) | isFirstScan={String(isFirstScan)}
                    </div>
                    <Select
                      value={formData.gender || userProfile?.gender || ''}
                      onValueChange={(value) => {
                        console.log('Gender field onChange:', value);
                        handleInputChange('gender', value);
                      }}
                    >
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="Select your gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
    </div>
  );
}
