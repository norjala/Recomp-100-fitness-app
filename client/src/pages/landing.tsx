import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, TrendingUp, Users, Target } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-secondary">
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="text-center text-white mb-12">
          <div className="flex items-center justify-center mb-6">
            <Trophy className="h-16 w-16 mr-4" />
            <h1 className="text-6xl font-bold">💯 Day Recomp</h1>
          </div>
          <p className="text-xl mb-8 max-w-2xl">
            Join the ultimate 100-day body recomposition competition. Track your progress with DEXA scans, 
            compete with others, and transform your body with science-backed scoring.
          </p>
          <Button
            onClick={handleLogin}
            size="lg"
            className="bg-white text-primary hover:bg-gray-100 text-xl px-8 py-4"
          >
            Join the Challenge
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="p-6 text-center text-white">
              <TrendingUp className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Scientific Tracking</h3>
              <p className="text-sm opacity-90">
                Use DEXA scans for the most accurate body composition measurements
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="p-6 text-center text-white">
              <Users className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Fair Competition</h3>
              <p className="text-sm opacity-90">
                Gender-specific scoring algorithms ensure fair competition for everyone
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="p-6 text-center text-white">
              <Target className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Real Results</h3>
              <p className="text-sm opacity-90">
                100-day challenge designed for maximum fat loss and muscle gain
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
