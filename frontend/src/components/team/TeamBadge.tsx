
import { Users, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface TeamBadgeProps {
  type: "personal" | "team"
  teamName?: string
  memberCount?: number
  className?: string
  size?: "sm" | "md" | "lg"
}

export function TeamBadge({ 
  type, 
  teamName, 
  memberCount, 
  className,
  size = "sm" 
}: TeamBadgeProps) {
  const sizeClasses = {
    sm: "text-xs h-5 px-1.5 gap-1",
    md: "text-sm h-6 px-2 gap-1.5",
    lg: "text-sm h-7 px-2.5 gap-2"
  }

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4"
  }

  if (type === "personal") {
    return (
      <Badge 
        variant="secondary" 
        className={cn(
          "font-normal",
          sizeClasses[size],
          className
        )}
      >
        <User className={iconSizes[size]} />
        <span>Personal</span>
      </Badge>
    )
  }

  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "font-normal",
        sizeClasses[size],
        className
      )}
    >
      <Users className={iconSizes[size]} />
      <span className="truncate max-w-[120px]">
        {teamName}
        {memberCount && ` (${memberCount})`}
      </span>
    </Badge>
  )
}

// Component for showing multiple badges (team + individual users)
interface TeamShareBadgesProps {
  teams?: Array<{ name: string; memberCount: number }>
  users?: Array<{ name: string; email: string }>
  className?: string
}

export function TeamShareBadges({ teams = [], users = [], className }: TeamShareBadgesProps) {
  const totalShares = teams.length + users.length
  
  if (totalShares === 0) {
    return null
  }

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {/* Team badges */}
      {teams.map((team, index) => (
        <TeamBadge
          key={`team-${index}`}
          type="team"
          teamName={team.name}
          memberCount={team.memberCount}
          size="sm"
        />
      ))}
      
      {/* Individual user avatars/badges */}
      {users.slice(0, 3).map((user, index) => (
        <div
          key={`user-${index}`}
          className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-sidebar-accent text-xs font-medium border border-sidebar-border"
          title={user.email}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
      ))}
      
      {/* Show +N if more than 3 users */}
      {users.length > 3 && (
        <div className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-sidebar-accent text-xs font-medium border border-sidebar-border">
          +{users.length - 3}
        </div>
      )}
    </div>
  )
}
