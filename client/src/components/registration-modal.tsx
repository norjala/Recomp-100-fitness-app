import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ObjectUploader } from "@/components/ObjectUploader";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import type { UploadResult } from "@uppy/core";

const registrationSchema = insertUserSchema.extend({
  scanDate: z.string().min(1, "Scan date is required"),
  bodyFat: z.number().min(0).max(100),
  leanMass: z.number().min(0),
  scanImagePath: z.string().optional(),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RegistrationModal({ isOpen, onClose }: RegistrationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<RegistrationFormData>({
    name: "",
    gender: "male",
    height: "",
    startingWeight: 0,
    scanDate: new Date().toISOString().split('T')[0],
    bodyFat: 0,
    leanMass: 0,
    scanImagePath: undefined,
  });

  const registrationMutation = useMutation({
    mutationFn: async (data: RegistrationFormData) => {
      const response = await apiRequest("POST", "/api/users/register", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome to FitChallenge Pro!",
        description: "Your registration is complete. Let's start your transformation journey!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onClose();
    },
    onError: (error) => {
      console.error("Registration error:", error);
      toast({
        title: "Registration Failed",
        description: "Failed to register. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof RegistrationFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = registrationSchema.parse(formData);
      registrationMutation.mutate(validatedData);
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
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const imageURL = uploadedFile.uploadURL;
      
      if (imageURL) {
        setFormData(prev => ({
          ...prev,
          scanImagePath: imageURL,
        }));
        
        toast({
          title: "File Uploaded",
          description: "Your DEXA scan report has been uploaded successfully.",
        });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Join the Challenge</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select 
                value={formData.gender} 
                onValueChange={(value) => handleInputChange('gender', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="height">Height</Label>
              <Input
                id="height"
                type="text"
                placeholder="5'10&quot;"
                value={formData.height}
                onChange={(e) => handleInputChange('height', e.target.value)}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="weight">Weight (lbs)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                placeholder="185.0"
                value={formData.startingWeight || ''}
                onChange={(e) => handleInputChange('startingWeight', parseFloat(e.target.value) || 0)}
                required
              />
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Baseline DEXA Scan Data</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  placeholder="19.0"
                  value={formData.bodyFat || ''}
                  onChange={(e) => handleInputChange('bodyFat', parseFloat(e.target.value) || 0)}
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
                  placeholder="139.6"
                  value={formData.leanMass || ''}
                  onChange={(e) => handleInputChange('leanMass', parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </div>
            
            <div className="mt-4">
              <Label>Upload DEXA Scan Report (Optional)</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center mt-2">
                <p className="text-sm text-gray-600 mb-2">Upload your baseline DEXA scan image or PDF</p>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760} // 10MB
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleUploadComplete}
                  buttonClassName="text-primary hover:text-blue-700"
                >
                  Choose File
                </ObjectUploader>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-primary hover:bg-blue-700"
              disabled={registrationMutation.isPending}
            >
              {registrationMutation.isPending ? "Joining..." : "Join Challenge"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
