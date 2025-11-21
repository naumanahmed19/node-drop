/**
 * Token Refresh Service
 * Automatically refreshes OAuth tokens when needed
 */

import { CredentialService } from './CredentialService';
import { oauthProviderRegistry } from '../oauth/OAuthProviderRegistry';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class TokenRefreshService {
  private credentialService: CredentialService;

  constructor(credentialService: CredentialService) {
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

    // Get credential type definition to check if it's OAuth
    const credentialType = this.credentialService.getCredentialType(credential.type);
    if (!credentialType || !credentialType.oauthProvider) {
      // Not an OAuth credential, return access token if available
      return credential.data.accessToken || '';
    }

    // Check if token needs refresh
    const needsRefresh = this.checkIfNeedsRefresh(credential.data);
    
    if (!needsRefresh) {
      logger.info(`[TokenRefresh] Token still valid for credential ${credentialId}`);
      return credential.data.accessToken;
    }

    logger.info(`[TokenRefresh] Refreshing token for credential ${credentialId}`);

    // Get OAuth provider from registry
    const providerName = credentialType.oauthProvider;
    const provider = oauthProviderRegistry.get(providerName);
    
    if (!provider) {
      throw new AppError(`OAuth provider '${providerName}' not found`, 500);
    }
    
    if (!provider.refreshAccessToken) {
      throw new AppError(`OAuth provider '${providerName}' does not support token refresh`, 500);
    }

    // Refresh the token
    try {
      const tokens = await provider.refreshAccessToken({
        refreshToken: credential.data.refreshToken,
        clientId: credential.data.clientId,
        clientSecret: credential.data.clientSecret
      });

      // Update credential with new tokens
      await this.credentialService.updateCredential(credentialId, userId, {
        data: {
          ...credential.data,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || credential.data.refreshToken,
          expiresIn: tokens.expiresIn,
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
   * Refreshes if token expires within 5 minutes
   */
  private checkIfNeedsRefresh(data: any): boolean {
    if (!data.tokenObtainedAt || !data.expiresIn) {
      return false; // Can't determine, assume valid
    }

    const obtainedAt = new Date(data.tokenObtainedAt).getTime();
    const expiresIn = data.expiresIn * 1000; // Convert to milliseconds
    const expiresAt = obtainedAt + expiresIn;
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds

    // Refresh if token expires within the buffer time
    return now >= (expiresAt - bufferTime);
  }
}
