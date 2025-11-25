import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FormFieldConfig, FormGenerator, FormGeneratorRef } from '@/components/ui/form-generator'
import { apiClient } from '@/services/api'
import { useCredentialStore } from '@/stores'
import { CreateCredentialRequest, Credential, CredentialType } from '@/types'
import { CheckCircle, Key, Loader2, LogIn, TestTube, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

interface CredentialFormProps {
  credentialType: CredentialType
  credential?: Credential
  onSuccess: (credential: Credential) => void
  onCancel: () => void
  showHeader?: boolean
  nodeType?: string // Node type for context-specific defaults
}

export function CredentialForm({
  credentialType,
  credential,
  onSuccess,
  onCancel,
  showHeader = true,
  nodeType
}: CredentialFormProps) {
  const { createCredential, updateCredential, testCredential, isLoading } = useCredentialStore()
  const formRef = useRef<FormGeneratorRef>(null)

  const [formValues, setFormValues] = useState<Record<string, any>>({
    name: credential?.name || '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  // Check if this is an OAuth credential (has oauthProvider specified)
  const isOAuthCredential = !!credentialType.oauthProvider

  const [contextualDisplayName, setContextualDisplayName] = useState<string>(credentialType.displayName)

  // Memoize fields array to prevent recreating on every render
  const fields = useMemo((): FormFieldConfig[] => [
    {
      name: 'name',
      displayName: 'Credential Name',
      type: 'text' as const,
      required: true,
      placeholder: 'Enter a name for this credential',
      description: 'A unique name to identify this credential',
    },
    ...(credentialType.properties as FormFieldConfig[])
  ], [credentialType.properties])

  useEffect(() => {
    // Fetch defaults if nodeType is provided
    const fetchDefaults = async () => {
      const initialData: Record<string, any> = {
        name: credential?.name || '',
      }

      // If nodeType is provided, fetch node-specific defaults and displayName
      if (nodeType && !credential) {
        try {
          const response = await apiClient.get(
            `/credentials/types/${credentialType.name}/defaults?nodeType=${nodeType}`
          )
          
          if (response.success && response.data) {
            // Apply defaults from backend
            if (response.data.defaults) {
              Object.assign(initialData, response.data.defaults)
            }
            
            // Use context-specific displayName if provided
            if (response.data.credentialType?.displayName) {
              setContextualDisplayName(response.data.credentialType.displayName)
            }
          }
        } catch (error) {
          console.warn('Failed to fetch credential defaults:', error)
        }
      }

      // Initialize remaining fields with default values from property definitions
      credentialType.properties.forEach(prop => {
        // Only set default if not already set by backend defaults
        if (!(prop.name in initialData)) {
          // Use the property's default value if available
          if (prop.default !== undefined) {
            initialData[prop.name] = prop.default
          } else if (prop.type === 'boolean') {
            initialData[prop.name] = false
          } else {
            initialData[prop.name] = ''
          }
        }
      })

      setFormValues(initialData)
      setFormErrors({})
      setTestResult(null)
    }

    fetchDefaults()
  }, [credentialType, credential, nodeType])

  const handleFieldChange = useCallback((name: string, value: any) => {
    setFormValues(prev => ({ ...prev, [name]: value }))
    setFormErrors(prev => {
      if (!prev[name]) return prev
      const newErrors = { ...prev }
      delete newErrors[name]
      return newErrors
    })
  }, [])

  const validateForm = useCallback((): boolean => {
    if (!formRef.current) return false
    const errors = formRef.current.validate()
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }, [])

  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return
    }

    try {
      const { name, ...data } = formValues
      let savedCredential: Credential

      if (credential) {
        savedCredential = await updateCredential(credential.id, { name, data })
      } else {
        const createData: CreateCredentialRequest = {
          name,
          type: credentialType.name,
          data
        }
        savedCredential = await createCredential(createData)
      }

      toast.success(credential ? 'Credential updated successfully!' : 'Credential created successfully!')
      onSuccess(savedCredential)
    } catch (error) {
      console.error('Failed to save credential:', error)
      toast.error(credential ? 'Failed to update credential' : 'Failed to create credential')
    }
  }, [validateForm, formValues, credential, updateCredential, createCredential, credentialType.name, onSuccess])

  const handleOAuthAuthorization = useCallback(async () => {
    if (!validateForm()) {
      return
    }

    try {
      setIsAuthenticating(true)

      const { name, ...credentialData } = formValues

      if (!credentialData.clientId || !credentialData.clientSecret) {
        toast.error('Please enter Client ID and Client Secret before authorizing')
        setIsAuthenticating(false)
        return
      }

      const params = new URLSearchParams()

      if (credential) {
        params.append('credentialId', credential.id)
      } else {
        params.append('clientId', credentialData.clientId)
        params.append('clientSecret', credentialData.clientSecret)
        params.append('credentialName', name || `${credentialType.displayName} - ${new Date().toLocaleDateString()}`)
        params.append('credentialType', credentialType.name)
        
        // Pass service selection and custom scopes if provided
        if (credentialData.services) {
          params.append('services', credentialData.services)
        }
        if (credentialData.useCustomScopes) {
          params.append('useCustomScopes', 'true')
          if (credentialData.customScopes) {
            params.append('customScopes', credentialData.customScopes)
          }
        }
      }

      // Use the OAuth provider specified in the credential type
      const oauthProvider = credentialType.oauthProvider || 'google'
      const response = await apiClient.get(`/oauth/${oauthProvider}/authorize?${params.toString()}`)

      if (response.success && response.data?.authorizationUrl) {
        const width = 600
        const height = 700
        const left = window.screen.width / 2 - width / 2
        const top = window.screen.height / 2 - height / 2

        const popup = window.open(
          response.data.authorizationUrl,
          'OAuthPopup',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        )

        if (!popup) {
          toast.error('Popup blocked. Please allow popups and try again.')
          setIsAuthenticating(false)
          return
        }

        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) {
            return
          }

          if (event.data.type === 'oauth-success') {
            window.removeEventListener('message', messageHandler)
            toast.success(`Successfully authenticated with ${credentialType.displayName}!`)

            if (event.data.credential) {
              // Add the new credential to the store immediately
              useCredentialStore.setState((state) => ({
                credentials: [...state.credentials, event.data.credential]
              }))
              
              onSuccess(event.data.credential)
            }

            if (popup && !popup.closed) {
              popup.close()
            }

            setIsAuthenticating(false)
          } else if (event.data.type === 'oauth-error') {
            window.removeEventListener('message', messageHandler)

            const rawError = event.data.error || 'Authentication failed'
            let errorMessage = rawError

            if (rawError.includes('redirect_uri_mismatch')) {
              errorMessage = `Redirect URI mismatch. Please ensure your OAuth app has this callback URL configured: ${response.data.callbackUrl}`
            } else if (rawError.includes('access_denied')) {
              errorMessage = 'Access denied. You need to approve the permissions to continue.'
            } else if (rawError.includes('already exists')) {
              errorMessage = rawError
            } else if (rawError.includes('invalid_grant')) {
              errorMessage = 'Invalid authorization code. Please try again.'
            }

            toast.error(errorMessage)

            if (popup && !popup.closed) {
              popup.close()
            }

            setIsAuthenticating(false)
          }
        }

        window.addEventListener('message', messageHandler)

        const popupCheckInterval = setInterval(() => {
          if (popup.closed) {
            clearInterval(popupCheckInterval)
            window.removeEventListener('message', messageHandler)
            setIsAuthenticating(false)
          }
        }, 500)
      } else {
        throw new Error('Failed to get authorization URL')
      }
    } catch (error: any) {
      console.error('OAuth authorization error:', error)
      toast.error(error.message || 'Failed to start OAuth authorization')
      setIsAuthenticating(false)
    }
  }, [validateForm, formValues, credential, credentialType, onSuccess])

  const handleTest = useCallback(async () => {
    if (!validateForm()) {
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const { name, ...data } = formValues

      if (isOAuthCredential) {
        if (!credential) {
          toast.error(`Please complete "Sign in with ${credentialType.displayName}" first before testing`)
          setIsTesting(false)
          return
        }

        const result = await apiClient.post('/credentials/test-saved', {
          credentialId: credential.id,
        })

        if (result.success && result.data.success) {
          setTestResult({ success: true, message: result.data.message || 'Connection test successful!' })
          toast.success(result.data.message || 'Connection test successful!')
        } else {
          setTestResult({ success: false, message: result.data.message || 'Connection test failed' })
          toast.error(result.data.message || 'Connection test failed')
        }
      } else {
        const result = await testCredential({
          type: credentialType.name,
          data
        })
        setTestResult(result)

        if (result.success) {
          toast.success('Connection test successful!')
        } else {
          toast.error(`Connection test failed: ${result.message || 'Unknown error'}`)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Test failed'
      setTestResult({
        success: false,
        message
      })
      toast.error('Failed to test connection')
    } finally {
      setIsTesting(false)
    }
  }, [validateForm, formValues, credentialType.name, testCredential, credential, isOAuthCredential])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: credentialType.color || '#6B7280' }}
          >
            {credentialType.icon || <Key className="w-4 h-4" />}
          </div>
          <div className="flex-1">
            <h3 className="text-base font-medium">{contextualDisplayName}</h3>
            <p className="text-sm text-muted-foreground">{credentialType.description}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto">
        <FormGenerator
          ref={formRef}
          fields={fields}
          values={formValues}
          errors={formErrors}
          onChange={handleFieldChange}
          showRequiredIndicator={true}
          disableAutoValidation={true}
          className="space-y-4"
        />

        {/* Test result */}
        {testResult && (
          <Alert
            variant={testResult.success ? "default" : "destructive"}
            className="mt-4"
          >
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {testResult.message || (testResult.success ? 'Connection successful' : 'Connection failed')}
              </AlertDescription>
            </div>
          </Alert>
        )}
      </div>

      {/* Footer buttons */}
      <div className="flex flex-col gap-2 pt-4 border-t mt-4">
        {/* OAuth Authorization Button */}
        {isOAuthCredential && (
          <Button
            type="button"
            onClick={handleOAuthAuthorization}
            disabled={isAuthenticating || isLoading}
            className="w-full"
            style={{ 
              backgroundColor: credentialType.color || '#6B7280',
              color: 'white'
            }}
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Opening {credentialType.displayName}...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                {formValues.accessToken
                  ? `Re-authorize with ${credentialType.displayName}`
                  : `Sign in with ${credentialType.displayName}`}
              </>
            )}
          </Button>
        )}

        {/* Test Connection Button */}
        {(!isOAuthCredential || credential) && (
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={isLoading || isTesting}
            className="w-full"
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <TestTube className="w-4 h-4 mr-2" />
            )}
            Test Connection
          </Button>
        )}

        {/* Create/Cancel buttons - hide for OAuth credentials */}
        {!isOAuthCredential && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {credential ? 'Update' : 'Create'}
            </Button>
          </div>
        )}

        {/* For OAuth credentials, only show Cancel button */}
        {isOAuthCredential && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="w-full"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
