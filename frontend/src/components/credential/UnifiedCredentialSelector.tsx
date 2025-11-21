import { AutoComplete, AutoCompleteOption } from '@/components/ui/autocomplete'
import { useCredentialStore } from '@/stores'
import { Credential } from '@/types'
import { Key, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CredentialModal } from './CredentialModal'

interface UnifiedCredentialSelectorProps {
  allowedTypes: string[] // Array of credential type names (e.g., ['httpBasicAuth', 'apiKey'])
  value?: string // Selected credential ID
  onChange: (credentialId: string | undefined) => void
  placeholder?: string
  description?: string
  required?: boolean
  error?: string
  disabled?: boolean
  nodeType?: string // Node type for context-specific defaults
}

export function UnifiedCredentialSelector({
  allowedTypes,
  value,
  onChange,
  placeholder = 'Select authentication...',
  description,
  required = false,
  error,
  disabled = false,
  nodeType
}: UnifiedCredentialSelectorProps) {
  const {
    credentials,
    credentialTypes,
    fetchCredentials,
    fetchCredentialTypes,
    isLoading
  } = useCredentialStore()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCredentialType, setSelectedCredentialType] = useState<string | null>(null)
  const [isFetchingTypes, setIsFetchingTypes] = useState(false)

  // Fetch credentials and types on mount
  useEffect(() => {
    const fetchData = async () => {
      if (credentials.length === 0) {
        fetchCredentials()
      }
      if (credentialTypes.length === 0) {
        setIsFetchingTypes(true)
        await fetchCredentialTypes()
        setIsFetchingTypes(false)
      }
    }
    fetchData()
  }, [credentials.length, credentialTypes.length, fetchCredentials, fetchCredentialTypes])

  // Check if credential types are ready
  const isCredentialTypesReady = credentialTypes.length > 0 && !isFetchingTypes

  // Filter credentials that match any of the allowed types
  const availableCredentials = useMemo(() => {
    return credentials.filter(cred => allowedTypes.includes(cred.type))
  }, [credentials, allowedTypes])

  // Convert credentials to AutoComplete options
  const options: AutoCompleteOption[] = useMemo(() => {
    return availableCredentials.map(cred => {
      const credType = credentialTypes.find(ct => ct.name === cred.type)
      return {
        id: cred.id,
        label: cred.name,
        value: cred.id,
        metadata: {
          subtitle: credType?.displayName || cred.type,
          type: cred.type,
          credentialType: credType
        }
      }
    })
  }, [availableCredentials, credentialTypes])

  const handleCredentialCreated = (credential: Credential) => {
    onChange(credential.id)
    setShowCreateModal(false)
    setSelectedCredentialType(null)
  }

  // Custom render for options to show credential type
  const renderOption = (option: AutoCompleteOption) => (
    <div className="flex items-start gap-2 flex-1 min-w-0">
      <Key className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate font-medium">{option.label}</p>
        {option.metadata?.subtitle && (
          <p className="text-xs text-muted-foreground truncate">
            {option.metadata.subtitle}
          </p>
        )}
      </div>
    </div>
  )

  // Custom render for selected value
  const renderSelected = (option: AutoCompleteOption) => (
    <div className="flex items-center gap-2">
      <span className="font-medium">{option.label}</span>
      <span className="text-xs text-muted-foreground">
        ({option.metadata?.subtitle})
      </span>
    </div>
  )

  return (
    <div className="space-y-2">
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      
      <div className="flex gap-2">
        <div className="flex-1">
          <AutoComplete
            value={value || ''}
            onChange={(newValue) => {
              onChange(newValue || undefined)
            }}
            options={options}
            placeholder={placeholder}
            searchPlaceholder="Search credentials..."
            emptyMessage="No credentials found"
            noOptionsMessage="No matching credentials"
            icon={<Key className="w-4 h-4" />}
            renderOption={renderOption}
            renderSelected={renderSelected}
            disabled={disabled}
            error={error}
            clearable={!required}
            refreshable={true}
            searchable={true}
          />
        </div>

        {/* Create New Credential Button */}
        {!disabled && allowedTypes.length === 1 && (
          <button
            type="button"
            onClick={async () => {
              // Ensure credential types are loaded before opening modal
              if (!isCredentialTypesReady) {
                setIsFetchingTypes(true)
                await fetchCredentialTypes()
                setIsFetchingTypes(false)
              }
              setSelectedCredentialType(allowedTypes[0])
              setShowCreateModal(true)
            }}
            disabled={isFetchingTypes}
            className="h-9 w-9 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isFetchingTypes ? "Loading credential types..." : "Create new credential"}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        {/* Create New with Type Selection - for multiple allowed types */}
        {!disabled && allowedTypes.length > 1 && (
          <div className="relative group">
            <button
              type="button"
              disabled={isFetchingTypes}
              className="h-9 w-9 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              title={isFetchingTypes ? "Loading credential types..." : "Create new credential"}
            >
              <Plus className="w-4 h-4" />
            </button>
            
            {/* Dropdown menu for selecting credential type */}
            {isCredentialTypesReady && (
              <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-300 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <div className="py-1">
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b">
                    Select credential type
                  </div>
                  {allowedTypes.map(typeName => {
                    const credType = credentialTypes.find(ct => ct.name === typeName)
                    return (
                      <button
                        key={typeName}
                        type="button"
                        onClick={async () => {
                          // Ensure credential types are loaded
                          if (!isCredentialTypesReady) {
                            setIsFetchingTypes(true)
                            await fetchCredentialTypes()
                            setIsFetchingTypes(false)
                          }
                          setSelectedCredentialType(typeName)
                          setShowCreateModal(true)
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Key className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{credType?.displayName || typeName}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Credential Creation Modal */}
      {selectedCredentialType && (() => {
        const credType = credentialTypes.find(ct => ct.name === selectedCredentialType)
        return credType ? (
          <CredentialModal
            open={showCreateModal}
            credentialType={credType}
            onClose={() => {
              setShowCreateModal(false)
              setSelectedCredentialType(null)
            }}
            onSave={handleCredentialCreated}
            nodeType={nodeType}
          />
        ) : null
      })()}
    </div>
  )
}
