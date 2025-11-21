/**
 * Core Credential Definitions
 * 
 * These are reusable credential types that can be used across multiple nodes.
 * Instead of each custom node defining its own OAuth2 or HTTP Basic Auth,
 * they can reference these core credentials.
 * 
 * Benefits:
 * - No duplication of credential definitions
 * - Consistent authentication across nodes
 * - Easier maintenance and updates
 * - Users can reuse the same credentials across multiple nodes
 */

export { GoogleOAuth2Credentials } from "./core/GoogleOAuth2.credentials";
export { HttpBasicAuthCredentials } from "./core/HttpBasicAuth.credentials";
export { OAuth2Credentials } from "./core/OAuth2.credentials";
export { ApiKeyCredentials } from "./core/ApiKey.credentials";

// Export OAuth utilities and providers
export * from "./oauth";

// Export all core credentials as an array for easy registration
import { GoogleOAuth2Credentials } from "./core/GoogleOAuth2.credentials";
import { HttpBasicAuthCredentials } from "./core/HttpBasicAuth.credentials";
import { OAuth2Credentials } from "./core/OAuth2.credentials";
import { ApiKeyCredentials } from "./core/ApiKey.credentials";

export const CoreCredentials = [
  GoogleOAuth2Credentials,
  HttpBasicAuthCredentials,
  OAuth2Credentials,
  ApiKeyCredentials,
];
