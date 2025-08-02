import { useQuery } from "@tanstack/react-query";
import { Chart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { DexaScan } from "@shared/schema";

interface ProgressChartProps {
  userId: string;
}

export function ProgressChart({ userId }: ProgressChartProps) {
  const { data: scans, isLoading } = useQuery<DexaScan[]>({
    queryKey: ["/api/users", userId, "scans"],
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!scans || scans.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <p>No scan data available for chart</p>
      </div>
    );
  }

  // Sort scans by date and prepare chart data
  const sortedScans = [...scans].sort((a, b) => 
    new Date(a.scanDate).getTime() - new Date(b.scanDate).getTime()
  );

  const chartData = sortedScans.map((scan, index) => ({
    date: new Date(scan.scanDate).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    bodyFat: scan.bodyFatPercent,
    leanMass: scan.leanMass,
    weight: scan.totalWeight,
    week: `Week ${Math.floor(index / 7) + 1}`,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis 
            dataKey="date" 
            className="text-xs"
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            className="text-xs"
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="bodyFat" 
            stroke="hsl(var(--destructive))" 
            strokeWidth={2}
            name="Body Fat %"
            dot={{ fill: "hsl(var(--destructive))", strokeWidth: 2 }}
          />
          <Line 
            type="monotone" 
            dataKey="leanMass" 
            stroke="hsl(var(--secondary))" 
            strokeWidth={2}
            name="Lean Mass (lbs)"
            dot={{ fill: "hsl(var(--secondary))", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="mt-4 flex justify-center space-x-6">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-destructive rounded-full mr-2"></div>
          <span className="text-sm text-gray-600">Body Fat %</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-secondary rounded-full mr-2"></div>
          <span className="text-sm text-gray-600">Lean Mass (lbs)</span>
        </div>
      </div>
    </div>
  );
}
