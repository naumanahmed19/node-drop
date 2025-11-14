import { NodeIconRenderer } from '@/components/common/NodeIconRenderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { useCustomNodeStore } from '@/stores/customNode'
import { NodePackageMetadata } from '@/types/customNode'
import {
  Command,
  Download,
  ExternalLink
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'


interface NodeMarketplaceProps {
  searchTerm?: string
  sortBy?: 'downloads' | 'rating' | 'updated' | 'relevance'
  sortOrder?: 'asc' | 'desc'
  selectedCategory?: string
  onCategoriesChange?: (categories: string[]) => void
  onRefreshNodes?: () => Promise<void>
}

export function NodeMarketplace({
  searchTerm = "",
  sortBy = 'downloads',
  sortOrder = 'desc',
  selectedCategory = 'all',
  onCategoriesChange,
  onRefreshNodes
}: NodeMarketplaceProps) {
  const {
    searchMarketplace,
    installPackage,
    loadPackages,
    searchResults,
    searchLoading,
    error
  } = useCustomNodeStore()


  const [installingNodes, setInstallingNodes] = useState<Set<string>>(new Set())
  const [hasSearched, setHasSearched] = useState(false)



  // Load marketplace data on mount and when search parameters change
  useEffect(() => {
    const loadMarketplace = async () => {
      try {
        await searchMarketplace({
          query: searchTerm || undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          sortBy,
          sortOrder,
          limit: 20 // Default to 20 nodes
        })
        setHasSearched(true)
      } catch (error) {
        setHasSearched(true)
      }
    }

    loadMarketplace()
  }, [searchTerm, selectedCategory, sortBy, sortOrder, searchMarketplace])



  // Get unique categories from search results
  const categories = useMemo(() => {
    if (!searchResults?.packages) return []
    const cats = [...new Set(searchResults.packages.map(pkg => {
      // Extract category from keywords or use first keyword
      return pkg.keywords?.[0] || 'Other'
    }))]
    return cats.sort()
  }, [searchResults])

  // Update parent with categories when they change
  useEffect(() => {
    if (onCategoriesChange) {
      onCategoriesChange(categories)
    }
  }, [categories, onCategoriesChange])



  // Handle node installation
  const handleInstall = async (pkg: NodePackageMetadata) => {
    setInstallingNodes(prev => new Set(prev).add(pkg.id))

    try {
      const result = await installPackage(pkg.id)

      if (result && !result.success) {
        alert(`Installation failed: ${result.errors?.join(', ') || 'Unknown error'}`)
      } else {

        // Refresh the installed packages in the store
        await loadPackages()

        // Refresh the installed nodes list
        if (onRefreshNodes) {
          await onRefreshNodes()
        }

        // Then refresh marketplace to update installation status
        // This needs to happen after the nodes are refreshed so the backend
        // can properly check which nodes are installed
        await searchMarketplace({
          query: searchTerm || undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          sortBy,
          sortOrder,
          limit: 20
        })
      }
    } catch (error) {
      alert(`Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setInstallingNodes(prev => {
        const newSet = new Set(prev)
        newSet.delete(pkg.id)
        return newSet
      })
    }
  }

  // Handle node update
  const handleUpdate = async (pkg: NodePackageMetadata) => {
    setInstallingNodes(prev => new Set(prev).add(pkg.id))

    try {
      const result = await installPackage(pkg.id, { force: true })

      if (result && !result.success) {
        alert(`Update failed: ${result.errors?.join(', ') || 'Unknown error'}`)
      } else {

        // Refresh the installed packages in the store
        await loadPackages()

        // Refresh the installed nodes list
        if (onRefreshNodes) {
          await onRefreshNodes()
        }

        // Then refresh marketplace to update installation status
        await searchMarketplace({
          query: searchTerm || undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          sortBy,
          sortOrder,
          limit: 20
        })
      }
    } catch (error) {
      alert(`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setInstallingNodes(prev => {
        const newSet = new Set(prev)
        newSet.delete(pkg.id)
        return newSet
      })
    }
  }



  // Render loading state
  if (searchLoading && !hasSearched) {
    return (
      <div className="p-4">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="animate-pulse">
                <div className="w-8 h-8 bg-muted rounded-lg"></div>
              </div>
              <div className="animate-pulse flex-1">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Render error state
  if (error && hasSearched) {
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground">
          <Command className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => searchMarketplace({})}
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  // Render empty state
  if ((!searchResults?.packages || searchResults.packages.length === 0) && hasSearched) {
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground">
          <Download className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm mb-2">
            {searchTerm ? 'No nodes match your search' : 'No nodes available in marketplace'}
          </p>
        </div>
      </div>
    )
  }

  // Render marketplace nodes in sidebar-style layout
  return (
    <div className="p-0">


      {/* Search Results Summary */}

      {searchTerm && hasSearched && searchResults?.packages && searchResults.packages.length > 0 && (
        <div className="px-4 py-2 border-b bg-muted/20">
          <div className="text-xs text-muted-foreground">
            {searchTerm && (
              <>Showing {searchResults.packages.length} of {searchResults.total} results for "{searchTerm}"</>
            )}
            {selectedCategory !== 'all' && (
              <> in {selectedCategory}</>
            )}
          </div>
        </div>
      )}

      {/* Results in flat list */}
      <div className="p-3 space-y-0">
        {searchResults?.packages?.map((pkg) => {
          const isInstalling = installingNodes.has(pkg.id)

          return (
            <div
              key={pkg.id}
              className="bg-card hover:bg-sidebar-accent hover:text-sidebar-accent-foreground p-3 text-sm leading-tight border border-border rounded-md mb-2 cursor-pointer group min-h-16 transition-colors"
            >
              <div className="flex items-start gap-3 mb-2">
                {pkg.iconUrl ? (
                  <div className="w-8 h-8 shrink-0 mt-0.5 flex items-center justify-center">
                    <img
                      src={pkg.iconUrl}
                      alt={pkg.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        // Fallback to NodeIconRenderer if image fails to load
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = '';
                      }}
                    />
                  </div>
                ) : (
                  <NodeIconRenderer
                    icon={pkg.icon || pkg.keywords?.[0]}
                    nodeType={pkg.name}
                    nodeGroup={pkg.keywords || []}
                    displayName={pkg.name}
                    backgroundColor="hsl(var(--primary))"
                    size="md"
                    className="shrink-0 mt-0.5"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="font-medium break-words">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="break-words">{pkg.name}</span>
                      {pkg.verified && (
                        <Badge variant="secondary" className="text-xs h-4 px-1 shrink-0">
                          ✓
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs h-4 px-1 shrink-0">
                        v{pkg.version}
                      </Badge>
                    </div>
                  </div>

                  {pkg.description && (
                    <div
                      className="text-xs text-muted-foreground leading-relaxed mt-1"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        wordBreak: 'break-word',
                        hyphens: 'auto'
                      }}
                    >
                      {pkg.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Buttons at bottom */}
              <div className="flex gap-2 items-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const url = pkg.homepage || pkg.repository || `https://npmjs.com/package/${pkg.name}`
                    window.open(url, '_blank')
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  title="View Package"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>

                {pkg.installed ? (
                  pkg.hasUpdate ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUpdate(pkg)
                      }}
                      disabled={isInstalling}
                      className="flex h-6 items-center justify-center gap-1 rounded-md bg-orange-600 px-2 text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                      title={isInstalling ? 'Updating...' : `Update to v${pkg.version}`}
                    >
                      {isInstalling ? (
                        <>
                          <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs">Updating</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-3 w-3" />
                          <span className="text-xs">Update</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex h-6 items-center justify-center gap-1 rounded-md bg-green-600 px-2 text-white">
                      <span className="text-xs">✓ Installed</span>
                    </div>
                  )
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleInstall(pkg)
                    }}
                    disabled={isInstalling}
                    className="flex h-6 items-center justify-center gap-1 rounded-md bg-primary px-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    title={isInstalling ? 'Installing...' : 'Install Package'}
                  >
                    {isInstalling ? (
                      <>
                        <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Installing</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        <span className="text-xs">Install</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
