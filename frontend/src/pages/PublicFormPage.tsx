
 
 import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormGenerator } from '@/components/ui/form-generator/FormGenerator'
import { FormFieldConfig, FormGeneratorRef } from '@/components/ui/form-generator/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import axios from 'axios'
import { CheckCircle, ExternalLink, Key, Loader2, Lock, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

interface FormConfig {
  formTitle: string
  formDescription: string
  formFields: FormFieldConfig[]
  submitButtonText: string
  workflowName?: string
  isActive?: boolean
}

interface FormResponse {
  success: boolean
  form?: FormConfig
  formId?: string
  workflowId?: string
  error?: string
  requiresPassword?: boolean
  requiresAccessKey?: boolean
}

export function PublicFormPage() {
  const { formId } = useParams<{ formId: string }>()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null)
  const [workflowId, setWorkflowId] = useState<string>('')
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [submitMessage, setSubmitMessage] = useState('')
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [requiresAccessKey, setRequiresAccessKey] = useState(false)
  const [password, setPassword] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [passwordVerified, setPasswordVerified] = useState(false)
  
  const formGeneratorRef = useRef<FormGeneratorRef>(null)

  // Fetch form configuration on mount
  useEffect(() => {
    const fetchFormConfig = async (providedPassword?: string) => {
      if (!formId) {
        setLoading(false)
        return
      }

      try {
        const baseApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
        // Remove /api suffix if present, forms are now under /webhook/forms
        const apiUrl = baseApiUrl.replace(/\/api$/, '')
        
        // Add password to query if provided
        const url = providedPassword 
          ? `${apiUrl}/webhook/forms/${formId}?password=${encodeURIComponent(providedPassword)}`
          : `${apiUrl}/webhook/forms/${formId}`
        
        const response = await axios.get<FormResponse>(url)
        
        if (response.data.success && response.data.form) {
          setFormConfig(response.data.form)
          setWorkflowId(response.data.workflowId || '')
          setRequiresPassword(response.data.requiresPassword || false)
          setRequiresAccessKey(response.data.requiresAccessKey || false)
          setPasswordVerified(true)
        } else {
          setSubmitStatus('error')
          setSubmitMessage(response.data.error || 'Form not found')
        }
      } catch (error: any) {
        console.error('Error fetching form:', error)
        
        // Check if password is required
        if (error.response?.status === 401 && error.response?.data?.requiresPassword) {
          setRequiresPassword(true)
          setPasswordVerified(false)
          setLoading(false)
          return
        }
        
        // Check if password is invalid
        if (error.response?.status === 403 && error.response?.data?.requiresPassword) {
          setSubmitStatus('error')
          setSubmitMessage('Invalid password. Please try again.')
          setPasswordVerified(false)
          setLoading(false)
          return
        }
        
        setSubmitStatus('error')
        const errorMessage = typeof error.response?.data?.error === 'string' 
          ? error.response.data.error 
          : error.message || 'Failed to load form. Please check the URL and try again.'
        setSubmitMessage(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchFormConfig()
  }, [formId])

  // Handle password verification
  const handlePasswordVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!password) {
      setSubmitStatus('error')
      setSubmitMessage('Please enter a password')
      return
    }
    
    setLoading(true)
    setSubmitStatus('idle')
    
    try {
      const baseApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
      const apiUrl = baseApiUrl.replace(/\/api$/, '')
      const url = `${apiUrl}/webhook/forms/${formId}?password=${encodeURIComponent(password)}`
      
      const response = await axios.get<FormResponse>(url)
      
      if (response.data.success && response.data.form) {
        setFormConfig(response.data.form)
        setWorkflowId(response.data.workflowId || '')
        setRequiresAccessKey(response.data.requiresAccessKey || false)
        setPasswordVerified(true)
        setSubmitStatus('idle')
      }
    } catch (error: any) {
      console.error('Password verification error:', error)
      setSubmitStatus('error')
      setSubmitMessage(error.response?.data?.error || 'Invalid password')
    } finally {
      setLoading(false)
    }
  }

  // Handle field value changes
  const handleFieldChange = (fieldName: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [fieldName]: value
    }))
    
    // Clear field error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldName]
        return newErrors
      })
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formId || !formConfig || submitting) return

    // Validate form
    const validationErrors = formGeneratorRef.current?.validate()
    if (validationErrors && Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSubmitting(true)
    setSubmitStatus('idle')
    setErrors({})

    try {
      const baseApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
      const apiUrl = baseApiUrl.replace(/\/api$/, '')
      
      // Prepare submission data
      const submissionData: any = {
        formData: formValues,
        workflowId: workflowId
      }
      
      // Add password if password protected
      if (requiresPassword && password) {
        submissionData.password = password
      }
      
      // Add access key if access key protected
      if (requiresAccessKey && accessKey) {
        submissionData.accessKey = accessKey
      }
      
      const response = await axios.post(`${apiUrl}/webhook/forms/${formId}/submit`, submissionData)

      if (response.data.success) {
        setSubmitStatus('success')
        setSubmitMessage(response.data.message || 'Form submitted successfully!')
        
        // Reset form after successful submission
        setFormValues({})
        
        // Scroll to success message
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setSubmitStatus('error')
        setSubmitMessage(response.data.error || 'Failed to submit form')
      }
    } catch (error: any) {
      console.error('Form submission error:', error)
      setSubmitStatus('error')
      const errorMessage = typeof error.response?.data?.error === 'string'
        ? error.response.data.error
        : error.message || 'An error occurred while submitting the form. Please try again.'
      setSubmitMessage(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading form...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Password verification required
  if (requiresPassword && !passwordVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <Lock className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Password Protected Form</CardTitle>
            <CardDescription className="text-center">
              This form is protected. Please enter the password to access it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitStatus === 'error' && (
              <Alert className="mb-4" variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{submitMessage}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handlePasswordVerification} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !password}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Access Form
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state (form not found)
  if (!formConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <XCircle className="w-16 h-16 text-destructive mb-4" />
              <h2 className="text-2xl font-bold mb-2">Form Not Found</h2>
              <p className="text-muted-foreground text-center">
                {submitMessage || 'The form you are looking for does not exist or is no longer available.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main form view
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success/Error Alert */}
        {submitStatus === 'success' && (
          <Alert className="mb-6 border-green-200 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {submitMessage}
            </AlertDescription>
          </Alert>
        )}

        {submitStatus === 'error' && (
          <Alert className="mb-6 border-red-200 bg-red-50 dark:bg-red-950" variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {submitMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Form Card */}
        <Card className="shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-3xl font-bold">
              {formConfig.formTitle}
            </CardTitle>
            {formConfig.formDescription && (
              <CardDescription className="text-base">
                {formConfig.formDescription}
              </CardDescription>
            )}
            {formConfig.workflowName && (
              <p className="text-xs text-muted-foreground pt-2">
                Powered by {formConfig.workflowName}
              </p>
            )}
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Form Fields */}
              <FormGenerator
                ref={formGeneratorRef}
                fields={formConfig.formFields}
                values={formValues}
                errors={errors}
                onChange={handleFieldChange}
                disabled={submitting}
                disableAutoValidation={true}
                showRequiredIndicator={true}
              />

              {/* Access Key Input (if required) */}
              {requiresAccessKey && (
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="accessKey" className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Access Key *
                  </Label>
                  <Input
                    id="accessKey"
                    type="password"
                    placeholder="Enter access key to submit"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    disabled={submitting}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    This form requires an access key for submission
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={submitting || formConfig.formFields.length === 0 || (requiresAccessKey && !accessKey)}
                  className="w-full h-11 text-base"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    formConfig.submitButtonText || 'Submit'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <span>Powered by node-drop</span>
            <ExternalLink className="w-3 h-3" />
          </p>
        </div>
      </div>
    </div>
  )
}
