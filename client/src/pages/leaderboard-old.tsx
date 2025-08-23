import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Trophy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { LeaderboardEntry } from "@shared/schema";

export default function Leaderboard() {
  const { user: currentUser } = useAuth();

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
    queryFn: async () => {
      const response = await fetch("/api/leaderboard");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  });

  if (leaderboardLoading) {
    return <LeaderboardSkeleton />;
  }

  const displayContestants = leaderboard || [];

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

  // Challenge countdown logic
  const challengeStartDate = new Date('2025-08-04');
  const challengeEndDate = new Date('2025-11-14');
  const today = new Date();
  const daysRemaining = Math.max(0, Math.ceil((challengeEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const totalChallengeDays = Math.ceil((challengeEndDate.getTime() - challengeStartDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.max(0, Math.ceil((today.getTime() - challengeStartDate.getTime()) / (1000 * 60 * 60 * 24)));
  const timeProgressPercent = Math.min(100, Math.max(0, (daysElapsed / totalChallengeDays) * 100));

  // Calculate estimated score based on target goals
  const calculateEstimatedScore = (contestant: ContestantEntry) => {
    if (!contestant.user.targetBodyFatPercent || !contestant.user.targetLeanMass) {
      return '--';
    }

    // Calculate percentage changes from baseline to target
    const currentBodyFat = contestant.baselineScan.bodyFatPercent;
    const currentLeanMass = contestant.baselineScan.leanMass;
    const targetBodyFat = contestant.user.targetBodyFatPercent;
    const targetLeanMass = contestant.user.targetLeanMass;

    // Body fat percentage change (negative means fat loss)
    const bodyFatPercentChange = ((targetBodyFat - currentBodyFat) / currentBodyFat) * 100;
    
    // Lean mass percentage change (positive means muscle gain)
    const leanMassPercentChange = ((targetLeanMass - currentLeanMass) / currentLeanMass) * 100;

    // Calculate fat loss score (10 points per 1% body fat lost, max 50)
    const fatLossScore = bodyFatPercentChange >= 0 ? 0 : Math.min(50, Math.abs(bodyFatPercentChange) * 10);
    
    // Calculate muscle gain score (20 points per 1% lean mass gained, max 50)
    const muscleGainScore = leanMassPercentChange <= 0 ? 0 : Math.min(50, leanMassPercentChange * 20);

    const totalScore = fatLossScore + muscleGainScore;
    return Math.round(totalScore);
  };

  return (
    <div className="max-w-7xl mx-auto mobile-padding pb-20 md:pb-8 prevent-overflow space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <Trophy className="h-8 w-8 text-yellow-500 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">100-Day Recomp Leaderboard v2</h1>
        </div>
        <p className="text-gray-600 mb-2">
          {displayContestants.length} contestant{displayContestants.length !== 1 ? 's' : ''} competing
        </p>
        <Badge className="bg-blue-100 text-blue-800 text-lg px-4 py-2">
          {daysRemaining} days remaining
        </Badge>
      </div>

      {/* Contestants Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200" style={{ minWidth: '1200px' }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '180px' }}>
                  Name
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '100px' }}>
                  Body Fat %
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '100px' }}>
                  Target BF %
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '120px' }}>
                  Lean Mass (lbs)
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '120px' }}>
                  Target LM (lbs)
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-purple-50" style={{ width: '120px' }}>
                  <span className="text-purple-700 font-semibold">Estimated Score</span>
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '140px' }}>
                  Days Left
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayContestants.map((contestant) => {
                const displayName = contestant.user.name || contestant.user.username || 'Anonymous';
                const isCurrentUser = currentUser?.id === contestant.user.id;
                
                return (
                  <tr 
                    key={contestant.user.id} 
                    className={`hover:bg-gray-50 ${isCurrentUser ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10">
                          <AvatarImage 
                            src={undefined} 
                            alt={displayName}
                          />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                            {displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="ml-4">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">{displayName}</div>
                            {isCurrentUser && (
                              <Badge className="ml-2 bg-blue-500 text-white text-xs">You</Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            Baseline: {new Date(contestant.baselineScan.scanDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-lg font-bold text-red-600">
                        {contestant.baselineScan.bodyFatPercent}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-lg font-semibold text-red-500">
                        {contestant.user.targetBodyFatPercent ? `${contestant.user.targetBodyFatPercent}%` : '--'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-lg font-bold text-green-600">
                        {contestant.baselineScan.leanMass} lbs
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-lg font-semibold text-green-500">
                        {contestant.user.targetLeanMass ? `${contestant.user.targetLeanMass} lbs` : '--'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center bg-purple-50 border-l-2 border-r-2 border-purple-200">
                      <div className="text-2xl font-bold text-purple-700">
                        {calculateEstimatedScore(contestant)}
                        {calculateEstimatedScore(contestant) !== '--' && (
                          <div className="text-sm text-purple-600 mt-1 font-semibold">POINTS</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="text-sm font-medium text-gray-900">
                          {daysRemaining} days
                        </div>
                        <div className="w-24">
                          <Progress 
                            value={timeProgressPercent} 
                            className="h-2"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            {Math.round(timeProgressPercent)}% complete
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
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
      
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Body Fat %', 'Target BF %', 'Lean Mass (lbs)', 'Target LM (lbs)', 'Estimated Score', 'Days Left'].map((header) => (
                  <th key={header} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3].map((i) => (
                <tr key={i}>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="ml-4 space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Skeleton className="h-6 w-12 mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Skeleton className="h-6 w-12 mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Skeleton className="h-6 w-16 mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Skeleton className="h-6 w-16 mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Skeleton className="h-6 w-12 mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center space-y-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-2 w-24" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
