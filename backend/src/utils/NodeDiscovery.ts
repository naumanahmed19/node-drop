import * as fs from "fs";
import * as path from "path";
import { NodeDefinition } from "../types/node.types";

export interface NodeInfo {
  name: string;
  path: string;
  definition: NodeDefinition;
}

/**
 * Auto-discovery utility for nodes
 * Scans the nodes directory and automatically loads all available nodes
 */
export class NodeDiscovery {
  private nodesDir: string;

  constructor(nodesDir?: string) {
    if (nodesDir) {
      this.nodesDir = nodesDir;
    } else {
      // In production (dist/), look for nodes in dist/nodes
      // In development (src/), look for nodes in src/nodes
      const defaultPath = path.join(__dirname, "..", "nodes");

      // Check if we're running from dist/ (production)
      if (__dirname.includes("dist")) {
        this.nodesDir = defaultPath; // This will be dist/nodes
      } else {
        this.nodesDir = defaultPath; // This will be src/nodes
      }
    }


  }

  /**
   * Discover all node directories
   * Returns a list of directories that contain node definitions
   */
  async discoverNodeDirectories(): Promise<string[]> {
    const directories: string[] = [];

    try {
      // Check if nodes directory exists
      if (!fs.existsSync(this.nodesDir)) {
        return directories;
      }

      const items = await fs.promises.readdir(this.nodesDir, {
        withFileTypes: true,
      });

      for (const item of items) {
        if (item.isDirectory()) {
          const dirPath = path.join(this.nodesDir, item.name);

          // Check if directory contains node files
          if (await this.isValidNodeDirectory(dirPath)) {
            directories.push(item.name);
          }
        }
      }
    } catch (error) {
      console.error("Error discovering node directories:", error);
    }

    return directories;
  }

  /**
   * Check if a directory is a valid node directory
   */
  private async isValidNodeDirectory(dirPath: string): Promise<boolean> {
    try {
      const files = await fs.promises.readdir(dirPath);

      // Check for index files or node files in both TS and JS formats
      return files.some(
        (file) =>
          file === "index.ts" ||
          file === "index.js" ||
          file.endsWith(".node.ts") ||
          file.endsWith(".node.js")
      );
    } catch {
      return false;
    }
  }

  /**
   * Load all nodes from discovered directories
   */
  async loadAllNodes(): Promise<NodeInfo[]> {
    const nodeInfos: NodeInfo[] = [];
    const directories = await this.discoverNodeDirectories();

    for (const dirName of directories) {
      try {
        const nodePath = path.join(this.nodesDir, dirName);
        const nodeModule = await this.loadNodeFromDirectory(nodePath);

        if (nodeModule) {
          // Extract all exported node definitions
          const nodeDefinitions = this.extractNodeDefinitions(nodeModule);

          for (const definition of nodeDefinitions) {
            nodeInfos.push({
              name: dirName,
              path: nodePath,
              definition,
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to load node from directory ${dirName}:`, error);
      }
    }

    return nodeInfos;
  }

  /**
   * Load a node module from a directory
   */
  private async loadNodeFromDirectory(dirPath: string): Promise<any> {
    try {
      // Try to load from index file first (both .js and .ts)
      const indexPaths = [
        path.join(dirPath, "index.js"),
        path.join(dirPath, "index.ts"),
        path.join(dirPath, "index")
      ];

      for (const indexPath of indexPaths) {
        try {
          // In production, use require for .js files, dynamic import for .ts files
          if (indexPath.endsWith('.js') && fs.existsSync(indexPath)) {
            // Use require for compiled JS files in production
            delete require.cache[require.resolve(indexPath)];
            const module = require(indexPath);
            return module;
          } else if (fs.existsSync(indexPath + '.ts') || fs.existsSync(indexPath + '.js')) {
            // Use dynamic import for development or when file exists
            const indexUrl = this.pathToFileUrl(indexPath);
            const module = await import(indexUrl);
            return module;
          }
        } catch (error) {
          // Continue to next path
        }
      }

      // If no index file, try to find .node.ts or .node.js files
      const files = await fs.promises.readdir(dirPath);
      const nodeFiles = files.filter((file) =>
        file.endsWith(".node.ts") || file.endsWith(".node.js")
      );

      for (const nodeFile of nodeFiles) {
        try {
          const nodeFilePath = path.join(dirPath, nodeFile);
          
          // In production, use require for .js files
          if (nodeFile.endsWith('.js')) {
            delete require.cache[require.resolve(nodeFilePath)];
            const module = require(nodeFilePath);
            return module;
          } else {
            // Use dynamic import for .ts files
            const nodeFileUrl = this.pathToFileUrl(nodeFilePath.replace(/\.(ts|js)$/, ""));
            const module = await import(nodeFileUrl);
            return module;
          }
        } catch (error) {
          // Continue to next file
        }
      }
    } catch (error) {
      console.error(`Error loading node from ${dirPath}:`, error);
    }

    return null;
  }

  /**
   * Convert file path to file:// URL for dynamic import (Windows compatible)
   */
  private pathToFileUrl(filePath: string): string {
    // Normalize path separators and resolve absolute path
    const absolutePath = path.resolve(filePath);

    // Convert Windows backslashes to forward slashes
    const normalizedPath = absolutePath.replace(/\\/g, "/");

    // Add file:// protocol
    return `file:///${normalizedPath}`;
  }

  /**
   * Extract node definitions from a module
   */
  private extractNodeDefinitions(nodeModule: any): NodeDefinition[] {
    const definitions: NodeDefinition[] = [];

    // First, check if the module itself is a node definition (for module.exports = NodeDefinition)
    if (this.isNodeDefinition(nodeModule)) {
      definitions.push(nodeModule);
      return definitions;
    }

    // Then check for named exports
    for (const key in nodeModule) {
      const exported = nodeModule[key];

      // Check if this looks like a node definition
      if (this.isNodeDefinition(exported)) {
        definitions.push(exported);
      }
    }

    return definitions;
  }

  /**
   * Check if an object is a node definition
   */
  private isNodeDefinition(obj: any): obj is NodeDefinition {
    return (
      obj &&
      typeof obj === "object" &&
      typeof obj.identifier === "string" &&
      typeof obj.displayName === "string" &&
      typeof obj.name === "string" &&
      Array.isArray(obj.inputs) &&
      Array.isArray(obj.outputs)
    );
  }

  /**
   * Get all available node definitions as a flat array
   */
  async getAllNodeDefinitions(): Promise<NodeDefinition[]> {
    const nodeInfos = await this.loadAllNodes();
    
    // Also load nodes from custom-nodes directory
    const customNodeInfos = await this.loadCustomNodes();
    
    const allNodeInfos = [...nodeInfos, ...customNodeInfos];
    return allNodeInfos.map((info) => info.definition);
  }

  /**
   * Load nodes from custom-nodes directory
   */
  async loadCustomNodes(): Promise<NodeInfo[]> {
    const nodeInfos: NodeInfo[] = [];
    const customNodesDir = path.join(process.cwd(), "custom-nodes");

    console.log(`🔍 Loading custom nodes from: ${customNodesDir}`);

    try {
      // Check if custom-nodes directory exists
      if (!fs.existsSync(customNodesDir)) {
        console.log("📁 Custom nodes directory does not exist");
        return nodeInfos;
      }

      const packageDirs = await fs.promises.readdir(customNodesDir, {
        withFileTypes: true,
      });

      console.log(`📦 Found ${packageDirs.length} items in custom-nodes directory`);

      for (const packageDir of packageDirs) {
        if (!packageDir.isDirectory()) {
          console.log(`⏭️ Skipping non-directory: ${packageDir.name}`);
          continue;
        }

        const packagePath = path.join(customNodesDir, packageDir.name);
        console.log(`🔍 Processing package: ${packageDir.name} at ${packagePath}`);
        
        try {
          // Look for node files in the package directory
          const nodeFiles = await this.findNodeFilesInPackage(packagePath);
          console.log(`📄 Found ${nodeFiles.length} node files in ${packageDir.name}:`, nodeFiles.map(f => path.basename(f)));
          
          for (const nodeFile of nodeFiles) {
            try {
              console.log(`🔄 Loading node file: ${nodeFile}`);
              const nodeModule = await this.loadNodeFromFile(nodeFile);
              
              if (nodeModule) {
                const nodeDefinitions = this.extractNodeDefinitions(nodeModule);
                console.log(`✅ Extracted ${nodeDefinitions.length} node definitions from ${path.basename(nodeFile)}`);
                
                for (const definition of nodeDefinitions) {
                  nodeInfos.push({
                    name: `${packageDir.name}/${path.basename(nodeFile)}`,
                    path: nodeFile,
                    definition,
                  });
                  console.log(`📝 Added node definition: ${definition.identifier} (${definition.displayName})`);
                }
              } else {
                console.warn(`⚠️ No module loaded from ${nodeFile}`);
              }
            } catch (error) {
              console.warn(`❌ Failed to load node from file ${nodeFile}:`, error);
            }
          }
        } catch (error) {
          console.warn(`❌ Failed to load custom node package ${packageDir.name}:`, error);
        }
      }
    } catch (error) {
      console.warn("❌ Failed to load custom nodes:", error);
    }

    console.log(`🎉 Total custom nodes loaded: ${nodeInfos.length}`);
    return nodeInfos;
  }

  /**
   * Find all node files in a package directory (recursively)
   */
  async findNodeFilesInPackage(packagePath: string): Promise<string[]> {
    const nodeFiles: string[] = [];

    const searchDirectory = async (dirPath: string) => {
      try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            // Skip node_modules and other common directories
            if (!['node_modules', '.git', 'dist', 'coverage'].includes(entry.name)) {
              await searchDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            if (entry.name.endsWith('.node.js') || entry.name.endsWith('.node.ts')) {
              nodeFiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Ignore errors for individual directories
      }
    };

    await searchDirectory(packagePath);
    return nodeFiles;
  }

  /**
   * Load a node from a specific file path
   */
  async loadNodeFromFile(filePath: string): Promise<any> {
    try {
      // Clear require cache to ensure fresh load
      const resolvedPath = require.resolve(filePath);
      delete require.cache[resolvedPath];
      
      const nodeModule = require(filePath);
      return nodeModule;
    } catch (error) {
      console.warn(`Failed to require node file ${filePath}:`, error);
      
      // Try with dynamic import as fallback for ES modules
      try {
        const fileUrl = this.pathToFileUrl(filePath);
        const nodeModule = await import(fileUrl + `?t=${Date.now()}`); // Add timestamp to bypass cache
        return nodeModule;
      } catch (importError) {
        console.warn(`Failed to import node file ${filePath}:`, importError);
        return null;
      }
    }
  }

  /**
   * Get node definitions grouped by directory
   */
  async getNodesByDirectory(): Promise<Record<string, NodeDefinition[]>> {
    const nodeInfos = await this.loadAllNodes();
    const grouped: Record<string, NodeDefinition[]> = {};

    for (const info of nodeInfos) {
      if (!grouped[info.name]) {
        grouped[info.name] = [];
      }
      grouped[info.name].push(info.definition);
    }

    return grouped;
  }
}

// Export a default instance
export const nodeDiscovery = new NodeDiscovery();
