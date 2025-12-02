/**
 * Visual Test Page for Chat Interface Node
 * 
 * This component allows you to visually test and interact with the Chat Interface Node
 * in different states and configurations.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChatInterfaceNode } from '@/components/workflow/nodes'
import { ReactFlow,  Background, Controls, ReactFlowProvider, NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import '../reactflow-theme.css'

const nodeTypes: NodeTypes = {
  chatInterface: ChatInterfaceNode as any,
}

// Test Case 1: Basic Empty Chat
const basicNode = [
  {
    id: 'chat-basic',
    type: 'chatInterface',
    position: { x: 100, y: 50 },
    data: {
      label: 'Basic Chat',
      nodeType: 'chatInterface',
      placeholder: 'Type your message...',
      disabled: false,
      parameters: {},
    },
  },
]

// Test Case 2: Chat with History
const chatWithHistory = [
  {
    id: 'chat-history',
    type: 'chatInterface',
    position: { x: 100, y: 50 },
    data: {
      label: 'Chat with History',
      nodeType: 'chatInterface',
      model: 'GPT-4',
      placeholder: 'Continue the conversation...',
      messages: [
        {
          id: '1',
          role: 'assistant',
          content: 'Hello! I\'m your AI assistant. How can I help you today?',
          timestamp: new Date(Date.now() - 120000),
        },
        {
          id: '2',
          role: 'user',
          content: 'Can you help me understand React hooks?',
          timestamp: new Date(Date.now() - 60000),
        },
        {
          id: '3',
          role: 'assistant',
          content: 'Of course! React hooks are functions that let you "hook into" React state and lifecycle features from function components. The most common ones are useState and useEffect. Would you like me to explain any specific hook?',
          timestamp: new Date(Date.now() - 30000),
        },
      ],
      disabled: false,
      parameters: {},
    },
  },
]

// Test Case 3: Disabled Chat
const disabledNode = [
  {
    id: 'chat-disabled',
    type: 'chatInterface',
    position: { x: 100, y: 50 },
    data: {
      label: 'Disabled Chat',
      nodeType: 'chatInterface',
      model: 'GPT-3.5',
      placeholder: 'This chat is disabled',
      disabled: true,
      parameters: {},
    },
  },
]

// Test Case 4: Selected State
const selectedNode = [
  {
    id: 'chat-selected',
    type: 'chatInterface',
    position: { x: 100, y: 50 },
    selected: true,
    data: {
      label: 'Selected Chat',
      nodeType: 'chatInterface',
      model: 'GPT-4',
      placeholder: 'This chat is selected',
      disabled: false,
      parameters: {},
    },
  },
]

// Test Case 5: Multiple Connected Nodes
const workflowNodes = [
  {
    id: 'input',
    type: 'input',
    position: { x: 0, y: 100 },
    data: { label: 'Input Data' },
  },
  {
    id: 'chat-workflow',
    type: 'chatInterface',
    position: { x: 250, y: 50 },
    data: {
      label: 'Chat Processor',
      nodeType: 'chatInterface',
      model: 'GPT-4',
      placeholder: 'Process and respond...',
      disabled: false,
      parameters: {},
    },
  },
  {
    id: 'output',
    type: 'output',
    position: { x: 650, y: 100 },
    data: { label: 'Save Results' },
  },
]

const workflowEdges = [
  { id: 'e1-2', source: 'input', target: 'chat-workflow', animated: true },
  { id: 'e2-3', source: 'chat-workflow', target: 'output', animated: true },
]

export function ChatInterfaceNodeVisualTest() {
  return (
    <div className="container mx-auto py-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Chat Interface Node - Visual Test Suite</CardTitle>
          <CardDescription>
            Test and preview the Chat Interface Node in different states and configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="history">With History</TabsTrigger>
              <TabsTrigger value="disabled">Disabled</TabsTrigger>
              <TabsTrigger value="selected">Selected</TabsTrigger>
              <TabsTrigger value="workflow">Workflow</TabsTrigger>
            </TabsList>

            {/* Test Case 1: Basic Empty Chat */}
            <TabsContent value="basic" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Basic Empty Chat</h3>
                <p className="text-sm text-muted-foreground">
                  A fresh chat interface with no messages. Try sending a message!
                </p>
              </div>
              <div className="h-[500px] border rounded-lg">
                <ReactFlowProvider>
                  <ReactFlow
                    nodes={basicNode}
                    nodeTypes={nodeTypes}
                    fitView
                    minZoom={0.5}
                    maxZoom={2}
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </ReactFlowProvider>
              </div>
            </TabsContent>

            {/* Test Case 2: Chat with History */}
            <TabsContent value="history" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Chat with Message History</h3>
                <p className="text-sm text-muted-foreground">
                  Pre-loaded with conversation history. The model badge is visible in the header.
                </p>
              </div>
              <div className="h-[500px] border rounded-lg">
                <ReactFlowProvider>
                  <ReactFlow
                    nodes={chatWithHistory}
                    nodeTypes={nodeTypes}
                    fitView
                    minZoom={0.5}
                    maxZoom={2}
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </ReactFlowProvider>
              </div>
            </TabsContent>

            {/* Test Case 3: Disabled Chat */}
            <TabsContent value="disabled" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Disabled State</h3>
                <p className="text-sm text-muted-foreground">
                  The input and send button are disabled. The node is in read-only mode.
                </p>
              </div>
              <div className="h-[500px] border rounded-lg">
                <ReactFlowProvider>
                  <ReactFlow
                    nodes={disabledNode}
                    nodeTypes={nodeTypes}
                    fitView
                    minZoom={0.5}
                    maxZoom={2}
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </ReactFlowProvider>
              </div>
            </TabsContent>

            {/* Test Case 4: Selected State */}
            <TabsContent value="selected" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Selected State</h3>
                <p className="text-sm text-muted-foreground">
                  The node appears selected with a blue ring highlight.
                </p>
              </div>
              <div className="h-[500px] border rounded-lg">
                <ReactFlowProvider>
                  <ReactFlow
                    nodes={selectedNode}
                    nodeTypes={nodeTypes}
                    fitView
                    minZoom={0.5}
                    maxZoom={2}
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </ReactFlowProvider>
              </div>
            </TabsContent>

            {/* Test Case 5: Workflow Integration */}
            <TabsContent value="workflow" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Workflow Integration</h3>
                <p className="text-sm text-muted-foreground">
                  Chat node connected to input and output nodes in a complete workflow.
                </p>
              </div>
              <div className="h-[500px] border rounded-lg">
                <ReactFlowProvider>
                  <ReactFlow
                    nodes={workflowNodes}
                    edges={workflowEdges}
                    nodeTypes={nodeTypes}
                    fitView
                    minZoom={0.5}
                    maxZoom={2}
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </ReactFlowProvider>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Feature Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Checklist</CardTitle>
          <CardDescription>All implemented features of the Chat Interface Node</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Visual Features</h4>
              <ul className="space-y-1 text-sm">
                <li>Ã¢Å“â€¦ Message bubbles (user & assistant)</li>
                <li>Ã¢Å“â€¦ Avatar icons</li>
                <li>Ã¢Å“â€¦ Timestamps</li>
                <li>Ã¢Å“â€¦ Typing indicator</li>
                <li>Ã¢Å“â€¦ Scrollable message area</li>
                <li>Ã¢Å“â€¦ Model badge display</li>
                <li>Ã¢Å“â€¦ Empty state</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Functional Features</h4>
              <ul className="space-y-1 text-sm">
                <li>Ã¢Å“â€¦ Send messages</li>
                <li>Ã¢Å“â€¦ Enter key to send</li>
                <li>Ã¢Å“â€¦ Input validation</li>
                <li>Ã¢Å“â€¦ Message history</li>
                <li>Ã¢Å“â€¦ Disabled state</li>
                <li>Ã¢Å“â€¦ Selected state</li>
                <li>Ã¢Å“â€¦ ReactFlow handles</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ChatInterfaceNodeVisualTest
