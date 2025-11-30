/**
 * Credential Helpers Utility
 *
 * Shared utilities for building credential mappings across execution engines.
 * Used by RealtimeExecutionEngine, ExecutionService, ExecutionEngine, FlowExecutionEngine
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

/**
 * Node type property interface for credential extraction
 */
export interface NodeTypeProperty {
  name: string;
  type: string;
  allowedTypes?: string[];
}

/**
 * Node type info interface
 */
export interface NodeTypeInfo {
  identifier: string;
  properties?: NodeTypeProperty[];
}

/**
 * Options for building credentials mapping
 */
export interface BuildCredentialsMappingOptions {
  /** Node parameters containing credential IDs */
  nodeParameters: Record<string, any>;
  /** Node type properties (from node type definition) */
  nodeTypeProperties?: NodeTypeProperty[];
  /** User ID for ownership verification */
  userId: string;
  /** Prisma client for database access */
  prisma: PrismaClient;
  /** Optional: Legacy credentials array from node */
  legacyCredentials?: string[];
  /** Optional: Log prefix for debugging */
  logPrefix?: string;
}

/**
 * Result of credential mapping
 */
export interface CredentialsMappingResult {
  /** Map of credential type -> credential ID */
  mapping: Record<string, string>;
  /** Any warnings encountered during mapping */
  warnings: string[];
}

/**
 * Builds a credentials mapping from node parameters and type definition.
 * This is the single source of truth for credential mapping logic.
 *
 * The mapping maps credential types (e.g., "googleSheetsOAuth2") to credential IDs.
 * This allows nodes to request credentials by their type.
 *
 * @param options - Options for building the mapping
 * @returns Credentials mapping and any warnings
 *
 * @example
 * const { mapping, warnings } = await buildCredentialsMapping({
 *   nodeParameters: { authentication: "cred_123" },
 *   nodeTypeProperties: [{ name: "authentication", type: "credential", allowedTypes: ["apiKey"] }],
 *   userId: "user_456",
 *   prisma: prismaClient,
 * });
 * // mapping = { "apiKey": "cred_123" }
 */
export async function buildCredentialsMapping(
  options: BuildCredentialsMappingOptions
): Promise<CredentialsMappingResult> {
  const {
    nodeParameters,
    nodeTypeProperties,
    userId,
    prisma,
    legacyCredentials,
    logPrefix = "[CredentialHelper]",
  } = options;

  const mapping: Record<string, string> = {};
  const warnings: string[] = [];

  // PRIMARY METHOD: Extract credentials from node type properties
  if (nodeTypeProperties && nodeTypeProperties.length > 0) {
    for (const property of nodeTypeProperties) {
      if (
        property.type === "credential" &&
        property.allowedTypes &&
        property.allowedTypes.length > 0
      ) {
        // Get the credential ID from parameters using the field name
        const credentialId = nodeParameters?.[property.name];

        if (credentialId && typeof credentialId === "string") {
          // Verify credential exists and get its actual type
          const cred = await prisma.credential.findUnique({
            where: { id: credentialId },
            select: { type: true, userId: true },
          });

          if (cred) {
            if (cred.userId !== userId) {
              const warning = `${logPrefix} Credential ${credentialId} does not belong to user ${userId}`;
              logger.warn(warning);
              warnings.push(warning);
              continue;
            }
            // Map the actual credential type from the database to the credential ID
            mapping[cred.type] = credentialId;
            logger.info(
              `${logPrefix} Mapped credential type '${cred.type}' to ID '${credentialId}' from parameter '${property.name}'`
            );
          } else {
            const warning = `${logPrefix} Credential ${credentialId} not found in database`;
            logger.warn(warning);
            warnings.push(warning);
          }
        }
      }
    }
  }

  // FALLBACK: Check legacy credentials array (if no credentials found via properties)
  if (
    Object.keys(mapping).length === 0 &&
    legacyCredentials &&
    Array.isArray(legacyCredentials) &&
    legacyCredentials.length > 0
  ) {
    logger.info(
      `${logPrefix} No credentials found via node type, checking legacy credentials array`
    );

    for (const credId of legacyCredentials) {
      try {
        const cred = await prisma.credential.findUnique({
          where: { id: credId },
          select: { type: true, userId: true },
        });

        if (cred) {
          if (cred.userId !== userId) {
            const warning = `${logPrefix} Legacy credential ${credId} does not belong to user ${userId}`;
            logger.warn(warning);
            warnings.push(warning);
            continue;
          }
          mapping[cred.type] = credId;
          logger.info(
            `${logPrefix} Mapped legacy credential type '${cred.type}' to ID '${credId}'`
          );
        } else {
          const warning = `${logPrefix} Legacy credential ${credId} not found in database`;
          logger.warn(warning);
          warnings.push(warning);
        }
      } catch (error) {
        const warning = `${logPrefix} Failed to lookup legacy credential ${credId}: ${error}`;
        logger.error(warning);
        warnings.push(warning);
      }
    }
  }

  return { mapping, warnings };
}

/**
 * Extracts credential properties from a node type definition.
 * Helper function to get just the credential-related properties.
 *
 * @param nodeTypeInfo - Node type information
 * @returns Array of credential properties
 */
export function extractCredentialProperties(
  nodeTypeInfo: NodeTypeInfo | undefined
): NodeTypeProperty[] {
  if (!nodeTypeInfo?.properties) {
    return [];
  }

  const properties = Array.isArray(nodeTypeInfo.properties)
    ? nodeTypeInfo.properties
    : [];

  return properties.filter(
    (p) =>
      p.type === "credential" && p.allowedTypes && p.allowedTypes.length > 0
  );
}
