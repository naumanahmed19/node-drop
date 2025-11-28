import { useAuthStore, usePinnedNodesStore } from '@/stores'
import { socketService } from '@/services/socket'
import { Loader2 } from 'lucide-react'
import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
}) => {
  const { isAuthenticated, isLoading, getCurrentUser, token } = useAuthStore()
  const location = useLocation()
  const [hasTriedAuth, setHasTriedAuth] = React.useState(false)

  useEffect(() => {
    // If we have a token but no user info, try to get current user (only once)
    if (token && token !== 'guest-token' && !isAuthenticated && !isLoading && !hasTriedAuth) {
      setHasTriedAuth(true)
      getCurrentUser().catch(() => {
        // getCurrentUser will handle clearing the token/state on failure
        setHasTriedAuth(false)
      })
    }
    // Remove automatic guest login - users must explicitly choose guest mode
  }, [token, isAuthenticated, isLoading, getCurrentUser, hasTriedAuth])

  // Initialize socket connection and pinned nodes when user is authenticated
  const { initialize: initializePinnedNodes } = usePinnedNodesStore()
  
  useEffect(() => {
    if (isAuthenticated && token && token !== 'guest-token') {
      // Initialize socket connection with current token
      socketService.initialize(token).catch(error => {
        console.error('Failed to initialize socket connection:', error)
      })
      
      // Initialize pinned nodes from user preferences
      initializePinnedNodes().catch(error => {
        console.error('Failed to initialize pinned nodes:', error)
      })
    } else if (!isAuthenticated) {
      // Disconnect socket when user is not authenticated
      socketService.disconnect()
    }
  }, [isAuthenticated, token, initializePinnedNodes])

  // Show loading spinner while checking authentication
  // Don't show loading for auth pages (login/register) as they have their own loading states
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'
  if ((isLoading || (token && !isAuthenticated && hasTriedAuth)) && !isAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" />
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If authentication is required but user is not authenticated (and not guest)
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If user is authenticated but trying to access auth pages
  if (!requireAuth && isAuthenticated) {
    const from = location.state?.from?.pathname || '/workflows'
    return <Navigate to={from} replace />
  }

  return <>{children}</>
}
