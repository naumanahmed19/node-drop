import { Response, Router } from "express";
import {
  getPreferences,
  patchPreferences,
  updatePreferences,
  getProfile,
  updateProfile,
} from "../controllers/user.controller";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/errors";

const router = Router();
const prisma = new PrismaClient();

/**
 * User routes
 * All routes require authentication
 */

// GET /api/users/profile - Get current user's profile
router.get("/profile", authenticateToken, getProfile);

// PUT /api/users/profile - Update current user's profile
router.put("/profile", authenticateToken, updateProfile);

// GET /api/users/preferences - Get current user's preferences
router.get("/preferences", authenticateToken, getPreferences);

// PUT /api/users/preferences - Replace all preferences
router.put("/preferences", authenticateToken, updatePreferences);

// PATCH /api/users/preferences - Merge preferences (partial update)
router.patch("/preferences", authenticateToken, patchPreferences);

// GET /api/users/search - Search users by email or name (for credential sharing)
router.get(
  "/search",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { query, email } = req.query;

    if (!query && !email) {
      throw new AppError("Query or email parameter is required", 400);
    }

    let users;

    if (email) {
      // Exact email search
      users = await prisma.user.findMany({
        where: {
          email: email as string,
          active: true,
          id: { not: req.user!.id }, // Exclude current user
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
        take: 1,
      });
    } else {
      // Fuzzy search by email or name
      users = await prisma.user.findMany({
        where: {
          active: true,
          id: { not: req.user!.id }, // Exclude current user
          OR: [
            { email: { contains: query as string, mode: "insensitive" } },
            { name: { contains: query as string, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
        take: 10,
        orderBy: {
          email: "asc",
        },
      });
    }

    res.json({
      success: true,
      data: users,
    });
  })
);

export default router;
