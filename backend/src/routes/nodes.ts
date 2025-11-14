import { PrismaClient } from "@prisma/client";
import { Response, Router } from "express";
import fs from "fs";
import path from "path";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { validateQuery } from "../middleware/validation";
import { ApiResponse, NodeQuerySchema } from "../types/api";

const prisma = new PrismaClient();
// Use lazy initialization to get the global nodeService when needed
const getNodeService = () => {
  if (!global.nodeService) {
    throw new Error(
      "NodeService not initialized. Make sure the server is properly started."
    );
  }
  return global.nodeService;
};

const router = Router();

// GET /api/nodes - List available node types
router.get(
  "/",
  authenticateToken,
  validateQuery(NodeQuerySchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      page = 1,
      limit = 50,
      category,
      search,
      sortBy = "displayName",
      sortOrder = "asc",
    } = req.query as any;

    let nodeTypes = await getNodeService().getNodeTypes();

    // Filter by category
    if (category) {
      nodeTypes = nodeTypes.filter((node) => node.group.includes(category));
    }

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      nodeTypes = nodeTypes.filter(
        (node) =>
          node.displayName.toLowerCase().includes(searchLower) ||
          node.description.toLowerCase().includes(searchLower) ||
          node.type.toLowerCase().includes(searchLower)
      );
    }

    // Sort nodes
    nodeTypes.sort((a, b) => {
      const aValue = (a as any)[sortBy] || "";
      const bValue = (b as any)[sortBy] || "";

      if (sortOrder === "desc") {
        return bValue.localeCompare(aValue);
      }
      return aValue.localeCompare(bValue);
    });

    // Paginate
    const total = nodeTypes.length;
    const skip = (page - 1) * limit;
    const paginatedNodes = nodeTypes.slice(skip, skip + limit);

    const response: ApiResponse = {
      success: true,
      data: paginatedNodes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.json(response);
  })
);

// GET /api/nodes/categories - Get node categories
router.get(
  "/categories",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const nodeTypes = await getNodeService().getNodeTypes();
    const categories = Array.from(
      new Set(nodeTypes.flatMap((node) => node.group))
    ).sort();

    const response: ApiResponse = {
      success: true,
      data: categories.map((category) => ({
        name: category,
        displayName: category.charAt(0).toUpperCase() + category.slice(1),
        count: nodeTypes.filter((node) => node.group.includes(category)).length,
      })),
    };

    res.json(response);
  })
);

// GET /api/nodes/:type - Get node type details
router.get(
  "/:type",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const nodeSchema = await getNodeService().getNodeSchema(req.params.type);

    if (!nodeSchema) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: "NODE_TYPE_NOT_FOUND",
          message: "Node type not found",
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: nodeSchema,
    };

    res.json(response);
  })
);

// POST /api/nodes/:type/execute - Test node execution
router.post(
  "/:type/execute",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      parameters = {},
      inputData = { main: [[]] },
      credentials = {},
    } = req.body;

    const result = await getNodeService().executeNode(
      req.params.type,
      parameters,
      inputData,
      credentials
    );

    const response: ApiResponse = {
      success: result.success,
      data: result.success ? result.data : undefined,
      error: result.error
        ? {
          code: "NODE_EXECUTION_ERROR",
          message: result.error.message,
        }
        : undefined,
    };

    if (!result.success) {
      return res.status(400).json(response);
    }

    res.json(response);
  })
);

// POST /api/nodes/:type/load-options - Load dynamic options for a field
router.post(
  "/:type/load-options",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { method, parameters = {}, credentials = {} } = req.body;

    if (!method) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: "MISSING_METHOD",
          message: "loadOptions method name is required",
        },
      };
      return res.status(400).json(response);
    }

    const result = await getNodeService().loadNodeOptions(
      req.params.type,
      method,
      parameters,
      credentials
    );

    const response: ApiResponse = {
      success: result.success,
      data: result.success ? result.data : undefined,
      error: result.error
        ? {
          code: "LOAD_OPTIONS_ERROR",
          message: result.error.message,
        }
        : undefined,
    };

    if (!result.success) {
      return res.status(400).json(response);
    }

    res.json(response);
  })
);

// GET /api/nodes/:type/icon - Serve custom node icon files
router.get(
  "/:type/icon",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { type } = req.params;

    // Validate node type to prevent path traversal attacks
    if (!type || !/^[a-zA-Z0-9-_]+$/.test(type)) {
      return res.status(400).json({ error: "Invalid node type" });
    }

    try {
      // Get the node schema to find its icon path
      const nodeSchema = await getNodeService().getNodeSchema(type);

      if (!nodeSchema || !nodeSchema.icon) {
        return res.status(404).json({ error: "Icon not found" });
      }

      // Check if icon is a file reference (e.g., "file:postgres.svg")
      if (!nodeSchema.icon.startsWith("file:")) {
        return res.status(400).json({ error: "Icon is not a file reference" });
      }

      // Extract filename from icon reference
      const iconFileName = nodeSchema.icon.replace("file:", "");

      // Find the node's directory in custom-nodes
      const customNodesDir = path.join(__dirname, "../../custom-nodes");

      // Look for the icon file in the node's directory
      // The structure is: custom-nodes/{node-package}/nodes/{icon-file}
      const possiblePaths = [
        // Try the node's type as directory name
        path.join(customNodesDir, type, "nodes", iconFileName),
        // Try common variations
        path.join(customNodesDir, type.replace("-", ""), "nodes", iconFileName),
        path.join(customNodesDir, type, iconFileName),
      ];

      let iconPath: string | null = null;
      
      // First try the direct paths
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          iconPath = possiblePath;
          break;
        }
      }

      // If not found, search all custom-nodes packages
      if (!iconPath && fs.existsSync(customNodesDir)) {
        const packages = fs.readdirSync(customNodesDir, { withFileTypes: true });
        for (const pkg of packages) {
          if (pkg.isDirectory()) {
            const pkgIconPath = path.join(customNodesDir, pkg.name, "nodes", iconFileName);
            if (fs.existsSync(pkgIconPath)) {
              iconPath = pkgIconPath;
              break;
            }
          }
        }
      }

      if (!iconPath) {
        return res.status(404).json({
          error: "Icon file not found",
          searched: possiblePaths,
        });
      }

      // Set appropriate content type for SVG
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 1 day
      //res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"); // Allow cross-origin loading

      // Send the file
      res.sendFile(iconPath);
    } catch (error) {
      console.error("Error serving icon:", error);
      res.status(500).json({ error: "Failed to serve icon" });
    }
  })
);

export { router as nodeRoutes };
