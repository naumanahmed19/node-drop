import { CredentialFormSidebar } from '@/components/credential/CredentialFormSidebar'
import { CredentialsHeader } from '@/components/credential/CredentialsHeader'
import { CredentialTypeSelection } from '@/components/credential/CredentialTypeSelection'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSidebarContext } from '@/contexts'
import { credentialService } from '@/services'
import { useCredentialStore } from '@/stores'
import { Credential, CredentialType } from '@/types'
import {
  Activity,
  Calendar,
  Clock,
  Edit,
  Key as KeyIcon,
  MoreHorizontal,
  Plus,
  Shield,
  Trash2,
  Users
} from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface CredentialsListProps {}

export function CredentialsList({}: CredentialsListProps) {
  const {
    credentialsData: credentials,
    setCredentialsData: setCredentials,
    isCredentialsLoaded,
    setIsCredentialsLoaded,
    credentialsError: error,
    setCredentialsError: setError,
    setHeaderSlot,
    setDetailSidebar
  } = useSidebarContext()
  
  const { 
    credentialTypes,
    fetchCredentialTypes,
    deleteCredential: deleteCredentialFromStore 
  } = useCredentialStore()
  
  const [isLoading, setIsLoading] = useState(!isCredentialsLoaded)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [localSearchTerm, setLocalSearchTerm] = useState("")
  
  // Dialog states
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)

  // CRUD handlers (defined early to avoid hoisting issues)
  const handleCreateCredential = () => {
    console.log('Create credential clicked')
    setEditingCredential(null)
    setDetailSidebar({
      isOpen: true,
      title: 'Create New Credential',
      content: <CredentialTypeSelection onTypeSelect={handleTypeSelect} />
    })
  }
  
  const handleTypeSelect = (credentialType: CredentialType) => {
    setDetailSidebar({
      isOpen: true,
      title: `Create ${credentialType.displayName}`,
      content: (
        <CredentialFormSidebar
          credentialType={credentialType}
          editingCredential={editingCredential || undefined}
          onSuccess={handleCredentialSuccess}
          onCancel={handleCloseDetailSidebar}
        />
      )
    })
  }
  
  const handleCloseDetailSidebar = () => {
    setDetailSidebar(null)
    setEditingCredential(null)
  }

  const handleEditCredential = (credential: Credential) => {
    console.log('Edit credential clicked:', credential)
    setEditingCredential(credential)
    
    // Find the credential type for the editing credential
    const credentialType = credentialTypes.find(ct => ct.name === credential.type)
    
    if (credentialType) {
      setDetailSidebar({
        isOpen: true,
        title: `Edit ${credential.name}`,
        content: (
          <CredentialFormSidebar
            credentialType={credentialType}
            editingCredential={credential}
            onSuccess={handleCredentialSuccess}
            onCancel={handleCloseDetailSidebar}
          />
        )
      })
    } else {
      toast.error('Credential type not found')
    }
  }

  const handleDeleteCredential = async (credential: Credential) => {
    try {
      await deleteCredentialFromStore(credential.id)
      // Refresh the credentials list
      const updatedCredentials = credentials.filter(c => c.id !== credential.id)
      setCredentials(updatedCredentials)
      toast.success('Credential deleted successfully')
    } catch (error) {
      console.error('Failed to delete credential:', error)
      toast.error('Failed to delete credential')
    }
  }

  const handleCredentialSuccess = async () => {
    try {
      // Refresh credentials list
      const updatedCredentials = await credentialService.getCredentials()
      setCredentials(updatedCredentials)
      handleCloseDetailSidebar()
      toast.success(`Credential ${editingCredential ? 'updated' : 'created'} successfully`)
    } catch (error) {
      console.error('Failed to refresh credentials:', error)
      // Still close sidebar on success
      handleCloseDetailSidebar()
    }
  }

  const fetchCredentials = async (forceRefresh = false) => {
    // Don't fetch if we already have data loaded (unless force refresh)
    if (!forceRefresh && isCredentialsLoaded && credentials.length > 0) {
      setIsLoading(false)
      return
    }

    try {
      if (forceRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)
      
      // Fetch fresh data
      const fetchedCredentials = await credentialService.getCredentials()
      setCredentials(fetchedCredentials)
      setIsCredentialsLoaded(true)
    } catch (err) {
      console.error('Failed to fetch credentials:', err)
      setError('Failed to load credentials')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchCredentials(true)
  }

  useEffect(() => {
    fetchCredentials()
  }, [isCredentialsLoaded, setCredentials, setIsCredentialsLoaded, setError])

  // Filter credentials based on search term
  const filteredCredentials = React.useMemo(() => {
    if (!localSearchTerm) return credentials
    
    return credentials.filter(credential =>
      credential.name.toLowerCase().includes(localSearchTerm.toLowerCase()) ||
      credential.type.toLowerCase().includes(localSearchTerm.toLowerCase())
    )
  }, [credentials, localSearchTerm])

  // Initialize credential types
  useEffect(() => {
    fetchCredentialTypes()
  }, [fetchCredentialTypes])

  // Set header slot for credentials
  useEffect(() => {
    setHeaderSlot(
      <CredentialsHeader 
        credentialsCount={filteredCredentials.length}
        searchTerm={localSearchTerm}
        onSearchChange={setLocalSearchTerm}
        onCreateClick={handleCreateCredential}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
    )
    
    // Clean up header slot when component unmounts
    return () => {
      setHeaderSlot(null)
    }
  }, [setHeaderSlot, filteredCredentials.length, localSearchTerm, handleCreateCredential, isRefreshing])

  const handleCredentialAction = (action: string, credentialId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const credential = credentials.find(c => c.id === credentialId)
    if (!credential) return

    switch (action) {
      case 'edit':
        handleEditCredential(credential)
        break
      case 'delete':
        handleDeleteCredential(credential)
        break
      default:
        console.log(`Unknown action: ${action}`)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getCredentialIcon = (type: string) => {
    // You can customize icons based on credential type
    const iconMap: Record<string, React.ReactNode> = {
      'http': <Activity className="h-4 w-4" />,
      'database': <Shield className="h-4 w-4" />,
      'api': <KeyIcon className="h-4 w-4" />,
      'oauth2': <Users className="h-4 w-4" />,
      default: <KeyIcon className="h-4 w-4" />
    }
    
    return iconMap[type.toLowerCase()] || iconMap.default
  }

  const isExpiringSoon = (expiresAt?: string | null) => {
    if (!expiresAt) return false
    const expiryDate = new Date(expiresAt)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24))
    return daysUntilExpiry <= 7 && daysUntilExpiry >= 0
  }

  const isExpired = (expiresAt?: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  if (isLoading) {
    return (
      <div className="divide-y">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-4 py-3">
            <div className="animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 w-4 bg-muted rounded shrink-0"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
              <div className="ml-6 flex items-center gap-2">
                <div className="h-4 bg-muted rounded w-16"></div>
                <div className="h-4 bg-muted rounded w-12"></div>
                <div className="h-3 w-3 bg-muted rounded-full"></div>
                <div className="h-3 bg-muted rounded w-20"></div>
                <div className="h-3 bg-muted rounded w-16"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="rounded-full bg-destructive/10 p-3 mb-3">
          <KeyIcon className="h-6 w-6 text-destructive" />
        </div>
        <p className="text-sm font-medium mb-1">Failed to load credentials</p>
        <p className="text-xs text-muted-foreground mb-4">{error}</p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </div>
    )
  }

  if (filteredCredentials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <KeyIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium mb-1">
          {localSearchTerm ? 'No credentials found' : 'No credentials yet'}
        </h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-[250px]">
          {localSearchTerm 
            ? 'Try adjusting your search terms' 
            : 'Create your first credential to connect with external services'}
        </p>
        {!localSearchTerm && (
          <Button 
            size="sm"
            onClick={handleCreateCredential}
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Credential
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="divide-y">
        {filteredCredentials.map((credential) => {
          const isOAuthCredential = credential.type === 'googleSheetsOAuth2' || credential.type === 'googleDriveOAuth2'
          
          return (
            <div
              key={credential.id}
              className={`hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group transition-colors ${!isOAuthCredential ? 'cursor-pointer' : ''}`}
              onClick={() => {
                if (!isOAuthCredential) {
                  console.log('Credential clicked:', credential.name)
                  handleEditCredential(credential)
                }
              }}
            >
              <div className="px-4 py-3 overflow-hidden">
              {/* Header Row - Name and Action Button */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                  <div className="shrink-0">
                    {getCredentialIcon(credential.type)}
                  </div>
                  <h4 className="text-sm font-medium break-words min-w-0" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{credential.name}</h4>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {/* Hide Edit option for OAuth credentials */}
                    {(credential.type !== 'googleSheetsOAuth2' && credential.type !== 'googleDriveOAuth2') && (
                      <DropdownMenuItem
                        onClick={(e) => handleCredentialAction('edit', credential.id, e)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => handleCredentialAction('delete', credential.id, e)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Badges and Metadata Row - All on one line */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground ml-6 gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  {/* Badges */}
                  <Badge 
                    variant="outline"
                    className="text-[10px] h-4 px-1.5 shrink-0"
                  >
                    {credential.type}
                  </Badge>
                  {credential.isShared && (
                    <Badge 
                      variant="secondary"
                      className="text-[10px] h-4 px-1.5 shrink-0"
                    >
                      <Users className="h-2.5 w-2.5 mr-0.5" />
                      Shared
                    </Badge>
                  )}
                  {isExpired(credential.expiresAt) && (
                    <Badge 
                      variant="destructive"
                      className="text-[10px] h-4 px-1.5 shrink-0"
                    >
                      Expired
                    </Badge>
                  )}
                  {isExpiringSoon(credential.expiresAt) && !isExpired(credential.expiresAt) && (
                    <Badge 
                      variant="outline"
                      className="text-[10px] h-4 px-1.5 border-orange-500 text-orange-600 shrink-0"
                    >
                      Expiring Soon
                    </Badge>
                  )}
                  
                  {/* Separator */}
                  <span className="text-muted-foreground/30">•</span>
                  
                  {/* Time/Metadata */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Calendar className="h-3 w-3" />
                    <span className="whitespace-nowrap">{formatDate(credential.updatedAt)}</span>
                  </div>
                  {credential.lastUsedAt && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" />
                      <span className="whitespace-nowrap">Used {formatDate(credential.lastUsedAt)}</span>
                    </div>
                  )}
                  {credential.usageCount !== undefined && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Activity className="h-3 w-3" />
                      <span className="whitespace-nowrap">{credential.usageCount} uses</span>
                    </div>
                  )}
                </div>
                
                {credential.expiresAt && !isExpired(credential.expiresAt) && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
                    Expires {formatDate(credential.expiresAt)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          )
        })}
      </div>

      {/* Detail sidebar is managed by the main app sidebar */}
    </>
  )
}
