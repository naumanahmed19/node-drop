import {
  NodeDefinition,
  NodeInputData,
  NodeOutputData,
} from "../../types/node.types";

/**
 * Image Preview Node
 *
 * Displays an image preview from a URL input.
 * Supports custom component rendering for real-time preview in the configuration dialog.
 */
export const ImagePreviewNode: NodeDefinition = {
  identifier: "image-preview",
  displayName: "Image Preview",
  name: "imagePreview",
  group: ["transform"],
  version: 1,
  description: "Display and preview images from URL with real-time rendering",
  icon: "fa:image",
  color: "#FF6B6B",
  outputComponent: "ImagePreviewOutput", // Custom output renderer
  defaults: {
    imageUrl: "",
    altText: "",
    displayInOutput: true,
  },
  inputs: ["main"],
  outputs: ["main"],
  properties: [
    {
      displayName: "Image URL",
      name: "imageUrl",
      type: "string",
      required: true,
      default: "",
      description:
        "The URL of the image to preview and display. Use {{json.fieldName}} to reference input data.",
      placeholder: "https://example.com/image.jpg",
    },
    {
      displayName: "Image Preview",
      name: "imagePreview",
      type: "custom",
      component: "ImagePreview",
      description: "Live preview of the image",
      componentProps: {
        urlField: "imageUrl", // Tell the component which field contains the URL
        dimensionsField: "imageDimensions", // Field to store dimensions
      },
    },
    {
      displayName: "Image Dimensions",
      name: "imageDimensions",
      type: "json",
      required: false,
      default: "{}",
      description: "Image dimensions (auto-populated by preview)",
      displayOptions: {
        show: {
          __never__: [true], // Never show this field in UI
        },
      },
    },
    {
      displayName: "Alt Text",
      name: "altText",
      type: "string",
      required: false,
      default: "",
      description:
        "Alternative text for the image (accessibility). Use {{json.fieldName}} to reference input data.",
      placeholder: "Description of the image",
    },
    {
      displayName: "Display in Output",
      name: "displayInOutput",
      type: "boolean",
      required: false,
      default: true,
      description: "Include image data in the output",
    },
  ],
  execute: async function (
    inputData: NodeInputData
  ): Promise<NodeOutputData[]> {
    // getNodeParameter now automatically resolves {{...}} placeholders from the first item
    const imageUrl = await this.getNodeParameter("imageUrl") as string;
    const altText = await this.getNodeParameter("altText") as string;
    const displayInOutput = await this.getNodeParameter("displayInOutput") as boolean;

    // Get dimensions from frontend (if available)
    let imageDimensions: any = {};
    try {
      const dimensionsParam = this.getNodeParameter(
        "imageDimensions"
      ) as string;
      if (dimensionsParam && dimensionsParam !== "{}") {
        imageDimensions =
          typeof dimensionsParam === "string"
            ? JSON.parse(dimensionsParam)
            : dimensionsParam;
      }
    } catch (error) {
      // Ignore parsing errors, dimensions are optional
    }

    if (!imageUrl) {
      throw new Error("Image URL is required");
    }

    // Validate URL format
    try {
      const url = new URL(imageUrl);

      // Check if protocol is http or https
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Image URL must use HTTP or HTTPS protocol");
      }
    } catch (error) {
      throw new Error(
        `Invalid image URL: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    // Try to fetch image metadata
    let imageMetadata: any = {};

    if (displayInOutput) {
      try {
        const fetch = (await import("node-fetch")).default;
        const { AbortController } = await import("abort-controller");

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          // Make HEAD request to get image info without downloading full image
          const response = await fetch(imageUrl, {
            method: "HEAD",
            signal: controller.signal as any,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const contentType = response.headers.get("content-type") || "";
            const contentLength = response.headers.get("content-length");

            // Validate it's an image
            if (!contentType.startsWith("image/")) {
              this.logger.warn("URL does not point to an image", {
                contentType,
                url: imageUrl,
              });
            }

            imageMetadata = {
              contentType,
              size: contentLength ? parseInt(contentLength, 10) : null,
              sizeFormatted: contentLength
                ? formatBytes(parseInt(contentLength, 10))
                : "Unknown",
              lastModified: response.headers.get("last-modified") || null,
              valid: contentType.startsWith("image/"),
              width: imageDimensions.width || null,
              height: imageDimensions.height || null,
              dimensions:
                imageDimensions.width && imageDimensions.height
                  ? `${imageDimensions.width}px × ${imageDimensions.height}px`
                  : null,
            };
          } else {
            this.logger.warn("Failed to fetch image metadata", {
              status: response.status,
              url: imageUrl,
            });
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          this.logger.warn("Error fetching image metadata", {
            error:
              fetchError instanceof Error
                ? fetchError.message
                : "Unknown error",
            url: imageUrl,
          });
        }
      } catch (error) {
        this.logger.warn("Error loading fetch module", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Prepare output data with resolved values
    const outputData = {
      imageUrl: imageUrl,
      altText: altText,
      metadata: imageMetadata,
      timestamp: new Date().toISOString(),
    };

    this.logger.info("Image preview processed", {
      url: imageUrl,
      hasMetadata: Object.keys(imageMetadata).length > 0,
    });

    return [{ main: [{ json: outputData }] }];
  },
};

/**
 * Helper function to format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
