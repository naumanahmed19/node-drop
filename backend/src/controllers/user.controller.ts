import { PrismaClient } from "@prisma/client";
import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/errorHandler";
import { ApiResponse } from "../types/api";

const prisma = new PrismaClient();

/**
 * GET /api/users/preferences
 * Get current user's preferences
 */
export const getPreferences = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new AppError("User not authenticated", 401, "UNAUTHORIZED");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true },
    });

    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    const response: ApiResponse = {
      success: true,
      data: {
        preferences: user.preferences || {},
      },
    };

    res.json(response);
  }
);

/**
 * PUT /api/users/preferences
 * Update current user's preferences
 */
export const updatePreferences = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new AppError("User not authenticated", 401, "UNAUTHORIZED");
    }

    const { preferences } = req.body;

    if (!preferences || typeof preferences !== "object") {
      throw new AppError(
        "Invalid preferences format",
        400,
        "INVALID_PREFERENCES"
      );
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { preferences },
      select: { preferences: true },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        preferences: user.preferences,
      },
    };

    res.json(response);
  }
);

/**
 * PATCH /api/users/preferences
 * Partially update current user's preferences (merge with existing)
 */
export const patchPreferences = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new AppError("User not authenticated", 401, "UNAUTHORIZED");
    }

    const { preferences } = req.body;

    if (!preferences || typeof preferences !== "object") {
      throw new AppError(
        "Invalid preferences format",
        400,
        "INVALID_PREFERENCES"
      );
    }

    // Get current preferences
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true },
    });

    if (!currentUser) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    // Merge preferences
    const currentPrefs = (currentUser.preferences as any) || {};
    const mergedPreferences = {
      ...currentPrefs,
      ...preferences,
      // Deep merge for nested objects like canvas settings
      canvas: {
        ...(currentPrefs.canvas || {}),
        ...(preferences.canvas || {}),
      },
      // pinnedNodes is a simple array, so direct replacement is fine
      ...(preferences.pinnedNodes !== undefined && { pinnedNodes: preferences.pinnedNodes }),
    };

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { preferences: mergedPreferences },
      select: { preferences: true },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        preferences: user.preferences,
      },
    };

    res.json(response);
  }
);

/**
 * GET /api/users/profile
 * Get current user's profile information
 */
export const getProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new AppError("User not authenticated", 401, "UNAUTHORIZED");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    const response: ApiResponse = {
      success: true,
      data: {
        user,
      },
    };

    res.json(response);
  }
);

/**
 * PUT /api/users/profile
 * Update current user's profile information
 */
export const updateProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new AppError("User not authenticated", 401, "UNAUTHORIZED");
    }

    const { name, email } = req.body;

    if (!name && !email) {
      throw new AppError(
        "No profile data provided",
        400,
        "NO_DATA"
      );
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError("Invalid email format", 400, "INVALID_EMAIL");
      }

      // Check if email is already taken by another user
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser && existingUser.id !== req.user.id) {
        throw new AppError("Email already in use", 400, "EMAIL_IN_USE");
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        user,
      },
    };

    res.json(response);
  }
);
