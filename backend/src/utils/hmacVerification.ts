/**
 * HMAC Signature Verification Utility
 * Used to verify webhook authenticity
 */

import crypto from 'crypto';

export interface HMACOptions {
  secret: string;
  algorithm?: 'sha1' | 'sha256' | 'sha512';
  header?: string;
}

/**
 * Generate HMAC signature for a payload
 */
export function generateHMACSignature(
  payload: string | Buffer,
  secret: string,
  algorithm: 'sha1' | 'sha256' | 'sha512' = 'sha256'
): string {
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Verify HMAC signature
 */
export function verifyHMACSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
  algorithm: 'sha1' | 'sha256' | 'sha512' = 'sha256'
): boolean {
  try {
    const expectedSignature = generateHMACSignature(payload, secret, algorithm);
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    // If signatures have different lengths, timingSafeEqual will throw
    return false;
  }
}

/**
 * Verify HMAC signature from request
 */
export function verifyWebhookSignature(
  body: any,
  signatureHeader: string | undefined,
  options: HMACOptions
): { valid: boolean; reason?: string } {
  // If no secret is configured, skip verification
  if (!options.secret || options.secret.trim() === '') {
    return { valid: true };
  }

  // Check if signature header is present
  if (!signatureHeader) {
    return {
      valid: false,
      reason: `Missing signature header: ${options.header || 'X-Webhook-Signature'}`,
    };
  }

  // Convert body to string for verification
  let payload: string;
  if (typeof body === 'string') {
    payload = body;
  } else if (Buffer.isBuffer(body)) {
    payload = body.toString('utf8');
  } else {
    payload = JSON.stringify(body);
  }

  // Verify signature
  const algorithm = options.algorithm || 'sha256';
  const isValid = verifyHMACSignature(payload, signatureHeader, options.secret, algorithm);

  if (!isValid) {
    return {
      valid: false,
      reason: 'Invalid HMAC signature',
    };
  }

  return { valid: true };
}

/**
 * Extract signature from header (handles different formats)
 * Examples:
 * - "sha256=abc123" -> "abc123"
 * - "abc123" -> "abc123"
 */
export function extractSignature(signatureHeader: string): string {
  // Check if signature has algorithm prefix (e.g., "sha256=abc123")
  const match = signatureHeader.match(/^(sha1|sha256|sha512)=(.+)$/);
  if (match) {
    return match[2];
  }
  
  // Return as-is if no prefix
  return signatureHeader;
}
