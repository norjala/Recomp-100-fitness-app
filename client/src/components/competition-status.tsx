import { Calendar, Clock, Trophy } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getCompetitionStatus } from "../../../shared/competition-config"

interface CompetitionStatusProps {
  className?: string
}

export function CompetitionStatus({ className }: CompetitionStatusProps) {
  const status = getCompetitionStatus()
  
  const getStatusIcon = () => {
    switch (status.status) {
      case 'not-started':
        return <Calendar className="h-4 w-4" />
      case 'active':
        return <Clock className="h-4 w-4" />
      case 'ended':
        return <Trophy className="h-4 w-4" />
    }
  }

  const getStatusBadge = () => {
    switch (status.status) {
      case 'not-started':
        return <Badge variant="secondary">Upcoming</Badge>
      case 'active':
        return <Badge variant="default">Active</Badge>
      case 'ended':
        return <Badge variant="destructive">Ended</Badge>
    }
  }

  const getProgressValue = () => {
    if (status.status !== 'active' || !status.daysElapsed) return 0
    const totalDays = 114 // 100-day challenge is actually 114 days (Aug 4 - Nov 26)
    return Math.round((status.daysElapsed / totalDays) * 100)
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {getStatusIcon()}
          Competition Status
        </CardTitle>
        {getStatusBadge()}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{status.message}</div>
        
        {status.status === 'active' && status.daysElapsed !== undefined && status.daysRemaining !== undefined && (
          <>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Day {status.daysElapsed + 1} of 114</span>
              <span>{status.daysRemaining} days left</span>
            </div>
            <Progress value={getProgressValue()} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Challenge Period: August 4, 2025 - November 26, 2025
            </p>
          </>
        )}
        
        {status.status === 'not-started' && (
          <p className="text-xs text-muted-foreground mt-2">
            Challenge starts August 4, 2025
          </p>
        )}
        
        {status.status === 'ended' && (
          <p className="text-xs text-muted-foreground mt-2">
            Challenge ended November 26, 2025
          </p>
        )}
      </CardContent>
    </Card>
  )
}