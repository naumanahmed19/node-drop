import { Input } from '@/components/ui/input'
import { useCredentialStore } from '@/stores'
import { CredentialType } from '@/types'
import { Key, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

interface CredentialTypeSelectionProps {
  onTypeSelect: (credentialType: CredentialType) => void
  suggestedTypes?: string[] // Suggested credential types for this context
  nodeType?: string // Node type for context-specific filtering
}

export function CredentialTypeSelection({ 
  onTypeSelect 
}: CredentialTypeSelectionProps) {
  const { credentialTypes } = useCredentialStore()
  const [searchTerm, setSearchTerm] = useState('')

  // Filter credential types based on search term only
  const filteredCredentials = useMemo(() => {
    const query = searchTerm.toLowerCase()
    
    if (!query) {
      return credentialTypes
    }
    
    return credentialTypes.filter(cred =>
      cred.displayName.toLowerCase().includes(query) ||
      cred.name.toLowerCase().includes(query) ||
      cred.description?.toLowerCase().includes(query)
    )
  }, [credentialTypes, searchTerm])

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-4 pb-0">
        <h3 className="text-sm font-medium mb-1">Choose Credential Type</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Select the type of credential you want to create
        </p>

        {/* Search input */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search credential types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Results count */}
        {searchTerm && (
          <div className="text-xs text-muted-foreground mb-3">
            {filteredCredentials.length} result{filteredCredentials.length !== 1 ? 's' : ''} found
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {filteredCredentials.length > 0 ? (
          <div className="p-3">
            {filteredCredentials.map((credType, index) => (
              <div
                key={credType.name}
                className={`bg-card hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-start gap-3 p-3 text-sm leading-tight border border-border rounded-md cursor-pointer group min-h-16 transition-colors ${index < filteredCredentials.length - 1 ? 'mb-2' : ''}`}
                onClick={() => onTypeSelect(credType)}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-medium flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: credType.color || '#6B7280' }}
                >
                  {credType.icon || <Key className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="font-medium">
                    <span className="break-words min-w-0" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                      {credType.displayName}
                    </span>
                  </div>
                  {credType.description && (
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
                      {credType.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <div className="text-center text-muted-foreground">
              <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No credential types found</p>
              <p className="text-xs">Try adjusting your search terms</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
