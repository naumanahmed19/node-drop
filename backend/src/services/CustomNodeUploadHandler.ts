import { PrismaClient } from "@prisma/client";
import AdmZip from "adm-zip";
import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "../utils/logger";

interface UploadResult {
  success: boolean;
  message: string;
  nodes?: any[];
  extractedPath?: string;
  errors?: string[];
}

interface NodeDefinition {
  type: string;
  displayName: string;
  name: string;
  group: string[];
  version?: number;
  description: string;
  defaults?: any;
  inputs?: string[];
  outputs?: string[];
  properties?: any[];
  icon?: string;
  color?: string;
}

interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  author?: string;
  nodeDrop?: {
    nodes?: string[];
    credentials?: string[];
  };
}

export class CustomNodeUploadHandler {
  private prisma: PrismaClient;
  private extractPath: string;
  private nodesPath: string; // Changed from customNodesPath to nodesPath

  constructor() {
    this.prisma = new PrismaClient();
    this.extractPath = path.join(process.cwd(), "temp/extract");
    this.nodesPath = path.join(process.cwd(), "custom-nodes"); // Point to custom nodes directory
  }

  async processUpload(
    filePath: string,
    originalName: string
  ): Promise<UploadResult> {
    try {
      // Create extraction directory
      await this.ensureDirectory(this.extractPath);
      await this.ensureDirectory(this.nodesPath);

      const extractDir = path.join(this.extractPath, Date.now().toString());
      await this.ensureDirectory(extractDir);

      // Extract ZIP file
      const zip = new AdmZip(filePath);
      zip.extractAllTo(extractDir, true);

      // Validate and process the extracted content
      const result = await this.processExtractedContent(
        extractDir,
        originalName
      );

      // Clean up the uploaded file
      await fs.unlink(filePath).catch(() => { });

      return {
        ...result,
        extractedPath: extractDir,
      };
    } catch (error) {
      logger.error("Upload processing failed", { error, filePath });
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        success: false,
        message: "Failed to process upload",
        errors: [errorMessage],
      };
    }
  }

  private async processExtractedContent(
    extractDir: string,
    originalName: string
  ): Promise<UploadResult> {
    try {
      // Look for package.json
      const packageJsonPath = path.join(extractDir, "package.json");
      let packageInfo: PackageInfo | null = null;

      try {
        const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
        packageInfo = JSON.parse(packageJsonContent);
      } catch (error) {
        return {
          success: false,
          message: "Invalid package structure",
          errors: ["package.json not found or invalid"],
        };
      }

      // Find and validate node files
      const nodeFiles = await this.findNodeFiles(extractDir);

      if (nodeFiles.length === 0) {
        return {
          success: false,
          message: "No node files found",
          errors: ["No .node.js or .node.ts files found in the package"],
        };
      }

      // Extract the entire package to custom-nodes directory
      const processedNodes: any[] = [];
      const errors: string[] = [];

      // Extract package once (use first node for naming)
      let packageExtracted = false;

      for (const nodeFile of nodeFiles) {
        try {
          const nodeDefinition = await this.processNodeFile(
            nodeFile,
            packageInfo!
          );
          if (nodeDefinition) {
            // Extract the entire package only once
            if (!packageExtracted) {
              try {
                const success = await this.extractNodeToFolder(
                  nodeFile,
                  nodeDefinition,
                  extractDir
                );

                if (!success) {
                  errors.push(
                    `Failed to extract package to custom-nodes directory`
                  );
                  break;
                }
                packageExtracted = true;
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push(errorMsg);
                logger.error("Package extraction failed", {
                  error: errorMsg,
                  nodeFile,
                  nodeDefinition: nodeDefinition.displayName
                });
                break;
              }
            }

            // Save to database (but don't register yet - let NodeLoader handle it)
            const savedNode = await this.saveNodeType(nodeDefinition);
            processedNodes.push(savedNode);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          errors.push(
            `Failed to process ${path.basename(nodeFile)}: ${errorMessage}`
          );
        }
      }

      if (processedNodes.length === 0) {
        return {
          success: false,
          message: "No valid nodes could be processed",
          errors:
            errors.length > 0 ? errors : ["All node files failed validation"],
        };
      }

      // Try to trigger auto-discovery and register new nodes with NodeService
      try {
        // Import NodeDiscovery to refresh the discovered nodes
        const { nodeDiscovery } = await import("../utils/NodeDiscovery");
        const discoveredNodes = await nodeDiscovery.getAllNodeDefinitions();
        logger.info("Nodes re-discovered after upload", {
          totalNodes: discoveredNodes.length,
        });

        // Get the global NodeService instance and refresh custom nodes
        const nodeService = global.nodeService;
        if (nodeService) {
          const refreshResult = await nodeService.refreshCustomNodes();
          logger.info("Custom nodes refresh result after upload", refreshResult);
        } else {
          logger.warn("Global NodeService not available for node registration");
        }
      } catch (error) {
        logger.warn("Failed to re-discover and register nodes after upload", {
          error,
        });
        // Don't fail the upload if discovery fails, just log the warning
      }

      return {
        success: true,
        message: `Successfully uploaded ${processedNodes.length} custom node(s)`,
        nodes: processedNodes,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      logger.error("Content processing failed", { error, extractDir });
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        success: false,
        message: "Failed to process package content",
        errors: [errorMessage],
      };
    }
  }

  private async findNodeFiles(directory: string): Promise<string[]> {
    const nodeFiles: string[] = [];

    const searchInDirectory = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await searchInDirectory(fullPath);
        } else if (entry.isFile()) {
          if (
            entry.name.endsWith(".node.js") ||
            entry.name.endsWith(".node.ts")
          ) {
            nodeFiles.push(fullPath);
          }
        }
      }
    };

    await searchInDirectory(directory);
    return nodeFiles;
  }

  private async processNodeFile(
    filePath: string,
    packageInfo: PackageInfo
  ): Promise<NodeDefinition | null> {
    try {
      // Try to find corresponding .node.json file
      const nodeJsonPath = filePath.replace(/\.(js|ts)$/, ".json");
      let nodeDescription: any = {};

      try {
        const nodeJsonContent = await fs.readFile(nodeJsonPath, "utf-8");
        nodeDescription = JSON.parse(nodeJsonContent);
      } catch (error) {
        // .node.json is optional, continue without it
        logger.warn("No .node.json found", { filePath: nodeJsonPath });
      }

      // Extract node information from file content
      const fileContent = await fs.readFile(filePath, "utf-8");
      const nodeInfo = this.extractNodeInfoFromContent(
        fileContent,
        path.basename(filePath)
      );

      // Merge information from different sources
      const nodeDefinition: NodeDefinition = {
        type: nodeInfo.type || this.generateTypeFromFilename(filePath),
        displayName:
          nodeDescription.displayName ||
          nodeInfo.displayName ||
          this.generateDisplayNameFromFilename(filePath),
        name:
          nodeDescription.name ||
          nodeInfo.name ||
          this.generateNameFromFilename(filePath),
        group: nodeDescription.group || nodeInfo.group || ["Custom"],
        version:
          nodeDescription.version || packageInfo.version
            ? parseInt(packageInfo.version.split(".")[0])
            : 1,
        description:
          nodeDescription.description ||
          nodeInfo.description ||
          `Custom node from ${packageInfo.name}`,
        defaults: nodeDescription.defaults || nodeInfo.defaults || {},
        inputs: nodeDescription.inputs || nodeInfo.inputs || ["main"],
        outputs: nodeDescription.outputs || nodeInfo.outputs || ["main"],
        properties: nodeDescription.properties || nodeInfo.properties || [],
        icon: nodeDescription.icon || nodeInfo.icon,
        color: nodeDescription.color || nodeInfo.color || "#3b82f6",
      };

      return nodeDefinition;
    } catch (error) {
      logger.error("Failed to process node file", { error, filePath });
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to process node file: ${errorMessage}`);
    }
  }

  /**
   * Extract the entire package to custom-nodes directory preserving structure
   */
  private async extractNodeToFolder(
    nodeFilePath: string,
    nodeDefinition: NodeDefinition,
    extractDir: string
  ): Promise<boolean> {
    try {
      // Generate package folder name from node display name or use package name
      const packageJsonPath = path.join(extractDir, "package.json");
      let packageName = this.generateFolderNameFromDisplayName(nodeDefinition.displayName);

      // Try to get package name from package.json
      try {
        const packageContent = await fs.readFile(packageJsonPath, "utf-8");
        const packageInfo = JSON.parse(packageContent);
        if (packageInfo.name) {
          packageName = packageInfo.name.replace(/[^a-zA-Z0-9\-_]/g, "");
        }
      } catch (error) {
        logger.warn("Could not read package.json, using generated name", {
          packageJsonPath,
          generatedName: packageName,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      const packageFolder = path.join(this.nodesPath, packageName);

      logger.info("Starting package extraction", {
        packageName,
        packageFolder,
        extractDir,
        nodeName: nodeDefinition.displayName
      });

      // Ensure custom-nodes directory exists
      try {
        await this.ensureDirectory(this.nodesPath);
        logger.info("Custom-nodes directory ensured", { path: this.nodesPath });
      } catch (error) {
        const errorMsg = `Failed to create custom-nodes directory: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMsg, { path: this.nodesPath, error });
        throw new Error(errorMsg);
      }

      // Remove existing package folder if it exists
      try {
        await fs.rm(packageFolder, { recursive: true, force: true });
        logger.info("Removed existing package folder", { packageFolder });
      } catch (error) {
        logger.warn("Could not remove existing package folder (may not exist)", {
          packageFolder,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Create package folder
      try {
        await this.ensureDirectory(packageFolder);
        logger.info("Created package folder", { packageFolder });
      } catch (error) {
        const errorMsg = `Failed to create package folder: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMsg, { packageFolder, error });
        throw new Error(errorMsg);
      }

      // Copy the entire extracted directory to preserve package structure
      try {
        await this.copyDirectory(extractDir, packageFolder);
        logger.info("Copied package contents", { from: extractDir, to: packageFolder });
      } catch (error) {
        const errorMsg = `Failed to copy package contents: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMsg, { extractDir, packageFolder, error });
        throw new Error(errorMsg);
      }

      // Install dependencies if package.json has dependencies
      try {
        await this.installDependencies(packageFolder);
        logger.info("Dependencies installation completed", { packageFolder });
      } catch (error) {
        logger.warn("Dependencies installation failed (continuing anyway)", {
          packageFolder,
          error: error instanceof Error ? error.message : String(error)
        });
        // Don't throw here - allow package to work without dependencies
      }

      logger.info("Package extracted to custom-nodes directory successfully", {
        packageName: packageName,
        folderPath: packageFolder,
        nodeName: nodeDefinition.displayName,
      });

      return true;
    } catch (error) {
      const errorMsg = `Failed to extract package to custom-nodes directory: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        nodeFilePath,
        nodeName: nodeDefinition.displayName,
      });
      throw new Error(errorMsg);
    }
  }

  /**
   * Extract the export name from a node file
   */
  private async extractExportNameFromFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, "utf-8");

      // Look for export patterns
      const exportPatterns = [
        /export\s+const\s+(\w+)\s*=/, // export const NodeName =
        /export\s+{\s*(\w+)\s*}/, // export { NodeName }
        /exports\.(\w+)\s*=/, // exports.NodeName =
        /module\.exports\s*=\s*{\s*(\w+)/, // module.exports = { NodeName
      ];

      for (const pattern of exportPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }

      // Fallback: try to find any capitalized word that looks like a node name
      const fallbackMatch = content.match(/(\w*Node)/);
      if (fallbackMatch && fallbackMatch[1]) {
        return fallbackMatch[1];
      }

      // Last resort: generate name from file
      const baseName = path.basename(filePath, path.extname(filePath));
      return baseName.replace(".node", "") + "Node";
    } catch (error) {
      logger.warn("Failed to extract export name from file", {
        error,
        filePath,
      });
      const baseName = path.basename(filePath, path.extname(filePath));
      return baseName.replace(".node", "") + "Node";
    }
  }

  /**
   * Generate a valid folder name from display name
   */
  private generateFolderNameFromDisplayName(displayName: string): string {
    return displayName
      .replace(/[^a-zA-Z0-9\s]/g, "") // Remove special characters
      .replace(/\s+/g, "") // Remove spaces
      .replace(/^./, (str) => str.toUpperCase()); // Capitalize first letter
  }

  /**
   * Copy related files (like .json, .md files) to the node folder
   */
  private async copyRelatedFiles(
    nodeFilePath: string,
    targetFolder: string,
    extractDir: string
  ): Promise<void> {
    try {
      const nodeBaseName = path.basename(
        nodeFilePath,
        path.extname(nodeFilePath)
      );
      const nodeDir = path.dirname(nodeFilePath);

      // Look for related files with the same base name
      const files = await fs.readdir(nodeDir);

      for (const file of files) {
        const filePath = path.join(nodeDir, file);
        const fileBaseName = path.basename(file, path.extname(file));

        // Copy files that match the node base name (excluding the main node file)
        if (
          fileBaseName === nodeBaseName &&
          file !== path.basename(nodeFilePath)
        ) {
          const targetFile = path.join(targetFolder, file);
          await fs.copyFile(filePath, targetFile);
          logger.debug("Copied related file", {
            from: filePath,
            to: targetFile,
          });
        }
      }

      // Also copy any package.json or README files from the root
      const commonFiles = ["package.json", "README.md", "README.txt"];
      for (const commonFile of commonFiles) {
        const sourcePath = path.join(extractDir, commonFile);
        try {
          await fs.access(sourcePath);
          const targetPath = path.join(targetFolder, commonFile);
          await fs.copyFile(sourcePath, targetPath);
          logger.debug("Copied common file", {
            from: sourcePath,
            to: targetPath,
          });
        } catch (error) {
          // File doesn't exist, skip
        }
      }
    } catch (error) {
      logger.warn("Failed to copy related files", {
        error,
        nodeFilePath,
        targetFolder,
      });
      // Don't fail the extraction if related files can't be copied
    }
  }

  private extractNodeInfoFromContent(
    content: string,
    filename: string
  ): Partial<NodeDefinition> {
    const info: Partial<NodeDefinition> = {};

    try {
      // Try to extract node definition from JavaScript object pattern
      // Look for patterns like: const NodeName = { ... } or module.exports = { ... }
      const objectPatterns = [
        /const\s+\w+\s*=\s*({[\s\S]*?});?\s*(?:module\.exports|$)/,
        /module\.exports\s*=\s*({[\s\S]*?});?\s*$/,
        /export\s+(?:const\s+\w+\s*=\s*)?({[\s\S]*?});?\s*$/
      ];

      let nodeObjectMatch = null;
      for (const pattern of objectPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          nodeObjectMatch = match[1];
          break;
        }
      }

      if (nodeObjectMatch) {
        // Try to safely evaluate the object to extract properties
        const nodeObject = this.safeEvaluateNodeObject(nodeObjectMatch);
        if (nodeObject) {
          // Extract all available properties from the node object
          if (nodeObject.type) info.type = nodeObject.type;
          if (nodeObject.displayName) info.displayName = nodeObject.displayName;
          if (nodeObject.name) info.name = nodeObject.name;
          if (nodeObject.group) info.group = nodeObject.group;
          if (nodeObject.version) info.version = nodeObject.version;
          if (nodeObject.description) info.description = nodeObject.description;
          if (nodeObject.defaults) info.defaults = nodeObject.defaults;
          if (nodeObject.inputs) info.inputs = nodeObject.inputs;
          if (nodeObject.outputs) info.outputs = nodeObject.outputs;
          if (nodeObject.properties) info.properties = nodeObject.properties;
          if (nodeObject.icon) info.icon = nodeObject.icon;
          if (nodeObject.color) info.color = nodeObject.color;

          logger.info("Successfully extracted node definition from content", {
            filename,
            extractedFields: Object.keys(info),
            propertiesCount: info.properties?.length || 0
          });

          return info;
        }
      }

      // Fallback to regex-based extraction for simpler cases
      // Try to extract class name and basic info from TypeScript/JavaScript content
      const classMatch = content.match(/class\s+(\w+)/);
      if (classMatch) {
        info.name = classMatch[1];
        info.displayName = classMatch[1].replace(/([A-Z])/g, " $1").trim();
      }

      // Look for description in comments
      const descriptionMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\s*\n/);
      if (descriptionMatch) {
        info.description = descriptionMatch[1];
      }

      // Try to extract individual fields using regex
      const typeMatch = content.match(/type:\s*['"`]([^'"`]+)['"`]/);
      if (typeMatch) {
        info.type = typeMatch[1];
      }

      const displayNameMatch = content.match(/displayName:\s*['"`]([^'"`]+)['"`]/);
      if (displayNameMatch) {
        info.displayName = displayNameMatch[1];
      }

      const nameMatch = content.match(/name:\s*['"`]([^'"`]+)['"`]/);
      if (nameMatch) {
        info.name = nameMatch[1];
      }

      // Try to extract properties array (basic pattern matching)
      const propertiesMatch = content.match(/properties:\s*(\[[\s\S]*?\])/);
      if (propertiesMatch) {
        try {
          // Try to safely evaluate the properties array
          const propertiesStr = propertiesMatch[1];
          const properties = this.safeEvaluateArray(propertiesStr);
          if (properties) {
            info.properties = properties;
            logger.info("Extracted properties array from regex", {
              filename,
              propertiesCount: properties.length
            });
          }
        } catch (error) {
          logger.warn("Failed to parse properties array from regex", {
            filename,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

    } catch (error) {
      logger.warn("Failed to extract node info from content", {
        filename,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return info;
  }

  /**
   * Safely evaluate a node object string to extract properties
   */
  private safeEvaluateNodeObject(objectStr: string): any {
    try {
      // Use regex-based parsing instead of evaluation for better safety and reliability
      return this.parseNodeObjectWithRegex(objectStr);
    } catch (error) {
      logger.warn("Failed to safely evaluate node object", {
        error: error instanceof Error ? error.message : 'Unknown error',
        objectPreview: objectStr.substring(0, 200) + '...'
      });
      return null;
    }
  }

  /**
   * Parse node object using regex patterns to extract key properties
   */
  private parseNodeObjectWithRegex(objectStr: string): any {
    const result: any = {};

    // Extract simple string properties
    const stringFields = ['type', 'displayName', 'name', 'description', 'icon', 'color'];
    for (const field of stringFields) {
      const pattern = new RegExp(`${field}:\\s*['"\`]([^'"\`]*?)['"\`]`, 'i');
      const match = objectStr.match(pattern);
      if (match && match[1]) {
        result[field] = match[1];
      }
    }

    // Extract number properties
    const numberFields = ['version'];
    for (const field of numberFields) {
      const pattern = new RegExp(`${field}:\\s*(\\d+)`, 'i');
      const match = objectStr.match(pattern);
      if (match && match[1]) {
        result[field] = parseInt(match[1], 10);
      }
    }

    // Extract array properties (group, inputs, outputs)
    const arrayFields = ['group', 'inputs', 'outputs'];
    for (const field of arrayFields) {
      const pattern = new RegExp(`${field}:\\s*(\\[[^\\]]*\\])`, 'i');
      const match = objectStr.match(pattern);
      if (match && match[1]) {
        try {
          // Simple array parsing for string arrays
          const arrayStr = match[1];
          const items = arrayStr.match(/['"]([^'"]*)['"]/g);
          if (items) {
            result[field] = items.map(item => item.replace(/['"]/g, ''));
          }
        } catch (error) {
          logger.warn(`Failed to parse ${field} array`, { error });
        }
      }
    }

    // Extract properties array (most complex) - use manual extraction for reliability
    const startIndex = objectStr.indexOf('properties:');
    if (startIndex !== -1) {
      const arrayStart = objectStr.indexOf('[', startIndex);
      if (arrayStart !== -1) {
        const propertiesArrayStr = this.extractBalancedBrackets(objectStr, arrayStart);
        if (propertiesArrayStr) {
          logger.debug("Extracted properties array string", {
            arrayLength: propertiesArrayStr.length
          });

          const propertiesArray = this.parsePropertiesArray(propertiesArrayStr);
          if (propertiesArray && propertiesArray.length > 0) {
            result.properties = propertiesArray;
          }
        }
      }
    }

    // Extract defaults object (simple case)
    const defaultsMatch = objectStr.match(/defaults:\s*(\{[^}]*\})/);
    if (defaultsMatch && defaultsMatch[1]) {
      try {
        // Simple object parsing for defaults
        const defaultsStr = defaultsMatch[1];
        const nameMatch = defaultsStr.match(/name:\s*['"]([^'"]*)['"]/);
        if (nameMatch) {
          result.defaults = { name: nameMatch[1] };
        }
      } catch (error) {
        logger.warn("Failed to parse defaults object", { error });
      }
    }

    return result;
  }

  /**
   * Extract content between balanced brackets starting from a given position
   */
  private extractBalancedBrackets(str: string, startPos: number): string | null {
    if (str[startPos] !== '[') return null;

    let depth = 0;
    let inString = false;
    let stringChar = '';
    let result = '';

    for (let i = startPos; i < str.length; i++) {
      const char = str[i];
      result += char;

      if (!inString) {
        if (char === '"' || char === "'" || char === '`') {
          inString = true;
          stringChar = char;
        } else if (char === '[') {
          depth++;
        } else if (char === ']') {
          depth--;
          if (depth === 0) {
            return result;
          }
        }
      } else {
        if (char === stringChar && str[i - 1] !== '\\') {
          inString = false;
          stringChar = '';
        }
      }
    }

    return null; // Unbalanced brackets
  }

  /**
   * Parse properties array from string using regex and bracket matching
   */
  private parsePropertiesArray(arrayStr: string): any[] | null {
    try {
      const properties: any[] = [];

      logger.debug("Starting to parse properties array", {
        arrayLength: arrayStr.length
      });

      // Find individual property objects within the array
      let depth = 0;
      let currentObj = '';
      let inString = false;
      let stringChar = '';
      let i = 0;

      // Skip the opening bracket
      if (arrayStr.trim().startsWith('[')) {
        i = arrayStr.indexOf('[') + 1;
      }

      let objectCount = 0;
      while (i < arrayStr.length) {
        const char = arrayStr[i];

        if (!inString) {
          if (char === '"' || char === "'" || char === '`') {
            inString = true;
            stringChar = char;
          } else if (char === '{') {
            depth++;
            if (depth === 1) {
              currentObj = '{';
              objectCount++;
              logger.debug(`Found property object #${objectCount} at position ${i}`);
              i++;
              continue;
            }
          } else if (char === '}') {
            depth--;
            if (depth === 0) {
              currentObj += '}';
              logger.debug(`Completed property object #${objectCount}`, {
                objectLength: currentObj.length
              });

              // Parse this property object
              const prop = this.parsePropertyObject(currentObj);
              if (prop) {
                properties.push(prop);
                logger.debug(`Successfully parsed property: ${prop.displayName || prop.name || 'unnamed'}`);
              } else {
                logger.warn(`Failed to parse property object #${objectCount}`);
              }
              currentObj = '';
              i++;
              continue;
            }
          } else if (char === ']' && depth === 0) {
            logger.debug("Reached end of properties array");
            break;
          }
        } else {
          if (char === stringChar && arrayStr[i - 1] !== '\\') {
            inString = false;
            stringChar = '';
          }
        }

        if (depth > 0) {
          currentObj += char;
        }
        i++;
      }

      logger.info("Finished parsing properties array", {
        propertiesCount: properties.length,
        sampleProperty: properties[0]?.displayName || 'none'
      });

      return properties.length > 0 ? properties : null;
    } catch (error) {
      logger.warn("Failed to parse properties array", {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Parse individual property object from string
   */
  private parsePropertyObject(objStr: string): any | null {
    try {
      const prop: any = {};

      // Extract string properties
      const stringFields = ['displayName', 'name', 'type', 'description', 'placeholder', 'default'];
      for (const field of stringFields) {
        const pattern = new RegExp(`${field}:\\s*['"\`]([^'"\`]*?)['"\`]`, 'i');
        const match = objStr.match(pattern);
        if (match && match[1]) {
          prop[field] = match[1];
        }
      }

      // Extract boolean properties
      const booleanFields = ['required'];
      for (const field of booleanFields) {
        const pattern = new RegExp(`${field}:\\s*(true|false)`, 'i');
        const match = objStr.match(pattern);
        if (match && match[1]) {
          prop[field] = match[1] === 'true';
        }
      }

      // Extract number properties
      const numberFields = ['default'];
      for (const field of numberFields) {
        const pattern = new RegExp(`${field}:\\s*(\\d+)`, 'i');
        const match = objStr.match(pattern);
        if (match && match[1] && !prop[field]) { // Don't override string defaults
          prop[field] = parseInt(match[1], 10);
        }
      }

      // Extract options array (simplified)
      const optionsMatch = objStr.match(/options:\s*(\[[\s\S]*?\])/);
      if (optionsMatch) {
        prop.options = []; // Placeholder - full parsing would be complex
      }

      // Extract displayOptions (simplified)
      const displayOptionsMatch = objStr.match(/displayOptions:\s*\{[\s\S]*?\}/);
      if (displayOptionsMatch) {
        prop.displayOptions = {}; // Placeholder
      }

      // Extract typeOptions (simplified)
      const typeOptionsMatch = objStr.match(/typeOptions:\s*\{[\s\S]*?\}/);
      if (typeOptionsMatch) {
        prop.typeOptions = {}; // Placeholder
      }

      return Object.keys(prop).length > 0 ? prop : null;
    } catch (error) {
      logger.warn("Failed to parse property object", {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Safely evaluate an array string
   */
  private safeEvaluateArray(arrayStr: string): any[] | null {
    // Use the same regex-based parsing approach
    return this.parsePropertiesArray(arrayStr);
  }

  private generateTypeFromFilename(filePath: string): string {
    const basename = path.basename(filePath, path.extname(filePath));
    return basename.replace(".node", "").replace(/[^a-zA-Z0-9]/g, "");
  }

  private generateDisplayNameFromFilename(filePath: string): string {
    const basename = path.basename(filePath, path.extname(filePath));
    return basename
      .replace(".node", "")
      .replace(/([A-Z])/g, " $1")
      .replace(/[_-]/g, " ")
      .trim()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private generateNameFromFilename(filePath: string): string {
    const basename = path.basename(filePath, path.extname(filePath));
    return basename.replace(".node", "").replace(/[^a-zA-Z0-9]/g, "");
  }

  private async saveNodeType(nodeDefinition: NodeDefinition): Promise<any> {
    try {
      // Check if node type already exists
      const existingNode = await this.prisma.nodeType.findUnique({
        where: { identifier: nodeDefinition.type },
      });

      if (existingNode) {
        // Update existing node
        return await this.prisma.nodeType.update({
          where: { identifier: nodeDefinition.type },
          data: {
            displayName: nodeDefinition.displayName,
            name: nodeDefinition.name,
            group: nodeDefinition.group,
            version: nodeDefinition.version,
            description: nodeDefinition.description,
            defaults: nodeDefinition.defaults,
            inputs: nodeDefinition.inputs,
            outputs: nodeDefinition.outputs,
            properties: nodeDefinition.properties,
            icon: nodeDefinition.icon,
            color: nodeDefinition.color,
            active: true,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new node
        return await this.prisma.nodeType.create({
          data: {
            identifier: nodeDefinition.type,
            displayName: nodeDefinition.displayName,
            name: nodeDefinition.name,
            group: nodeDefinition.group,
            version: nodeDefinition.version || 1,
            description: nodeDefinition.description,
            defaults: nodeDefinition.defaults || {},
            inputs: nodeDefinition.inputs || ["main"],
            outputs: nodeDefinition.outputs || ["main"],
            properties: nodeDefinition.properties || [],
            icon: nodeDefinition.icon,
            color: nodeDefinition.color,
            active: true,
          },
        });
      }
    } catch (error) {
      logger.error("Failed to save node type", { error, nodeDefinition });
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to save node type: ${errorMessage}`);
    }
  }

  private generatePackageNameFromZip(originalName: string): string {
    // Remove .zip extension and sanitize name
    const name = path.basename(originalName, ".zip");
    return name.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
      logger.debug("Directory already exists", { dirPath });
    } catch (error) {
      try {
        await fs.mkdir(dirPath, { recursive: true });
        logger.debug("Directory created", { dirPath });
      } catch (mkdirError) {
        const errorMsg = `Failed to create directory ${dirPath}: ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`;
        logger.error(errorMsg, { dirPath, error: mkdirError });
        throw new Error(errorMsg);
      }
    }
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(source: string, destination: string): Promise<void> {
    try {
      await this.ensureDirectory(destination);

      const entries = await fs.readdir(source, { withFileTypes: true });
      logger.debug("Copying directory contents", {
        source,
        destination,
        entriesCount: entries.length
      });

      for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);

        try {
          if (entry.isDirectory()) {
            await this.copyDirectory(sourcePath, destPath);
          } else {
            await fs.copyFile(sourcePath, destPath);
          }
        } catch (error) {
          const errorMsg = `Failed to copy ${entry.isDirectory() ? 'directory' : 'file'} ${entry.name}: ${error instanceof Error ? error.message : String(error)}`;
          logger.error(errorMsg, {
            sourcePath,
            destPath,
            isDirectory: entry.isDirectory(),
            error: error instanceof Error ? error.message : String(error)
          });
          throw new Error(errorMsg);
        }
      }

      logger.debug("Directory copy completed", { source, destination });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to copy')) {
        // Re-throw specific copy errors
        throw error;
      }

      const errorMsg = `Failed to copy directory from ${source} to ${destination}: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg, { source, destination, error });
      throw new Error(errorMsg);
    }
  }

  /**
   * Install dependencies for the package
   */
  private async installDependencies(packagePath: string): Promise<void> {
    try {
      const packageJsonPath = path.join(packagePath, "package.json");

      if (!await this.fileExists(packageJsonPath)) {
        return;
      }

      const packageContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageInfo = JSON.parse(packageContent);

      // Check if there are dependencies to install
      const hasDependencies = packageInfo.dependencies &&
        Object.keys(packageInfo.dependencies).length > 0;

      if (!hasDependencies) {
        logger.info("No dependencies to install", { packagePath });
        return;
      }

      logger.info("Installing package dependencies", {
        packagePath,
        dependencies: Object.keys(packageInfo.dependencies)
      });

      // Use child_process to run npm install
      const { spawn } = await import("child_process");

      return new Promise((resolve, reject) => {
        const npmProcess = spawn("npm", ["install", "--production"], {
          cwd: packagePath,
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        npmProcess.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        npmProcess.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        npmProcess.on("close", (code) => {
          if (code === 0) {
            logger.info("Dependencies installed successfully", {
              packagePath,
              stdout: stdout.trim()
            });
            resolve();
          } else {
            logger.error("Failed to install dependencies", {
              packagePath,
              code,
              stderr: stderr.trim(),
              stdout: stdout.trim()
            });
            // Don't reject - allow package to be used without dependencies
            // Some nodes might work without all dependencies
            resolve();
          }
        });

        npmProcess.on("error", (error) => {
          logger.error("Error spawning npm install", { error, packagePath });
          // Don't reject - allow package to be used without dependencies
          resolve();
        });
      });

    } catch (error) {
      logger.error("Failed to install dependencies", { error, packagePath });
      // Don't throw - allow package to be used without dependencies
    }
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
