// Custom Node types for frontend

export interface NodePackageInfo {
  name: string;
  version: string;
  description: string;
  author?: string;
  keywords?: string[];
  main: string;
  nodes: string[];
  credentials?: string[];
}

export interface NodePackageValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  packageInfo?: NodePackageInfo;
}

export interface NodeLoadResult {
  success: boolean;
  nodeType?: string;
  errors?: string[];
  warnings?: string[];
}

export interface NodeCompilationResult {
  success: boolean;
  compiledPath?: string;
  errors?: string[];
  warnings?: string[];
}

export interface NodeTemplateOptions {
  name: string;
  displayName: string;
  description: string;
  type: "action" | "trigger" | "transform";
  author?: string;
  version?: string;
  group?: string[];
  includeCredentials?: boolean;
  includeTests?: boolean;
  typescript?: boolean;
}

export interface TemplateGenerationResult {
  success: boolean;
  packagePath?: string;
  errors?: string[];
  warnings?: string[];
}

export interface NodePackageMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  keywords: string[];
  downloadUrl: string;
  icon?: string;
  iconUrl?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  createdAt: string;
  updatedAt: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  verified: boolean;
  screenshots?: string[];
  readme?: string;
  changelog?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  nodeTypes: string[];
  credentialTypes: string[];
  installed?: boolean;
  installedVersion?: string;
  hasUpdate?: boolean;
}

export interface NodeSearchFilters {
  query?: string;
  category?: string;
  author?: string;
  verified?: boolean;
  minRating?: number;
  tags?: string[];
  sortBy?: "relevance" | "downloads" | "rating" | "updated" | "created";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface NodeSearchResult {
  packages: NodePackageMetadata[];
  total: number;
  hasMore: boolean;
}

export interface PublishOptions {
  packagePath: string;
  version?: string;
  changelog?: string;
  tags?: string[];
  private?: boolean;
  dryRun?: boolean;
}

export interface PublishResult {
  success: boolean;
  packageId?: string;
  version?: string;
  downloadUrl?: string;
  errors?: string[];
  warnings?: string[];
}

export interface InstallOptions {
  version?: string;
  force?: boolean;
  skipValidation?: boolean;
  installPath?: string;
}

export interface InstallResult {
  success: boolean;
  packagePath?: string;
  version?: string;
  errors?: string[];
  warnings?: string[];
}

export interface UpdateResult {
  success: boolean;
  oldVersion?: string;
  newVersion?: string;
  changelog?: string;
  errors?: string[];
  warnings?: string[];
}

export interface CustomNodeState {
  packages: NodePackageInfo[];
  loading: boolean;
  error: string | null;
  searchResults: NodeSearchResult | null;
  searchLoading: boolean;
  selectedPackage: NodePackageMetadata | null;
}

export interface CustomNodeActions {
  loadPackages: () => Promise<void>;
  validatePackage: (
    packagePath: string
  ) => Promise<NodePackageValidationResult>;
  loadPackage: (packagePath: string) => Promise<NodeLoadResult>;
  unloadPackage: (packageName: string) => Promise<void>;
  reloadPackage: (packageName: string) => Promise<NodeLoadResult>;
  generatePackage: (
    options: NodeTemplateOptions,
    outputPath?: string
  ) => Promise<TemplateGenerationResult>;
  generatePackageZip: (options: NodeTemplateOptions) => Promise<void>;
  compilePackage: (packagePath: string) => Promise<NodeCompilationResult>;
  searchMarketplace: (filters: NodeSearchFilters) => Promise<NodeSearchResult>;
  getPackageInfo: (packageId: string) => Promise<NodePackageMetadata>;
  installPackage: (
    packageId: string,
    options?: InstallOptions
  ) => Promise<InstallResult>;
  updatePackage: (packageId: string) => Promise<UpdateResult>;
  publishPackage: (options: PublishOptions) => Promise<PublishResult>;
  clearError: () => void;
  setSelectedPackage: (pkg: NodePackageMetadata | null) => void;
}
