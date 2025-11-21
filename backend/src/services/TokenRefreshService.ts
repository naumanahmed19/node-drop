/**
 * Token Refresh Service
 * Automatically refreshes OAuth tokens when needed
 */

import { PrismaClient } from '@prisma/client';
import { CredentialService } from './CredentialService';
import { refreshOAuthToken, shouldRefreshToken } from '../oauth/utils/tokenRefresh';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class TokenRefreshService {
  private prisma: PrismaClient;
  private credentialService: CredentialService;

  constructor(credentialService: CredentialService) {
    this.prisma = new PrismaClient();
    this.credentialService = credentialService;
  }

  /**
   * Ensure credential has a valid access token
   * Automatically refreshes if expired or expiring soon
   */
  async ensureValidToken(credentialId: string, userId: string): Promise<string> {
    const credential = await this.credentialService.getCredential(credentialId, userId);
    
    if (!credential) {
      throw new AppError('Credential not found', 404);
    }

    // Check if this is an OAuth credential
    if (!this.isOAuthCredential(credential.type)) {
      return credential.data.accessToken || '';
    }

    // Check if token needs refresh
    const needsRefresh = this.checkIfNeedsRefresh(credential.data);
    
    if (!needsRefresh) {
      logger.info(`[TokenRefresh] Token still valid for credential ${credentialId}`);
      return credential.data.accessToken;
    }

    logger.info(`[TokenRefresh] Refreshing token for credential ${credentialId}`);

    // Extract provider from credential type
    const provider = this.extractProvider(credential.type);
    
    // Refresh the token
    try {
      const tokens = await refreshOAuthToken(
        provider,
        credential.data.refreshToken,
        credential.data.clientId,
        credential.data.clientSecret
      );

      // Update credential with new tokens
      await this.credentialService.updateCredential(credentialId, userId, {
        data: {
          ...credential.data,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          tokenType: tokens.tokenType,
          tokenObtainedAt: new Date().toISOString(),
        },
      });

      logger.info(`[TokenRefresh] Token refreshed successfully for credential ${credentialId}`);

      return tokens.accessToken;
    } catch (error: any) {
      logger.error(`[TokenRefresh] Failed to refresh token for credential ${credentialId}:`, error);
      throw new AppError(
        `Failed to refresh OAuth token: ${error.message}. Please re-authorize the credential.`,
        401
      );
    }
  }

  /**
   * Check if credential needs token refresh
   */
  private checkIfNeedsRefresh(data: any): boolean {
    if (!data.tokenObtainedAt || !data.expiresIn) {
      return false; // Can't determine, assume valid
    }

    return shouldRefreshToken(data.tokenObtainedAt, data.expiresIn, 5);
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
   * Extract provider name from credential type
   */
  private extractProvider(type: string): string {
    // Map credential types to providers
    const typeToProvider: Record<string, string> = {
      'googleOAuth2': 'google',
      'googleSheetsOAuth2': 'google',
      'googleDriveOAuth2': 'google',
      'githubOAuth2': 'github',
      'microsoftOAuth2': 'microsoft',
      'slackOAuth2': 'slack',
    };

    return typeToProvider[type] || type.split('OAuth')[0].toLowerCase();
  }
}
