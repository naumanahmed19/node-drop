import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, Search } from 'lucide-react'

interface NodesHeaderProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  nodeCount: number
  searchTerm: string
  setSearchTerm: (term: string) => void
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function NodesHeader({ 
  activeTab, 
  setActiveTab, 
  searchTerm,
  setSearchTerm,
  onRefresh,
  isRefreshing = false
}: NodesHeaderProps) {
  return (
    <div className="space-y-3">
      {/* Title and tabs */}
      <div className="flex items-center justify-between gap-2">
        {/* <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Nodes ({nodeCount})
        </span> */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto flex-1">
          <TabsList className="grid grid-cols-3 h-6 p-0 bg-muted">
            <TabsTrigger 
              value="available" 
              className="text-xs px-2 h-6 data-[state=active]:bg-background"
            >
              Installed
            </TabsTrigger>
            <TabsTrigger 
              value="marketplace" 
              className="text-xs px-2 h-6 data-[state=active]:bg-background"
            >
              Marketplace
            </TabsTrigger>
            <TabsTrigger 
              value="upload" 
              className="text-xs px-2 h-6 data-[state=active]:bg-background"
            >
              Upload
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Search input with refresh button */}
      {(activeTab === 'available' || activeTab === 'marketplace') && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={activeTab === 'available' ? "Search installed nodes..." : "Search marketplace..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          {/* Action buttons */}
          {onRefresh && activeTab === 'available' && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
