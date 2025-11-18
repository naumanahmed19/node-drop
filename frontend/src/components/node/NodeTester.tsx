import { useState } from 'react'
import { Play, Loader2, CheckCircle, XCircle, AlertTriangle, RotateCcw, Copy, Download, Info } from 'lucide-react'
import { WorkflowNode, NodeType } from '@/types'
import { nodeService } from '@/services'
import { isServiceOrToolNode } from '@/utils/nodeTypeUtils'

interface NodeTesterProps {
    node: WorkflowNode
    nodeType: NodeType
    onTestComplete?: (result: any) => void
}

interface TestResult {
    success: boolean
    data?: any
    error?: string
    executionTime?: number
    timestamp?: string
}

export function NodeTester({ node, nodeType, onTestComplete }: NodeTesterProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [testResult, setTestResult] = useState<TestResult | null>(null)
    const [testData, setTestData] = useState('{"test": "data"}')
    const [testHistory, setTestHistory] = useState<TestResult[]>([])
    const [showHistory, setShowHistory] = useState(false)

    const handleTest = async () => {
        setIsLoading(true)
        setTestResult(null)

        try {
            let inputData
            try {
                inputData = JSON.parse(testData)
            } catch {
                inputData = { main: [[{ json: { test: 'data' } }]] }
            }

            const startTime = Date.now()
            const result = await nodeService.testNode(node.type, {
                parameters: node.parameters,
                inputData,
                credentials: node.credentials || []
            })
            const executionTime = Date.now() - startTime

            const testResult: TestResult = {
                success: result.success,
                data: result.data,
                error: result.error,
                executionTime,
                timestamp: new Date().toISOString()
            }

            setTestResult(testResult)
            setTestHistory(prev => [testResult, ...prev.slice(0, 9)]) // Keep last 10 results
            onTestComplete?.(testResult)
        } catch (error) {
            const testResult: TestResult = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                timestamp: new Date().toISOString()
            }
            setTestResult(testResult)
            setTestHistory(prev => [testResult, ...prev.slice(0, 9)]) // Keep last 10 results
            onTestComplete?.(testResult)
        } finally {
            setIsLoading(false)
        }
    }

    const formatJson = (data: any) => {
        try {
            return JSON.stringify(data, null, 2)
        } catch {
            return String(data)
        }
    }

    const getResultIcon = () => {
        if (!testResult) return null

        if (testResult.success) {
            return <CheckCircle className="w-5 h-5 text-green-500" />
        } else {
            return <XCircle className="w-5 h-5 text-red-500" />
        }
    }

    const getResultColor = () => {
        if (!testResult) return ''

        return testResult.success
            ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
            : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            // Could add a toast notification here
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err)
        })
    }

    const downloadResult = (result: TestResult) => {
        const dataStr = JSON.stringify(result, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `node-test-result-${new Date().toISOString().slice(0, 19)}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const resetTest = () => {
        setTestResult(null)
        setTestData('{"test": "data"}')
    }

    const loadSampleData = () => {
        const sampleData = {
            main: [
                [
                    {
                        json: {
                            id: 1,
                            name: "Sample Item",
                            value: "test-value",
                            timestamp: new Date().toISOString()
                        }
                    }
                ]
            ]
        }
        setTestData(JSON.stringify(sampleData, null, 2))
    }

    // Check if this is a service or tool node
    const isNonExecutable = isServiceOrToolNode(nodeType)

    return (
        <div className="space-y-4">
            {/* Show info message for service/tool nodes */}
            {isNonExecutable && (
                <div className="border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 rounded-md p-4">
                    <div className="flex items-start space-x-3">
                        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                {nodeType.identifier === 'service' ? 'Service Node' : 'Tool Node'}
                            </p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                This node cannot be executed directly. It is designed to be called by other nodes in your workflow.
                            </p>
                            {nodeType.identifier === 'service' && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                                    Service nodes (like AI models) provide functionality to other nodes and are not standalone executables.
                                </p>
                            )}
                            {nodeType.identifier === 'tool' && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                                    Tool nodes are called by AI Agent nodes to perform specific tasks.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Test input - hidden for service/tool nodes */}
            {!isNonExecutable && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium">
                            Test Input Data
                        </label>
                        <div className="flex space-x-2">
                            <button
                                onClick={loadSampleData}
                                className="text-xs text-primary hover:text-primary/80 transition-colors"
                            >
                                Load Sample
                            </button>
                            <button
                                onClick={resetTest}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                    <textarea
                        value={testData}
                        onChange={(e) => setTestData(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-ring focus:border-transparent font-mono text-sm resize-y bg-background"
                        placeholder="Enter JSON test data..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        Enter JSON data to test the node with. Use "Load Sample" for example data.
                    </p>
                </div>
            )}

            {/* Test controls - hidden for service/tool nodes */}
            {!isNonExecutable && (
                <div className="flex space-x-2">
                    <button
                        onClick={handleTest}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Play className="w-4 h-4" />
                        )}
                        <span>{isLoading ? 'Testing...' : 'Test Node'}</span>
                    </button>
                    
                    {testHistory.length > 0 && (
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="px-3 py-2 border rounded-md hover:bg-accent transition-colors"
                            title="View test history"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}

            {/* Test result */}
            {testResult && (
                <div className={`border rounded-md p-4 ${getResultColor()}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                            {getResultIcon()}
                            <span className="font-medium">
                                {testResult.success ? 'Test Successful' : 'Test Failed'}
                            </span>
                            {testResult.executionTime && (
                                <span className="text-sm text-gray-500">
                                    ({testResult.executionTime}ms)
                                </span>
                            )}
                            {testResult.timestamp && (
                                <span className="text-xs text-gray-400">
                                    {new Date(testResult.timestamp).toLocaleTimeString()}
                                </span>
                            )}
                        </div>
                        <div className="flex space-x-1">
                            <button
                                onClick={() => copyToClipboard(formatJson(testResult))}
                                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                title="Copy result to clipboard"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => downloadResult(testResult)}
                                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                title="Download result as JSON"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {testResult.error && (
                        <div className="mb-3">
                            <div className="flex items-center space-x-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                <span className="text-sm font-medium text-red-700 dark:text-red-400">Error</span>
                            </div>
                            <pre className="text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950 p-2 rounded border overflow-x-auto whitespace-pre-wrap">
                                {testResult.error}
                            </pre>
                        </div>
                    )}

                    {testResult.data && (
                        <div>
                            <div className="flex items-center space-x-2 mb-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span className="text-sm font-medium text-green-700 dark:text-green-400">Output Data</span>
                            </div>
                            <pre className="text-sm bg-muted p-2 rounded border overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                                {formatJson(testResult.data)}
                            </pre>
                        </div>
                    )}
                </div>
            )}

            {/* Test history */}
            {showHistory && testHistory.length > 0 && (
                <div className="border rounded-md p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium">Test History</h4>
                        <button
                            onClick={() => setTestHistory([])}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Clear History
                        </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {testHistory.map((result, index) => (
                            <div
                                key={index}
                                className={`p-2 rounded border text-xs ${
                                    result.success 
                                        ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900' 
                                        : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        {result.success ? (
                                            <CheckCircle className="w-3 h-3 text-green-500" />
                                        ) : (
                                            <XCircle className="w-3 h-3 text-red-500" />
                                        )}
                                        <span className={result.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                                            {result.success ? 'Success' : 'Failed'}
                                        </span>
                                        {result.executionTime && (
                                            <span className="text-muted-foreground">
                                                ({result.executionTime}ms)
                                            </span>
                                        )}
                                    </div>
                                    {result.timestamp && (
                                        <span className="text-muted-foreground">
                                            {new Date(result.timestamp).toLocaleTimeString()}
                                        </span>
                                    )}
                                </div>
                                {result.error && (
                                    <div className="mt-1 text-red-600 dark:text-red-400 truncate">
                                        {result.error}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Node info */}
            <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Node Type:</strong> {nodeType.displayName}</p>
                <p><strong>Version:</strong> {nodeType.version}</p>
                {node.credentials && node.credentials.length > 0 && (
                    <p><strong>Credentials:</strong> {node.credentials.join(', ')}</p>
                )}
            </div>
        </div>
    )
}
