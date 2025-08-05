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

  const { data: scans } = useQuery({
    queryKey: ["/api/users", user?.id, "scans"],
    enabled: !!user,
  });

  const currentRank = leaderboard?.find(entry => entry.user.id === user?.id)?.rank;
  // Challenge runs from August 4, 2025 to November 12, 2025 (100 days)
  const challengeStartDate = new Date('2025-08-04');
  const challengeEndDate = new Date('2025-11-12');
  const today = new Date();
  const challengeDay = Math.max(1, Math.min(100, Math.floor((today.getTime() - challengeStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1));
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

  // Calculate body composition changes if we have scan data
  const bodyFatChange = scans && scans.length > 1 
    ? ((scans[0].bodyFatPercent - scans[scans.length - 1].bodyFatPercent) / scans[scans.length - 1].bodyFatPercent) * 100
    : 0;
    
  const leanMassChange = scans && scans.length > 1
    ? ((scans[0].leanMass - scans[scans.length - 1].leanMass) / scans[scans.length - 1].leanMass) * 100
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user.name || user.email}!
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
            <div className="text-2xl font-bold">#{scans && scans.length > 0 ? '1' : '--'}</div>
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
                  {scans && scans.length > 0 ? scans[scans.length - 1].bodyFatPercent.toFixed(1) : '--'}%
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
                  {scans && scans.length > 0 ? scans[scans.length - 1].leanMass.toFixed(1) : '--'} lbs
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
                  {scans && scans.length > 0 ? '100.0' : '--'}
                </p>
                <p className="text-sm text-gray-500">
                  FLS: {scans && scans.length > 0 ? '50.0' : '--'} | MGS: {scans && scans.length > 0 ? '50.0' : '--'}
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
                <p className="text-2xl font-bold text-gray-900">{scans?.length || 0}</p>
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
