/**
 * Credential Helper Utilities
 * Makes it easy for nodes to use credentials with automatic token refresh
 */

import { PrismaClient } from '@prisma/client';
import { CredentialService } from '../services/CredentialService';
import { TokenRefreshService } from '../services/TokenRefreshService';
import { google } from 'googleapis';
import { AppError } from './errors';
import { logger } from './logger';

export class CredentialHelper {
  private prisma: PrismaClient;
  private credentialService: CredentialService;
  private tokenRefreshService: TokenRefreshService;

  constructor(credentialService: CredentialService) {
    this.prisma = new PrismaClient();
    this.credentialService = credentialService;
    this.tokenRefreshService = new TokenRefreshService(credentialService);
  }

  /**
   * Get credential with automatic token refresh
   * This is the main method nodes should use
   */
  async getCredentialForNode(
    credentialId: string,
    userId: string,
    nodeType?: string
  ): Promise<any> {
    const credential = await this.credentialService.getCredential(
      credentialId,
      userId
    );

    if (!credential) {
      throw new AppError('Credential not found', 404);
    }

    // For OAuth credentials, ensure token is valid
    if (this.isOAuthCredential(credential.type)) {
      try {
        const accessToken = await this.tokenRefreshService.ensureValidToken(
          credentialId,
          userId
        );

        // Update last used timestamp
        await this.updateLastUsed(credentialId);

        return {
          ...credential.data,
          accessToken,
        };
      } catch (error: any) {
        logger.error(
          `[CredentialHelper] Failed to refresh token for ${credentialId}:`,
          error
        );
        throw new AppError(
          `Credential token expired. Please re-authorize: ${error.message}`,
          401
        );
      }
    }

    // For non-OAuth credentials, just return the data
    await this.updateLastUsed(credentialId);
    return credential.data;
  }

  /**
   * Get Google OAuth2 client with automatic token refresh
   * Convenience method for Google services
   */
  async getGoogleOAuthClient(credentialId: string, userId: string) {
    const data = await this.getCredentialForNode(credentialId, userId, 'google');

    const auth = new google.auth.OAuth2(data.clientId, data.clientSecret);
    auth.setCredentials({
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
    });

    return auth;
  }

  /**
   * Get Gmail API client
   */
  async getGmailClient(credentialId: string, userId: string) {
    const auth = await this.getGoogleOAuthClient(credentialId, userId);
    return google.gmail({ version: 'v1', auth });
  }

  /**
   * Get Google Drive API client
   */
  async getDriveClient(credentialId: string, userId: string) {
    const auth = await this.getGoogleOAuthClient(credentialId, userId);
    return google.drive({ version: 'v3', auth });
  }

  /**
   * Get Google Sheets API client
   */
  async getSheetsClient(credentialId: string, userId: string) {
    const auth = await this.getGoogleOAuthClient(credentialId, userId);
    return google.sheets({ version: 'v4', auth });
  }

  /**
   * Get Google Calendar API client
   */
  async getCalendarClient(credentialId: string, userId: string) {
    const auth = await this.getGoogleOAuthClient(credentialId, userId);
    return google.calendar({ version: 'v3', auth });
  }

  /**
   * Check if credential type is OAuth-based
   */
  private isOAuthCredential(type: string): boolean {
    const oauthTypes = [
      'googleOAuth2',
      'googleSheetsOAuth2',
      'googleDriveOAuth2',
      'oauth2',
      'githubOAuth2',
      'microsoftOAuth2',
      'slackOAuth2',
    ];

    return oauthTypes.includes(type) || type.toLowerCase().includes('oauth');
  }

  /**
   * Update last used timestamp
   */
  private async updateLastUsed(credentialId: string) {
    try {
      await this.prisma.credential.update({
        where: { id: credentialId },
        data: { updatedAt: new Date() },
      });
    } catch (error) {
      // Non-critical, just log
      logger.warn(`[CredentialHelper] Failed to update lastUsed for ${credentialId}`);
    }
  }
}

/**
 * Global credential helper instance
 * Can be used across the application
 */
let globalCredentialHelper: CredentialHelper | null = null;

export function initializeCredentialHelper(
  credentialService: CredentialService
): CredentialHelper {
  globalCredentialHelper = new CredentialHelper(credentialService);
  return globalCredentialHelper;
}

export function getCredentialHelper(): CredentialHelper {
  if (!globalCredentialHelper) {
    throw new Error(
      'CredentialHelper not initialized. Call initializeCredentialHelper first.'
    );
  }
  return globalCredentialHelper;
}
