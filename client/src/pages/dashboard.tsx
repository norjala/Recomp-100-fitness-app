import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ProgressChart } from "@/components/progress-chart";
import { Plus, Percent, Dumbbell, TrendingUp, Calendar, ArrowDown, ArrowUp } from "lucide-react";
import type { UserWithStats, LeaderboardEntry } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

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

  // Calculate changes from baseline scan
  const baselineScan = scans?.find(scan => scan.isBaseline);
  // For displaying current stats, use the most recent scan or baseline if it's the only one
  const latestScan = scans?.length > 0 
    ? scans.reduce((latest, current) => 
        new Date(current.scanDate) > new Date(latest.scanDate) ? current : latest
      )
    : null;
  
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
                  onClick={() => setLocation('/upload')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Upload DEXA Scan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
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
          <CardContent className="p-6">
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
          <CardContent className="p-6">
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
          <CardContent className="p-6">
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
                  onClick={() => setLocation('/upload')}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Scan
                </Button>
              </div>
            </div>
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
