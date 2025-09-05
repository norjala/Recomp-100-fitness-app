import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Dumbbell } from "lucide-react";
import type { DexaScan } from "@shared/schema";

interface LeanMassChartProps {
  userId: string;
}

export function LeanMassChart({ userId }: LeanMassChartProps) {
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
          <Dumbbell className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>No lean mass data available for chart</p>
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
    leanMass: scan.leanMass,
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
            domain={['dataMin - 5', 'dataMax + 5']}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
            formatter={(value, name) => [
              `${(value as number).toFixed(1)} lbs`,
              name
            ]}
            labelFormatter={(label, payload) => 
              payload?.[0]?.payload?.fullDate || label
            }
          />
          <Line 
            type="monotone" 
            dataKey="leanMass" 
            stroke="hsl(var(--secondary))" 
            strokeWidth={3}
            name="Lean Mass"
            dot={{ fill: "hsl(var(--secondary))", strokeWidth: 2, r: 5 }}
            activeDot={{ r: 7, stroke: "hsl(var(--secondary))", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="mt-4 flex justify-center">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-secondary rounded-full mr-2"></div>
          <span className="text-sm text-gray-600">Lean Mass (lbs)</span>
        </div>
      </div>
    </div>
  );
}