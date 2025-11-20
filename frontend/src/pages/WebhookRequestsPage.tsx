import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { webhookService } from '@/services/webhook'
import type { WebhookRequestLog } from '@/types/webhook'
import { 
  AlertCircle, 
  CheckCircle, 
  Filter, 
  Loader2, 
  Search, 
  XCircle,
  ExternalLink,
  Webhook,
  Activity,
  FileText,
  MessageSquare
} from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export const WebhookRequestsPage: React.FC = () => {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<WebhookRequestLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRequests, setTotalRequests] = useState(0)
  const pageLimit = 20

  useEffect(() => {
    loadRequests()
  }, [currentPage, statusFilter, typeFilter])

  const loadRequests = async () => {
    try {
      setIsLoading(true)
      const result = await webhookService.getAllWebhookLogs({
        limit: pageLimit,
        offset: (currentPage - 1) * pageLimit,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      })
      setRequests(result.logs)
      setTotalRequests(result.total)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load requests')
    } finally {
      setIsLoading(false)
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'webhook':
        return (
          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
            <Webhook className="w-3 h-3 mr-1" />
            Webhook
          </Badge>
        )
      case 'form':
        return (
          <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
            <FileText className="w-3 h-3 mr-1" />
            Form
          </Badge>
        )
      case 'chat':
        return (
          <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
            <MessageSquare className="w-3 h-3 mr-1" />
            Chat
          </Badge>
        )
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Success
          </Badge>
        )
      case 'rejected':
        return (
          <Badge className="bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        )
      case 'failed':
        return (
          <Badge className="bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getResponseCodeColor = (code: number) => {
    if (code >= 200 && code < 300) return 'text-green-600 dark:text-green-400'
    if (code >= 400 && code < 500) return 'text-yellow-600 dark:text-yellow-400'
    if (code >= 500) return 'text-red-600 dark:text-red-400'
    return 'text-muted-foreground'
  }

  const handleViewExecution = (executionId: string, workflowId: string) => {
    navigate(`/workflows/${workflowId}/executions/${executionId}`)
  }

  const filteredRequests = requests.filter((request) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        request.webhookId.toLowerCase().includes(query) ||
        request.workflowId.toLowerCase().includes(query) ||
        request.ip.toLowerCase().includes(query) ||
        request.method.toLowerCase().includes(query)
      )
    }
    return true
  })

  // Calculate stats from current data
  const stats = {
    total: totalRequests,
    success: requests.filter(r => r.status === 'success').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    failed: requests.filter(r => r.status === 'failed').length,
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 min-h-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <Activity className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Request Logs</h1>
        </div>
        <p className="text-muted-foreground">Monitor all incoming webhook, form, and chat requests</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Successful</p>
              <p className="text-2xl font-bold text-green-600">{stats.success}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Rejected</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.rejected}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-500 opacity-50" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="text"
            placeholder="Search by webhook ID, workflow, IP, or method..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="px-4 py-2 border border-input bg-background rounded-lg focus:ring-2 focus:ring-ring focus:border-input"
          >
            <option value="">All Types</option>
            <option value="webhook">Webhooks</option>
            <option value="form">Forms</option>
            <option value="chat">Chats</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="px-4 py-2 border border-input bg-background rounded-lg focus:ring-2 focus:ring-ring focus:border-input"
          >
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="rejected">Rejected</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading webhook requests...</span>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <Webhook className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-card-foreground mb-2">No webhook requests found</h3>
          <p className="text-muted-foreground">
            {searchQuery || statusFilter
              ? 'Try adjusting your search or filters'
              : 'Webhook requests will appear here when they are received'}
          </p>
        </div>
      ) : (
        <>
          {/* Requests Table */}
          <div className="bg-card shadow-sm rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Response
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Workflow
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Execution
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-accent">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-card-foreground">
                          {new Date(request.timestamp).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {new Date(request.timestamp).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getTypeBadge(request.type || 'webhook')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="outline" className="font-mono">
                          {request.method}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(request.status)}
                        {request.reason && (
                          <div className="text-xs text-muted-foreground mt-1 max-w-xs truncate">
                            {request.reason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`font-mono text-sm font-medium ${getResponseCodeColor(request.responseCode)}`}>
                          {request.responseCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground font-mono">
                        {request.responseTime}ms
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-card-foreground">{request.ip}</span>
                        {request.testMode && (
                          <Badge variant="outline" className="ml-2 text-xs">TEST</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-card-foreground max-w-xs truncate">
                          {request.workflowId}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {request.webhookId.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {request.executionId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewExecution(request.executionId!, request.workflowId)}
                            className="h-8 px-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageLimit + 1} to {Math.min(currentPage * pageLimit, totalRequests)} of {totalRequests} request{totalRequests !== 1 ? 's' : ''}
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm text-foreground">Page {currentPage}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage * pageLimit >= totalRequests || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
