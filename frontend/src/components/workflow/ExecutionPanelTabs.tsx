import { Activity, BarChart3, Clock, Search } from 'lucide-react'

type TabType = 'progress' | 'timeline' | 'metrics' | 'logs' | 'results' | 'inspect'

interface ExecutionPanelTabsProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  logsCount: number
  resultsCount: number
}

export function ExecutionPanelTabs({ 
  activeTab, 
  onTabChange, 
  logsCount, 
  resultsCount 
}: ExecutionPanelTabsProps) {
  const getTabClassName = (tab: TabType) => {
    const baseClass = 'px-4 py-2 text-sm font-medium transition-colors'
    const activeClass = 'text-primary border-b-2 border-primary'
    const inactiveClass = 'text-muted-foreground hover:text-foreground'
    
    return `${baseClass} ${activeTab === tab ? activeClass : inactiveClass}`
  }

  return (
    <div className="flex border-b border-border bg-background">
      <button
        onClick={() => onTabChange('progress')}
        className={`${getTabClassName('progress')} flex items-center space-x-1`}
      >
        <Activity className="w-4 h-4" />
        <span>Progress</span>
      </button>
      
      <button
        onClick={() => onTabChange('timeline')}
        className={`${getTabClassName('timeline')} flex items-center space-x-1`}
      >
        <Clock className="w-4 h-4" />
        <span>Timeline</span>
      </button>
      
      <button
        onClick={() => onTabChange('metrics')}
        className={`${getTabClassName('metrics')} flex items-center space-x-1`}
      >
        <BarChart3 className="w-4 h-4" />
        <span>Metrics</span>
      </button>
      
      <button
        onClick={() => onTabChange('logs')}
        className={getTabClassName('logs')}
      >
        Logs ({logsCount})
      </button>
      
      <button
        onClick={() => onTabChange('results')}
        className={getTabClassName('results')}
      >
        Results ({resultsCount})
      </button>
      
      <button
        onClick={() => onTabChange('inspect')}
        className={`${getTabClassName('inspect')} flex items-center space-x-1`}
      >
        <Search className="w-4 h-4" />
        <span>Inspect</span>
      </button>
    </div>
  )
}

export type { TabType }
