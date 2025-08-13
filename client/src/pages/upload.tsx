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
    scanImagePath: undefined as string | undefined,
    isBaseline: false,
    notes: '',
    targetBodyFatPercent: user?.targetBodyFatPercent || 0,
    targetLeanMass: user?.targetLeanMass || 0,
  });

  // Update target fields when user data changes
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        targetBodyFatPercent: prev.targetBodyFatPercent || user.targetBodyFatPercent || 0,
        targetLeanMass: prev.targetLeanMass || user.targetLeanMass || 0,
      }));
    }
  }, [user]);
  
  const [uploadedScanId, setUploadedScanId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  // Query user's existing scans to determine if this is their first scan
  const { data: userScans = [], isLoading: scansLoading } = useQuery<DexaScan[]>({
    queryKey: ["/api/users", user?.id, "scans"],
    enabled: !!user?.id,
  });

  const isFirstScan = userScans.length === 0;
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
        }));

        toast({
          title: "Data extracted successfully",
          description: `Extracted: ${extractedData.bodyFatPercent}% BF, ${extractedData.leanMass}lbs LM, ${extractedData.totalWeight}lbs total${extractedData.rmr ? `, RMR: ${extractedData.rmr} cal/day` : ''}${extractedData.scanDate ? `, Date: ${extractedData.scanDate}` : ''} (${Math.round(extractedData.confidence * 100)}% confidence)`,
        });
      } else {
        toast({
          title: "PDF uploaded successfully",
          description: "Please enter your scan values manually from your DEXA report. All data will be saved accurately.",
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

  if (authLoading) {
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
                  Upload your DEXA scan image/PDF and automatically extract the data
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
                
                {/* Extraction Results */}
                {extractedData && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md text-left">
                    <h5 className="text-sm font-medium text-green-800 mb-2">Extracted Data</h5>
                    <div className="text-xs text-green-700 space-y-1">
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
                      <div>Confidence: {Math.round(extractedData.confidence * 100)}%</div>
                    </div>
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
                    <Label htmlFor="targetBodyFat">Target Body Fat % (Optional)</Label>
                    <Input
                      id="targetBodyFat"
                      type="number"
                      step="0.1"
                      min="1"
                      max="50"
                      placeholder="[enter goal]"
                      value={formData.targetBodyFatPercent || ''}
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
                    <Label htmlFor="targetLeanMass">Target Lean Mass (lbs) (Optional)</Label>
                    <Input
                      id="targetLeanMass"
                      type="number"
                      step="0.1"
                      min="50"
                      placeholder="[enter goal]"
                      value={formData.targetLeanMass || ''}
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
