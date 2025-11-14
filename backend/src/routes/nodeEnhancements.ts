import express from "express";
import fs from "fs/promises";
import path from "path";
import { logger } from "../utils/logger";

const router = express.Router();

/**
 * Get list of custom nodes with frontend enhancements
 * 
 * Scans custom-nodes directory for .enhancement.js files
 */
router.get("/enhancements", async (req, res) => {
  try {
    const customNodesDir = path.join(process.cwd(), "custom-nodes");
    const enhancements: Array<{ nodeType: string; enhancementUrl: string }> = [];

    // Check if custom-nodes directory exists
    try {
      await fs.access(customNodesDir);
    } catch {
      return res.json({ enhancements: [] });
    }

    // Scan all custom node packages
    const packages = await fs.readdir(customNodesDir);

    for (const packageName of packages) {
      const packagePath = path.join(customNodesDir, packageName);
      const nodesPath = path.join(packagePath, "nodes");

      try {
        // Check if nodes directory exists
        await fs.access(nodesPath);

        // Scan for enhancement files
        const files = await fs.readdir(nodesPath);
        const enhancementFiles = files.filter((f) =>
          f.endsWith(".enhancement.js")
        );

        for (const enhancementFile of enhancementFiles) {
          // Extract node type from filename (e.g., "Delay.enhancement.js" -> "delay")
          const nodeType = enhancementFile
            .replace(".enhancement.js", "")
            .toLowerCase();

          enhancements.push({
            nodeType,
            enhancementUrl: `/api/nodes/enhancements/${packageName}/${enhancementFile}`,
          });

          logger.info(`Found enhancement for ${nodeType}`, {
            package: packageName,
            file: enhancementFile,
          });
        }
      } catch (error) {
        // Skip packages without nodes directory
        continue;
      }
    }

    res.json({ enhancements });
  } catch (error) {
    logger.error("Failed to get node enhancements", { error });
    res.status(500).json({
      error: "Failed to get node enhancements",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Serve a specific enhancement file
 */
router.get("/enhancements/:package/:file", async (req, res) => {
  try {
    const { package: packageName, file } = req.params;

    // Security: Validate filename to prevent directory traversal
    if (
      !file.endsWith(".enhancement.js") ||
      file.includes("..") ||
      packageName.includes("..")
    ) {
      return res.status(400).json({ error: "Invalid file name" });
    }

    const filePath = path.join(
      process.cwd(),
      "custom-nodes",
      packageName,
      "nodes",
      file
    );

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: "Enhancement file not found" });
    }

    // Read and serve the file
    const content = await fs.readFile(filePath, "utf-8");

    res.setHeader("Content-Type", "application/javascript");
    res.send(content);
  } catch (error) {
    logger.error("Failed to serve enhancement file", { error });
    res.status(500).json({
      error: "Failed to serve enhancement file",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
