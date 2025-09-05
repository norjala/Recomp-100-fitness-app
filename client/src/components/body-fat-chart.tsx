import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Percent } from "lucide-react";
import type { DexaScan } from "@shared/schema";

interface BodyFatChartProps {
  userId: string;
}

export function BodyFatChart({ userId }: BodyFatChartProps) {
  const { data: scans, isLoading } = useQuery<DexaScan[]>({
    queryKey: ["/api/users", userId, "scans"],
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!scans || scans.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Percent className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>No body fat data available for chart</p>
        </div>
      </div>
    );
  }

  // Sort scans by date and prepare chart data
  const sortedScans = [...scans].sort((a, b) => 
    new Date(a.scanDate).getTime() - new Date(b.scanDate).getTime()
  );

  const chartData = sortedScans.map((scan) => ({
    date: new Date(scan.scanDate).toLocaleDateString('en-US', { 
      month: 'short', 
      year: '2-digit'
    }),
    bodyFat: scan.bodyFatPercent,
    fullDate: new Date(scan.scanDate).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
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
            domain={['dataMin - 1', 'dataMax + 1']}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
            formatter={(value, name) => [
              `${(value as number).toFixed(1)}%`,
              name
            ]}
            labelFormatter={(label, payload) => 
              payload?.[0]?.payload?.fullDate || label
            }
          />
          <Line 
            type="monotone" 
            dataKey="bodyFat" 
            stroke="hsl(var(--destructive))" 
            strokeWidth={3}
            name="Body Fat %"
            dot={{ fill: "hsl(var(--destructive))", strokeWidth: 2, r: 5 }}
            activeDot={{ r: 7, stroke: "hsl(var(--destructive))", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="mt-4 flex justify-center">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-destructive rounded-full mr-2"></div>
          <span className="text-sm text-gray-600">Body Fat Percentage</span>
        </div>
      </div>
    </div>
  );
}