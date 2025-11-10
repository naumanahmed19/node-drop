import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Configure multer for in-memory file storage
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file limit
    files: 20, // Max 20 files
    fields: 50, // Max 50 fields (including non-file fields)
  },
});

/**
 * Middleware to handle raw body for webhooks
 * Preserves the raw body before JSON parsing
 */
export function captureRawBody(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Only capture raw body for webhook routes
  if (!req.path.startsWith("/webhook")) {
    return next();
  }

  const chunks: Buffer[] = [];

  req.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on("end", () => {
    if (chunks.length > 0) {
      (req as any).rawBody = Buffer.concat(chunks);
    }
    next();
  });
}

/**
 * Middleware to conditionally parse webhook body based on webhook settings
 * Checks if webhook has rawBody or binaryProperty options enabled
 */
export async function webhookBodyParser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.log('🔧 webhookBodyParser called for:', req.path);
  try {
    // Extract webhook path (everything after /webhook/)
    const webhookPath = req.path.replace(/^\//, ""); // Remove leading slash
    console.log('🔍 Extracted webhook path:', webhookPath);

    // Find the workflow with this webhook
    const workflows = await prisma.workflow.findMany({
      where: { active: true },
      select: {
        id: true,
        nodes: true,
        triggers: true,
      },
    });

    let webhookOptions: any = null;

    // Find matching webhook trigger
    for (const workflow of workflows) {
      const triggers = (workflow.triggers as any[]) || [];
      const webhookTrigger = triggers.find(
        (t) =>
          t.type === "webhook" &&
          t.active &&
          (t.settings?.webhookId === webhookPath ||
            t.settings?.webhookUrl === webhookPath)
      );

      if (webhookTrigger) {
        // Get webhook options from workflow nodes
        const nodes =
          typeof workflow.nodes === "string"
            ? JSON.parse(workflow.nodes)
            : workflow.nodes;
        const webhookNode = (nodes as any[])?.find(
          (n) => n.id === webhookTrigger.nodeId
        );

        if (webhookNode?.parameters?.options) {
          webhookOptions = webhookNode.parameters.options;
          break;
        }
      }
    }

    // Check if this is a multipart/form-data request
    const contentType = req.get("Content-Type") || "";
    const isMultipart = contentType.includes("multipart/form-data");

    console.log('🔍 webhookBodyParser:', {
      path: req.path,
      contentType,
      isMultipart,
      hasWebhookOptions: !!webhookOptions,
      webhookOptions
    });

    // Handle multipart form data (file uploads) - process regardless of webhook options
    if (isMultipart) {
      console.log('📤 Processing multipart upload...');
      
      // Use multer to handle any file fields (supports multiple files)
      const uploadMiddleware = upload.any();
      return uploadMiddleware(req, res, (err) => {
        if (err) {
          console.error("❌ File upload error:", err);
          return res.status(400).json({
            success: false,
            error: "File upload failed",
            details: err.message,
          });
        }

        const files = (req as any).files || [];
        console.log('✅ File upload processed:', {
          fileCount: files.length,
          files: files.map((f: any) => ({
            fieldName: f.fieldname,
            fileName: f.originalname,
            fileSize: f.size,
            mimeType: f.mimetype
          }))
        });

        // Store all files in request for later use
        if (files.length > 0) {
          (req as any).binaryData = files.map((file: any) => ({
            data: file.buffer,
            mimeType: file.mimetype,
            fileName: file.originalname,
            fileSize: file.size,
            fieldName: file.fieldname,
          }));
        }

        next();
      });
    }

    // If no webhook options found, continue with default parsing
    if (!webhookOptions) {
      return next();
    }

    // Handle raw body
    if (webhookOptions.rawBody) {
      // Raw body is already captured by captureRawBody middleware
      // Just ensure it's available
      if ((req as any).rawBody) {
        // Store raw body as string for easy access
        (req as any).rawBodyString = (req as any).rawBody.toString("utf-8");
      }
    }

    next();
  } catch (error) {
    console.error("Error in webhookBodyParser:", error);
    next(); // Continue even if there's an error
  }
}

/**
 * Middleware to handle multipart form data for file uploads
 * This is a simpler alternative that always allows file uploads
 */
export const handleFileUpload = upload.single("file");

/**
 * Middleware to handle multiple files
 */
export const handleMultipleFiles = upload.array("files", 10); // Max 10 files

/**
 * Middleware to handle any field name for file upload
 */
export const handleAnyFile = upload.any();
