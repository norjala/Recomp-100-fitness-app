import { AlertTriangle, Info, Clock } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { classifyScanDate, getCompetitionStatus } from "../../../shared/competition-config"
import type { DexaScan } from "../../../shared/schema"

interface ScanClassificationWarningProps {
  scan?: DexaScan
  scanDate?: Date
  className?: string
}

export function ScanClassificationWarning({ 
  scan, 
  scanDate, 
  className 
}: ScanClassificationWarningProps) {
  const date = scan?.scanDate ? new Date(scan.scanDate) : scanDate
  
  if (!date) return null

  const classification = classifyScanDate(date)
  const competitionStatus = getCompetitionStatus()
  
  // Don't show warning if scan is competition eligible and no warning type
  if (classification.isCompetitionEligible && !classification.warningType) {
    return null
  }

  const getVariant = () => {
    if (!classification.isCompetitionEligible) return "destructive"
    if (classification.warningType) return "warning"
    return "default"
  }

  const getIcon = () => {
    if (!classification.isCompetitionEligible) return <AlertTriangle className="h-4 w-4" />
    if (classification.warningType) return <Info className="h-4 w-4" />
    return <Clock className="h-4 w-4" />
  }

  const getTitle = () => {
    switch (classification.category) {
      case 'historical':
        return "Historical Scan"
      case 'post-challenge':
        return "Post-Challenge Scan"
      default:
        if (classification.warningType === 'pre-challenge') {
          return "Pre-Challenge Scan"
        }
        return "Competition Scan"
    }
  }

  const getBadgeVariant = () => {
    if (!classification.isCompetitionEligible) return "destructive"
    if (classification.warningType) return "secondary"
    return "default"
  }

  return (
    <Alert variant={getVariant()} className={className}>
      {getIcon()}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertTitle>{getTitle()}</AlertTitle>
            <Badge variant={getBadgeVariant()}>
              {classification.isCompetitionEligible ? "Competition Eligible" : "Not Eligible"}
            </Badge>
          </div>
          {classification.message && (
            <AlertDescription>
              {classification.message}
            </AlertDescription>
          )}
          
          {/* Competition status context */}
          <AlertDescription className="text-xs mt-2 opacity-80">
            Competition Status: {competitionStatus.message}
            {competitionStatus.daysRemaining !== undefined && (
              <> • {competitionStatus.daysRemaining} days remaining</>
            )}
            {competitionStatus.daysElapsed !== undefined && (
              <> • Day {competitionStatus.daysElapsed + 1} of 114</>
            )}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  )
}

interface ScanCategoryBadgeProps {
  scan: DexaScan
  className?: string
}

export function ScanCategoryBadge({ scan, className }: ScanCategoryBadgeProps) {
  const getVariant = () => {
    if (!scan.isCompetitionEligible) return "destructive"
    switch (scan.scanCategory) {
      case 'historical':
        return "secondary"
      case 'post-challenge':
        return "secondary"
      default:
        return "default"
    }
  }

  const getLabel = () => {
    switch (scan.scanCategory) {
      case 'historical':
        return "Historical"
      case 'post-challenge':
        return "Post-Challenge"
      default:
        return "Competition"
    }
  }

  return (
    <Badge variant={getVariant()} className={className}>
      {getLabel()}
    </Badge>
  )
}