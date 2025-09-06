import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Trophy,
  Calculator,
  Users,
  TrendingDown,
  TrendingUp,
  Info,
  Target,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  projectScores,
  formatScore,
  type ScoreBreakdown,
} from "@shared/scoring-utils";
import type { LeaderboardEntry } from "@shared/schema";
import { CompetitionStatus } from "@/components/competition-status";

export default function Leaderboard() {
  const { user: currentUser } = useAuth();
  const [showProjectedScores, setShowProjectedScores] = useState(false);

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<
    LeaderboardEntry[]
  >({
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

  const displayEntries = leaderboard || [];

  if (displayEntries.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No contestants yet
            </h3>
            <p className="text-gray-600">
              Upload your first DEXA scan to join the competition!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Challenge countdown logic
  const challengeStartDate = new Date("2025-08-04");
  const challengeEndDate = new Date("2025-11-14");
  const today = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (challengeEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  const totalChallengeDays = Math.ceil(
    (challengeEndDate.getTime() - challengeStartDate.getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const daysElapsed = Math.max(
    0,
    Math.ceil(
      (today.getTime() - challengeStartDate.getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  const timeProgressPercent = Math.min(
    100,
    Math.max(0, (daysElapsed / totalChallengeDays) * 100)
  );

  // Helper function to calculate projected scores for a user
  const calculateProjectedScore = (
    entry: LeaderboardEntry
  ): ScoreBreakdown | null => {
    const { user } = entry;

    // Check if user has target goals set
    if (!user.targetBodyFatPercent || !user.targetLeanMass) {
      return null;
    }

    // We need to get the baseline scan for this user to calculate projections correctly
    // For now, we'll use latestScan as a fallback, but this should ideally use baselineScan
    const baselineScan = entry.latestScan; // TODO: Get actual baseline scan
    
    if (!baselineScan) {
      return null;
    }

    // Use baseline scan for projection (show raw scores, not normalized)
    const scanData = {
      bodyFatPercent: baselineScan.bodyFatPercent,
      leanMass: baselineScan.leanMass,
      totalWeight: baselineScan.totalWeight,
      fatMass: baselineScan.fatMass || undefined,
    };

    return projectScores(
      scanData,
      user.targetBodyFatPercent,
      user.targetLeanMass,
      user.gender || "male",
      undefined // Don't normalize projections - show raw meaningful scores
    );
  };

  return (
    <div className="max-w-7xl mx-auto mobile-padding pb-20 md:pb-8 prevent-overflow space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <Trophy className="h-8 w-8 text-yellow-500 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">
            100-Day Recomp Leaderboard
          </h1>
        </div>
        <p className="text-gray-600 mb-4">
          {displayEntries.length} contestant
          {displayEntries.length !== 1 ? "s" : ""} competing
        </p>
      </div>

      {/* Competition Status */}
      <CompetitionStatus className="mb-6" />

      {/* Toggle Controls */}
      <div className="flex flex-col items-start space-y-3">
        <div className="flex items-center space-x-3 bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm">
          <Target className="h-4 w-4 text-purple-600" />
          <label
            htmlFor="projected-scores-toggle"
            className="text-sm font-medium text-gray-700 cursor-pointer"
          >
            Show Projected Scores
          </label>
          <Switch
            id="projected-scores-toggle"
            checked={showProjectedScores}
            onCheckedChange={setShowProjectedScores}
          />
        </div>
        {showProjectedScores && (
          <div className="text-left">
            <p className="text-sm text-gray-600">
              Projected scores show what your score would be if you achieve your
              target body fat % and lean mass goals.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Set your target goals in the Dashboard to see projections.
            </p>
          </div>
        )}
      </div>

      {/* Leaderboard Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="w-full divide-y divide-gray-200"
            style={{ minWidth: showProjectedScores ? "1600px" : "1200px" }}
          >
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  style={{ width: "180px" }}
                >
                  Name
                </th>
                <th
                  className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                  style={{ width: "100px" }}
                >
                  Body Fat %
                </th>
                {showProjectedScores && (
                  <th
                    className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-50"
                    style={{ width: "110px" }}
                  >
                    <span className="text-red-700 font-semibold">
                      Target BF %
                    </span>
                  </th>
                )}
                <th
                  className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                  style={{ width: "120px" }}
                >
                  Lean Mass (lbs)
                </th>
                {showProjectedScores && (
                  <th
                    className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50"
                    style={{ width: "130px" }}
                  >
                    <span className="text-green-700 font-semibold">
                      Target LM (lbs)
                    </span>
                  </th>
                )}
                {showProjectedScores && (
                  <th
                    className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50"
                    style={{ width: "140px" }}
                  >
                    <span className="text-blue-700 font-semibold">
                      Projected Score
                    </span>
                    <div className="text-xs text-blue-600 mt-1 font-normal">
                      (raw score)
                    </div>
                  </th>
                )}
                <th
                  className={`px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    showProjectedScores ? "bg-purple-50" : "bg-purple-50"
                  }`}
                  style={{ width: "140px" }}
                >
                  <span className="text-purple-700 font-semibold">
                    {showProjectedScores
                      ? "Current Score"
                      : "Competition Score"}
                  </span>
                  <div className="text-xs text-purple-600 mt-1 font-normal">
                    (raw score)
                  </div>
                </th>
                <th
                  className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                  style={{ width: "140px" }}
                >
                  Days Left
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayEntries.map((entry) => {
                const isCurrentUser = currentUser?.id === entry.user.id;
                const currentBodyFat = entry.latestScan?.bodyFatPercent || 0;
                const currentLeanMass = entry.latestScan?.leanMass || 0;

                return (
                  <tr
                    key={entry.user.id}
                    className={`hover:bg-gray-50 ${
                      isCurrentUser
                        ? "bg-blue-50 border-l-4 border-blue-500"
                        : ""
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={undefined}
                            alt={entry.displayName}
                          />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                            {entry.displayName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="ml-4">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">
                              {entry.displayName}
                            </div>
                            {isCurrentUser && (
                              <Badge className="ml-2 bg-blue-500 text-white text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            Baseline:{" "}
                            {entry.latestScan
                              ? new Date(
                                  entry.latestScan.scanDate
                                ).toLocaleDateString()
                              : "N/A"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-medium text-red-600">
                        {currentBodyFat.toFixed(1)}%
                      </span>
                    </td>
                    {showProjectedScores && (
                      <td className="px-3 py-4 whitespace-nowrap text-center bg-red-50">
                        {entry.user.targetBodyFatPercent ? (
                          <span className="text-sm font-medium text-red-700">
                            {entry.user.targetBodyFatPercent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            No target
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-medium text-green-600">
                        {currentLeanMass.toFixed(0)} lbs
                      </span>
                    </td>
                    {showProjectedScores && (
                      <td className="px-3 py-4 whitespace-nowrap text-center bg-green-50">
                        {entry.user.targetLeanMass ? (
                          <span className="text-sm font-medium text-green-700">
                            {entry.user.targetLeanMass.toFixed(0)} lbs
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            No target
                          </span>
                        )}
                      </td>
                    )}
                    {showProjectedScores && (
                      <td className="px-3 py-4 whitespace-nowrap text-center bg-blue-50">
                        {(() => {
                          const projectedScore = calculateProjectedScore(entry);
                          if (!projectedScore) {
                            return (
                              <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-400">
                                  No targets set
                                </span>
                                <span className="text-xs text-blue-600 mt-1">
                                  Set goals in Dashboard
                                </span>
                              </div>
                            );
                          }
                          return (
                            <div className="flex flex-col items-center">
                              <span className="text-xl font-bold text-blue-700">
                                {Math.round(projectedScore.totalScore)}
                              </span>
                              <span className="text-xs text-blue-600 font-medium">
                                PTS
                              </span>
                              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                <div>
                                  FLS: {Math.round(projectedScore.fatLossScore)}
                                </div>
                                <div>
                                  MGS:{" "}
                                  {Math.round(projectedScore.muscleGainScore)}
                                </div>
                              </div>
                              <Badge className="mt-1 bg-blue-100 text-blue-700 text-xs">
                                PROJECTED
                              </Badge>
                            </div>
                          );
                        })()}
                      </td>
                    )}
                    <td className="px-3 py-4 whitespace-nowrap text-center bg-purple-50">
                      <div className="flex flex-col items-center">
                        <span className="text-xl font-bold text-purple-700">
                          {Math.round(entry.totalScore)}
                        </span>
                        <span className="text-xs text-purple-600 font-medium">
                          PTS
                        </span>
                        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                          <div>FLS: {Math.round(entry.fatLossScore)}</div>
                          <div>MGS: {Math.round(entry.muscleGainScore)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-medium text-gray-900">
                          {daysRemaining} days
                        </span>
                        <Progress
                          value={timeProgressPercent}
                          className="w-20 h-2 mt-1"
                        />
                        <span className="text-xs text-gray-500 mt-1">
                          {Math.round(timeProgressPercent)}% complete
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

      {/* Scoring Explanation Section */}
      <Card className="border-2 border-blue-100 bg-blue-50/30">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mb-3">
              <Calculator className="h-6 w-6 text-blue-600 mr-2" />
              <h2 className="text-xl font-bold text-gray-900">
                How Scores Are Calculated
              </h2>
            </div>
            <p className="text-gray-600 max-w-3xl mx-auto">
              Our scoring system rewards both fat loss and muscle gain based on
              percentage improvements from your baseline scan.
            </p>
          </div>

          {/* Formula Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="text-center p-4 bg-white rounded-lg border border-blue-200">
              <div className="bg-purple-100 rounded-full p-3 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                <Trophy className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Total Score</h3>
              <p className="text-sm text-gray-600 mb-2">
                Fat Loss Score + Muscle Gain Score
              </p>
              <Badge className="bg-purple-100 text-purple-800 font-bold">
                Maximum: 100 Points
              </Badge>
            </div>

            <div className="text-center p-4 bg-white rounded-lg border border-red-200">
              <div className="bg-red-100 rounded-full p-3 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                <TrendingDown className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Fat Loss Score (FLS)
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                ln(BF%_start / BF%_end) × 100 × Leanness_Multiplier
              </p>
              <Badge className="bg-red-100 text-red-800 font-bold">
                Maximum: 100 Points
              </Badge>
            </div>

            <div className="text-center p-4 bg-white rounded-lg border border-green-200">
              <div className="bg-green-100 rounded-full p-3 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Muscle Gain Score (MGS)
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                (Lean_Mass_%_Change) × 17 × Gender_Multiplier
              </p>
              <Badge className="bg-green-100 text-green-800 font-bold">
                Maximum: 100 Points
              </Badge>
            </div>
          </div>

          {/* Gender Bonus */}
          <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <Users className="h-5 w-5 text-pink-600 mr-3 mt-0.5" />
              <div>
                <h4 className="font-semibold text-pink-900 mb-1">
                  Gender Multipliers
                </h4>
                <p className="text-sm text-pink-800">
                  <strong>Women: 2.0x</strong> multiplier for muscle gain •{" "}
                  <strong>Men: 1.0x</strong> baseline
                  <br />
                  Acknowledges the increased difficulty of building lean muscle
                  mass for women.
                </p>
              </div>
            </div>
          </div>

          {/* Leanness Multiplier Tables */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
            <div className="flex items-start mb-3">
              <TrendingDown className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-900 mb-1">
                  Leanness Multipliers (Fat Loss Score)
                </h4>
                <p className="text-sm text-yellow-800">
                  Lower baseline body fat percentages receive higher
                  multipliers, rewarding contestants who start leaner.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Men's Table */}
              <div className="bg-white rounded-lg border border-yellow-300 p-4">
                <h5 className="font-semibold text-blue-900 mb-3 text-center">
                  Men
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 px-2 bg-blue-50 rounded">
                    <span className="font-medium">&lt; 15% BF</span>
                    <span className="font-bold text-blue-600">1.4x</span>
                  </div>
                  <div className="flex justify-between py-1 px-2">
                    <span>15.0% - 18% BF</span>
                    <span className="font-bold">1.3x</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 bg-gray-50 rounded">
                    <span>18.0% - 21% BF</span>
                    <span className="font-bold">1.2x</span>
                  </div>
                  <div className="flex justify-between py-1 px-2">
                    <span>21.0% - 25% BF</span>
                    <span className="font-bold">1.1x</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 bg-gray-100 rounded">
                    <span>≥ 25.0% BF</span>
                    <span className="font-bold text-gray-600">1.0x</span>
                  </div>
                </div>
              </div>

              {/* Women's Table */}
              <div className="bg-white rounded-lg border border-yellow-300 p-4">
                <h5 className="font-semibold text-pink-900 mb-3 text-center">
                  Women
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 px-2 bg-pink-50 rounded">
                    <span className="font-medium">&lt; 20% BF</span>
                    <span className="font-bold text-pink-600">1.4x</span>
                  </div>
                  <div className="flex justify-between py-1 px-2">
                    <span>20.0% - 23% BF</span>
                    <span className="font-bold">1.3x</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 bg-gray-50 rounded">
                    <span>23.0% - 26% BF</span>
                    <span className="font-bold">1.2x</span>
                  </div>
                  <div className="flex justify-between py-1 px-2">
                    <span>26.0% - 30% BF</span>
                    <span className="font-bold">1.1x</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 bg-gray-100 rounded">
                    <span>≥ 30.0% BF</span>
                    <span className="font-bold text-gray-600">1.0x</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Examples */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Men's Example */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
              <div className="flex items-center mb-4">
                <div className="bg-blue-600 text-white rounded-full p-2 mr-3">
                  <span className="text-sm font-bold">👨</span>
                </div>
                <h3 className="font-bold text-blue-900">Men's Example</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Baseline Body Fat:</span>
                  <span className="font-medium">20.0%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Latest Body Fat:</span>
                  <span className="font-medium text-red-600">18.0% (-2%)</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-700">Fat Loss Score:</span>
                  <span className="font-bold text-red-600">10.8 points</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>ln(20/18) × 100 × 1.0 =</span>
                  <span>10.8</span>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Baseline Lean Mass:</span>
                    <span className="font-medium">140.0 lbs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Latest Lean Mass:</span>
                    <span className="font-medium text-green-600">
                      141.4 lbs (+1%)
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-700">Muscle Gain Score:</span>
                    <span className="font-bold text-green-600">
                      17.0 points
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1% × 17 × 1.0 =</span>
                    <span>17.0</span>
                  </div>
                </div>

                <div className="border-t-2 border-blue-300 pt-3 mt-4">
                  <div className="flex justify-between text-lg">
                    <span className="font-bold text-blue-900">
                      Total Score:
                    </span>
                    <span className="font-bold text-blue-600">27.8 points</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Women's Example */}
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-5">
              <div className="flex items-center mb-4">
                <div className="bg-pink-600 text-white rounded-full p-2 mr-3">
                  <span className="text-sm font-bold">👩</span>
                </div>
                <h3 className="font-bold text-pink-900">Women's Example</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Baseline Body Fat:</span>
                  <span className="font-medium">25.0%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Latest Body Fat:</span>
                  <span className="font-medium text-red-600">
                    23.5% (-1.5%)
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-700">Fat Loss Score:</span>
                  <span className="font-bold text-red-600">6.3 points</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>ln(25/23.5) × 100 × 1.0 =</span>
                  <span>6.3</span>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Baseline Lean Mass:</span>
                    <span className="font-medium">110.0 lbs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Latest Lean Mass:</span>
                    <span className="font-medium text-green-600">
                      110.9 lbs (+0.8%)
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-700">Muscle Gain Score:</span>
                    <span className="font-bold text-green-600">
                      27.2 points
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0.8% × 17 × 2.0 =</span>
                    <span>27.2</span>
                  </div>
                </div>

                <div className="border-t-2 border-pink-300 pt-3 mt-4">
                  <div className="flex justify-between text-lg">
                    <span className="font-bold text-pink-900">
                      Total Score:
                    </span>
                    <span className="font-bold text-pink-600">33.5 points</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Important Notes */}
          <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-gray-600 mr-3 mt-0.5" />
              <div className="text-sm text-gray-700">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Important Notes:
                </h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>
                    Scores are calculated based on{" "}
                    <strong>percentage improvements</strong> from your baseline
                    scan
                  </li>
                  <li>
                    You need at least 1 scan to appear on the leaderboard, and 2 scans (baseline + progress) to receive a competition score
                  </li>
                  <li>
                    Only improvements count - fat gain or muscle loss score 0
                    points
                  </li>
                  <li>
                    Theoretical maximum is ~250 points, but typical excellent
                    scores are 50-150 points
                  </li>
                  <li>
                    Scores update automatically when you upload new DEXA scans
                  </li>
                </ul>
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
    <div className="max-w-7xl mx-auto mobile-padding pb-20 md:pb-8 prevent-overflow space-y-6">
      <div className="text-center space-y-4">
        <Skeleton className="h-10 w-96 mx-auto" />
        <Skeleton className="h-6 w-48 mx-auto" />
        <Skeleton className="h-8 w-32 mx-auto" />
      </div>
      <Card>
        <div className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
