import { PrismaClient } from "@prisma/client";
import { Request, Response, Router } from "express";
import { promises as fs } from "fs";
import multer from "multer";
import path from "path";
import { authenticateToken } from "../middleware/auth";
import { CustomNodeUploadHandler } from "../services/CustomNodeUploadHandler";
import { logger } from "../utils/logger";

const router = Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), "temp/uploads"),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/zip" ||
      file.originalname.endsWith(".zip")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only ZIP files are allowed"));
    }
  },
});

// Apply authentication middleware to all routes
// router.use(authenticateToken); // Temporarily disabled for testing

/**
 * GET /api/node-types
 * Get all node types from the database
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { group } = req.query;

    const whereClause = group ? { group: { has: group as string } } : {};

    const nodeTypes = await prisma.nodeType.findMany({
      where: whereClause,
      orderBy: [{ active: "desc" }, { displayName: "asc" }],
    });

    res.json({
      success: true,
      data: nodeTypes,
      count: nodeTypes.length,
    });
  } catch (error) {
    logger.error("Failed to get node types", { error });
    res.status(500).json({
      success: false,
      error: "Failed to get node types",
    });
  }
});

/**
 * GET /api/node-types/:type
 * Get a specific node type by type identifier
 */
router.get("/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    const nodeType = await prisma.nodeType.findUnique({
      where: { identifier: type },
    });

    if (!nodeType) {
      return res.status(404).json({
        success: false,
        error: "Node type not found",
      });
    }

    res.json({
      success: true,
      data: nodeType,
    });
  } catch (error) {
    logger.error("Failed to get node type", { error, type: req.params.identifier });
    res.status(500).json({
      success: false,
      error: "Failed to get node type",
    });
  }
});

/**
 * POST /api/node-types/upload
 * Upload a ZIP file containing custom nodes
 */
router.post(
  "/upload",
  upload.single("nodes"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      logger.info("Processing node upload", {
        filename: req.file.originalname,
        size: req.file.size,
        path: req.file.path
      });

      const uploadHandler = new CustomNodeUploadHandler();
      const result = await uploadHandler.processUpload(
        req.file.path,
        req.file.originalname
      );

      if (result.success) {
        logger.info("Upload successful", {
          filename: req.file.originalname,
          nodesCount: result.nodes?.length || 0
        });
        
        res.json({
          success: true,
          message: result.message,
          data: {
            nodes: result.nodes,
            extractedPath: result.extractedPath,
          },
        });
      } else {
        logger.error("Upload processing failed", {
          filename: req.file.originalname,
          errors: result.errors,
          message: result.message
        });
        
        res.status(400).json({
          success: false,
          error: result.message || "Upload processing failed",
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error("Failed to process upload", { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        filename: req.file?.originalname
      });
      
      const errorMessage = error instanceof Error ? error.message : "Failed to process upload";
      res.status(500).json({
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      });
    }
  }
);

/**
 * PATCH /api/node-types/:type
 * Update a node type's properties (e.g., active status)
 */
router.patch("/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const updateData = req.body;

    // Log the update request for debugging
    logger.info("Updating node type", { type, updateData });

    const nodeType = await prisma.nodeType.update({
      where: { identifier: type },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    logger.info("Node type updated successfully", {
      type,
      active: nodeType.active,
    });

    res.json({
      success: true,
      data: nodeType,
      message: "Node type updated successfully",
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Node type not found",
      });
    }

    logger.error("Failed to update node type", {
      error,
      type: req.params.identifier,
      updateData: req.body,
    });
    res.status(500).json({
      success: false,
      error: "Failed to update node type",
    });
  }
});

/**
 * DELETE /api/node-types/packages/:packageName
 * Uninstall a complete node package (database + files)
 */
router.delete("/packages/:packageName", async (req: Request, res: Response) => {
  try {
    const { packageName } = req.params;

    logger.info("Starting node package uninstall", { packageName });

    // Step 1: Check if package directory exists (but allow deletion even if it doesn't)
    const customNodesPath = path.join(process.cwd(), "custom-nodes", packageName);

    let packageExists = false;
    try {
      await fs.access(customNodesPath);
      packageExists = true;
      logger.info("Package directory found", { packageName, path: customNodesPath });
    } catch (error) {
      packageExists = false;
      logger.info("Package directory not found, but will check database for orphaned entries", { packageName, path: customNodesPath });
    }

    // Step 2: Find node types using multiple strategies
    const allNodeTypes = await prisma.nodeType.findMany();
    const packageNodeTypes = [];
    const errors = [];

    // Strategy 1: Use heuristic matching (most reliable for our case)
    logger.info("Using heuristic matching to find package nodes", { packageName });

    for (const nodeType of allNodeTypes) {
      const typeMatch = nodeType.identifier.toLowerCase() === packageName.toLowerCase();
      const nameMatch = nodeType.name.toLowerCase().includes(packageName.toLowerCase());
      const displayNameMatch = nodeType.displayName.toLowerCase().includes(packageName.toLowerCase());

      if (typeMatch || nameMatch || displayNameMatch) {
        packageNodeTypes.push(nodeType);
        logger.info("Found matching node type", {
          type: nodeType.identifier,
          displayName: nodeType.displayName,
          matchReason: typeMatch ? 'type' : nameMatch ? 'name' : 'displayName'
        });
      }
    }

    // Strategy 2: Parse package.json to get node information (only if package directory exists)
    if (packageExists) {
      try {
        const packageJsonPath = path.join(customNodesPath, 'package.json');
        const packageJsonExists = await fs.access(packageJsonPath).then(() => true).catch(() => false);

        if (packageJsonExists) {
        const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
        const packageInfo = JSON.parse(packageJsonContent);

        logger.info("Found package.json", {
          name: packageInfo.name,
          version: packageInfo.version,
          description: packageInfo.description
        });

        // Look for nodes mentioned in package.json
        if (packageInfo.nodeDrop && packageInfo.nodeDrop.nodes) {
          for (const nodePath of packageInfo.nodeDrop.nodes) {
            // Extract potential node type from path
            const nodeFileName = path.basename(nodePath, path.extname(nodePath));
            const potentialType = nodeFileName.replace('.node', '');

            const matchingNode = allNodeTypes.find(nt => nt.identifier === potentialType);
            if (matchingNode && !packageNodeTypes.find(pnt => pnt.identifier === matchingNode.identifier)) {
              packageNodeTypes.push(matchingNode);
              logger.info("Found node type from package.json", { type: matchingNode.identifier });
            }
          }
        }
        }
      } catch (error) {
        logger.warn("Failed to parse package.json", { packageName, error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Strategy 3: Scan for .node.js files and extract type from filename (only if package directory exists)
    if (packageExists) {
      try {
      const scanForNodeFiles = async (dirPath: string): Promise<string[]> => {
        const nodeFiles: string[] = [];
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory() && !['node_modules', '.git', 'dist', 'coverage'].includes(entry.name)) {
              nodeFiles.push(...await scanForNodeFiles(fullPath));
            } else if (entry.isFile() && (entry.name.endsWith('.node.js') || entry.name.endsWith('.node.ts'))) {
              nodeFiles.push(fullPath);
            }
          }
        } catch (error) {
          logger.warn("Failed to scan directory", { dirPath, error: error instanceof Error ? error.message : String(error) });
        }
        return nodeFiles;
      };

      const nodeFiles = await scanForNodeFiles(customNodesPath);
      logger.info("Found node files", { count: nodeFiles.length, files: nodeFiles.map(f => path.basename(f)) });

      for (const nodeFile of nodeFiles) {
        // Extract potential node type from filename
        const fileName = path.basename(nodeFile);
        const potentialType = fileName.replace(/\.(node\.)?(js|ts)$/, '');

        const matchingNode = allNodeTypes.find(nt => nt.identifier === potentialType);
        if (matchingNode && !packageNodeTypes.find(pnt => pnt.identifier === matchingNode.identifier)) {
          packageNodeTypes.push(matchingNode);
          logger.info("Found node type from file scan", { type: matchingNode.identifier, file: fileName });
        }
      }
      } catch (error) {
        logger.warn("Failed to scan for node files", { packageName, error: error instanceof Error ? error.message : String(error) });
      }
    }

    logger.info("Node identification complete", {
      packageName,
      foundNodes: packageNodeTypes.length,
      nodeTypes: packageNodeTypes.map(nt => nt.identifier)
    });

    // Check if we found any nodes to delete
    if (packageNodeTypes.length === 0 && !packageExists) {
      return res.status(404).json({
        success: false,
        error: `No nodes found for package: ${packageName}. Package directory and database entries not found.`,
      });
    }

    // If no nodes found but package directory exists, it might be an empty package
    if (packageNodeTypes.length === 0 && packageExists) {
      logger.info("No node types found in database, but package directory exists. Will remove directory only.", { packageName });
    }

    // Step 3: Unload from memory using NodeService (BEFORE database deletion)
    try {
      // Import NodeService to unload nodes from memory
      const { NodeService } = await import("../services/NodeService");
      const nodeService = new NodeService(prisma);

      for (const nodeType of packageNodeTypes) {
        try {
          await nodeService.unloadNodeFromMemory(nodeType.identifier);
          logger.info("Unloaded node from memory", { type: nodeType.identifier });
        } catch (error) {
          logger.warn("Failed to unload node from memory", { type: nodeType.identifier, error: error instanceof Error ? error.message : String(error) });
        }
      }
    } catch (error) {
      logger.warn("Failed to unload nodes from memory", { packageName, error: error instanceof Error ? error.message : String(error) });
    }

    // Step 4: Remove node types from database (AFTER memory unregistration)
    const deletedNodeTypes = [];
    for (const nodeType of packageNodeTypes) {
      try {
        await prisma.nodeType.delete({
          where: { identifier: nodeType.identifier },
        });
        deletedNodeTypes.push(nodeType.identifier);
        logger.info("Deleted node type from database", { type: nodeType.identifier });
      } catch (error) {
        const errorMsg = `Failed to delete node type ${nodeType.identifier}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Step 5: Remove package directory and all files (only if directory exists)
    let filesRemoved = false;
    let removalError = null;

    if (packageExists) {
      try {
        logger.info("🗑️ Starting package directory removal process", {
          packageName,
          path: customNodesPath
        });

        // Check current permissions and ownership
        try {
          const stats = await fs.stat(customNodesPath);
          const permissions = (stats.mode & parseInt('777', 8)).toString(8);
          logger.info("📊 Directory permissions before removal", {
            path: customNodesPath,
            permissions: permissions,
            uid: stats.uid,
            gid: stats.gid,
            processUid: process.getuid ? process.getuid() : 'unknown',
            processGid: process.getgid ? process.getgid() : 'unknown',
            isDirectory: stats.isDirectory(),
            size: stats.size,
            lastModified: stats.mtime
          });
        } catch (statError) {
          logger.info("⚠️ Could not check directory permissions", {
            path: customNodesPath,
            error: statError instanceof Error ? statError.message : String(statError)
          });
        }

        // Try removal with force
        logger.info("🔧 Attempting package directory removal");
        await fs.rm(customNodesPath, { recursive: true, force: true });
        filesRemoved = true;
        logger.info("✅ Package directory removed successfully");

      } catch (error) {
        removalError = error;
        logger.error("❌ Failed to remove package directory", {
          error: error instanceof Error ? error.message : String(error),
          errorCode: error instanceof Error && 'code' in error ? error.code : 'unknown'
        });
      }
    } else {
      // Package directory doesn't exist, so no files to remove
      filesRemoved = true; // Consider it "removed" since it doesn't exist
      logger.info("Package directory doesn't exist, skipping file removal", { packageName, path: customNodesPath });
    }

    // Step 6: Return success response
    logger.debug("🎉 Package uninstall completed successfully", {
      packageName,
      filesRemoved,
      nodeTypesFound: packageNodeTypes.length,
      nodeTypesDeleted: deletedNodeTypes.length,
      deletedTypes: deletedNodeTypes,
      hasErrors: errors.length > 0,
      errorCount: errors.length
    });

    const response = {
      success: true,
      message: `Package ${packageName} uninstalled successfully`,
      details: {
        packageName,
        deletedNodeTypes,
        removedPath: customNodesPath,
        filesRemoved,
        nodeTypesFound: packageNodeTypes.length,
        nodeTypesDeleted: deletedNodeTypes.length,
        errors: errors.length > 0 ? errors : undefined
      },
    };

    logger.info("Package uninstall completed", response.details);
    res.json(response);

  } catch (error) {
    const errorMsg = `Failed to uninstall node package: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMsg, {
      error,
      packageName: req.params.packageName,
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
});

/**
 * POST /api/node-types/refresh-custom
 * Refresh and register custom nodes from the custom-nodes directory
 */
router.post("/refresh-custom", async (req: Request, res: Response) => {
  try {
    // Get the global NodeService instance
    const nodeService = global.nodeService;
    if (!nodeService) {
      return res.status(500).json({
        success: false,
        error: "NodeService not available",
      });
    }

    const result = await nodeService.refreshCustomNodes();

    res.json({
      success: result.success,
      message: result.message,
      data: {
        registered: result.registered,
      },
    });
  } catch (error) {
    logger.error("Failed to refresh custom nodes", { error });
    res.status(500).json({
      success: false,
      error: "Failed to refresh custom nodes",
    });
  }
});

/**
 * GET /api/node-types/groups/list
 * Get all unique groups from node types
 */
router.get("/groups/list", async (req: Request, res: Response) => {
  try {
    const nodeTypes = await prisma.nodeType.findMany({
      select: { group: true },
    });

    const allGroups = nodeTypes.flatMap((nt) => nt.group);
    const uniqueGroups = [...new Set(allGroups)].sort();

    res.json({
      success: true,
      data: uniqueGroups,
      count: uniqueGroups.length,
    });
  } catch (error) {
    logger.error("Failed to get node groups", { error });
    res.status(500).json({
      success: false,
      error: "Failed to get node groups",
    });
  }
});

/**
 * POST /api/node-types/templates
 * Create a new template from selected nodes
 */
router.post("/templates", async (req: Request, res: Response) => {
  try {
    const {
      type,
      displayName,
      name,
      description,
      icon,
      color,
      group,
      version,
      defaults,
      inputs,
      outputs,
      properties,
      isTemplate,
      templateData,
    } = req.body;

    // Validate required fields
    if (!type || !displayName || !templateData) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: type, displayName, templateData",
      });
    }

    // Check if template with this type already exists
    const existing = await prisma.nodeType.findUnique({
      where: { identifier: type },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Template with type '${type}' already exists`,
      });
    }

    // Create the template node type
    const template = await prisma.nodeType.create({
      data: {
        identifier: type,
        displayName,
        name: name || displayName,
        description: description || "",
        icon: icon || "📦",
        color: color || "#6366f1",
        group: group || ["Templates"],
        version: version || 1,
        defaults: defaults || {},
        inputs: inputs || ["main"],
        outputs: outputs || ["main"],
        properties: properties || [],
        isTemplate: isTemplate !== undefined ? isTemplate : true,
        templateData: templateData || null,
        active: true,
      },
    });

    logger.info("Template created successfully", {
      type: template.identifier,
      displayName: template.displayName,
      nodesCount: templateData?.nodes?.length || 0,
      connectionsCount: templateData?.connections?.length || 0,
    });

    res.json({
      success: true,
      data: template,
      message: "Template created successfully",
    });
  } catch (error) {
    logger.error("Failed to create template", { error });
    res.status(500).json({
      success: false,
      error: "Failed to create template",
    });
  }
});

/**
 * GET /api/node-types/templates
 * Get all templates
 */
router.get("/templates", async (req: Request, res: Response) => {
  try {
    const templates = await prisma.nodeType.findMany({
      where: { isTemplate: true },
      orderBy: { displayName: "asc" },
    });

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    logger.error("Failed to get templates", { error });
    res.status(500).json({
      success: false,
      error: "Failed to get templates",
    });
  }
});

/**
 * GET /api/node-types/templates/:type
 * Get a specific template by type
 */
router.get("/templates/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    const template = await prisma.nodeType.findFirst({
      where: {
        identifier: type,
        isTemplate: true,
      },
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: "Template not found",
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error("Failed to get template", { error, type: req.params.identifier });
    res.status(500).json({
      success: false,
      error: "Failed to get template",
    });
  }
});

/**
 * PATCH /api/node-types/templates/:type
 * Update a template
 */
router.patch("/templates/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const updateData = req.body;

    const template = await prisma.nodeType.updateMany({
      where: {
        identifier: type,
        isTemplate: true,
      },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    if (template.count === 0) {
      return res.status(404).json({
        success: false,
        error: "Template not found",
      });
    }

    // Fetch the updated template
    const updatedTemplate = await prisma.nodeType.findUnique({
      where: { identifier: type },
    });

    logger.info("Template updated successfully", { type });

    res.json({
      success: true,
      data: updatedTemplate,
      message: "Template updated successfully",
    });
  } catch (error) {
    logger.error("Failed to update template", {
      error,
      type: req.params.identifier,
    });
    res.status(500).json({
      success: false,
      error: "Failed to update template",
    });
  }
});

/**
 * DELETE /api/node-types/templates/:type
 * Delete a template
 */
router.delete("/templates/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    const result = await prisma.nodeType.deleteMany({
      where: {
        identifier: type,
        isTemplate: true,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({
        success: false,
        error: "Template not found",
      });
    }

    logger.info("Template deleted successfully", { type });

    res.json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    logger.error("Failed to delete template", {
      error,
      type: req.params.identifier,
    });
    res.status(500).json({
      success: false,
      error: "Failed to delete template",
    });
  }
});

export { router as nodeTypeRoutes };
