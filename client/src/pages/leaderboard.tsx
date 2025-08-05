import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { LeaderboardEntry } from "@shared/schema";

export default function Leaderboard() {
  const { user: currentUser } = useAuth();
  
  const { data: leaderboard, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
  });

  if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No competitors yet</h3>
            <p className="text-gray-600">Be the first to join the challenge!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-orange-400" />;
      default:
        return <span className="text-sm font-bold text-gray-600">#{rank}</span>;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-500 text-white";
      case 2:
        return "bg-gray-400 text-white";
      case 3:
        return "bg-orange-400 text-white";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Trophy className="h-5 w-5 mr-2 text-warning" />
              Leaderboard
            </h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Last updated:</span>
              <span className="text-sm font-medium text-gray-900">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contestant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fat Loss
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Muscle Gain
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboard.map((entry) => {
                const isCurrentUser = currentUser?.id === entry.user.id;
                
                return (
                  <tr 
                    key={entry.user.id} 
                    className={`hover:bg-gray-50 ${isCurrentUser ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Badge className={`${getRankBadgeColor(entry.rank)} w-8 h-8 flex items-center justify-center rounded-full`}>
                          {entry.rank <= 3 ? getRankIcon(entry.rank) : entry.rank}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10">
                          <AvatarImage 
                            src={entry.user.profileImageUrl || undefined} 
                            alt={entry.user.name}
                          />
                          <AvatarFallback>
                            {entry.user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 flex items-center">
                            {entry.user.name}
                            {isCurrentUser && (
                              <Badge className="ml-2 bg-primary text-white">You</Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 capitalize">
                            {entry.user.gender}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        {entry.totalScore.toFixed(1)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {entry.fatLossScore.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {entry.bodyFatChange.toFixed(1)}% BF
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {entry.muscleGainScore.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">
                        +{entry.leanMassChange.toFixed(1)}% LM
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Progress 
                          value={entry.progressPercent} 
                          className="w-16 h-2 mr-2"
                        />
                        <span className="text-xs text-gray-500">
                          {Math.round(entry.progressPercent)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Scoring Transparency */}
      <Card className="mt-8">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Trophy className="h-5 w-5 mr-2 text-primary" />
            Scoring Formula Transparency
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Fat Loss Score (FLS)</h4>
              <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
                FLS = ln(BF%_start / BF%_end) × 100 × Leanness_Multiplier
              </div>
              
              <div className="space-y-2">
                <h5 className="font-medium text-gray-700">Leanness Multipliers</h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Men:</strong>
                    <ul className="mt-1 space-y-1 text-gray-600">
                      <li>≥25% BF: 1.0x</li>
                      <li>21-25%: 1.1x</li>
                      <li>18-20.9%: 1.2x</li>
                      <li>15-17.9%: 1.3x</li>
                      <li>&lt;15%: 1.4x</li>
                    </ul>
                  </div>
                  <div>
                    <strong>Women:</strong>
                    <ul className="mt-1 space-y-1 text-gray-600">
                      <li>≥30% BF: 1.0x</li>
                      <li>26-30%: 1.1x</li>
                      <li>23-25.9%: 1.2x</li>
                      <li>20-22.9%: 1.3x</li>
                      <li>&lt;20%: 1.4x</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Muscle Gain Score (MGS)</h4>
              <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
                MGS = (Lean_Mass_%_Change) × 100 × 17 × Gender_Multiplier
              </div>
              
              <div className="space-y-2">
                <h5 className="font-medium text-gray-700">Gender Multipliers</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li><strong>Men:</strong> 1.0x</li>
                  <li><strong>Women:</strong> 2.0x</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Both scores are normalized across all contestants using min-max normalization (1-100 points). Total Score = FLS + MGS (max 200 points).
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
