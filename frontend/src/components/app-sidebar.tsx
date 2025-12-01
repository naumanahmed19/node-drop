"use client"
import { CredentialsList } from "@/components/credential/CredentialsList"
import { ExecutionsList, ScheduledExecutionsList } from "@/components/execution"
import { NavUser } from "@/components/nav-user"
import { NodeTypesList } from "@/components/node/NodeTypesList"
import { TeamSwitcher } from "@/components/team/TeamSwitcher"
import { TeamsList } from "@/components/team/TeamsList"
import { CreateTeamModal } from "@/components/team/CreateTeamModal"
import { AddMemberModal } from "@/components/team/AddMemberModal"
import { ManageMembersDialog } from "@/components/team/ManageMembersDialog"
import { TeamSettingsModal } from "@/components/team/TeamSettingsModal"
import { Button } from "@/components/ui/button"
import { useConfirmDialog } from "@/components/ui/ConfirmDialog"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
    useSidebar
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { VariablesList } from "@/components/variable/VariablesList"
import { WorkflowsList } from "@/components/workflow/WorkflowsList"
import { useSidebarContext, useTheme, useTeam } from "@/contexts"
import { useAuthStore, useReactFlowUIStore, useWorkflowStore } from "@/stores"
import {
    Activity,
    ArrowLeft,
    CalendarClock,
    Database,
    Home,
    Key,
    Maximize,
    Monitor,
    Moon,
    Plus,
    Settings,
    Sun,
    Users,
    Variable,
    Workflow,
    ZoomIn,
    ZoomOut,
} from "lucide-react"
import * as React from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"

// This is sample data for the workflow editor
const data = {
  user: {
    name: "Workflow User",
    email: "user@example.com",
    avatar: "/avatars/user.jpg",
  },
  navMain: [
    {
      title: "Home",
      url: "/",
      icon: Home,
      isActive: false,
    },
    {
      title: "All Workflows",
      url: "#",
      icon: Workflow,
      isActive: false,
    },
    {
      title: "New Workflow",
      url: "/workflows/new", 
      icon: Plus,
      isActive: false,
    },

  ],
  workflowItems: [

    {
      title: "Nodes",
      url: "#",
      icon: Database,
      isActive: true,
    },
    {
      title: "Executions",
      url: "#",
      icon: Activity,
      isActive: false,
    },
    {
      title: "Variables",
      url: "#",
      icon: Variable,
      isActive: false,
    },
  ],
  bottomItems: [
    {
      title: "Teams",
      url: "#",
      icon: Users,
      isActive: false,
    },
    {
      title: "Active Triggers",
      url: "#",
      icon: CalendarClock,
      isActive: false,
    },
    {
      title: "All Credentials",
      url: "#",
      icon: Key,
      isActive: false,
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings,
      isActive: false,
    },
  ],

}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { open, setOpen } = useSidebar()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { id: workflowId } = useParams<{ id: string }>()
  const { 
    activeWorkflowItem, 
    setActiveWorkflowItem,
    headerSlot,
    detailSidebar,
    setDetailSidebar
  } = useSidebarContext()
  
  // Theme hook
  const { theme, setTheme } = useTheme()
  
  // Team hook
  const { teams } = useTeam()

  // Get workflow state to check for unsaved changes
  const { isDirty, isTitleDirty } = useWorkflowStore()
  const { showConfirm, ConfirmDialog } = useConfirmDialog()

  // Team modals state
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = React.useState(false)
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = React.useState(false)
  const [isManageMembersDialogOpen, setIsManageMembersDialogOpen] = React.useState(false)
  const [isTeamSettingsModalOpen, setIsTeamSettingsModalOpen] = React.useState(false)
  const [selectedTeam, setSelectedTeam] = React.useState<{ id: string; name: string; userRole: string } | null>(null)
  const [selectedTeamForSettings, setSelectedTeamForSettings] = React.useState<{ id: string; name: string; description?: string; color: string } | null>(null)

  const handleNavigation = async (url: string) => {
    // Check if navigating to "New Workflow" and there are unsaved changes
    if (url === "/workflows/new" && (isDirty || isTitleDirty)) {
      const confirmed = await showConfirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes in the current workflow. Creating a new workflow will discard these changes.',
        details: [
          'All unsaved changes will be lost',
          'Consider saving your current workflow first'
        ],
        confirmText: 'Create New Workflow',
        cancelText: 'Cancel',
        severity: 'warning'
      })

      if (!confirmed) return
    }

    // Pass current location as state when navigating to /workflows/new
    if (url === "/workflows/new") {
      navigate(url, { state: { from: location.pathname } })
    } else {
      navigate(url)
    }
  }

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden"
      {...props}
    >
      <div className="flex h-full">
        {/* This is the first sidebar */}
        {/* We disable collapsible and adjust width to icon. */}
        {/* This will make the sidebar appear as icons. */}
        <Sidebar
          collapsible="none"
          className="w-[calc(var(--sidebar-width-icon)+1px)] border-r"
        >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <a href="#">
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    <Workflow className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">node drop</span>
                    <span className="truncate text-xs">Workflow</span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {/* Navigation Items */}
          <SidebarGroup>
         
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {data.navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      onClick={() => {
                        if (item.title === "All Workflows") {
                          // Handle "All Workflows" like other workflow items
                          if (activeWorkflowItem?.title === item.title) {
                            setOpen(!open)
                          } else {
                            setActiveWorkflowItem(item)
                            setOpen(true)
                          }
                        } else if (item.url !== "#") {
                          handleNavigation(item.url)
                        }
                      }}
                      isActive={item.title === "All Workflows" && activeWorkflowItem?.title === item.title}
                      className="px-2.5 md:px-2"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Workflow Items */}
          <SidebarGroup>
            
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {data.workflowItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      onClick={() => {
                        if (activeWorkflowItem?.title === item.title) {
                          // Toggle sidebar if same item is clicked
                          setOpen(!open)
                        } else {
                          // Set new item and open sidebar
                          setActiveWorkflowItem(item)
                          setOpen(true)
                        }
                      }}
                      isActive={activeWorkflowItem?.title === item.title}
                      className="px-2.5 md:px-2"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Bottom Items */}
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {data.bottomItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      onClick={() => {
                        if (activeWorkflowItem?.title === item.title) {
                          // Toggle sidebar if same item is clicked
                          setOpen(!open)
                        } else {
                          // Set new item and open sidebar
                          setActiveWorkflowItem(item)
                          setOpen(true)
                        }
                      }}
                      isActive={activeWorkflowItem?.title === item.title}
                      className="px-2.5 md:px-2"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={user || data.user} />
        </SidebarFooter>
      </Sidebar>
      {/* This is the second sidebar */}
      {/* We disable collapsible and let it fill remaining space */}
      <Sidebar collapsible="none" className="flex-1 md:flex">
        {/* Show DetailSidebar header when detail sidebar is open, otherwise show normal header */}
        {detailSidebar ? (
          <SidebarHeader className="gap-3 border-b p-4 bg-sidebar/50">
            <div className="flex w-full items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDetailSidebar(null)}
                className="h-8 w-8 p-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-sidebar-foreground truncate">
                  {detailSidebar.title}
                </h2>
              </div>
            </div>
          </SidebarHeader>
        ) : (
          <SidebarHeader className="gap-3.5 border-b p-4">
            {/* Team Switcher - Only show for context-aware views and when user has teams */}
            {teams.length > 0 && (activeWorkflowItem?.title === "All Workflows" || 
              activeWorkflowItem?.title === "All Credentials") && (
              <TeamSwitcher 
                onTeamChange={(teamId) => {
                  console.log("Team changed to:", teamId)
                  // TODO: Update context and reload data
                }}
              />
            )}
            
            <div className="flex w-full items-center justify-between">
              <div className="text-foreground text-base font-medium">
                {activeWorkflowItem?.title}
              </div>
            </div>
            {/* Render header slot if available - each component provides its own header and search */}
            {headerSlot}
          </SidebarHeader>
        )}
        
        <SidebarContent>
          <SidebarGroup className="px-0 h-full">
            <SidebarGroupContent className="h-full">
              {/* Show DetailSidebar content when open, otherwise show normal content */}
              {detailSidebar ? (
                detailSidebar.content
              ) : (
                <>
                  {activeWorkflowItem?.title === "All Workflows" && (
                    <WorkflowsList />
                  )}
                  
                  {activeWorkflowItem?.title === "All Credentials" && (
                    <CredentialsList />
                  )}
                  
                  {activeWorkflowItem?.title === "Variables" && (
                    <VariablesList currentWorkflowId={workflowId && workflowId !== 'new' ? workflowId : undefined} />
                  )}
                  
                  {activeWorkflowItem?.title === "Nodes" && (
                    <NodeTypesList />
                  )}
                  
                  {activeWorkflowItem?.title === "Executions" && (
                    <ExecutionsList />
                  )}
                  
                  {activeWorkflowItem?.title === "Teams" && (
                    <TeamsList 
                      onTeamSelect={(team) => {
                        setSelectedTeam(team)
                        setIsManageMembersDialogOpen(true)
                      }}
                      onCreateTeam={() => {
                        setIsCreateTeamModalOpen(true)
                      }}
                      onTeamSettings={(team) => {
                        setSelectedTeamForSettings(team)
                        setIsTeamSettingsModalOpen(true)
                      }}
                    />
                  )}
                  
                  {activeWorkflowItem?.title === "Active Triggers" && (
                    <ScheduledExecutionsList />
                  )}
                  
                  {activeWorkflowItem?.title === "Settings" && (
                    <div className="flex flex-col h-full">
                      <div className="p-4 space-y-6 overflow-y-auto flex-1">
                      {/* Theme Section */}
                      <div>
                        <h4 className="text-sm font-medium mb-3">Appearance</h4>
                        <div className="space-y-2">
                          <label className="text-sm text-muted-foreground mb-2 block">Theme</label>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => setTheme('light')}
                              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:bg-sidebar-accent ${
                                theme === 'light' 
                                  ? 'border-sidebar-primary bg-sidebar-accent' 
                                  : 'border-sidebar-border'
                              }`}
                            >
                              <Sun className="w-5 h-5" />
                              <span className="text-xs font-medium">Light</span>
                            </button>
                            <button
                              onClick={() => setTheme('dark')}
                              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:bg-sidebar-accent ${
                                theme === 'dark' 
                                  ? 'border-sidebar-primary bg-sidebar-accent' 
                                  : 'border-sidebar-border'
                              }`}
                            >
                              <Moon className="w-5 h-5" />
                              <span className="text-xs font-medium">Dark</span>
                            </button>
                            <button
                              onClick={() => setTheme('system')}
                              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:bg-sidebar-accent ${
                                theme === 'system' 
                                  ? 'border-sidebar-primary bg-sidebar-accent' 
                                  : 'border-sidebar-border'
                              }`}
                            >
                              <Monitor className="w-5 h-5" />
                              <span className="text-xs font-medium">System</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <SidebarSeparator />

                      {/* Canvas View Settings */}
                      <div>
                        <h4 className="text-sm font-medium mb-3">Canvas View</h4>
                        <div className="space-y-2 text-sm">
                          <CanvasViewSettings />
                        </div>
                      </div>

                      <SidebarSeparator />

                      {/* Canvas Zoom Controls */}
                      <div>
                        <h4 className="text-sm font-medium mb-3">Zoom Controls</h4>
                        <div className="flex flex-col gap-2">
                          <CanvasZoomControls />
                        </div>
                      </div>

                      <SidebarSeparator />

                      {/* Canvas Boundary Settings */}
                      <CanvasBoundarySettings />
                    </div>
                    </div>
                  )}
                </>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      </div>
      <ConfirmDialog />
      <CreateTeamModal 
        open={isCreateTeamModalOpen}
        onOpenChange={setIsCreateTeamModalOpen}
        onSuccess={(teamId) => {
          console.log("Team created:", teamId)
        }}
      />
      {selectedTeam && (
        <>
          <AddMemberModal 
            open={isAddMemberModalOpen}
            onOpenChange={setIsAddMemberModalOpen}
            teamId={selectedTeam.id}
            teamName={selectedTeam.name}
            onSuccess={() => {
              // Refresh members list
              setIsManageMembersDialogOpen(true)
            }}
          />
          <ManageMembersDialog 
            open={isManageMembersDialogOpen}
            onOpenChange={setIsManageMembersDialogOpen}
            teamId={selectedTeam.id}
            teamName={selectedTeam.name}
            userRole={selectedTeam.userRole as any}
            onAddMember={() => {
              setIsManageMembersDialogOpen(false)
              setIsAddMemberModalOpen(true)
            }}
          />
        </>
      )}
      {selectedTeamForSettings && (
        <TeamSettingsModal 
          open={isTeamSettingsModalOpen}
          onOpenChange={setIsTeamSettingsModalOpen}
          teamId={selectedTeamForSettings.id}
          initialData={{
            name: selectedTeamForSettings.name,
            description: selectedTeamForSettings.description,
            color: selectedTeamForSettings.color,
          }}
          onSuccess={() => {
            // Team updated successfully
          }}
          onDelete={() => {
            // Team deleted, close modal
            setIsTeamSettingsModalOpen(false)
            setSelectedTeamForSettings(null)
          }}
        />
      )}
    </Sidebar>
  )
}

// Canvas Zoom Controls Component
function CanvasZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlowUIStore()

  return (
    <>
      <Button
        onClick={zoomIn}
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
      >
        <ZoomIn className="w-4 h-4" />
        Zoom In
      </Button>
      <Button
        onClick={zoomOut}
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
      >
        <ZoomOut className="w-4 h-4" />
        Zoom Out
      </Button>
      <Button
        onClick={fitView}
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
      >
        <Maximize className="w-4 h-4" />
        Fit to View
      </Button>
    </>
  )
}

// Canvas View Settings Component
function CanvasViewSettings() {
  const {
    showMinimap,
    showBackground,
    showControls,
    panOnDrag,
    zoomOnScroll,
    editableConnections,
    toggleMinimap,
    toggleBackground,
    toggleControls,
    togglePanOnDrag,
    toggleZoomOnScroll,
    toggleEditableConnections,
    changeBackgroundVariant,
  } = useReactFlowUIStore()

  return (
    <>
      <div className="flex justify-between items-center">
        <span>Show Minimap</span>
        <Switch checked={showMinimap} onCheckedChange={toggleMinimap} />
      </div>
      <div className="flex justify-between items-center">
        <span>Show Grid Background</span>
        <Switch checked={showBackground} onCheckedChange={toggleBackground} />
      </div>
      <div className="flex justify-between items-center">
        <span>Show Controls</span>
        <Switch checked={showControls} onCheckedChange={toggleControls} />
      </div>
      <div className="flex justify-between items-center">
        <span>Pan on Drag</span>
        <Switch checked={panOnDrag} onCheckedChange={togglePanOnDrag} />
      </div>
      <div className="flex justify-between items-center">
        <span>Zoom on Scroll</span>
        <Switch checked={zoomOnScroll} onCheckedChange={toggleZoomOnScroll} />
      </div>
      <div className="flex justify-between items-center">
        <span>Editable Connections</span>
        <Switch checked={editableConnections} onCheckedChange={toggleEditableConnections} />
      </div>
      
      {/* Background Pattern Selector */}
      {showBackground && (
        <div className="pt-2 border-t">
          <label className="text-xs text-muted-foreground mb-2 block">Background Pattern</label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => changeBackgroundVariant('dots')}
              className="px-2 py-1.5 text-xs rounded border hover:bg-sidebar-accent transition-colors text-left"
            >
              Dots
            </button>
            <button
              onClick={() => changeBackgroundVariant('lines')}
              className="px-2 py-1.5 text-xs rounded border hover:bg-sidebar-accent transition-colors text-left"
            >
              Lines
            </button>
            <button
              onClick={() => changeBackgroundVariant('cross')}
              className="px-2 py-1.5 text-xs rounded border hover:bg-sidebar-accent transition-colors text-left"
            >
              Cross
            </button>
            <button
              onClick={() => changeBackgroundVariant('none')}
              className="px-2 py-1.5 text-xs rounded border hover:bg-sidebar-accent transition-colors text-left"
            >
              None
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// Canvas Boundary Settings Component
function CanvasBoundarySettings() {
  const { canvasBoundaryX, canvasBoundaryY, setCanvasBoundaryX, setCanvasBoundaryY } = useReactFlowUIStore()

  return (
    <div>
      <h4 className="text-sm font-medium mb-3">Canvas Boundaries</h4>
      <div className="space-y-4 text-sm">
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-muted-foreground text-xs">Horizontal (X)</span>
            <span className="font-mono text-xs font-medium">{canvasBoundaryX}px</span>
          </div>
          <input
            type="range"
            min="500"
            max="10000"
            step="100"
            value={canvasBoundaryX}
            onChange={(e) => setCanvasBoundaryX(Number(e.target.value))}
            className="w-full h-1.5 bg-sidebar-border rounded-lg appearance-none cursor-pointer accent-sidebar-primary"
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-muted-foreground text-xs">Vertical (Y)</span>
            <span className="font-mono text-xs font-medium">{canvasBoundaryY}px</span>
          </div>
          <input
            type="range"
            min="500"
            max="10000"
            step="100"
            value={canvasBoundaryY}
            onChange={(e) => setCanvasBoundaryY(Number(e.target.value))}
            className="w-full h-1.5 bg-sidebar-border rounded-lg appearance-none cursor-pointer accent-sidebar-primary"
          />
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          Control how far you can pan and place nodes on the canvas
        </p>
      </div>
    </div>
  )
}
