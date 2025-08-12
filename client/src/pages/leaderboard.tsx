import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Target, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { ContestantEntry } from "@shared/schema";

export default function Leaderboard() {
  const { user: currentUser } = useAuth();

  const { data: contestants, isLoading: contestantsLoading } = useQuery<ContestantEntry[]>({
    queryKey: ["/api/contestants"],
    queryFn: async () => {
      const response = await fetch("/api/contestants");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  });

  // Challenge countdown logic
  const challengeEndDate = new Date('2025-11-14');
  const today = new Date();
  const daysRemaining = Math.max(0, Math.ceil((challengeEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  if (contestantsLoading) {
    return <LeaderboardSkeleton />;
  }

  const displayContestants = contestants || [];

  if (displayContestants.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No contestants yet</h3>
            <p className="text-gray-600">Upload your first DEXA scan to join the competition!</p>
          </CardContent>
        </Card>
      </div>
    );
  }



  return (
    <div className="max-w-7xl mx-auto mobile-padding pb-20 md:pb-8 prevent-overflow space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <Trophy className="h-8 w-8 text-yellow-500 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">100-Day Recomp Leaderboard</h1>
        </div>
        <p className="text-gray-600 mb-2">
          {displayContestants.length} contestant{displayContestants.length !== 1 ? 's' : ''} competing
        </p>
        <Badge className="bg-blue-100 text-blue-800 text-lg px-4 py-2">
          {daysRemaining} days remaining
        </Badge>
      </div>

      {/* Contestants Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {displayContestants.map((contestant) => {
          const displayName = contestant.user.name || contestant.user.username || 'Anonymous';
          const isCurrentUser = currentUser?.id === contestant.user.id;
          
          return (
            <Card key={contestant.user.id} className={`hover:shadow-lg transition-shadow ${isCurrentUser ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage 
                      src={undefined} 
                      alt={displayName}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-lg">{displayName}</CardTitle>
                      {isCurrentUser && (
                        <Badge className="bg-blue-500 text-white text-xs">You</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      Baseline: {new Date(contestant.baselineScan.scanDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Current Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {contestant.baselineScan.bodyFatPercent}%
                    </div>
                    <div className="text-xs text-gray-500">Current Body Fat</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {contestant.baselineScan.leanMass}
                    </div>
                    <div className="text-xs text-gray-500">Lean Mass (lbs)</div>
                  </div>
                </div>

                {/* Target Goals */}
                <div className="flex items-center space-x-2 text-sm">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span className="text-gray-600">Goals:</span>
                  <span className="font-medium">
                    {contestant.user.targetBodyFatPercent ? `${contestant.user.targetBodyFatPercent}%` : '--'} BF,
                  </span>
                  <span className="font-medium">
                    {contestant.user.targetLeanMass ? `${contestant.user.targetLeanMass}` : '--'} lbs LM
                  </span>
                </div>

                {/* RMR if available */}
                {contestant.baselineScan.restingMetabolicRate && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Zap className="h-4 w-4 text-orange-500" />
                    <span className="text-gray-600">RMR:</span>
                    <span className="font-medium">{contestant.baselineScan.restingMetabolicRate} cal/day</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto mobile-padding pb-20 md:pb-8 space-y-6">
      <div className="text-center">
        <Skeleton className="h-10 w-80 mx-auto mb-4" />
        <Skeleton className="h-4 w-40 mx-auto mb-2" />
        <Skeleton className="h-8 w-32 mx-auto" />
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
