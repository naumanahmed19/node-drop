/**
 * Example component showing how workflow cards will look with team context
 * This demonstrates the visual design - not meant for production use
 */

import * as React from "react"
import { Workflow, MoreVertical, Play, Clock } from "lucide-react"
import { TeamBadge, TeamShareBadges } from "./TeamBadge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ExampleWorkflowCards() {
  return (
    <div className="p-6 space-y-4 bg-background">
      <h2 className="text-lg font-semibold mb-4">Workflow Cards with Team Context</h2>
      
      {/* Personal Workflow */}
      <WorkflowCard
        name="My Personal Workflow"
        description="Data processing automation"
        type="personal"
        lastRun="2 hours ago"
        status="active"
      />

      {/* Team Workflow (You created) */}
      <WorkflowCard
        name="Production Deploy"
        description="Automated deployment pipeline"
        type="team"
        teamName="Engineering Team"
        teamMemberCount={12}
        createdBy="You"
        lastRun="5 minutes ago"
        status="active"
      />

      {/* Team Workflow (Someone else created) */}
      <WorkflowCard
        name="Data Sync Pipeline"
        description="Sync data between systems"
        type="team"
        teamName="Engineering Team"
        teamMemberCount={12}
        createdBy="Alice"
        lastRun="1 hour ago"
        status="active"
      />

      {/* Team Workflow (Different team) */}
      <WorkflowCard
        name="Marketing Campaign"
        description="Automated email campaigns"
        type="team"
        teamName="Marketing Team"
        teamMemberCount={5}
        createdBy="Jane"
        lastRun="3 hours ago"
        status="inactive"
      />

      <h2 className="text-lg font-semibold mb-4 mt-8">Credential Cards with Sharing</h2>

      {/* Personal Credential (Not shared) */}
      <CredentialCard
        name="My GitHub Token"
        type="apiKey"
        ownerType="personal"
        createdAt="2 weeks ago"
      />

      {/* Personal Credential (Shared with users) */}
      <CredentialCard
        name="Production API Key"
        type="apiKey"
        ownerType="personal"
        createdAt="1 month ago"
        sharedWith={{
          users: [
            { name: "Bob", email: "bob@example.com" },
            { name: "Charlie", email: "charlie@example.com" },
          ]
        }}
      />

      {/* Personal Credential (Shared with team + users) */}
      <CredentialCard
        name="AWS Production"
        type="oauth2"
        ownerType="personal"
        createdAt="2 months ago"
        sharedWith={{
          teams: [{ name: "Engineering", memberCount: 12 }],
          users: [
            { name: "Jane", email: "jane@example.com" },
            { name: "Frank", email: "frank@example.com" },
          ]
        }}
      />

      {/* Team Credential */}
      <CredentialCard
        name="GitHub API"
        type="apiKey"
        ownerType="team"
        teamName="Engineering Team"
        teamMemberCount={12}
        createdAt="3 months ago"
        yourAccess="USE"
      />
    </div>
  )
}

interface WorkflowCardProps {
  name: string
  description: string
  type: "personal" | "team"
  teamName?: string
  teamMemberCount?: number
  createdBy?: string
  lastRun: string
  status: "active" | "inactive"
}

function WorkflowCard({
  name,
  description,
  type,
  teamName,
  teamMemberCount,
  createdBy,
  lastRun,
  status,
}: WorkflowCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors cursor-pointer",
        status === "active" ? "border-border" : "border-border/50 opacity-75"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          "flex items-center justify-center h-10 w-10 rounded-lg shrink-0",
          status === "active" ? "bg-primary/10" : "bg-muted"
        )}>
          <Workflow className={cn(
            "h-5 w-5",
            status === "active" ? "text-primary" : "text-muted-foreground"
          )} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-medium text-sm truncate">{name}</h3>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
            {description}
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Team/Personal Badge */}
            {type === "personal" ? (
              <TeamBadge type="personal" size="sm" />
            ) : (
              <TeamBadge
                type="team"
                teamName={teamName}
                memberCount={teamMemberCount}
                size="sm"
              />
            )}

            {/* Creator */}
            {createdBy && (
              <>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{createdBy}</span>
              </>
            )}

            {/* Last run */}
            <span className="text-xs text-muted-foreground">•</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{lastRun}</span>
            </div>

            {/* Status */}
            <span className="text-xs text-muted-foreground">•</span>
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium",
              status === "active" ? "text-green-600" : "text-muted-foreground"
            )}>
              <div className={cn(
                "h-1.5 w-1.5 rounded-full",
                status === "active" ? "bg-green-600" : "bg-muted-foreground"
              )} />
              <span>{status === "active" ? "Active" : "Inactive"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface CredentialCardProps {
  name: string
  type: string
  ownerType: "personal" | "team"
  teamName?: string
  teamMemberCount?: number
  createdAt: string
  yourAccess?: "USE" | "VIEW" | "EDIT"
  sharedWith?: {
    teams?: Array<{ name: string; memberCount: number }>
    users?: Array<{ name: string; email: string }>
  }
}

function CredentialCard({
  name,
  type,
  ownerType,
  teamName,
  teamMemberCount,
  createdAt,
  yourAccess,
  sharedWith,
}: CredentialCardProps) {
  const hasShares = (sharedWith?.teams?.length || 0) + (sharedWith?.users?.length || 0) > 0

  return (
    <div className="group relative rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors cursor-pointer">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 shrink-0">
          <span className="text-lg">🔑</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-medium text-sm truncate">{name}</h3>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mb-2">
            [{type}] • {createdAt}
          </p>

          {/* Owner */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground">Owner:</span>
            {ownerType === "personal" ? (
              <TeamBadge type="personal" size="sm" />
            ) : (
              <TeamBadge
                type="team"
                teamName={teamName}
                memberCount={teamMemberCount}
                size="sm"
              />
            )}
            {yourAccess && (
              <>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs font-medium text-muted-foreground">
                  Your access: {yourAccess}
                </span>
              </>
            )}
          </div>

          {/* Shared with */}
          {hasShares && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Shared with:</span>
              <TeamShareBadges
                teams={sharedWith?.teams}
                users={sharedWith?.users}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
