import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { DexaScan } from "@shared/schema";

interface ScanComparisonProps {
  baselineScan: DexaScan;
  latestScan: DexaScan;
}

export function ScanComparison({ baselineScan, latestScan }: ScanComparisonProps) {
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateChange = (current: number, baseline: number) => {
    return current - baseline;
  };

  const calculatePercentChange = (current: number, baseline: number) => {
    return ((current - baseline) / baseline) * 100;
  };

  const getChangeIcon = (change: number, isReverse = false) => {
    const isPositive = isReverse ? change < 0 : change > 0;
    if (Math.abs(change) < 0.01) return <Minus className="h-3 w-3" />;
    return isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const getChangeColor = (change: number, isReverse = false) => {
    const isPositive = isReverse ? change < 0 : change > 0;
    if (Math.abs(change) < 0.01) return "text-gray-500";
    return isPositive ? "text-success" : "text-destructive";
  };

  const bodyFatChange = calculateChange(latestScan.bodyFatPercent, baselineScan.bodyFatPercent);
  const bodyFatPercentChange = calculatePercentChange(latestScan.bodyFatPercent, baselineScan.bodyFatPercent);
  const leanMassChange = calculateChange(latestScan.leanMass, baselineScan.leanMass);
  const leanMassPercentChange = calculatePercentChange(latestScan.leanMass, baselineScan.leanMass);
  const weightChange = calculateChange(latestScan.totalWeight, baselineScan.totalWeight);

  return (
    <div>
      <h5 className="text-lg font-medium text-gray-900 mb-4">Baseline vs Latest Comparison</h5>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h6 className="font-medium text-gray-900">
                Baseline ({formatDate(baselineScan.scanDate)})
              </h6>
              <Badge variant="secondary">Baseline</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Body Fat %</span>
                <span className="font-medium">{baselineScan.bodyFatPercent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Lean Mass</span>
                <span className="font-medium">{baselineScan.leanMass.toFixed(1)} lbs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Weight</span>
                <span className="font-medium">{baselineScan.totalWeight.toFixed(1)} lbs</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h6 className="font-medium text-gray-900">
                Latest ({formatDate(latestScan.scanDate)})
              </h6>
              <Badge className="bg-success text-white">Latest</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Body Fat %</span>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{latestScan.bodyFatPercent.toFixed(1)}%</span>
                  <span className={`text-sm flex items-center ${getChangeColor(bodyFatChange, true)}`}>
                    {getChangeIcon(bodyFatChange, true)}
                    {bodyFatChange.toFixed(1)}% ({bodyFatPercentChange.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Lean Mass</span>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{latestScan.leanMass.toFixed(1)} lbs</span>
                  <span className={`text-sm flex items-center ${getChangeColor(leanMassChange)}`}>
                    {getChangeIcon(leanMassChange)}
                    {leanMassChange.toFixed(1)} lbs ({leanMassPercentChange.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Weight</span>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{latestScan.totalWeight.toFixed(1)} lbs</span>
                  <span className={`text-sm flex items-center ${getChangeColor(weightChange, true)}`}>
                    {getChangeIcon(weightChange, true)}
                    {weightChange.toFixed(1)} lbs
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
