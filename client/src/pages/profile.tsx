import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScanComparison } from "@/components/scan-comparison";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDexaScanSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Eye, FileText, Edit, Trash2, Plus } from "lucide-react";
import type { UserWithStats, DexaScan, InsertDexaScan } from "@shared/schema";

export default function Profile() {
  const { toast } = useToast();
  const { user: authUser, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [editingScan, setEditingScan] = useState<DexaScan | null>(null);

  const { data: user, isLoading: userLoading } = useQuery<UserWithStats>({
    queryKey: ["/api/user"],
    enabled: !!authUser,
  });

  const { data: scans, isLoading: scansLoading } = useQuery<DexaScan[]>({
    queryKey: ["/api/users", authUser?.id, "scans"],
    enabled: !!authUser?.id,
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

  const editFormSchema = insertDexaScanSchema.partial().extend({
    scanDate: z.union([z.string(), z.date()]).optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  });

  const form = useForm<z.infer<typeof editFormSchema>>({
    resolver: zodResolver(editFormSchema),
  });

  const handleEditScan = (scan: DexaScan) => {
    setEditingScan(scan);
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

  if (authLoading || userLoading) {
    return <ProfileSkeleton />;
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

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="max-w-7xl mx-auto mobile-padding pb-20 md:pb-8 prevent-overflow">
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
                <span className="hidden md:inline">Joined: {formatDate(user.createdAt)}</span>
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
                <Button 
                  className="mt-4 mobile-button"
                  onClick={() => setLocation('/upload')}
                >
                  Upload DEXA
                </Button>
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
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any additional notes about this scan..."
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
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

function ProfileSkeleton() {
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
