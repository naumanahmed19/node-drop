import { Credential, NodeType, Workflow } from '@/types'
import { createContext, ReactNode, useCallback, useContext, useState } from 'react'

interface WorkflowItem {
  title: string
  url: string
  icon: any
  isActive: boolean
}

interface SidebarContextType {
  activeWorkflowItem: WorkflowItem
  setActiveWorkflowItem: (item: WorkflowItem) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  workflowsData: Workflow[]
  setWorkflowsData: (data: Workflow[]) => void
  credentialsData: Credential[]
  setCredentialsData: (data: Credential[]) => void
  nodeTypesData: NodeType[]
  setNodeTypesData: (data: NodeType[]) => void
  isWorkflowsLoaded: boolean
  setIsWorkflowsLoaded: (loaded: boolean) => void
  isCredentialsLoaded: boolean
  setIsCredentialsLoaded: (loaded: boolean) => void
  isNodeTypesLoaded: boolean
  setIsNodeTypesLoaded: (loaded: boolean) => void
  workflowsError: string | null
  setWorkflowsError: (error: string | null) => void
  credentialsError: string | null
  setCredentialsError: (error: string | null) => void
  nodeTypesError: string | null
  setNodeTypesError: (error: string | null) => void
  currentWorkflowId: string | null
  setCurrentWorkflowId: (id: string | null) => void
  headerSlot: ReactNode
  setHeaderSlot: (slot: ReactNode) => void
  detailSidebar: {
    isOpen: boolean
    title: string
    content: ReactNode
  } | null
  setDetailSidebar: (sidebar: { isOpen: boolean; title: string; content: ReactNode } | null) => void
}

const SidebarContext = createContext<SidebarContextType | null>(null)

interface SidebarProviderProps {
  children: ReactNode
}

export function SidebarContextProvider({ children }: SidebarProviderProps) {
  const [activeWorkflowItem, setActiveWorkflowItemState] = useState<WorkflowItem>({
    title: "Nodes",
    url: "#",
    icon: null,
    isActive: true,
  })
  const [searchTerm, setSearchTermState] = useState("")
  const [workflowsData, setWorkflowsDataState] = useState<Workflow[]>([])
  const [credentialsData, setCredentialsDataState] = useState<Credential[]>([])
  const [nodeTypesData, setNodeTypesDataState] = useState<NodeType[]>([])
  const [isWorkflowsLoaded, setIsWorkflowsLoadedState] = useState(false)
  const [isCredentialsLoaded, setIsCredentialsLoadedState] = useState(false)
  const [isNodeTypesLoaded, setIsNodeTypesLoadedState] = useState(false)
  const [workflowsError, setWorkflowsErrorState] = useState<string | null>(null)
  const [credentialsError, setCredentialsErrorState] = useState<string | null>(null)
  const [nodeTypesError, setNodeTypesErrorState] = useState<string | null>(null)
  const [currentWorkflowId, setCurrentWorkflowIdState] = useState<string | null>(null)
  const [headerSlot, setHeaderSlotState] = useState<ReactNode>(null)
  const [detailSidebar, setDetailSidebarState] = useState<{
    isOpen: boolean
    title: string
    content: ReactNode
  } | null>(null)

  // Stable setter functions
  const setActiveWorkflowItem = useCallback((item: WorkflowItem) => {
    setActiveWorkflowItemState(item)
  }, [])

  const setSearchTerm = useCallback((term: string) => {
    setSearchTermState(term)
  }, [])

  const setWorkflowsData = useCallback((data: Workflow[]) => {
    setWorkflowsDataState(data)
  }, [])

  const setCredentialsData = useCallback((data: Credential[]) => {
    setCredentialsDataState(data)
  }, [])

  const setNodeTypesData = useCallback((data: NodeType[]) => {
    setNodeTypesDataState(data)
  }, [])

  const setIsWorkflowsLoaded = useCallback((loaded: boolean) => {
    setIsWorkflowsLoadedState(loaded)
  }, [])

  const setIsCredentialsLoaded = useCallback((loaded: boolean) => {
    setIsCredentialsLoadedState(loaded)
  }, [])

  const setIsNodeTypesLoaded = useCallback((loaded: boolean) => {
    setIsNodeTypesLoadedState(loaded)
  }, [])

  const setWorkflowsError = useCallback((error: string | null) => {
    setWorkflowsErrorState(error)
  }, [])

  const setCredentialsError = useCallback((error: string | null) => {
    setCredentialsErrorState(error)
  }, [])

  const setNodeTypesError = useCallback((error: string | null) => {
    setNodeTypesErrorState(error)
  }, [])

  const setCurrentWorkflowId = useCallback((id: string | null) => {
    setCurrentWorkflowIdState(id)
  }, [])

  const setHeaderSlot = useCallback((slot: ReactNode) => {
    setHeaderSlotState(slot)
  }, [])

  const setDetailSidebar = useCallback((sidebar: { isOpen: boolean; title: string; content: ReactNode } | null) => {
    setDetailSidebarState(sidebar)
  }, [])

  return (
    <SidebarContext.Provider
      value={{
        activeWorkflowItem,
        setActiveWorkflowItem,
        searchTerm,
        setSearchTerm,
        workflowsData,
        setWorkflowsData,
        credentialsData,
        setCredentialsData,
        nodeTypesData,
        setNodeTypesData,
        isWorkflowsLoaded,
        setIsWorkflowsLoaded,
        isCredentialsLoaded,
        setIsCredentialsLoaded,
        isNodeTypesLoaded,
        setIsNodeTypesLoaded,
        workflowsError,
        setWorkflowsError,
        credentialsError,
        setCredentialsError,
        nodeTypesError,
        setNodeTypesError,
        currentWorkflowId,
        setCurrentWorkflowId,
        headerSlot,
        setHeaderSlot,
        detailSidebar,
        setDetailSidebar,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarContext() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebarContext must be used within a SidebarContextProvider')
  }
  return context
}
