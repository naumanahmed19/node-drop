import { Request, Response, Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { NodeLoader } from "../services/NodeLoader";
import { NodeMarketplace } from "../services/NodeMarketplace";
import { NodeTemplateGenerator } from "../services/NodeTemplateGenerator";
import { logger } from "../utils/logger";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/custom-nodes/packages
 * Get all loaded custom node packages
 */
router.get("/packages", async (req: Request, res: Response) => {
  try {
    const nodeLoader = global.nodeLoader as NodeLoader;
    const packages = nodeLoader.getLoadedPackages();

    res.json({
      success: true,
      data: packages,
      count: packages.length,
    });
  } catch (error) {
    logger.error("Failed to get custom node packages", { error });
    res.status(500).json({
      success: false,
      error: "Failed to get custom node packages",
    });
  }
});

/**
 * POST /api/custom-nodes/packages/validate
 * Validate a custom node package
 */
router.post("/packages/validate", async (req: Request, res: Response) => {
  try {
    const { packagePath } = req.body;

    if (!packagePath) {
      return res.status(400).json({
        success: false,
        error: "Package path is required",
      });
    }

    const nodeLoader = global.nodeLoader as NodeLoader;
    const result = await nodeLoader.validateNodePackage(packagePath);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("Failed to validate package", { error });
    res.status(500).json({
      success: false,
      error: "Failed to validate package",
    });
  }
});

/**
 * POST /api/custom-nodes/packages/load
 * Load a custom node package
 */
router.post("/packages/load", async (req: Request, res: Response) => {
  try {
    const { packagePath } = req.body;

    if (!packagePath) {
      return res.status(400).json({
        success: false,
        error: "Package path is required",
      });
    }

    const nodeLoader = global.nodeLoader as NodeLoader;
    const result = await nodeLoader.loadNodePackage(packagePath);

    if (result.success) {
      res.json({
        success: true,
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        error: "Failed to load package",
        details: result.errors,
      });
    }
  } catch (error) {
    logger.error("Failed to load package", { error });
    res.status(500).json({
      success: false,
      error: "Failed to load package",
    });
  }
});

/**
 * POST /api/custom-nodes/packages/:packageName/reload
 * Reload a custom node package (for development)
 */
router.post(
  "/packages/:packageName/reload",
  async (req: Request, res: Response) => {
    try {
      const { packageName } = req.params;

      const nodeLoader = global.nodeLoader as NodeLoader;
      const result = await nodeLoader.reloadNodePackage(packageName);

      if (result.success) {
        res.json({
          success: true,
          data: result,
          message: `Package ${packageName} reloaded successfully`,
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Failed to reload package",
          details: result.errors,
        });
      }
    } catch (error) {
      logger.error("Failed to reload package", {
        error,
        packageName: req.params.packageName,
      });
      res.status(500).json({
        success: false,
        error: "Failed to reload package",
      });
    }
  }
);

/**
 * POST /api/custom-nodes/generate
 * Generate a new custom node package from template
 */
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const {
      name,
      displayName,
      description,
      type,
      author,
      version,
      group,
      includeCredentials,
      includeTests,
      typescript,
      outputPath,
    } = req.body;

    if (!name || !displayName || !description || !type) {
      return res.status(400).json({
        success: false,
        error: "Name, displayName, description, and type are required",
      });
    }

    const templateGenerator = new NodeTemplateGenerator();
    const result = await templateGenerator.generateNodePackage(
      outputPath || process.cwd(),
      {
        name,
        displayName,
        description,
        type,
        author,
        version,
        group: group
          ? group.split(",").map((g: string) => g.trim())
          : undefined,
        includeCredentials,
        includeTests,
        typescript,
      }
    );

    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: "Node package generated successfully",
      });
    } else {
      res.status(400).json({
        success: false,
        error: "Failed to generate package",
        details: result.errors,
      });
    }
  } catch (error) {
    logger.error("Failed to generate package", { error });
    res.status(500).json({
      success: false,
      error: "Failed to generate package",
    });
  }
});

/**
 * POST /api/custom-nodes/generate-zip
 * Generate a new custom node package as a downloadable zip file
 */
router.post("/generate-zip", async (req: Request, res: Response) => {
  try {
    const {
      name,
      displayName,
      description,
      type,
      author,
      version,
      group,
      includeCredentials,
      includeTests,
      typescript,
    } = req.body;

    if (!name || !displayName || !description || !type) {
      return res.status(400).json({
        success: false,
        error: "Name, displayName, description, and type are required",
      });
    }

    const templateGenerator = new NodeTemplateGenerator();
    const result = await templateGenerator.generateNodePackageZip({
      name,
      displayName,
      description,
      type,
      author,
      version,
      group: Array.isArray(group) ? group : group ? [group] : undefined,
      includeCredentials,
      includeTests,
      typescript,
    });

    if (result.success && result.zipBuffer && result.filename) {
      // Set headers for file download
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`
      );
      res.setHeader("Content-Length", result.zipBuffer.length);

      // Send the zip file
      res.send(result.zipBuffer);
    } else {
      res.status(400).json({
        success: false,
        error: "Failed to generate package zip",
        details: result.errors,
      });
    }
  } catch (error) {
    logger.error("Failed to generate package zip", { error });
    res.status(500).json({
      success: false,
      error: "Failed to generate package zip",
    });
  }
});

/**
 * POST /api/custom-nodes/compile
 * Compile a TypeScript node package
 */
router.post("/compile", async (req: Request, res: Response) => {
  try {
    const { packagePath } = req.body;

    if (!packagePath) {
      return res.status(400).json({
        success: false,
        error: "Package path is required",
      });
    }

    const nodeLoader = global.nodeLoader as NodeLoader;
    const result = await nodeLoader.compileNodePackage(packagePath);

    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: "Package compiled successfully",
      });
    } else {
      res.status(400).json({
        success: false,
        error: "Failed to compile package",
        details: result.errors,
      });
    }
  } catch (error) {
    logger.error("Failed to compile package", { error });
    res.status(500).json({
      success: false,
      error: "Failed to compile package",
    });
  }
});

/**
 * GET /api/custom-nodes/marketplace/search
 * Search for nodes in the marketplace
 */
router.get("/marketplace/search", async (req: Request, res: Response) => {
  try {
    const {
      query,
      category,
      author,
      verified,
      minRating,
      tags,
      sortBy,
      sortOrder,
      limit,
      offset,
    } = req.query;

    const marketplace = new NodeMarketplace({
      registryUrl:
        process.env.NODE_MARKETPLACE_URL || "https://marketplace.nodeDrop.io",
    });

    const filters = {
      query: query as string,
      category: category as string,
      author: author as string,
      verified: verified !== undefined ? verified === "true" : undefined,
      minRating: minRating ? parseFloat(minRating as string) : undefined,
      tags: tags ? (tags as string).split(",") : undefined,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    };

    const result = await marketplace.searchNodes(filters);
    
    // Get installed packages to check installation status
    const installedPackages = await marketplace.getInstalledPackages();
    
    // Create a map with both original name and lowercase name for matching
    const installedMap = new Map<string, { version: string; name: string }>();
    installedPackages.forEach(pkg => {
      installedMap.set(pkg.name.toLowerCase(), { version: pkg.version, name: pkg.name });
      installedMap.set(pkg.name, { version: pkg.version, name: pkg.name });
    });
    
    logger.info('Installed packages map', { 
      installedPackages: installedPackages.map(p => ({ name: p.name, version: p.version })),
      mapKeys: Array.from(installedMap.keys())
    });
    
    // Add installation status to each package
    const packagesWithStatus = result.packages.map(pkg => {
      const installedInfo = installedMap.get(pkg.name.toLowerCase()) || installedMap.get(pkg.name);
      return {
        ...pkg,
        installed: !!installedInfo,
        installedVersion: installedInfo?.version,
        hasUpdate: installedInfo && installedInfo.version !== pkg.version
      };
    });

    res.json({
      success: true,
      data: {
        ...result,
        packages: packagesWithStatus
      },
    });
  } catch (error) {
    logger.error("Failed to search marketplace", { error });
    res.status(500).json({
      success: false,
      error: "Failed to search marketplace",
    });
  }
});

/**
 * GET /api/custom-nodes/marketplace/packages/:packageId
 * Get detailed information about a marketplace package
 */
router.get(
  "/marketplace/packages/:packageId",
  async (req: Request, res: Response) => {
    try {
      const { packageId } = req.params;

      const marketplace = new NodeMarketplace({
        registryUrl:
          process.env.NODE_MARKETPLACE_URL || "https://marketplace.nodeDrop.io",
      });

      const packageInfo = await marketplace.getNodeInfo(packageId);

      res.json({
        success: true,
        data: packageInfo,
      });
    } catch (error) {
      logger.error("Failed to get package info", {
        error,
        packageId: req.params.packageId,
      });
      res.status(500).json({
        success: false,
        error: "Failed to get package info",
      });
    }
  }
);

/**
 * POST /api/custom-nodes/marketplace/install
 * Install a package from the marketplace
 */
router.post("/marketplace/install", async (req: Request, res: Response) => {
  try {
    const { packageId, version, force, skipValidation } = req.body;

    if (!packageId) {
      return res.status(400).json({
        success: false,
        error: "Package ID is required",
      });
    }

    const marketplace = new NodeMarketplace({
      registryUrl:
        process.env.NODE_MARKETPLACE_URL || "https://marketplace.nodeDrop.io",
    });

    const result = await marketplace.installNode(packageId, {
      version,
      force,
      skipValidation,
    });

    if (result.success) {
      // Load the installed package
      try {
        const nodeLoader = global.nodeLoader as NodeLoader;
        await nodeLoader.loadNodePackage(result.packagePath!);
        
        logger.info('Package installed and loaded successfully', { packageId, packagePath: result.packagePath });
      } catch (loadError) {
        logger.error('Failed to load installed package', { error: loadError, packageId });
        // Continue anyway - package is installed even if loading failed
      }

      res.json({
        success: true,
        data: result,
        message: "Package installed and loaded successfully",
      });
    } else {
      res.status(400).json({
        success: false,
        error: "Failed to install package",
        details: result.errors,
      });
    }
  } catch (error) {
    logger.error("Failed to install package", { error });
    res.status(500).json({
      success: false,
      error: "Failed to install package",
    });
  }
});

/**
 * POST /api/custom-nodes/marketplace/publish
 * Publish a package to the marketplace
 */
router.post("/marketplace/publish", async (req: Request, res: Response) => {
  try {
    const {
      packagePath,
      version,
      changelog,
      tags,
      private: isPrivate,
      dryRun,
    } = req.body;

    if (!packagePath) {
      return res.status(400).json({
        success: false,
        error: "Package path is required",
      });
    }

    const marketplace = new NodeMarketplace({
      registryUrl:
        process.env.NODE_MARKETPLACE_URL || "https://marketplace.nodeDrop.io",
      apiKey: process.env.NODE_MARKETPLACE_API_KEY,
    });

    const result = await marketplace.publishNode({
      packagePath,
      version,
      changelog,
      tags: tags ? tags.split(",").map((t: string) => t.trim()) : undefined,
      private: isPrivate,
      dryRun,
    });

    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: dryRun
          ? "Package validation successful (dry run)"
          : "Package published successfully",
      });
    } else {
      res.status(400).json({
        success: false,
        error: "Failed to publish package",
        details: result.errors,
      });
    }
  } catch (error) {
    logger.error("Failed to publish package", { error });
    res.status(500).json({
      success: false,
      error: "Failed to publish package",
    });
  }
});

export { router as customNodeRoutes };
