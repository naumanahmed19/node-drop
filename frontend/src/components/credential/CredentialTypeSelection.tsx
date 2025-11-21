import { Button } from '@/components/ui/button'
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
  onTypeSelect, 
  suggestedTypes = [],
  nodeType 
}: CredentialTypeSelectionProps) {
  const { credentialTypes } = useCredentialStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Categorize credential types
  const categorizedCredentials = useMemo(() => {
    const categories: Record<string, CredentialType[]> = {
      suggested: [],
      google: [],
      microsoft: [],
      communication: [],
      database: [],
      cloud: [],
      generic: [],
      other: []
    }

    credentialTypes.forEach(cred => {
      // Add to suggested if it matches
      if (suggestedTypes.includes(cred.name)) {
        categories.suggested.push(cred)
      }

      // Categorize by name patterns
      const name = cred.name.toLowerCase()
      const displayName = cred.displayName.toLowerCase()
      
      if (name.includes('google') || displayName.includes('google')) {
        categories.google.push(cred)
      } else if (name.includes('microsoft') || name.includes('azure') || displayName.includes('microsoft')) {
        categories.microsoft.push(cred)
      } else if (name.includes('slack') || name.includes('discord') || name.includes('telegram') || name.includes('email') || name.includes('gmail')) {
        categories.communication.push(cred)
      } else if (name.includes('postgres') || name.includes('mysql') || name.includes('mongo') || name.includes('database')) {
        categories.database.push(cred)
      } else if (name.includes('aws') || name.includes('gcp') || name.includes('azure') || name.includes('cloud')) {
        categories.cloud.push(cred)
      } else if (name.includes('oauth') || name.includes('apikey') || name.includes('basic') || name === 'oauth2' || name === 'apiKey' || name === 'httpBasicAuth') {
        categories.generic.push(cred)
      } else {
        categories.other.push(cred)
      }
    })

    // Remove empty categories and return as array
    return Object.entries(categories).filter(([_, creds]) => creds.length > 0)
  }, [credentialTypes, suggestedTypes])

  // Filter credential types based on search term and category
  const filteredCredentials = useMemo(() => {
    const query = searchTerm.toLowerCase()
    
    return categorizedCredentials.map(([category, creds]) => {
      // Filter by category
      if (selectedCategory !== 'all' && category !== selectedCategory) {
        return [category, []] as [string, CredentialType[]]
      }

      // Filter by search query
      const filtered = creds.filter(cred =>
        cred.displayName.toLowerCase().includes(query) ||
        cred.name.toLowerCase().includes(query) ||
        cred.description?.toLowerCase().includes(query)
      )

      return [category, filtered] as [string, CredentialType[]]
    }).filter(([_, creds]) => creds.length > 0)
  }, [categorizedCredentials, searchTerm, selectedCategory])

  const totalResults = filteredCredentials.reduce((sum, [_, creds]) => sum + creds.length, 0)

  return (
    <div className="p-4 space-y-4 h-full flex flex-col">
      <div className="flex-shrink-0">
        <h3 className="text-sm font-medium mb-1">Choose Credential Type</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Select the type of credential you want to create
        </p>
      </div>

      {/* Search input */}
      <div className="relative flex-shrink-0">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search credential types..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Category filters */}
      {categorizedCredentials.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 flex-shrink-0">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
            className="text-xs h-7"
          >
            All
          </Button>
          {categorizedCredentials.map(([category]) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="capitalize text-xs h-7 whitespace-nowrap"
            >
              {category}
            </Button>
          ))}
        </div>
      )}

      {/* Results count */}
      {searchTerm && (
        <div className="text-xs text-muted-foreground flex-shrink-0">
          {totalResults} result{totalResults !== 1 ? 's' : ''} found
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="space-y-4 pr-1">
          {filteredCredentials.length > 0 ? (
            filteredCredentials.map(([category, creds]) => (
              <div key={category}>
                {/* Category header */}
                <h4 className="text-xs font-medium text-muted-foreground mb-2 capitalize sticky top-0 bg-background py-1">
                  {category === 'suggested' ? '⭐ Suggested' : category}
                </h4>
                
                {/* Credential cards */}
                <div className="space-y-2">
                  {creds.map((credType) => (
                    <div
                      key={credType.name}
                      className="group cursor-pointer border border-border rounded-md hover:bg-sidebar-accent hover:border-sidebar-accent transition-colors p-3 w-full overflow-hidden"
                      onClick={() => onTypeSelect(credType)}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-medium flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: credType.color || '#6B7280' }}
                        >
                          {credType.icon || <Key className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <h4 className="text-sm font-medium text-sidebar-foreground group-hover:text-sidebar-accent-foreground truncate">
                            {credType.displayName}
                          </h4>
                          <p className="text-xs text-muted-foreground group-hover:text-sidebar-accent-foreground/80 break-words">
                            {credType.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No credential types found</p>
              <p className="text-xs">Try adjusting your search terms</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
