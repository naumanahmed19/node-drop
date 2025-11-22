/**
 * Demo page to showcase Team UI components
 * This page demonstrates how teams will look in the application
 * 
 * To view this page, add a route in App.tsx:
 * <Route path="/teams-demo" element={<TeamsDemo />} />
 */

import * as React from "react"
import { TeamSwitcher, TeamBadge, TeamShareBadges, ExampleWorkflowCards } from "@/components/team"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export function TeamsDemo() {
  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Teams UI Components Demo</h1>
        <p className="text-muted-foreground">
          Preview of how teams will look in Node-Drop
        </p>
      </div>

      <div className="space-y-8">
        {/* Team Switcher */}
        <Card>
          <CardHeader>
            <CardTitle>Team Switcher</CardTitle>
            <CardDescription>
              Dropdown to switch between personal workspace and teams. 
              This will appear at the top of the content sidebar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm">
              <TeamSwitcher 
                onTeamChange={(teamId) => {
                  console.log("Team changed to:", teamId)
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Team Badges */}
        <Card>
          <CardHeader>
            <CardTitle>Team Badges</CardTitle>
            <CardDescription>
              Visual indicators showing whether content is personal or team-owned
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Personal Badge</h4>
                <div className="flex items-center gap-2">
                  <TeamBadge type="personal" size="sm" />
                  <TeamBadge type="personal" size="md" />
                  <TeamBadge type="personal" size="lg" />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-2">Team Badges</h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <TeamBadge type="team" teamName="Engineering" memberCount={12} size="sm" />
                  <TeamBadge type="team" teamName="Marketing" memberCount={5} size="md" />
                  <TeamBadge type="team" teamName="Design Team" memberCount={8} size="lg" />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-2">Share Badges (Teams + Users)</h4>
                <div className="space-y-2">
                  <TeamShareBadges
                    teams={[
                      { name: "Engineering", memberCount: 12 }
                    ]}
                    users={[
                      { name: "Alice", email: "alice@example.com" },
                      { name: "Bob", email: "bob@example.com" }
                    ]}
                  />
                  
                  <TeamShareBadges
                    teams={[
                      { name: "Engineering", memberCount: 12 },
                      { name: "QA", memberCount: 5 }
                    ]}
                    users={[
                      { name: "Alice", email: "alice@example.com" },
                      { name: "Bob", email: "bob@example.com" },
                      { name: "Charlie", email: "charlie@example.com" },
                      { name: "David", email: "david@example.com" },
                      { name: "Eve", email: "eve@example.com" }
                    ]}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Workflow & Credential Cards */}
        <Card>
          <CardHeader>
            <CardTitle>Workflow & Credential Cards with Team Context</CardTitle>
            <CardDescription>
              How workflows and credentials will display team information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExampleWorkflowCards />
          </CardContent>
        </Card>

        {/* Context Switching Demo */}
        <Card>
          <CardHeader>
            <CardTitle>How Context Switching Works</CardTitle>
            <CardDescription>
              Visual explanation of personal vs team context
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <TeamBadge type="personal" size="sm" />
                  Personal Context
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                  <li>Shows your personal workflows</li>
                  <li>Shows your personal credentials</li>
                  <li>Shows credentials shared with you individually</li>
                  <li>Default view for new users</li>
                </ul>
              </div>

              <div className="p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <TeamBadge type="team" teamName="Engineering Team" memberCount={12} size="sm" />
                  Team Context
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                  <li>Shows team workflows (created by any team member)</li>
                  <li>Shows team credentials (shared with entire team)</li>
                  <li>Shows team members and their roles</li>
                  <li>Can create new team workflows/credentials</li>
                </ul>
              </div>

              <div className="p-4 border rounded-lg bg-blue-500/10 border-blue-500/20">
                <h4 className="font-medium mb-2">💡 Key Feature: Seamless Switching</h4>
                <p className="text-sm text-muted-foreground">
                  Users can instantly switch between personal and team contexts using the 
                  Team Switcher dropdown. No page reload, no confusion. The sidebar content 
                  updates to show the relevant workflows, credentials, and resources for 
                  the selected context.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Implementation Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Implementation Notes</CardTitle>
            <CardDescription>
              Technical details for developers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-1">Components Created:</h4>
                <ul className="list-disc ml-6 text-muted-foreground space-y-1">
                  <li><code>TeamSwitcher.tsx</code> - Dropdown for switching contexts</li>
                  <li><code>TeamBadge.tsx</code> - Visual indicators for team/personal</li>
                  <li><code>TeamsList.tsx</code> - Team management view</li>
                  <li><code>ExampleWorkflowCardWithTeam.tsx</code> - Demo cards</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-1">Integration Points:</h4>
                <ul className="list-disc ml-6 text-muted-foreground space-y-1">
                  <li>TeamSwitcher added to app-sidebar.tsx header</li>
                  <li>Teams icon added to sidebar navigation</li>
                  <li>TeamsList view integrated into sidebar content</li>
                  <li>Ready for backend API integration</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-1">Next Steps:</h4>
                <ul className="list-disc ml-6 text-muted-foreground space-y-1">
                  <li>Create team context provider</li>
                  <li>Implement backend API endpoints</li>
                  <li>Update WorkflowsList to filter by context</li>
                  <li>Update CredentialsList to filter by context</li>
                  <li>Add team creation modal</li>
                  <li>Add team management dashboard</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default TeamsDemo
