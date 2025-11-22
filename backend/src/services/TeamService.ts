import { PrismaClient, TeamRole } from "@prisma/client";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();

export interface CreateTeamData {
  name: string;
  slug?: string;
  description?: string;
  color?: string;
  ownerId: string;
}

export interface UpdateTeamData {
  name?: string;
  slug?: string;
  description?: string;
  color?: string;
  settings?: any;
}

export interface AddMemberData {
  email: string;
  role?: TeamRole;
}

export class TeamService {
  /**
   * Create a new team
   */
  static async createTeam(data: CreateTeamData) {
    try {
      // Generate slug from name if not provided
      const slug = data.slug || this.generateSlug(data.name);

      // Check if slug already exists
      const existingTeam = await prisma.team.findUnique({
        where: { slug },
      });

      if (existingTeam) {
        throw new AppError("Team slug already exists", 400);
      }

      // Create team
      const team = await prisma.team.create({
        data: {
          name: data.name,
          slug,
          description: data.description,
          color: data.color || "#3b82f6",
          ownerId: data.ownerId,
        },
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { members: true, workflows: true, credentials: true },
          },
        },
      });

      // Add owner as team member with OWNER role
      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: data.ownerId,
          role: TeamRole.OWNER,
        },
      });

      logger.info(`Team created: ${team.id} by user ${data.ownerId}`);

      return team;
    } catch (error) {
      logger.error("Error creating team:", error);
      throw error;
    }
  }

  /**
   * Get user's teams (owned + member of)
   */
  static async getUserTeams(userId: string) {
    try {
      const teams = await prisma.team.findMany({
        where: {
          OR: [
            { ownerId: userId }, // Teams user owns
            { members: { some: { userId } } }, // Teams user is member of
          ],
        },
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          _count: {
            select: { workflows: true, credentials: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Add user's role to each team
      const teamsWithRole = teams.map((team) => {
        const membership = team.members.find((m) => m.userId === userId);
        return {
          ...team,
          userRole: membership?.role || TeamRole.OWNER,
        };
      });

      return teamsWithRole;
    } catch (error) {
      logger.error("Error getting user teams:", error);
      throw error;
    }
  }

  /**
   * Get team by ID
   */
  static async getTeam(teamId: string, userId: string) {
    try {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          _count: {
            select: { workflows: true, credentials: true },
          },
        },
      });

      if (!team) {
        throw new AppError("Team not found", 404);
      }

      // Check if user has access
      const isMember = team.members.some((m) => m.userId === userId);
      if (!isMember && team.ownerId !== userId) {
        throw new AppError("Access denied", 403);
      }

      return team;
    } catch (error) {
      logger.error("Error getting team:", error);
      throw error;
    }
  }

  /**
   * Update team
   */
  static async updateTeam(teamId: string, userId: string, data: UpdateTeamData) {
    try {
      // Check if user is owner
      const team = await prisma.team.findUnique({
        where: { id: teamId },
      });

      if (!team) {
        throw new AppError("Team not found", 404);
      }

      if (team.ownerId !== userId) {
        throw new AppError("Only team owner can update team", 403);
      }

      // If slug is being updated, check uniqueness
      if (data.slug && data.slug !== team.slug) {
        const existingTeam = await prisma.team.findUnique({
          where: { slug: data.slug },
        });

        if (existingTeam) {
          throw new AppError("Team slug already exists", 400);
        }
      }

      const updatedTeam = await prisma.team.update({
        where: { id: teamId },
        data,
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { members: true, workflows: true, credentials: true },
          },
        },
      });

      logger.info(`Team updated: ${teamId} by user ${userId}`);

      return updatedTeam;
    } catch (error) {
      logger.error("Error updating team:", error);
      throw error;
    }
  }

  /**
   * Delete team
   */
  static async deleteTeam(teamId: string, userId: string) {
    try {
      // Check if user is owner
      const team = await prisma.team.findUnique({
        where: { id: teamId },
      });

      if (!team) {
        throw new AppError("Team not found", 404);
      }

      if (team.ownerId !== userId) {
        throw new AppError("Only team owner can delete team", 403);
      }

      // Delete team (cascade will handle members and shares)
      await prisma.team.delete({
        where: { id: teamId },
      });

      logger.info(`Team deleted: ${teamId} by user ${userId}`);

      return { success: true };
    } catch (error) {
      logger.error("Error deleting team:", error);
      throw error;
    }
  }

  /**
   * Add member to team
   */
  static async addMember(teamId: string, userId: string, data: AddMemberData) {
    try {
      // Check if user is owner or admin
      const canManage = await this.canManageMembers(teamId, userId);
      if (!canManage) {
        throw new AppError("Only team owner can add members", 403);
      }

      // Find user by email
      const targetUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!targetUser) {
        throw new AppError("User not found", 404);
      }

      // Check if already a member
      const existingMember = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId: targetUser.id,
          },
        },
      });

      if (existingMember) {
        throw new AppError("User is already a team member", 400);
      }

      // Add member
      const member = await prisma.teamMember.create({
        data: {
          teamId,
          userId: targetUser.id,
          role: data.role || TeamRole.MEMBER,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      logger.info(`Member added to team ${teamId}: ${targetUser.id}`);

      // TODO: Send email notification to new member

      return member;
    } catch (error) {
      logger.error("Error adding team member:", error);
      throw error;
    }
  }

  /**
   * Remove member from team
   */
  static async removeMember(teamId: string, userId: string, targetUserId: string) {
    try {
      // Check if user can manage members
      const canManage = await this.canManageMembers(teamId, userId);
      if (!canManage) {
        throw new AppError("Only team owner can remove members", 403);
      }

      // Can't remove team owner
      const team = await prisma.team.findUnique({
        where: { id: teamId },
      });

      if (team?.ownerId === targetUserId) {
        throw new AppError("Cannot remove team owner", 400);
      }

      // Remove member
      await prisma.teamMember.delete({
        where: {
          teamId_userId: {
            teamId,
            userId: targetUserId,
          },
        },
      });

      logger.info(`Member removed from team ${teamId}: ${targetUserId}`);

      return { success: true };
    } catch (error) {
      logger.error("Error removing team member:", error);
      throw error;
    }
  }

  /**
   * Update member role
   */
  static async updateMemberRole(
    teamId: string,
    userId: string,
    targetUserId: string,
    newRole: TeamRole
  ) {
    try {
      // Check if user is owner
      const team = await prisma.team.findUnique({
        where: { id: teamId },
      });

      if (!team) {
        throw new AppError("Team not found", 404);
      }

      if (team.ownerId !== userId) {
        throw new AppError("Only team owner can change roles", 403);
      }

      // Can't change owner's role
      if (team.ownerId === targetUserId) {
        throw new AppError("Cannot change team owner's role", 400);
      }

      // Update role
      const member = await prisma.teamMember.update({
        where: {
          teamId_userId: {
            teamId,
            userId: targetUserId,
          },
        },
        data: { role: newRole },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      logger.info(`Member role updated in team ${teamId}: ${targetUserId} -> ${newRole}`);

      return member;
    } catch (error) {
      logger.error("Error updating member role:", error);
      throw error;
    }
  }

  /**
   * Get team members
   */
  static async getTeamMembers(teamId: string, userId: string) {
    try {
      // Check if user has access to team
      const isMember = await this.isTeamMember(teamId, userId);
      if (!isMember) {
        throw new AppError("Access denied", 403);
      }

      const members = await prisma.teamMember.findMany({
        where: { teamId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      });

      return members;
    } catch (error) {
      logger.error("Error getting team members:", error);
      throw error;
    }
  }

  /**
   * Check if user is team member
   */
  static async isTeamMember(teamId: string, userId: string): Promise<boolean> {
    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    return !!member;
  }

  /**
   * Get user's role in team
   */
  static async getTeamRole(teamId: string, userId: string): Promise<TeamRole | null> {
    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    return member?.role || null;
  }

  /**
   * Check if user can manage team members
   */
  static async canManageMembers(teamId: string, userId: string): Promise<boolean> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    return team?.ownerId === userId;
  }

  /**
   * Generate URL-friendly slug from team name
   */
  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50);
  }

  // ============================================
  // TEAM CREDENTIAL SHARING METHODS
  // ============================================

  /**
   * Share credential with team
   */
  static async shareCredentialWithTeam(
    credentialId: string,
    teamId: string,
    userId: string,
    permission: "USE" | "VIEW" | "EDIT" = "USE"
  ) {
    try {
      // Verify user owns the credential
      const credential = await prisma.credential.findFirst({
        where: { id: credentialId, userId },
      });

      if (!credential) {
        throw new AppError("Credential not found or access denied", 404);
      }

      // Verify user has access to team
      const isMember = await this.isTeamMember(teamId, userId);
      if (!isMember) {
        throw new AppError("Access denied to team", 403);
      }

      // Check if already shared
      const existingShare = await prisma.teamCredentialShare.findUnique({
        where: {
          credentialId_teamId: {
            credentialId,
            teamId,
          },
        },
      });

      if (existingShare) {
        throw new AppError("Credential already shared with this team", 400);
      }

      // Create share
      const share = await prisma.teamCredentialShare.create({
        data: {
          credentialId,
          teamId,
          permission,
          sharedBy: userId,
        },
        include: {
          team: {
            select: { id: true, name: true, slug: true },
          },
          credential: {
            select: { id: true, name: true, type: true },
          },
        },
      });

      logger.info(
        `Credential shared with team: ${credentialId} -> ${teamId} (permission: ${permission})`
      );

      return share;
    } catch (error) {
      logger.error("Error sharing credential with team:", error);
      throw error;
    }
  }

  /**
   * Unshare credential from team
   */
  static async unshareCredentialFromTeam(
    credentialId: string,
    teamId: string,
    userId: string
  ) {
    try {
      // Verify user owns the credential
      const credential = await prisma.credential.findFirst({
        where: { id: credentialId, userId },
      });

      if (!credential) {
        throw new AppError("Credential not found or access denied", 404);
      }

      // Delete share
      const deleted = await prisma.teamCredentialShare.deleteMany({
        where: {
          credentialId,
          teamId,
        },
      });

      if (deleted.count === 0) {
        throw new AppError("Share not found", 404);
      }

      logger.info(`Credential unshared from team: ${credentialId} -> ${teamId}`);

      return { success: true };
    } catch (error) {
      logger.error("Error unsharing credential from team:", error);
      throw error;
    }
  }

  /**
   * Get team credential shares
   */
  static async getTeamCredentialShares(teamId: string, userId: string) {
    try {
      // Verify user has access to team
      const isMember = await this.isTeamMember(teamId, userId);
      if (!isMember) {
        throw new AppError("Access denied to team", 403);
      }

      const shares = await prisma.teamCredentialShare.findMany({
        where: { teamId },
        include: {
          credential: {
            select: {
              id: true,
              name: true,
              type: true,
              userId: true,
              createdAt: true,
              updatedAt: true,
              expiresAt: true,
            },
          },
          sharer: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { sharedAt: "desc" },
      });

      return shares;
    } catch (error) {
      logger.error("Error getting team credential shares:", error);
      throw error;
    }
  }

  /**
   * Get credentials shared with a specific team
   */
  static async getCredentialTeamShares(credentialId: string, userId: string) {
    try {
      // Verify user owns the credential
      const credential = await prisma.credential.findFirst({
        where: { id: credentialId, userId },
      });

      if (!credential) {
        throw new AppError("Credential not found or access denied", 404);
      }

      const shares = await prisma.teamCredentialShare.findMany({
        where: { credentialId },
        include: {
          team: {
            select: { id: true, name: true, slug: true, color: true },
          },
        },
        orderBy: { sharedAt: "desc" },
      });

      return shares;
    } catch (error) {
      logger.error("Error getting credential team shares:", error);
      throw error;
    }
  }

  /**
   * Update team credential share permission
   */
  static async updateTeamCredentialPermission(
    credentialId: string,
    teamId: string,
    userId: string,
    newPermission: "USE" | "VIEW" | "EDIT"
  ) {
    try {
      // Verify user owns the credential
      const credential = await prisma.credential.findFirst({
        where: { id: credentialId, userId },
      });

      if (!credential) {
        throw new AppError("Credential not found or access denied", 404);
      }

      const updated = await prisma.teamCredentialShare.updateMany({
        where: {
          credentialId,
          teamId,
        },
        data: {
          permission: newPermission,
        },
      });

      if (updated.count === 0) {
        throw new AppError("Share not found", 404);
      }

      logger.info(
        `Team credential permission updated: ${credentialId} -> ${teamId} to ${newPermission}`
      );

      // Return updated share
      return await prisma.teamCredentialShare.findUnique({
        where: {
          credentialId_teamId: {
            credentialId,
            teamId,
          },
        },
        include: {
          team: {
            select: { id: true, name: true, slug: true },
          },
        },
      });
    } catch (error) {
      logger.error("Error updating team credential permission:", error);
      throw error;
    }
  }

  // ============================================
  // WORKFLOW TEAM ASSIGNMENT METHODS
  // ============================================

  /**
   * Assign workflow to team
   */
  static async assignWorkflowToTeam(
    workflowId: string,
    teamId: string,
    userId: string
  ) {
    try {
      // Verify user owns the workflow
      const workflow = await prisma.workflow.findFirst({
        where: { id: workflowId, userId },
      });

      if (!workflow) {
        throw new AppError("Workflow not found or access denied", 404);
      }

      // Verify user has access to team
      const isMember = await this.isTeamMember(teamId, userId);
      if (!isMember) {
        throw new AppError("Access denied to team", 403);
      }

      // Update workflow
      const updatedWorkflow = await prisma.workflow.update({
        where: { id: workflowId },
        data: { teamId },
        include: {
          team: {
            select: { id: true, name: true, slug: true, color: true },
          },
        },
      });

      logger.info(`Workflow assigned to team: ${workflowId} -> ${teamId}`);

      return updatedWorkflow;
    } catch (error) {
      logger.error("Error assigning workflow to team:", error);
      throw error;
    }
  }

  /**
   * Remove workflow from team (make it personal)
   */
  static async removeWorkflowFromTeam(workflowId: string, userId: string) {
    try {
      // Verify user owns the workflow
      const workflow = await prisma.workflow.findFirst({
        where: { id: workflowId, userId },
      });

      if (!workflow) {
        throw new AppError("Workflow not found or access denied", 404);
      }

      // Update workflow
      const updatedWorkflow = await prisma.workflow.update({
        where: { id: workflowId },
        data: { teamId: null },
      });

      logger.info(`Workflow removed from team: ${workflowId}`);

      return updatedWorkflow;
    } catch (error) {
      logger.error("Error removing workflow from team:", error);
      throw error;
    }
  }

  /**
   * Get team workflows
   */
  static async getTeamWorkflows(teamId: string, userId: string) {
    try {
      // Verify user has access to team
      const isMember = await this.isTeamMember(teamId, userId);
      if (!isMember) {
        throw new AppError("Access denied to team", 403);
      }

      const workflows = await prisma.workflow.findMany({
        where: { teamId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      return workflows;
    } catch (error) {
      logger.error("Error getting team workflows:", error);
      throw error;
    }
  }
}
