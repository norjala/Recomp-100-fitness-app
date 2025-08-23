import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ProgressChart } from "@/components/progress-chart";
import { Plus, Percent, Dumbbell, TrendingUp, Calendar, ArrowDown, ArrowUp, Target, Save } from "lucide-react";
import { projectScores, validateTargetGoals, formatPercentage, formatScore } from "@shared/scoring-utils";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { UserWithStats, LeaderboardEntry } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Target goals state
  const [targetBodyFat, setTargetBodyFat] = useState<string>('');
  const [targetLeanMass, setTargetLeanMass] = useState<string>('');
  const [isEditingTargets, setIsEditingTargets] = useState(false);

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
    enabled: !!user,
  });

  const { data: scans = [] } = useQuery<any[]>({
    queryKey: [`/api/users/${user?.id}/scans`],
    enabled: !!user,
  });

  const { data: userScore = {} } = useQuery<any>({
    queryKey: [`/api/scoring/${user?.id}`],
    enabled: !!user,
  });

  // Update target goals mutation
  const updateTargetsMutation = useMutation({
    mutationFn: async (data: { targetBodyFatPercent: number; targetLeanMass: number }) => {
      const response = await apiRequest("PUT", "/api/user/targets", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setIsEditingTargets(false);
      toast({
        title: "Target goals updated",
        description: "Your target goals have been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: "Failed to update target goals. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Initialize target values from user data
  useEffect(() => {
    if (user && !isEditingTargets) {
      setTargetBodyFat(user.targetBodyFatPercent ? user.targetBodyFatPercent.toString() : '');
      setTargetLeanMass(user.targetLeanMass ? user.targetLeanMass.toString() : '');
    }
  }, [user, isEditingTargets]);

  const currentRank = leaderboard?.find(entry => entry.user.id === user?.id)?.rank;
  // Challenge runs from August 4, 2025 to November 14, 2025 (102 days)
  const challengeStartDate = new Date('2025-08-04');
  const challengeEndDate = new Date('2025-11-14');
  const today = new Date();
  
  // Calculate days remaining until challenge ends
  const daysRemaining = Math.max(0, Math.ceil((challengeEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  
  // Calculate progress percentage (how much of the challenge has passed)
  const totalDays = Math.ceil((challengeEndDate.getTime() - challengeStartDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysPassed = totalDays - daysRemaining;
  const progressPercent = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));

  // Helper functions for target goals and projections
  const handleSaveTargets = () => {
    const bodyFatValue = parseFloat(targetBodyFat);
    const leanMassValue = parseFloat(targetLeanMass);
    
    if (isNaN(bodyFatValue) || isNaN(leanMassValue)) {
      toast({
        title: "Invalid input",
        description: "Please enter valid numbers for both target goals.",
        variant: "destructive",
      });
      return;
    }
    
    updateTargetsMutation.mutate({
      targetBodyFatPercent: bodyFatValue,
      targetLeanMass: leanMassValue,
    });
  };

  const handleCancelEdit = () => {
    setIsEditingTargets(false);
    // Reset to current user values
    setTargetBodyFat(user?.targetBodyFatPercent ? user.targetBodyFatPercent.toString() : '');
    setTargetLeanMass(user?.targetLeanMass ? user.targetLeanMass.toString() : '');
  };

  if (authLoading || !user) {
    return <DashboardSkeleton />;
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

  // Calculate scan variables first
  const baselineScan = scans?.find(scan => scan.isBaseline);
  
  // For displaying current stats, use the most recent scan or baseline if it's the only one
  const latestScan = scans?.length > 0 
    ? scans.reduce((latest, current) => 
        new Date(current.scanDate) > new Date(latest.scanDate) ? current : latest
      )
    : null;
  
  // Calculate projected scores with memoization for performance
  const projectedScores = useMemo(() => {
    if (!latestScan || !targetBodyFat || !targetLeanMass) return null;
    
    const bodyFatValue = parseFloat(targetBodyFat);
    const leanMassValue = parseFloat(targetLeanMass);
    
    // Only calculate if values are valid numbers
    if (isNaN(bodyFatValue) || isNaN(leanMassValue)) return null;
    
    // Project from current state (latestScan) to target goals
    return projectScores(
      latestScan,
      bodyFatValue,
      leanMassValue,
      user?.gender || 'male'
    );
  }, [latestScan, targetBodyFat, targetLeanMass, user?.gender]);

  // Validate target goals with memoization
  const targetValidation = useMemo(() => {
    if (!baselineScan || !targetBodyFat || !targetLeanMass) return null;
    
    const bodyFatValue = parseFloat(targetBodyFat);
    const leanMassValue = parseFloat(targetLeanMass);
    
    // Only validate if values are valid numbers
    if (isNaN(bodyFatValue) || isNaN(leanMassValue)) return null;
    
    return validateTargetGoals(
      baselineScan,
      bodyFatValue,
      leanMassValue
    );
  }, [baselineScan, targetBodyFat, targetLeanMass]);
  
  // For progress calculations, only compare when there are multiple scans
  const nonBaselineScans = scans?.filter(scan => !scan.isBaseline) || [];
  const progressScan = nonBaselineScans.length > 0 
    ? nonBaselineScans.reduce((latest, current) => 
        new Date(current.scanDate) > new Date(latest.scanDate) ? current : latest
      )
    : null;
  
  const bodyFatChange = baselineScan && progressScan
    ? ((progressScan.bodyFatPercent - baselineScan.bodyFatPercent) / baselineScan.bodyFatPercent) * 100
    : 0;
    
  const leanMassChange = baselineScan && progressScan
    ? ((progressScan.leanMass - baselineScan.leanMass) / baselineScan.leanMass) * 100
    : 0;

  // Check if user has minimum required scans for participation
  const hasMinimumScans = scans.length >= 1 && baselineScan;

  return (
    <div className="max-w-7xl mx-auto mobile-padding pb-20 md:pb-8 prevent-overflow">
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user.firstName || user.name || user.username || 'User'}!
        </h2>
        <p className="text-gray-600">Track your progress in the 100-day body recomposition challenge</p>
      </div>

      {/* Challenge Status Banner */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-4 md:p-6 text-white mb-6 md:mb-8">
        <div className="flex items-center justify-between flex-wrap gap-3 md:gap-4">
          <div>
            <h3 className="text-lg md:text-xl font-semibold mb-1 md:mb-2">Challenge Progress</h3>
            <p className="text-blue-100 text-sm md:text-base">
              {daysRemaining > 0 ? `${daysRemaining} days left until 11/14` : 'Challenge complete!'}
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <div className="bg-white bg-opacity-20 rounded-full h-2">
              <div 
                className="bg-white rounded-full h-2 transition-all duration-300" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Welcome Message for New Users */}
      {!hasMinimumScans && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-blue-800">Join the Competition!</h3>
                <p className="text-blue-700">
                  Upload your baseline DEXA scan to join the 100-day recomposition challenge and appear on the leaderboard!
                </p>
                <Button 
                  className="mt-3 bg-blue-600 hover:bg-blue-700" 
                  onClick={() => setLocation('/my-scans')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Upload DEXA Scan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid - Mobile Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-3 bg-accent bg-opacity-10 rounded-lg">
                <Percent className="h-5 w-5 text-accent" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Body Fat %</p>
                <p className="text-2xl font-bold text-gray-900">
                  {latestScan ? latestScan.bodyFatPercent.toFixed(1) : '--'}%
                </p>
                {bodyFatChange !== 0 && (
                  <p className={`text-sm flex items-center ${bodyFatChange < 0 ? 'text-success' : 'text-destructive'}`}>
                    {bodyFatChange < 0 ? <ArrowDown className="h-3 w-3 mr-1" /> : <ArrowUp className="h-3 w-3 mr-1" />}
                    {Math.abs(bodyFatChange).toFixed(1)}% from start
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-3 bg-secondary bg-opacity-10 rounded-lg">
                <Dumbbell className="h-5 w-5 text-secondary" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Lean Mass</p>
                <p className="text-2xl font-bold text-gray-900">
                  {latestScan ? latestScan.leanMass.toFixed(1) : '--'} lbs
                </p>
                {leanMassChange !== 0 && (
                  <p className={`text-sm flex items-center ${leanMassChange > 0 ? 'text-success' : 'text-destructive'}`}>
                    {leanMassChange > 0 ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                    +{leanMassChange.toFixed(1)}% from start
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-3 bg-primary bg-opacity-10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Score</p>
                {!hasMinimumScans ? (
                  <div>
                    <p className="text-2xl font-bold text-gray-400">--</p>
                    <p className="text-xs text-gray-400">Need 2+ scans to calculate</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {userScore?.totalScore?.toFixed(1) || '0.0'}
                    </p>
                    <p className="text-sm text-gray-500">
                      FLS: {userScore?.fatLossScore?.toFixed(1) || '0.0'} | MGS: {userScore?.muscleGainScore?.toFixed(1) || '0.0'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-3 bg-warning bg-opacity-10 rounded-lg">
                <Calendar className="h-5 w-5 text-warning" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Scans</p>
                <p className="text-2xl font-bold text-gray-900">{scans.length}</p>
                <Button 
                  size="sm" 
                  className="mt-2 bg-secondary hover:bg-emerald-700"
                  onClick={() => setLocation('/my-scans')}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Scan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Target Goals and Score Projection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-6 md:mb-8">
        {/* Target Goals Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2 text-primary" />
              Target Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!baselineScan ? (
              <div className="text-center py-6">
                <Target className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 mb-4">Upload a baseline scan to set target goals</p>
                <Button onClick={() => setLocation('/my-scans')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Upload DEXA Scan
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="target-body-fat">Target Body Fat %</Label>
                    <Input
                      id="target-body-fat"
                      type="number"
                      step="0.1"
                      min="3"
                      max="50"
                      placeholder="Enter target"
                      value={targetBodyFat}
                      onChange={(e) => setTargetBodyFat(e.target.value)}
                      onFocus={() => setIsEditingTargets(true)}
                      className="placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <Label htmlFor="target-lean-mass">Target Lean Mass (lbs)</Label>
                    <Input
                      id="target-lean-mass"
                      type="number"
                      step="0.1"
                      min="50"
                      placeholder="Enter target"
                      value={targetLeanMass}
                      onChange={(e) => setTargetLeanMass(e.target.value)}
                      onFocus={() => setIsEditingTargets(true)}
                      className="placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* Target validation warnings */}
                {targetValidation && !targetValidation.isValid && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <div className="text-sm text-yellow-800">
                      <strong>Consider these targets:</strong>
                      <ul className="mt-1 list-disc list-inside">
                        {targetValidation.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Current vs Target comparison */}
                {latestScan && (
                  <div className="bg-gray-50 rounded-md p-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Current vs Target</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Body Fat:</span>
                        <div className="font-medium">
                          {latestScan.bodyFatPercent.toFixed(1)}% → {targetBodyFat || '--'}%
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Lean Mass:</span>
                        <div className="font-medium">
                          {latestScan.leanMass.toFixed(1)} → {targetLeanMass || '--'} lbs
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save/Cancel buttons */}
                {isEditingTargets && (
                  <div className="flex space-x-2">
                    <Button 
                      onClick={handleSaveTargets}
                      disabled={updateTargetsMutation.isPending}
                      className="flex-1"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updateTargetsMutation.isPending ? "Saving..." : "Save Targets"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleCancelEdit}
                      disabled={updateTargetsMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Projected Score Display */}
        <Card className="border-2 border-dashed border-purple-300 bg-purple-50/30">
          <CardHeader className="border-b border-purple-200 bg-purple-50/50">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-purple-600" />
                Score Projection
              </div>
              <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50">
                PROJECTED
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {!projectedScores ? (
              <div className="text-center py-6">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 mb-2">Set target goals to see projected score</p>
                <p className="text-xs text-gray-400">Scores will update in real-time as you type</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Projected Total Score */}
                <div className="text-center relative">
                  <div className="absolute -top-2 -right-2 bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full border border-purple-300">
                    PROJECTED
                  </div>
                  <div className="text-4xl font-bold text-purple-600 mb-1 relative">
                    {formatScore(projectedScores.totalScore)}
                    <span className="text-lg font-normal text-purple-400">/100</span>
                  </div>
                  <div className="text-sm text-purple-700 font-medium">
                    PROJECTED TOTAL SCORE
                  </div>
                  <div className="text-xs text-purple-600 mt-1 italic">
                    If you reach your target goals
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-purple-200">
                  <div className="text-center p-3 bg-red-50/50 rounded-lg border border-red-200">
                    <div className="text-2xl font-bold text-red-600 mb-1">
                      {formatScore(projectedScores.fatLossScore)}
                      <span className="text-sm font-normal text-red-400">/50</span>
                    </div>
                    <div className="text-xs text-red-700 font-medium">Fat Loss Score</div>
                    <div className="text-xs text-red-600 mt-1">
                      {formatPercentage(projectedScores.fatLossPercent)} needed
                    </div>
                  </div>
                  <div className="text-center p-3 bg-green-50/50 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {formatScore(projectedScores.muscleGainScore)}
                      <span className="text-sm font-normal text-green-400">/50</span>
                    </div>
                    <div className="text-xs text-green-700 font-medium">Muscle Gain Score</div>
                    <div className="text-xs text-green-600 mt-1">
                      {formatPercentage(projectedScores.muscleGainPercent)} needed
                    </div>
                  </div>
                </div>

                {/* What-if scenario indicator */}
                <div className="bg-purple-100 border border-purple-300 rounded-lg p-3">
                  <div className="flex items-center text-sm text-purple-800">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    <span className="font-medium">What-If Scenario:</span>
                  </div>
                  <div className="text-xs text-purple-700 mt-1">
                    This projection updates as you modify your target goals above. 
                    Actual scores are calculated from your real DEXA scans.
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progress Chart */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Timeline</h3>
          <ProgressChart userId={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      
      <Skeleton className="h-32 w-full mb-8 rounded-xl" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
