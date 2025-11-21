/**
 * Token Refresh Utilities
 * Handles automatic OAuth token refresh with provider-specific logic
 */

import axios from 'axios';
import { getProviderConfig } from '../providers';
import { logger } from '../../utils/logger';

export interface TokenRefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Refresh an OAuth access token
 */
export async function refreshOAuthToken(
  provider: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenRefreshResult> {
  const config = getProviderConfig(provider);
  
  if (!config) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    ...config.additionalHeaders,
  };

  const bodyParams: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };

  if (config.useBasicAuth) {
    // Use Basic Authentication - credentials in Authorization header
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers.Authorization = `Basic ${basicAuth}`;
  } else {
    // Include credentials in request body
    bodyParams.client_id = clientId;
    bodyParams.client_secret = clientSecret;
  }

  try {
    const response = await axios.post(
      config.tokenUrl,
      new URLSearchParams(bodyParams).toString(),
      { headers }
    );

    const data = response.data;

    // Handle refresh token rotation
    let newRefreshToken = refreshToken;
    if (config.supportsRefreshTokenRotation && data.refresh_token) {
      newRefreshToken = data.refresh_token;
      logger.info(`[OAuth] Received new refresh token from ${provider}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: newRefreshToken,
      expiresIn: data.expires_in || data.expiresIn || 3600,
      tokenType: data.token_type || 'Bearer',
    };
  } catch (error: any) {
    logger.error(`[OAuth] Token refresh failed for ${provider}:`, {
      status: error.response?.status,
      error: error.response?.data,
    });
    
    throw new Error(
      `Failed to refresh ${provider} token: ${
        error.response?.data?.error_description || 
        error.response?.data?.error || 
        error.message
      }`
    );
  }
}

/**
 * Check if token needs refresh (expired or expiring soon)
 */
export function shouldRefreshToken(
  tokenObtainedAt: string | Date,
  expiresIn: number,
  bufferMinutes: number = 5
): boolean {
  const obtainedAt = new Date(tokenObtainedAt);
  const expiresAt = new Date(obtainedAt.getTime() + expiresIn * 1000);
  const now = new Date();
  const bufferTime = new Date(now.getTime() + bufferMinutes * 60 * 1000);

  return expiresAt <= bufferTime;
}

/**
 * Get token expiration info
 */
export function getTokenExpirationInfo(
  tokenObtainedAt: string | Date,
  expiresIn: number
): {
  expiresAt: Date;
  isExpired: boolean;
  expiresInMinutes: number;
} {
  const obtainedAt = new Date(tokenObtainedAt);
  const expiresAt = new Date(obtainedAt.getTime() + expiresIn * 1000);
  const now = new Date();
  const isExpired = now > expiresAt;
  const expiresInMinutes = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));

  return {
    expiresAt,
    isExpired,
    expiresInMinutes,
  };
}
