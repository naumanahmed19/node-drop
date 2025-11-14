import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw } from 'lucide-react'

interface ScheduledExecutionsHeaderProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  activeCount: number
  pausedCount: number
  failedCount: number
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function ScheduledExecutionsHeader({ 
  activeTab, 
  setActiveTab, 
  activeCount,
  pausedCount,
  failedCount,
  onRefresh,
  isRefreshing = false
}: ScheduledExecutionsHeaderProps) {
  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex items-center justify-between gap-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto flex-1">
          <TabsList className="grid grid-cols-3 h-6 p-0 bg-muted">
            <TabsTrigger 
              value="active" 
              className="text-xs px-2 h-6 data-[state=active]:bg-background"
            >
              Active ({activeCount})
            </TabsTrigger>
            <TabsTrigger 
              value="paused" 
              className="text-xs px-2 h-6 data-[state=active]:bg-background"
            >
              Paused ({pausedCount})
            </TabsTrigger>
            <TabsTrigger 
              value="failed" 
              className="text-xs px-2 h-6 data-[state=active]:bg-background"
            >
              Failed ({failedCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
    </div>
  )
}
