import { PrismaClient } from "@prisma/client";
import axios from "axios";
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
   */
  async getCredential(
    id: string,
    userId: string
  ): Promise<CredentialWithData | null> {
    const credential = await this.prisma.credential.findFirst({
      where: {
        id,
        userId,
      },
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

    // Check if credential type has a custom test method
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

    // Perform type-specific testing for built-in types
    switch (type) {
      case "httpBasicAuth":
        return this.testHttpBasicAuth(data);
      case "apiKey":
        return this.testApiKey(data);
      case "oauth2":
        return this.testOAuth2(data);
      case "googleSheetsOAuth2":
        return this.testGoogleSheetsOAuth2(data);
      case "googleDriveOAuth2":
        return this.testGoogleDriveOAuth2(data);
      case "bearerToken":
        return this.testBearerToken(data);
      default:
        return { success: true, message: "Credential format is valid" };
    }
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
   */
  getCredentialTypes(): CredentialType[] {
    // Built-in credential types
    const builtInTypes: CredentialType[] = [
      {
        name: "httpBasicAuth",
        displayName: "HTTP Basic Auth",
        description: "Username and password for HTTP Basic Authentication",
        properties: [
          {
            displayName: "Username",
            name: "username",
            type: "string",
            required: true,
            description: "Username for authentication",
            placeholder: "Enter username",
          },
          {
            displayName: "Password",
            name: "password",
            type: "password",
            required: true,
            description: "Password for authentication",
            placeholder: "Enter password",
          },
        ],
        icon: "🔐",
        color: "#4F46E5",
        testable: true,
      },
      {
        name: "apiKey",
        displayName: "API Key",
        description: "API key for service authentication",
        properties: [
          {
            displayName: "API Key",
            name: "apiKey",
            type: "password",
            required: true,
            description: "Your API key",
            placeholder: "Enter API key",
          },
          {
            displayName: "Header Name",
            name: "headerName",
            type: "string",
            required: false,
            default: "Authorization",
            description: "Header name for the API key",
            placeholder: "Authorization",
          },
        ],
        icon: "🔑",
        color: "#059669",
        testable: true,
      },
      {
        name: "oauth2",
        displayName: "OAuth2",
        description: "OAuth2 authentication credentials",
        properties: [
          {
            displayName: "Client ID",
            name: "clientId",
            type: "string",
            required: true,
            description: "OAuth2 client ID",
            placeholder: "Enter client ID",
          },
          {
            displayName: "Client Secret",
            name: "clientSecret",
            type: "password",
            required: true,
            description: "OAuth2 client secret",
            placeholder: "Enter client secret",
          },
          {
            displayName: "Access Token",
            name: "accessToken",
            type: "password",
            required: false,
            description: "OAuth2 access token",
            placeholder: "Enter access token",
          },
          {
            displayName: "Refresh Token",
            name: "refreshToken",
            type: "password",
            required: false,
            description: "OAuth2 refresh token",
            placeholder: "Enter refresh token",
          },
        ],
        icon: "🔒",
        color: "#DC2626",
        testable: true,
      },
      {
        name: "bearerToken",
        displayName: "Bearer Token",
        description: "Bearer token for HTTP Authorization header",
        properties: [
          {
            displayName: "Bearer Token",
            name: "token",
            type: "password",
            required: true,
            description: "Bearer token for authentication",
            placeholder: "Enter bearer token",
          },
          {
            displayName: "Token Prefix",
            name: "tokenPrefix",
            type: "string",
            required: false,
            default: "Bearer",
            description: 'Prefix for the token (usually "Bearer")',
            placeholder: "Bearer",
          },
        ],
        icon: "🎫",
        color: "#7C3AED",
        testable: true,
      },
      {
        name: "googleSheetsOAuth2",
        displayName: "Google Sheets OAuth2",
        description: "OAuth2 credentials for Google Sheets API",
        properties: [
          {
            displayName: "Client ID",
            name: "clientId",
            type: "string",
            required: true,
            description: "OAuth2 Client ID from Google Cloud Console",
            placeholder: "123456789-abc123.apps.googleusercontent.com",
          },
          {
            displayName: "Client Secret",
            name: "clientSecret",
            type: "password",
            required: true,
            description: "OAuth2 Client Secret from Google Cloud Console",
            placeholder: "GOCSPX-***",
          },
          {
            displayName: "OAuth Redirect URL",
            name: "oauthCallbackUrl",
            type: "string",
            required: false,
            readonly: true,
            description:
              "Copy this URL and add it to 'Authorized redirect URIs' in your Google Cloud Console OAuth2 credentials",
            placeholder: `${
              process.env.FRONTEND_URL || "http://localhost:3000"
            }/oauth/callback`,
            default: `${
              process.env.FRONTEND_URL || "http://localhost:3000"
            }/oauth/callback`,
          },
          // Note: accessToken and refreshToken are stored in the credential
          // but not shown in the form - they're automatically filled via OAuth
        ],
        icon: "📊",
        color: "#0F9D58",
        testable: true,
      },
      {
        name: "googleDriveOAuth2",
        displayName: "Google Drive OAuth2",
        description: "OAuth2 credentials for Google Drive API",
        properties: [
          {
            displayName: "Client ID",
            name: "clientId",
            type: "string",
            required: true,
            description: "OAuth2 Client ID from Google Cloud Console",
            placeholder: "123456789-abc123.apps.googleusercontent.com",
          },
          {
            displayName: "Client Secret",
            name: "clientSecret",
            type: "password",
            required: true,
            description: "OAuth2 Client Secret from Google Cloud Console",
            placeholder: "GOCSPX-***",
          },
          {
            displayName: "OAuth Redirect URL",
            name: "oauthCallbackUrl",
            type: "string",
            required: false,
            readonly: true,
            description:
              "Copy this URL and add it to 'Authorized redirect URIs' in your Google Cloud Console OAuth2 credentials",
            placeholder: `${
              process.env.FRONTEND_URL || "http://localhost:3000"
            }/oauth/callback`,
            default: `${
              process.env.FRONTEND_URL || "http://localhost:3000"
            }/oauth/callback`,
          },
          // Note: accessToken and refreshToken are stored in the credential
          // but not shown in the form - they're automatically filled via OAuth
        ],
        icon: "🗂️",
        color: "#4285F4",
        testable: true,
      },
      {
        name: "postgresDb",
        displayName: "PostgreSQL Database",
        description: "PostgreSQL database connection credentials",
        properties: [
          {
            displayName: "Host",
            name: "host",
            type: "string",
            required: true,
            default: "localhost",
            description: "PostgreSQL server host",
            placeholder: "localhost or IP address",
          },
          {
            displayName: "Port",
            name: "port",
            type: "number",
            required: true,
            default: 5432,
            description: "PostgreSQL server port",
          },
          {
            displayName: "Database",
            name: "database",
            type: "string",
            required: true,
            default: "",
            description: "Database name",
            placeholder: "my_database",
          },
          {
            displayName: "User",
            name: "user",
            type: "string",
            required: true,
            default: "",
            description: "Database user",
            placeholder: "postgres",
          },
          {
            displayName: "Password",
            name: "password",
            type: "password",
            required: true,
            default: "",
            description: "Database password",
          },
          {
            displayName: "SSL",
            name: "ssl",
            type: "boolean",
            default: false,
            description: "Use SSL connection",
          },
        ],
        icon: "🐘",
        color: "#336791",
        testable: true,
        test: async (data: CredentialData) => {
          // Validate required fields
          if (!data.host || !data.database || !data.user || !data.password) {
            return {
              success: false,
              message: "Host, database, user, and password are required",
            };
          }

          // Try to connect to PostgreSQL
          try {
            const { Pool } = require("pg");

            const pool = new Pool({
              host: data.host,
              port: data.port || 5432,
              database: data.database,
              user: data.user,
              password: data.password,
              ssl: data.ssl ? { rejectUnauthorized: false } : false,
              connectionTimeoutMillis: 5000, // 5 second timeout
              max: 1, // Only create 1 connection for testing
            });

            try {
              // Test the connection with a simple query
              const result = await pool.query(
                "SELECT NOW() as current_time, version() as version"
              );
              await pool.end();

              if (result.rows && result.rows.length > 0) {
                const version = result.rows[0].version;
                // Extract just the PostgreSQL version number
                const versionMatch = version.match(/PostgreSQL ([\d.]+)/);
                const versionStr = versionMatch ? versionMatch[1] : "Unknown";

                return {
                  success: true,
                  message: `Connected successfully to PostgreSQL ${versionStr} at ${
                    data.host
                  }:${data.port || 5432}/${data.database}`,
                };
              }

              await pool.end();
              return {
                success: true,
                message: "Connection successful",
              };
            } catch (queryError) {
              await pool.end();
              throw queryError;
            }
          } catch (error: any) {
            // Handle specific PostgreSQL error codes
            if (error.code === "ECONNREFUSED") {
              return {
                success: false,
                message: `Cannot connect to database server at ${data.host}:${
                  data.port || 5432
                }. Connection refused.`,
              };
            } else if (error.code === "ENOTFOUND") {
              return {
                success: false,
                message: `Cannot resolve host: ${data.host}. Please check the hostname.`,
              };
            } else if (error.code === "ETIMEDOUT") {
              return {
                success: false,
                message: `Connection timeout to ${data.host}:${
                  data.port || 5432
                }. Please check firewall and network settings.`,
              };
            } else if (error.code === "28P01") {
              return {
                success: false,
                message: "Authentication failed. Invalid username or password.",
              };
            } else if (error.code === "3D000") {
              return {
                success: false,
                message: `Database "${data.database}" does not exist.`,
              };
            } else if (error.code === "28000") {
              return {
                success: false,
                message:
                  "Authorization failed. User does not have access to this database.",
              };
            } else if (error.code === "08001") {
              return {
                success: false,
                message:
                  "Unable to establish connection. Please check server settings.",
              };
            } else {
              return {
                success: false,
                message: `Connection failed: ${error.message || "Unknown error"}`,
              };
            }
          }
        },
      },
    ];

    // Combine built-in types with registered types from custom nodes
    const registeredTypes = Array.from(this.credentialTypeRegistry.values());
    return [...builtInTypes, ...registeredTypes];
  }

  /**
   * Get credential type definition
   */
  getCredentialType(type: string): CredentialType | null {
    return this.getCredentialTypes().find((ct) => ct.name === type) || null;
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
   * Test HTTP Basic Auth credentials
   */
  private async testHttpBasicAuth(
    data: CredentialData
  ): Promise<{ success: boolean; message: string }> {
    if (!data.username || !data.password) {
      return { success: false, message: "Username and password are required" };
    }

    // In a real implementation, you might test against a specific endpoint
    // For now, just validate the format
    return { success: true, message: "HTTP Basic Auth credentials are valid" };
  }

  /**
   * Test API Key credentials
   */
  private async testApiKey(
    data: CredentialData
  ): Promise<{ success: boolean; message: string }> {
    if (!data.apiKey) {
      return { success: false, message: "API key is required" };
    }

    // Basic format validation
    if (data.apiKey.length < 10) {
      return { success: false, message: "API key appears to be too short" };
    }

    return { success: true, message: "API key format is valid" };
  }

  /**
   * Test OAuth2 credentials
   */
  private async testOAuth2(
    data: CredentialData
  ): Promise<{ success: boolean; message: string }> {
    if (!data.clientId || !data.clientSecret) {
      return {
        success: false,
        message: "Client ID and Client Secret are required",
      };
    }

    // Check if access token is present
    if (!data.accessToken) {
      return {
        success: false,
        message:
          "No access token found. Please complete the OAuth2 authorization flow.",
      };
    }

    // Check if token is expired (if tokenObtainedAt and expiresIn are available)
    if (data.tokenObtainedAt && data.expiresIn) {
      const obtainedDate = new Date(data.tokenObtainedAt);
      const expiresAt = new Date(
        obtainedDate.getTime() + data.expiresIn * 1000
      );

      if (new Date() > expiresAt) {
        if (!data.refreshToken) {
          return {
            success: false,
            message:
              "Access token has expired and no refresh token is available. Please re-authorize.",
          };
        }
        return {
          success: false,
          message: "Access token has expired. Please refresh the token.",
        };
      }
    }

    return {
      success: true,
      message: "OAuth2 credentials are configured correctly",
    };
  }

  /**
   * Test Google Sheets OAuth2 credentials by making a real API call
   */
  private async testGoogleSheetsOAuth2(
    data: CredentialData
  ): Promise<{ success: boolean; message: string }> {
    // First do basic validation
    if (!data.clientId || !data.clientSecret) {
      return {
        success: false,
        message: "Client ID and Client Secret are required",
      };
    }

    // Check if access token is present
    if (!data.accessToken) {
      return {
        success: false,
        message:
          "No access token found. Please complete the OAuth2 authorization flow first.",
      };
    }

    // Check if token is expired
    if (data.tokenObtainedAt && data.expiresIn) {
      const obtainedDate = new Date(data.tokenObtainedAt);
      const expiresAt = new Date(
        obtainedDate.getTime() + data.expiresIn * 1000
      );

      if (new Date() > expiresAt) {
        return {
          success: false,
          message:
            "Access token has expired. Please refresh the token or re-authorize.",
        };
      }
    }

    // Test the token by making a real API call to Google
    try {
      // Test with Google Drive API to list files (lightweight call)
      const response = await axios.get(
        "https://www.googleapis.com/drive/v3/about?fields=user",
        {
          headers: {
            Authorization: `Bearer ${data.accessToken}`,
          },
          timeout: 10000, // 10 second timeout
        }
      );

      if (response.status === 200 && response.data.user) {
        return {
          success: true,
          message: `Connected successfully as ${
            response.data.user.emailAddress || "Google user"
          }`,
        };
      }

      return {
        success: true,
        message: "Connection successful",
      };
    } catch (error: any) {
      // Handle specific error cases
      if (error.response) {
        const status = error.response.status;

        if (status === 401) {
          return {
            success: false,
            message: "Access token is invalid or expired. Please re-authorize.",
          };
        } else if (status === 403) {
          return {
            success: false,
            message:
              "Access forbidden. Please check OAuth2 scopes and permissions.",
          };
        } else if (status === 429) {
          return {
            success: false,
            message: "Rate limit exceeded. Please try again later.",
          };
        } else {
          return {
            success: false,
            message: `Google API error (${status}): ${
              error.response.data?.error?.message || error.message
            }`,
          };
        }
      } else if (error.code === "ECONNABORTED") {
        return {
          success: false,
          message: "Connection timeout. Please check your internet connection.",
        };
      } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        return {
          success: false,
          message:
            "Cannot reach Google servers. Please check your internet connection.",
        };
      } else {
        return {
          success: false,
          message: `Connection test failed: ${error.message}`,
        };
      }
    }
  }

  /**
   * Test Google Drive OAuth2 credentials by making a real API call
   */
  private async testGoogleDriveOAuth2(
    data: CredentialData
  ): Promise<{ success: boolean; message: string }> {
    // First do basic validation
    if (!data.clientId || !data.clientSecret) {
      return {
        success: false,
        message: "Client ID and Client Secret are required",
      };
    }

    // Check if access token is present
    if (!data.accessToken) {
      return {
        success: false,
        message:
          "No access token found. Please complete the OAuth2 authorization flow first.",
      };
    }

    // Check if token is expired
    if (data.tokenObtainedAt && data.expiresIn) {
      const obtainedDate = new Date(data.tokenObtainedAt);
      const expiresAt = new Date(
        obtainedDate.getTime() + data.expiresIn * 1000
      );

      if (new Date() > expiresAt) {
        return {
          success: false,
          message:
            "Access token has expired. Please refresh the token or re-authorize.",
        };
      }
    }

    // Test the token by making a real API call to Google Drive
    try {
      const response = await axios.get(
        "https://www.googleapis.com/drive/v3/about?fields=user,storageQuota",
        {
          headers: {
            Authorization: `Bearer ${data.accessToken}`,
          },
          timeout: 10000, // 10 second timeout
        }
      );

      if (response.status === 200 && response.data.user) {
        const user = response.data.user;
        const quota = response.data.storageQuota;
        
        let message = `Connected successfully as ${user.displayName || user.emailAddress}`;
        
        if (quota && quota.limit) {
          const usedGB = Math.round((parseInt(quota.usage) / (1024 * 1024 * 1024)) * 100) / 100;
          const limitGB = Math.round((parseInt(quota.limit) / (1024 * 1024 * 1024)) * 100) / 100;
          message += ` (${usedGB}GB / ${limitGB}GB used)`;
        }

        return {
          success: true,
          message
        };
      }

      return {
        success: true,
        message: "Connection successful",
      };
    } catch (error: any) {
      // Handle specific error cases
      if (error.response) {
        const status = error.response.status;

        if (status === 401) {
          return {
            success: false,
            message: "Access token is invalid or expired. Please re-authorize.",
          };
        } else if (status === 403) {
          return {
            success: false,
            message:
              "Access forbidden. Please check OAuth2 scopes and permissions.",
          };
        } else if (status === 429) {
          return {
            success: false,
            message: "Rate limit exceeded. Please try again later.",
          };
        } else {
          return {
            success: false,
            message: `Google Drive API error (${status}): ${
              error.response.data?.error?.message || error.message
            }`,
          };
        }
      } else if (error.code === "ECONNABORTED") {
        return {
          success: false,
          message: "Connection timeout. Please check your internet connection.",
        };
      } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        return {
          success: false,
          message:
            "Cannot reach Google servers. Please check your internet connection.",
        };
      } else {
        return {
          success: false,
          message: `Connection test failed: ${error.message}`,
        };
      }
    }
  }

  /**
   * Test Bearer Token credentials
   */
  private async testBearerToken(
    data: CredentialData
  ): Promise<{ success: boolean; message: string }> {
    if (!data.token) {
      return { success: false, message: "Bearer token is required" };
    }

    // Basic format validation
    if (data.token.length < 10) {
      return {
        success: false,
        message: "Bearer token appears to be too short",
      };
    }

    // Check if tokenPrefix is provided and valid
    if (data.tokenPrefix && data.tokenPrefix.trim().length === 0) {
      return {
        success: false,
        message: "Token prefix cannot be empty if provided",
      };
    }

    return { success: true, message: "Bearer token credentials are valid" };
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
}
