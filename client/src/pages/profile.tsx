import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
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
import { apiRequest } from "@/lib/queryClient";
import { Eye, FileText, Edit, Trash2, Plus } from "lucide-react";
import type { UserWithStats, DexaScan, InsertDexaScan } from "@shared/schema";

export default function Profile() {
  const { toast } = useToast();
  const { user: authUser, isLoading: authLoading } = useAuth();
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
    mutationFn: async (data: { scanId: string; updates: Partial<InsertDexaScan> }) => {
      const res = await apiRequest("PUT", `/api/scans/${data.scanId}`, data.updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", authUser?.id, "scans"] });
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

  const form = useForm<Partial<InsertDexaScan>>({
    resolver: zodResolver(insertDexaScanSchema.partial()),
  });

  const handleEditScan = (scan: DexaScan) => {
    setEditingScan(scan);
    form.reset({
      bodyFatPercent: scan.bodyFatPercent,
      leanMass: scan.leanMass,
      totalWeight: scan.totalWeight,
      scanDate: new Date(scan.scanDate).toISOString().split('T')[0],
      isBaseline: scan.isBaseline,
      notes: scan.notes || '',
    });
  };

  const onSubmitEdit = (data: Partial<InsertDexaScan>) => {
    if (!editingScan) return;
    editScanMutation.mutate({
      scanId: editingScan.id,
      updates: {
        ...data,
        scanDate: data.scanDate ? new Date(data.scanDate) : undefined,
      },
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">My Profile & Progress</h3>
        </div>
        
        <CardContent className="p-6">
          {/* Profile Header */}
          <div className="flex items-center space-x-6 mb-8">
            <Avatar className="h-24 w-24">
              <AvatarImage 
                src={user.profileImageUrl || undefined} 
                alt={user.name || user.email}
              />
              <AvatarFallback className="text-xl">
                {user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || user.email.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h4 className="text-xl font-bold text-gray-900">{user.name || user.email}</h4>
              <p className="text-gray-600 capitalize">{user.gender || 'Not specified'}</p>
              <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                <span>Height: {user.height || 'Not specified'}</span>
                <span>Starting Weight: {user.startingWeight || '--'} lbs</span>
                <span>Joined: {formatDate(user.createdAt)}</span>
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
                          BF: {scan.bodyFatPercent.toFixed(1)}% | LM: {scan.leanMass.toFixed(1)} lbs | Weight: {scan.totalWeight.toFixed(1)} lbs
                        </p>
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
                  className="mt-4"
                  onClick={() => window.location.hash = 'upload'}
                >
                  Upload Your First Scan
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
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
