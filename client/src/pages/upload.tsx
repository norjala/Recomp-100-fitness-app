import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Upload as UploadIcon, CloudUpload, Save } from "lucide-react";
import { insertDexaScanSchema } from "@shared/schema";
import { z } from "zod";
import type { UploadResult } from "@uppy/core";

const scanFormSchema = insertDexaScanSchema.omit({ userId: true, createdAt: true }).extend({
  scanDate: z.string().min(1, "Scan date is required"),
});

type ScanFormData = z.infer<typeof scanFormSchema>;

export default function Upload() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    scanDate: new Date().toISOString().split('T')[0],
    bodyFatPercent: 0,
    leanMass: 0,
    totalWeight: 0,
    scanImagePath: undefined as string | undefined,
    isBaseline: false,
  });
  
  const [uploadedScanId, setUploadedScanId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const createScanMutation = useMutation({
    mutationFn: async (data: ScanFormData) => {
      const response = await apiRequest("POST", "/api/scans", data);
      return response.json();
    },
    onSuccess: (scan) => {
      setUploadedScanId(scan.id);
      toast({
        title: "Success",
        description: "DEXA scan data saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      
      // Reset form
      setFormData({
        scanDate: new Date().toISOString().split('T')[0],
        bodyFatPercent: 0,
        leanMass: 0,
        totalWeight: 0,
        scanImagePath: undefined as string | undefined,
        isBaseline: false,
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <UploadIcon className="h-5 w-5 mr-2 text-secondary" />
            Upload DEXA Scan
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* File Upload Area */}
            <div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-secondary transition-colors">
                <CloudUpload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">Upload DEXA Scan Report</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Drag and drop your DEXA scan image or PDF here, or click to browse
                </p>
                
                {uploadedScanId ? (
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={10485760} // 10MB
                    onGetUploadParameters={handleGetUploadParameters}
                    onComplete={handleUploadComplete}
                    buttonClassName="bg-secondary text-white hover:bg-emerald-700"
                  >
                    Upload Scan Image
                  </ObjectUploader>
                ) : (
                  <div>
                    <Button variant="outline" disabled>
                      Save scan data first to upload image
                    </Button>
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-2">Supports JPG, PNG, PDF up to 10MB</p>
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
                
                <div>
                  <Label htmlFor="bodyFat">Body Fat %</Label>
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
