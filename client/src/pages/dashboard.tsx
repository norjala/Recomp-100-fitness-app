import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
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

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
    enabled: !!user,
  });

  const currentRank = leaderboard?.find(entry => entry.user.id === user?.id)?.rank;
  const challengeDay = user?.joinDate ? Math.floor((Date.now() - new Date(user.joinDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 0;
  const progressPercent = Math.min(100, (challengeDay / 100) * 100);

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

  const bodyFatChange = user.baselineScan && user.latestScan 
    ? ((user.latestScan.bodyFatPercent - user.baselineScan.bodyFatPercent) / user.baselineScan.bodyFatPercent) * 100
    : 0;

  const leanMassChange = user.baselineScan && user.latestScan
    ? ((user.latestScan.leanMass - user.baselineScan.leanMass) / user.baselineScan.leanMass) * 100
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user.firstName || user.name}!
        </h2>
        <p className="text-gray-600">Track your progress in the 100-day body recomposition challenge</p>
      </div>

      {/* Challenge Status Banner */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-6 text-white mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-xl font-semibold mb-2">Challenge Progress</h3>
            <p className="text-blue-100">Day {challengeDay} of 100</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">#{currentRank || '--'}</div>
            <p className="text-blue-100">Current Rank</p>
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
                  {user.currentBodyFat?.toFixed(1) || '--'}%
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
                  {user.currentLeanMass?.toFixed(1) || '--'} lbs
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
                <p className="text-2xl font-bold text-gray-900">
                  {user.totalScore?.toFixed(1) || '--'}
                </p>
                <p className="text-sm text-gray-500">
                  FLS: {user.fatLossScore?.toFixed(1) || '--'} | MGS: {user.muscleGainScore?.toFixed(1) || '--'}
                </p>
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
                <p className="text-2xl font-bold text-gray-900">{user.totalScans}</p>
                <Button 
                  size="sm" 
                  className="mt-2 bg-secondary hover:bg-emerald-700"
                  onClick={() => window.location.hash = 'upload'}
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
