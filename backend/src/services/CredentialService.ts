import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";

export interface CredentialData {
  [key: string]: any;
}

export interface CredentialType {
  name: string;
  displayName: string;
  description?: string;
  properties: CredentialProperty[];
  icon?: string;
  color?: string;
  testable?: boolean;
  oauthProvider?: string; // OAuth provider name (google, microsoft, github, etc.)
  test?: (
    data: CredentialData
  ) => Promise<{ success: boolean; message: string }>;
}

export interface CredentialProperty {
  displayName: string;
  name: string;
  type: "string" | "password" | "number" | "boolean" | "options" | "hidden";
  required?: boolean;
  readonly?: boolean;
  default?: any;
  description?: string;
  options?: Array<{ name: string; value: any }>;
  placeholder?: string;
  displayOptions?: {
    show?: Record<string, any[]>;
    hide?: Record<string, any[]>;
  };
}

export interface CredentialWithData {
  id: string;
  name: string;
  type: string;
  userId: string;
  data: CredentialData;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CredentialRotationConfig {
  enabled: boolean;
  intervalDays: number;
  warningDays: number;
  autoRotate: boolean;
}

export class CredentialService {
  private prisma: PrismaClient;
  private encryptionKey: string;
  private algorithm = "aes-256-cbc";
  private credentialTypeRegistry = new Map<string, CredentialType>();
  private coreCredentialsRegistered = false;

  constructor() {
    this.prisma = new PrismaClient();

    // Use environment variable or generate a secure key
    const keyString = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!keyString || keyString.length !== 64) {
      throw new Error(
        "CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
      );
    }

    this.encryptionKey = keyString;
  }

  /**
   * Register core credential types
   * This should be called once during application initialization
   */
  registerCoreCredentials(): void {
    if (this.coreCredentialsRegistered) {
      logger.info("Core credentials already registered, skipping");
      return;
    }

    try {
      // Import core credentials
      const { CoreCredentials } = require("../oauth/credentials");

      // Register each core credential
      for (const credential of CoreCredentials) {
        this.registerCredentialType(credential);
      }

      this.coreCredentialsRegistered = true;
      // Core credentials registered silently
    } catch (error) {
      logger.error("Failed to register core credentials:", error);
      throw error;
    }
  }

  /**
   * Register a credential type from a custom node
   */
  registerCredentialType(credentialType: CredentialType): void {
    this.credentialTypeRegistry.set(credentialType.name, credentialType);
    // Silently registered - only log errors
  }

  /**
   * Unregister a credential type
   */
  unregisterCredentialType(credentialTypeName: string): void {
    this.credentialTypeRegistry.delete(credentialTypeName);
    // Silently unregistered
  }

  /**
   * Encrypt credential data using AES-256-CBC
   */
  private encryptData(data: CredentialData): string {
    try {
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(this.encryptionKey, "hex");
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
      encrypted += cipher.final("hex");

      // Combine IV and encrypted data
      const combined = iv.toString("hex") + ":" + encrypted;
      return combined;
    } catch (error) {
      logger.error("Failed to encrypt credential data:", error);
      throw new AppError("Failed to encrypt credential data", 500);
    }
  }

  /**
   * Decrypt credential data using AES-256-CBC
   */
  private decryptData(encryptedData: string): CredentialData {
    try {
      const parts = encryptedData.split(":");
      if (parts.length !== 2) {
        throw new Error("Invalid encrypted data format");
      }

      const iv = Buffer.from(parts[0], "hex");
      const encrypted = parts[1];
      const key = Buffer.from(this.encryptionKey, "hex");

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return JSON.parse(decrypted);
    } catch (error) {
      logger.error("Failed to decrypt credential data:", error);
      throw new AppError("Failed to decrypt credential data", 500);
    }
  }

  /**
   * Create a new credential
   */
  async createCredential(
    userId: string,
    name: string,
    type: string,
    data: CredentialData,
    expiresAt?: Date
  ): Promise<CredentialWithData> {
    // Validate credential type
    const credentialType = this.getCredentialType(type);
    if (!credentialType) {
      throw new AppError(`Unknown credential type: ${type}`, 400);
    }

    // Validate credential data
    this.validateCredentialData(credentialType, data);

    // Check if credential name already exists for this user
    const existingCredential = await this.prisma.credential.findFirst({
      where: {
        name,
        userId,
      },
    });

    if (existingCredential) {
      throw new AppError("A credential with this name already exists", 400);
    }

    // Encrypt the credential data
    const encryptedData = this.encryptData(data);

    const credential = await this.prisma.credential.create({
      data: {
        name,
        type,
        userId,
        data: encryptedData,
        expiresAt,
      },
    });

    logger.info(`Credential created: ${name} (${type}) for user ${userId}`);

    return {
      ...credential,
      data: data, // Return decrypted data
    };
  }

  /**
   * Get credential by ID with decrypted data
   * Checks both ownership and shared access
   */
  async getCredential(
    id: string,
    userId: string
  ): Promise<CredentialWithData | null> {
    // First check if user owns the credential
    let credential = await this.prisma.credential.findFirst({
      where: {
        id,
        userId,
      },
    });

    let isOwner = !!credential;
    let permission = "EDIT"; // Owner has full access

    // If not owner, check if credential is shared with user
    if (!credential) {
      const share = await this.prisma.credentialShare.findFirst({
        where: {
          credentialId: id,
          sharedWithUserId: userId,
        },
        include: {
          credential: true,
        },
      });

      if (share) {
        credential = share.credential;
        permission = share.permission;
      }
    }

    if (!credential) {
      return null;
    }

    // Check if credential is expired
    if (credential.expiresAt && credential.expiresAt < new Date()) {
      throw new AppError("Credential has expired", 401);
    }

    const decryptedData = this.decryptData(credential.data);

    return {
      ...credential,
      data: decryptedData,
      isOwner,
      permission,
    } as any;
  }

  /**
   * Get credential by ID for system use (e.g., webhooks, triggers)
   * Does NOT check user ownership - use with caution
   */
  async getCredentialById(id: string): Promise<CredentialWithData | null> {
    const credential = await this.prisma.credential.findUnique({
      where: { id },
    });

    if (!credential) {
      return null;
    }

    // Check if credential is expired
    if (credential.expiresAt && credential.expiresAt < new Date()) {
      throw new AppError("Credential has expired", 401);
    }

    const decryptedData = this.decryptData(credential.data);

    return {
      ...credential,
      data: decryptedData,
    };
  }

  /**
   * Get credentials for a user (without decrypted data)
   */
  async getCredentials(userId: string, type?: string) {
    const whereClause: any = { userId };
    if (type) {
      whereClause.type = type;
    }

    const credentials = await this.prisma.credential.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        type: true,
        userId: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return credentials;
  }

  /**
   * Update credential
   */
  async updateCredential(
    id: string,
    userId: string,
    updates: {
      name?: string;
      data?: CredentialData;
      expiresAt?: Date;
    }
  ): Promise<CredentialWithData> {
    const existingCredential = await this.prisma.credential.findFirst({
      where: { id, userId },
    });

    if (!existingCredential) {
      throw new AppError("Credential not found", 404);
    }

    // Check name conflicts
    if (updates.name && updates.name !== existingCredential.name) {
      const nameConflict = await this.prisma.credential.findFirst({
        where: {
          name: updates.name,
          userId,
          id: { not: id },
        },
      });

      if (nameConflict) {
        throw new AppError("A credential with this name already exists", 400);
      }
    }

    const updateData: any = {};

    if (updates.name) {
      updateData.name = updates.name;
    }

    if (updates.data) {
      const credentialType = this.getCredentialType(existingCredential.type);
      if (credentialType) {
        this.validateCredentialData(credentialType, updates.data);
      }
      updateData.data = this.encryptData(updates.data);
    }

    if (updates.expiresAt !== undefined) {
      updateData.expiresAt = updates.expiresAt;
    }

    const credential = await this.prisma.credential.update({
      where: { id },
      data: updateData,
    });

    logger.info(
      `Credential updated: ${credential.name} (${credential.type}) for user ${userId}`
    );

    const decryptedData = updates.data || this.decryptData(credential.data);

    return {
      ...credential,
      data: decryptedData,
    };
  }

  /**
   * Delete credential
   */
  async deleteCredential(id: string, userId: string): Promise<void> {
    const credential = await this.prisma.credential.findFirst({
      where: { id, userId },
    });

    if (!credential) {
      throw new AppError("Credential not found", 404);
    }

    await this.prisma.credential.delete({
      where: { id },
    });

    logger.info(
      `Credential deleted: ${credential.name} (${credential.type}) for user ${userId}`
    );
  }

  /**
   * Get credential for node execution (with decrypted data)
   */
  async getCredentialForExecution(
    credentialId: string,
    userId: string
  ): Promise<CredentialData> {
    const credential = await this.getCredential(credentialId, userId);

    if (!credential) {
      throw new AppError("Credential not found", 404);
    }

    return credential.data;
  }

  /**
   * Test credential connection
   */
  async testCredential(
    type: string,
    data: CredentialData
  ): Promise<{ success: boolean; message: string }> {
    const credentialType = this.getCredentialType(type);
    if (!credentialType) {
      return { success: false, message: `Unknown credential type: ${type}` };
    }

    // Validate data first
    try {
      this.validateCredentialData(credentialType, data);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // All credential types now have their test method in their definition
    if (credentialType.test && typeof credentialType.test === "function") {
      try {
        return await credentialType.test(data);
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : "Test failed",
        };
      }
    }

    // If no test method is defined, just validate the format
    return { success: true, message: "Credential format is valid" };
  }

  /**
   * Get expiring credentials
   */
  async getExpiringCredentials(userId: string, warningDays: number = 7) {
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + warningDays);

    return await this.prisma.credential.findMany({
      where: {
        userId,
        expiresAt: {
          lte: warningDate,
          gt: new Date(),
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
        expiresAt: true,
      },
    });
  }

  /**
   * Rotate credential (create new version)
   */
  async rotateCredential(
    id: string,
    userId: string,
    newData: CredentialData
  ): Promise<CredentialWithData> {
    const existingCredential = await this.prisma.credential.findFirst({
      where: { id, userId },
    });

    if (!existingCredential) {
      throw new AppError("Credential not found", 404);
    }

    // Validate new credential data
    const credentialType = this.getCredentialType(existingCredential.type);
    if (credentialType) {
      this.validateCredentialData(credentialType, newData);
    }

    // Update with new data and extend expiration
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 90); // 90 days from now

    const updatedCredential = await this.updateCredential(id, userId, {
      data: newData,
      expiresAt: newExpiresAt,
    });

    logger.info(
      `Credential rotated: ${existingCredential.name} (${existingCredential.type}) for user ${userId}`
    );

    return updatedCredential;
  }

  /**
   * Get available credential types
   * Returns all registered credential types (core + custom nodes)
   */
  getCredentialTypes(): CredentialType[] {
    // All credential types are now registered via the registry
    // Core credentials are registered in registerCoreCredentials()
    // Custom node credentials are registered when nodes are loaded
    return Array.from(this.credentialTypeRegistry.values());
  }

  /**
   * Get credential type definition
   */
  getCredentialType(type: string): CredentialType | null {
    return this.credentialTypeRegistry.get(type) || null;
  }



  /**
   * Check if a property should be visible based on displayOptions
   */
  private shouldShowProperty(
    property: any,
    data: CredentialData,
    allProperties: any[]
  ): boolean {
    const displayOptions = property.displayOptions;

    if (!displayOptions) {
      return true; // No display options means always visible
    }

    // Check "show" conditions
    if (displayOptions.show) {
      const shouldShow = Object.entries(displayOptions.show).every(
        ([dependentFieldName, expectedValues]: [string, any]) => {
          let currentValue = data[dependentFieldName];

          // If value is undefined, try to get the default value
          if (currentValue === undefined) {
            const dependentProperty = allProperties.find(
              (p) => p.name === dependentFieldName
            );
            currentValue = dependentProperty?.default;
          }

          // Check if current value matches any of the expected values
          return (
            currentValue !== undefined &&
            (expectedValues as any[]).includes(currentValue)
          );
        }
      );

      if (!shouldShow) {
        return false;
      }
    }

    // Check "hide" conditions
    if (displayOptions.hide) {
      const shouldHide = Object.entries(displayOptions.hide).some(
        ([dependentFieldName, expectedValues]: [string, any]) => {
          let currentValue = data[dependentFieldName];

          // If value is undefined, try to get the default value
          if (currentValue === undefined) {
            const dependentProperty = allProperties.find(
              (p) => p.name === dependentFieldName
            );
            currentValue = dependentProperty?.default;
          }

          // Check if current value matches any of the values that should hide this field
          return (
            currentValue !== undefined &&
            (expectedValues as any[]).includes(currentValue)
          );
        }
      );

      if (shouldHide) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate credential data against type definition
   * Only validates visible properties based on displayOptions
   */
  private validateCredentialData(
    credentialType: CredentialType,
    data: CredentialData
  ): void {
    const errors: string[] = [];

    for (const property of credentialType.properties) {
      // Check if property should be visible
      if (!this.shouldShowProperty(property, data, credentialType.properties)) {
        continue; // Skip validation for hidden properties
      }

      const value = data[property.name];

      if (
        property.required &&
        (value === undefined || value === null || value === "")
      ) {
        errors.push(`${property.displayName} is required`);
        continue;
      }

      if (value !== undefined && value !== null) {
        // Type validation
        switch (property.type) {
          case "string":
          case "password":
            if (typeof value !== "string") {
              errors.push(`${property.displayName} must be a string`);
            }
            break;
          case "number":
            if (typeof value !== "number") {
              errors.push(`${property.displayName} must be a number`);
            }
            break;
          case "boolean":
            if (typeof value !== "boolean") {
              errors.push(`${property.displayName} must be a boolean`);
            }
            break;
          case "options":
            if (
              property.options &&
              !property.options.some((opt) => opt.value === value)
            ) {
              errors.push(
                `${property.displayName} must be one of the allowed options`
              );
            }
            break;
        }
      }
    }

    if (errors.length > 0) {
      throw new AppError(
        `Credential validation failed: ${errors.join(", ")}`,
        400
      );
    }
  }



  /**
   * Deep sanitize object to remove dangerous properties
   */
  private deepSanitize(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (
      typeof obj === "string" ||
      typeof obj === "number" ||
      typeof obj === "boolean"
    ) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepSanitize(item));
    }

    if (typeof obj === "object") {
      const sanitized: any = {};
      const dangerousProps = ["__proto__", "constructor", "prototype"];

      for (const [key, value] of Object.entries(obj)) {
        if (!dangerousProps.includes(key)) {
          sanitized[key] = this.deepSanitize(value);
        }
      }

      return sanitized;
    }

    return obj;
  }

  // ============================================
  // CREDENTIAL SHARING METHODS
  // ============================================

  /**
   * Share credential with another user
   */
  async shareCredential(
    credentialId: string,
    ownerUserId: string,
    shareWithUserId: string,
    permission: "USE" | "VIEW" | "EDIT" = "USE",
    sharedByUserId?: string
  ): Promise<any> {
    // Verify owner has access to credential
    const credential = await this.getCredential(credentialId, ownerUserId);
    if (!credential) {
      throw new AppError("Credential not found or access denied", 404);
    }

    // Prevent sharing with self
    if (ownerUserId === shareWithUserId) {
      throw new AppError("Cannot share credential with yourself", 400);
    }

    // Verify target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: shareWithUserId },
    });

    if (!targetUser) {
      throw new AppError("Target user not found", 404);
    }

    // Check if already shared
    const existingShare = await this.prisma.credentialShare.findUnique({
      where: {
        credentialId_sharedWithUserId: {
          credentialId,
          sharedWithUserId: shareWithUserId,
        },
      },
    });

    if (existingShare) {
      throw new AppError("Credential already shared with this user", 400);
    }

    // Create share
    const share = await this.prisma.credentialShare.create({
      data: {
        credentialId,
        ownerUserId,
        sharedWithUserId: shareWithUserId,
        permission,
        sharedByUserId: sharedByUserId || ownerUserId,
      },
      include: {
        sharedWith: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        credential: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    logger.info(
      `Credential shared: ${credentialId} with user ${shareWithUserId} (permission: ${permission})`
    );

    // TODO: Send email notification to shareWithUserId
    // await emailService.sendCredentialSharedNotification(...)

    return share;
  }

  /**
   * Unshare credential (revoke access)
   */
  async unshareCredential(
    credentialId: string,
    ownerUserId: string,
    shareWithUserId: string
  ): Promise<void> {
    // Verify owner has access
    const credential = await this.getCredential(credentialId, ownerUserId);
    if (!credential) {
      throw new AppError("Credential not found or access denied", 404);
    }

    // Delete share
    const deleted = await this.prisma.credentialShare.deleteMany({
      where: {
        credentialId,
        sharedWithUserId: shareWithUserId,
      },
    });

    if (deleted.count === 0) {
      throw new AppError("Share not found", 404);
    }

    logger.info(
      `Credential unshared: ${credentialId} from user ${shareWithUserId}`
    );

    // TODO: Send email notification to shareWithUserId
    // await emailService.sendAccessRevokedNotification(...)
  }

  /**
   * Get all shares for a credential
   */
  async getCredentialShares(
    credentialId: string,
    ownerUserId: string
  ): Promise<any[]> {
    // Verify owner has access
    const credential = await this.getCredential(credentialId, ownerUserId);
    if (!credential) {
      throw new AppError("Credential not found or access denied", 404);
    }

    return await this.prisma.credentialShare.findMany({
      where: { credentialId },
      include: {
        sharedWith: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        sharedAt: "desc",
      },
    });
  }

  /**
   * Update share permission
   */
  async updateSharePermission(
    credentialId: string,
    ownerUserId: string,
    shareWithUserId: string,
    newPermission: "USE" | "VIEW" | "EDIT"
  ): Promise<any> {
    // Verify owner has access
    const credential = await this.getCredential(credentialId, ownerUserId);
    if (!credential) {
      throw new AppError("Credential not found or access denied", 404);
    }

    const updated = await this.prisma.credentialShare.updateMany({
      where: {
        credentialId,
        sharedWithUserId: shareWithUserId,
      },
      data: {
        permission: newPermission,
      },
    });

    if (updated.count === 0) {
      throw new AppError("Share not found", 404);
    }

    logger.info(
      `Share permission updated: ${credentialId} for user ${shareWithUserId} to ${newPermission}`
    );

    // Return updated share
    return await this.prisma.credentialShare.findUnique({
      where: {
        credentialId_sharedWithUserId: {
          credentialId,
          sharedWithUserId: shareWithUserId,
        },
      },
      include: {
        sharedWith: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get credentials shared WITH this user
   */
  async getSharedCredentials(userId: string): Promise<any[]> {
    const shares = await this.prisma.credentialShare.findMany({
      where: {
        sharedWithUserId: userId,
      },
      include: {
        credential: {
          select: {
            id: true,
            name: true,
            type: true,
            createdAt: true,
            updatedAt: true,
            expiresAt: true,
          },
        },
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        sharedAt: "desc",
      },
    });

    return shares.map((share) => ({
      ...share.credential,
      sharedBy: share.owner,
      permission: share.permission,
      sharedAt: share.sharedAt,
      isShared: true,
    }));
  }
}
