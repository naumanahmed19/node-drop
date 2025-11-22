export interface Credential {
  id: string;
  name: string;
  type: string;
  userId: string;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  usageCount?: number;
  isShared?: boolean;
  sharedWith?: string[];
  rotationConfig?: CredentialRotationConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialType {
  name: string;
  displayName: string;
  description: string;
  properties: CredentialProperty[];
  icon?: string;
  color?: string;
  oauthProvider?: string; // OAuth provider name (google, microsoft, github, etc.)
}

export interface CredentialProperty {
  displayName: string;
  name: string;
  type: "string" | "text" | "password" | "number" | "boolean" | "options";
  required?: boolean;
  default?: any;
  description?: string;
  options?: Array<{ name: string; value: any }>;
  placeholder?: string;
  displayOptions?: {
    show?: Record<string, any[]>;
    hide?: Record<string, any[]>;
  };
}

export interface CredentialData {
  [key: string]: any;
}

export interface CreateCredentialRequest {
  name: string;
  type: string;
  data: CredentialData;
}

export interface UpdateCredentialRequest {
  name?: string;
  data?: CredentialData;
}

export interface TestCredentialRequest {
  type: string;
  data: CredentialData;
}

export interface TestCredentialResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface CredentialRotationConfig {
  enabled: boolean;
  intervalDays: number;
  warningDays: number;
  autoRotate: boolean;
}

export interface CredentialUsageLog {
  id: string;
  credentialId: string;
  workflowId: string;
  workflowName: string;
  nodeId: string;
  nodeName: string;
  usedAt: string;
  success: boolean;
  error?: string;
}

export interface CredentialAuditLog {
  id: string;
  credentialId: string;
  action: "created" | "updated" | "deleted" | "rotated" | "shared" | "accessed";
  userId: string;
  userName: string;
  timestamp: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export interface CredentialSecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: {
    maxAge?: number; // days
    requireRotation: boolean;
    rotationInterval?: number; // days
    allowSharing: boolean;
    requireMFA: boolean;
    allowedIpRanges?: string[];
    encryptionLevel: "standard" | "high";
  };
}

export interface CredentialBackup {
  id: string;
  name: string;
  description?: string;
  credentials: Array<{
    id: string;
    name: string;
    type: string;
    encrypted: boolean;
  }>;
  createdAt: string;
  size: number;
}

export interface BulkCredentialOperation {
  operation: "import" | "export" | "delete" | "rotate";
  credentialIds: string[];
  options?: Record<string, any>;
}

export interface CredentialImportData {
  credentials: Array<{
    name: string;
    type: string;
    data: CredentialData;
    expiresAt?: string;
  }>;
  overwriteExisting?: boolean;
}

export interface CredentialExportData {
  credentials: Array<{
    id: string;
    name: string;
    type: string;
    data?: CredentialData; // Only included if user has permission
    expiresAt?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  exportedAt: string;
  exportedBy: string;
}
