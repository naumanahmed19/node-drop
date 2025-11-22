import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {
  addTeamMember,
  assignWorkflowToTeam,
  createTeam,
  deleteTeam,
  getTeam,
  getTeamCredentials,
  getTeamMembers,
  getTeamWorkflows,
  getUserTeams,
  removeTeamMember,
  removeWorkflowFromTeam,
  shareCredentialWithTeam,
  unshareCredentialFromTeam,
  updateMemberRole,
  updateTeam,
  updateTeamCredentialPermission,
} from "../controllers/team.controller";

const router = Router();

/**
 * Team routes
 * All routes require authentication
 */

// ============================================
// TEAM CRUD ROUTES
// ============================================

// GET /api/teams - Get all teams for current user
router.get("/", authenticateToken, getUserTeams);

// POST /api/teams - Create a new team
router.post("/", authenticateToken, createTeam);

// GET /api/teams/:id - Get team by ID
router.get("/:id", authenticateToken, getTeam);

// PUT /api/teams/:id - Update team
router.put("/:id", authenticateToken, updateTeam);

// DELETE /api/teams/:id - Delete team
router.delete("/:id", authenticateToken, deleteTeam);

// ============================================
// TEAM MEMBER ROUTES
// ============================================

// GET /api/teams/:id/members - Get team members
router.get("/:id/members", authenticateToken, getTeamMembers);

// POST /api/teams/:id/members - Add member to team
router.post("/:id/members", authenticateToken, addTeamMember);

// DELETE /api/teams/:id/members/:userId - Remove member from team
router.delete("/:id/members/:userId", authenticateToken, removeTeamMember);

// PATCH /api/teams/:id/members/:userId/role - Update member role
router.patch("/:id/members/:userId/role", authenticateToken, updateMemberRole);

// ============================================
// TEAM CREDENTIAL SHARING ROUTES
// ============================================

// GET /api/teams/:id/credentials - Get team credential shares
router.get("/:id/credentials", authenticateToken, getTeamCredentials);

// POST /api/teams/:id/credentials/:credentialId - Share credential with team
router.post("/:id/credentials/:credentialId", authenticateToken, shareCredentialWithTeam);

// DELETE /api/teams/:id/credentials/:credentialId - Unshare credential from team
router.delete("/:id/credentials/:credentialId", authenticateToken, unshareCredentialFromTeam);

// PATCH /api/teams/:id/credentials/:credentialId/permission - Update team credential permission
router.patch("/:id/credentials/:credentialId/permission", authenticateToken, updateTeamCredentialPermission);

// ============================================
// TEAM WORKFLOW ROUTES
// ============================================

// GET /api/teams/:id/workflows - Get team workflows
router.get("/:id/workflows", authenticateToken, getTeamWorkflows);

// PUT /api/teams/:id/workflows/:workflowId - Assign workflow to team
router.put("/:id/workflows/:workflowId", authenticateToken, assignWorkflowToTeam);

// DELETE /api/teams/:id/workflows/:workflowId - Remove workflow from team
router.delete("/:id/workflows/:workflowId", authenticateToken, removeWorkflowFromTeam);

export default router;
