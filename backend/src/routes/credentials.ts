import { Response, Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import { AppError } from "../utils/errors";
import {
  credentialCreateSchema,
  credentialUpdateSchema,
} from "../utils/validation";

const router = Router();

// Use global credential service instance (shared with NodeLoader)
const getCredentialService = () => {
  if (!global.credentialService) {
    throw new Error("CredentialService not initialized");
  }
  return global.credentialService;
};

// Get all credentials for the authenticated user (owned + shared)
router.get(
  "/",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { type } = req.query;

    // Get owned credentials
    const ownedCredentials = await getCredentialService().getCredentials(
      req.user!.id,
      type as string
    );

    // For each owned credential, get share information
    const ownedWithShares = await Promise.all(
      ownedCredentials.map(async (cred) => {
        try {
          const shares = await getCredentialService().getCredentialShares(
            cred.id,
            req.user!.id
          );
          return {
            ...cred,
            sharedWith: shares.map(s => ({
              id: s.sharedWith.id,
              email: s.sharedWith.email,
              name: s.sharedWith.name,
              permission: s.permission
            })),
            shareCount: shares.length
          };
        } catch (err) {
          // If getting shares fails, just return credential without share info
          return { ...cred, sharedWith: [], shareCount: 0 };
        }
      })
    );

    // Get shared credentials
    const sharedCredentials = await getCredentialService().getSharedCredentials(
      req.user!.id
    );

    // Merge both lists
    const allCredentials = [...ownedWithShares, ...sharedCredentials];

    res.json({
      success: true,
      data: allCredentials,
    });
  })
);

// Get available credential types
router.get(
  "/types",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const credentialTypes = getCredentialService().getCredentialTypes();

    res.json({
      success: true,
      data: credentialTypes,
    });
  })
);

// Get credential type with node context (for default values)
router.get(
  "/types/:typeName/defaults",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { typeName } = req.params;
    const { nodeType } = req.query;

    const credentialType = getCredentialService().getCredentialType(typeName);
    
    if (!credentialType) {
      throw new AppError("Credential type not found", 404);
    }

    // If nodeType is provided, get node-specific defaults and displayName
    let defaults: Record<string, any> = {};
    let contextualCredentialType = { ...credentialType };
    
    if (nodeType) {
      // Get node definition to extract credential properties
      const nodeService = global.nodeService;
      if (nodeService) {
        try {
          const nodeDefinition = await nodeService.getNodeDefinition(nodeType as string);
          
          if (nodeDefinition?.credentials) {
            const credDef = nodeDefinition.credentials.find(
              (c: any) => c.name === typeName
            );
            
            if (credDef) {
              // Use context-specific displayName if provided
              if (credDef.displayName) {
                contextualCredentialType.displayName = credDef.displayName;
              }
              
              // Extract default values from node's credential properties
              if (credDef.properties) {
                credDef.properties.forEach((prop: any) => {
                  if (prop.name && prop.value !== undefined) {
                    defaults[prop.name] = prop.value;
                  }
                });
              }
            }
          }
        } catch (error) {
          // Node not found or error getting definition, continue without defaults
          console.warn(`Could not get node definition for ${nodeType}:`, error);
        }
      }
    }

    res.json({
      success: true,
      data: {
        credentialType: contextualCredentialType,
        defaults,
      },
    });
  })
);

// Get expiring credentials
router.get(
  "/expiring/:days?",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const warningDays = parseInt(req.params.days || "7");

    if (isNaN(warningDays) || warningDays < 1) {
      throw new AppError("Warning days must be a positive number", 400);
    }

    const expiringCredentials =
      await getCredentialService().getExpiringCredentials(
        req.user!.id,
        warningDays
      );

    res.json({
      success: true,
      data: expiringCredentials,
    });
  })
);

// Get a specific credential
router.get(
  "/:id",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const credential = await getCredentialService().getCredential(
      id,
      req.user!.id
    );

    if (!credential) {
      throw new AppError("Credential not found", 404);
    }

    // Don't return decrypted data in GET requests for security
    const { data, ...credentialWithoutData } = credential;

    res.json({
      success: true,
      data: credentialWithoutData,
    });
  })
);

// Get credential for execution (internal endpoint)
router.get(
  "/:id/execution",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const credentialData =
      await getCredentialService().getCredentialForExecution(id, req.user!.id);

    res.json({
      success: true,
      data: credentialData,
    });
  })
);

// Create a new credential
router.post(
  "/",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validatedData = credentialCreateSchema.parse(req.body);

    const credential = await getCredentialService().createCredential(
      req.user!.id,
      validatedData.name,
      validatedData.type,
      validatedData.data,
      validatedData.expiresAt
    );

    // Don't return decrypted data
    const { data, ...credentialWithoutData } = credential;

    res.status(201).json({
      success: true,
      data: credentialWithoutData,
    });
  })
);

// Update a credential
router.put(
  "/:id",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const validatedData = credentialUpdateSchema.parse(req.body);

    const credential = await getCredentialService().updateCredential(
      id,
      req.user!.id,
      {
        name: validatedData.name,
        data: validatedData.data,
        expiresAt: validatedData.expiresAt,
      }
    );

    // Don't return decrypted data
    const { data, ...credentialWithoutData } = credential;

    res.json({
      success: true,
      data: credentialWithoutData,
    });
  })
);

// Delete a credential
router.delete(
  "/:id",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await getCredentialService().deleteCredential(id, req.user!.id);

    res.json({
      success: true,
      message: "Credential deleted successfully",
    });
  })
);

// Test a credential
router.post(
  "/test",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { type, data } = req.body;

    if (!type || !data) {
      throw new AppError("Credential type and data are required", 400);
    }

    const testResult = await getCredentialService().testCredential(type, data);

    res.json({
      success: true,
      data: testResult,
    });
  })
);

// Test a saved credential (for OAuth credentials that don't have tokens in the form)
router.post(
  "/test-saved",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { credentialId } = req.body;

    if (!credentialId) {
      throw new AppError("Credential ID is required", 400);
    }

    // Get the credential from database
    const credential = await getCredentialService().getCredential(
      credentialId,
      req.user!.id
    );

    if (!credential) {
      throw new AppError("Credential not found", 404);
    }

    // Test the credential with its saved data (includes tokens)
    const testResult = await getCredentialService().testCredential(
      credential.type,
      credential.data
    );

    res.json({
      success: true,
      data: testResult,
    });
  })
);

// Rotate a credential
router.post(
  "/:id/rotate",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { data } = req.body;

    if (!data) {
      throw new AppError("New credential data is required", 400);
    }

    const rotatedCredential = await getCredentialService().rotateCredential(
      id,
      req.user!.id,
      data
    );

    // Don't return decrypted data
    const { data: credentialData, ...credentialWithoutData } =
      rotatedCredential;

    res.json({
      success: true,
      data: credentialWithoutData,
      message: "Credential rotated successfully",
    });
  })
);

// ============================================
// CREDENTIAL SHARING ROUTES
// ============================================

// Get credentials shared WITH me
router.get(
  "/shared-with-me",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const sharedCredentials = await getCredentialService().getSharedCredentials(
      req.user!.id
    );

    res.json({
      success: true,
      data: sharedCredentials,
    });
  })
);

// Get shares for a specific credential (who has access)
router.get(
  "/:id/shares",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const shares = await getCredentialService().getCredentialShares(
      id,
      req.user!.id
    );

    res.json({
      success: true,
      data: shares,
    });
  })
);

// Share credential with a user
router.post(
  "/:id/share",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { userId, permission = "USE" } = req.body;

    if (!userId) {
      throw new AppError("User ID is required", 400);
    }

    if (!["USE", "VIEW", "EDIT"].includes(permission)) {
      throw new AppError("Invalid permission. Must be USE, VIEW, or EDIT", 400);
    }

    const share = await getCredentialService().shareCredential(
      id,
      req.user!.id,
      userId,
      permission,
      req.user!.id
    );

    res.status(201).json({
      success: true,
      data: share,
      message: "Credential shared successfully",
    });
  })
);

// Update share permission
router.put(
  "/:id/share/:userId",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, userId } = req.params;
    const { permission } = req.body;

    if (!permission || !["USE", "VIEW", "EDIT"].includes(permission)) {
      throw new AppError("Invalid permission. Must be USE, VIEW, or EDIT", 400);
    }

    const updatedShare = await getCredentialService().updateSharePermission(
      id,
      req.user!.id,
      userId,
      permission
    );

    res.json({
      success: true,
      data: updatedShare,
      message: "Permission updated successfully",
    });
  })
);

// Unshare credential (revoke access)
router.delete(
  "/:id/share/:userId",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, userId } = req.params;

    await getCredentialService().unshareCredential(
      id,
      req.user!.id,
      userId
    );

    res.json({
      success: true,
      message: "Access revoked successfully",
    });
  })
);

// ============================================
// CREDENTIAL TEAM SHARING ROUTES
// ============================================

// Get teams a credential is shared with
router.get(
  "/:id/teams",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    // Import TeamService
    const { TeamService } = await import("../services/TeamService");
    
    const shares = await TeamService.getCredentialTeamShares(
      id,
      req.user!.id
    );

    res.json({
      success: true,
      data: shares,
    });
  })
);

export default router;
