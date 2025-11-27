// GENDER UI TEST - Force rebuild
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [editingProfile, setEditingProfile] = useState(false);
  const [targetBodyFat, setTargetBodyFat] = useState<string>('');
  const [targetLeanMass, setTargetLeanMass] = useState<string>('');

  // DEBUG: Force show gender field for testing
  const [forceShowGender, setForceShowGender] = useState(false);

  const { data: user, isLoading: userLoading } = useQuery<UserWithStats>({
    queryKey: ["/api/user"],
    enabled: !!authUser,
  });

  // Gender field debugging - comprehensive logging
  useEffect(() => {
    console.log('=== PROFILE DEBUG - User Data Loading ===');
    console.log('authUser:', authUser);
    console.log('authLoading:', authLoading);
    console.log('user:', user);
    console.log('userLoading:', userLoading);
    console.log('user?.gender:', user?.gender);
    console.log('typeof user?.gender:', typeof user?.gender);
    console.log('user?.gender === null:', user?.gender === null);
    console.log('user?.gender === undefined:', user?.gender === undefined);
    console.log('!user?.gender (condition used in render):', !user?.gender);
    console.log('====================================');
  }, [authUser, authLoading, user, userLoading]);

  const { data: scans, isLoading: scansLoading } = useQuery<DexaScan[]>({
    queryKey: ["/api/users", authUser?.id, "scans"],
    enabled: !!authUser?.id,
  });

  // Edit scan mutation
  const editScanMutation = useMutation({
    mutationFn: async ({ scanId, updates, firstName, lastName, gender }: {
      scanId: string;
      updates: Partial<InsertDexaScan>;
      firstName?: string;
      lastName?: string;
      gender?: string;
    }) => {
      const res = await apiRequest("PUT", `/api/scans/${scanId}`, {
        ...updates,
        firstName,
        lastName,
        gender,
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
    gender: z.enum(["male", "female"]).optional(),
  });

  const form = useForm<z.infer<typeof editFormSchema>>({
    resolver: zodResolver(editFormSchema),
  });

  const profileFormSchema = z.object({
    gender: z.enum(["male", "female"]).optional(),
    height: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  });

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
  });

  // Update user target goals mutation
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

  // Update user profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: { gender?: string; height?: string; firstName?: string; lastName?: string }) => {
      const res = await apiRequest("PUT", "/api/user/profile", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scoring", authUser?.id] });
      setEditingProfile(false);
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
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

  const handleEditProfile = () => {
    setEditingProfile(true);
    profileForm.reset({
      gender: user?.gender || undefined,
      height: user?.height || '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
    });
  };

  const onSubmitProfile = (data: z.infer<typeof profileFormSchema>) => {
    const updates: any = {};
    if (data.gender) updates.gender = data.gender;
    if (data.height) updates.height = data.height;
    if (data.firstName) updates.firstName = data.firstName;
    if (data.lastName) updates.lastName = data.lastName;

    if (data.firstName && data.lastName) {
      updates.name = `${data.firstName} ${data.lastName}`;
    }

    updateProfileMutation.mutate(updates);
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
      gender: user?.gender || '',
      scanDate: new Date(scan.scanDate).toISOString().split('T')[0],
      isBaseline: scan.isBaseline,
      notes: scan.notes || '',
    });
  };

  const onSubmitEdit = (data: z.infer<typeof editFormSchema>) => {
    if (!editingScan) return;
    
    // Extract the scan update data (excluding firstName/lastName/gender which are for profile)
    const { firstName, lastName, gender, ...scanUpdateData } = data;
    
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
      // Pass firstName, lastName, and gender separately for profile update
      firstName,
      lastName,
      gender,
    });
  };

  const handleDeleteScan = (scanId: string) => {
    if (confirm("Are you sure you want to delete this scan? This action cannot be undone.")) {
      deleteScanMutation.mutate(scanId);
    }
  };

  // Enhanced loading state debugging
  useEffect(() => {
    console.log('=== PROFILE LOADING STATES ===');
    console.log('authLoading:', authLoading);
    console.log('userLoading:', userLoading);
    console.log('user exists:', !!user);
    console.log('=============================');
  }, [authLoading, userLoading, user]);

  if (authLoading || userLoading) {
    console.log('PROFILE: Showing loading skeleton due to:', { authLoading, userLoading });
    return <ProfileSkeleton />;
  }

  if (!user) {
    console.log('PROFILE: No user data available');
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
      {/* DEBUG PANEL - Remove after debugging */}
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: '#000',
        color: '#fff',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        zIndex: 9999,
        maxWidth: '300px'
      }}>
        <div><strong>🔍 PROFILE DEBUG PANEL</strong></div>
        <div>authLoading: {String(authLoading)}</div>
        <div>userLoading: {String(userLoading)}</div>
        <div>user exists: {String(!!user)}</div>
        <div>user.gender: {String(user?.gender)} ({typeof user?.gender})</div>
        <div>!user?.gender: {String(!user?.gender)}</div>
        <div>editingProfile: {String(editingProfile)}</div>
        <div>forceShowGender: {String(forceShowGender)}</div>
      </div>

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
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-lg md:text-xl font-bold text-gray-900 truncate">{user.name || user.username || user.email || 'User'}</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditProfile}
                  className="ml-2"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-gray-600 capitalize text-sm md:text-base">
                  {user.gender ? `Gender: ${user.gender}` : 'Gender: Not specified'}
                </p>
                {!user.gender && (
                  <Badge variant="destructive" className="text-xs">Required for scoring</Badge>
                )}
              </div>
              <div className="mt-2 flex flex-col md:flex-row md:items-center md:space-x-4 text-xs md:text-sm text-gray-500 space-y-1 md:space-y-0">
                <span>Height: {user.height || 'Not specified'}</span>
                <span>Weight: {user.startingWeight || '--'} lbs</span>
                <span className="hidden md:inline">Joined: {user.createdAt ? formatDate(user.createdAt) : 'Unknown'}</span>
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

      {/* Edit Profile Dialog */}
      <Dialog open={editingProfile} onOpenChange={setEditingProfile}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="space-y-4">
              <FormField
                control={profileForm.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">Required for accurate competition scoring</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
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
                  control={profileForm.control}
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
              <FormField
                control={profileForm.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 5'10&quot; or 178cm"
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
                  onClick={() => setEditingProfile(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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

              {/* DEBUGGING: Force show gender field button */}
              <div style={{ marginBottom: '10px', padding: '10px', background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '5px' }}>
                <div style={{ fontSize: '12px', color: '#856404', marginBottom: '5px' }}>
                  🔧 DEBUG TOOLS: Testing gender field visibility in edit dialog
                </div>
                <button
                  type="button"
                  onClick={() => {
                    console.log('=== MANUAL TRIGGER DEBUG (PROFILE) ===');
                    console.log('Current user:', user);
                    console.log('user.gender:', user?.gender);
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

              {/* Gender field - only show if user has no gender set */}
              {(() => {
                // More robust gender check - handle null, undefined, and empty string
                const gender = user?.gender;
                const shouldShow = !gender || gender === '' || gender === null || gender === undefined;
                console.log('=== PROFILE EDIT DIALOG GENDER FIELD DEBUG ===');
                console.log('user:', user);
                console.log('user?.gender:', user?.gender);
                console.log('gender variable:', gender);
                console.log('gender === null:', gender === null);
                console.log('gender === undefined:', gender === undefined);
                console.log('gender === "":', gender === '');
                console.log('!gender:', !gender);
                console.log('forceShowGender:', forceShowGender);
                console.log('shouldShow (comprehensive check):', shouldShow);
                console.log('FINAL DECISION (shouldShow || forceShowGender):', shouldShow || forceShowGender);
                console.log('===============================================');
                return shouldShow || forceShowGender;
              })() && (
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => {
                    console.log('=== GENDER FIELD RENDER DEBUG ===');
                    console.log('field.value:', field.value);
                    console.log('user?.gender:', user?.gender);
                    console.log('================================');
                    return (
                      <FormItem style={{ border: '2px solid red', padding: '8px', backgroundColor: '#ffe6e6' }}>
                        <FormLabel>Gender <span className="text-red-500">*</span></FormLabel>
                        <div style={{ fontSize: '12px', color: 'red', marginBottom: '4px' }}>
                          🔍 DEBUG: Field visible! user.gender={String(user?.gender)} (type: {typeof user?.gender}) | field.value={String(field.value)} (type: {typeof field.value})
                        </div>
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              )}

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
