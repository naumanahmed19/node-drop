import {
  BuiltInNodeTypes,
  NodeDefinition,
  NodeInputData,
  NodeOutputData,
} from "../../types/node.types";
import { HttpExecutionErrorFactory } from "../../utils/errors/HttpExecutionError";
import { RetryHandler } from "../../utils/retry/RetryStrategy";
import { ResourceLimitsEnforcer } from "../../utils/security/ResourceLimitsEnforcer";
import { UrlSecurityValidator } from "../../utils/security/UrlSecurityValidator";

export const HttpRequestNode: NodeDefinition = {
  identifier: BuiltInNodeTypes.HTTP_REQUEST,
  displayName: "HTTP Request",
  name: "httpRequest",
  group: ["transform"],
  version: 1,
  description: "Make HTTP requests to any URL",
  icon: "fa:globe",
  color: "#2196F3",
  defaults: {
    method: "GET",
    url: "",
    headers: {},
    body: "",
    timeout: 30000,
    followRedirects: true,
    maxRedirects: 5,
  },
  inputs: ["main"],
  outputs: ["main"],
  properties: [
    {
      displayName: "Authentication",
      name: "authentication",
      type: "credential",
      required: false,
      default: "",
      description: "Select authentication method for HTTP requests",
      placeholder: "Select authentication...",
      allowedTypes: [
        "httpBasicAuth",
        "httpHeaderAuth",
        "httpBearerAuth",
        "apiKey",
      ],
    },
    {
      displayName: "Method",
      name: "method",
      type: "options",
      required: true,
      default: "GET",
      options: [
        { name: "GET", value: "GET" },
        { name: "POST", value: "POST" },
        { name: "PUT", value: "PUT" },
        { name: "DELETE", value: "DELETE" },
        { name: "PATCH", value: "PATCH" },
      ],
    },
    {
      displayName: "URL",
      name: "url",
      type: "expression",
      required: true,
      default: "",
      description: "The URL to make the request to",
    },
    {
      displayName: "Headers",
      name: "headers",
      type: "json",
      required: false,
      default: "{}",
      description: "Headers to send with the request",
    },
    {
      displayName: "Body",
      name: "body",
      type: "json",
      required: false,
      default: "",
      description: "Body data to send with the request",
      displayOptions: {
        show: {
          method: ["POST", "PUT", "PATCH"],
        },
      },
    },
    {
      displayName: "Timeout (ms)",
      name: "timeout",
      type: "number",
      required: false,
      default: 30000,
      description: "Request timeout in milliseconds",
    },
    {
      displayName: "Follow Redirects",
      name: "followRedirects",
      type: "boolean",
      required: false,
      default: true,
      description: "Whether to follow HTTP redirects",
    },
    {
      displayName: "Max Redirects",
      name: "maxRedirects",
      type: "number",
      required: false,
      default: 5,
      description: "Maximum number of redirects to follow",
      displayOptions: {
        show: {
          followRedirects: [true],
        },
      },
    },
    {
      displayName: "Response Format",
      name: "responseFormat",
      type: "options",
      required: false,
      default: "dataOnly",
      options: [
        { name: "Data Only", value: "dataOnly" },
        { name: "Full Response", value: "fullResponse" },
      ],
      description: "Choose whether to return only the response data or the complete response including status, headers, etc.",
    },
  ],
  execute: async function (
    inputData: NodeInputData
  ): Promise<NodeOutputData[]> {
    const method = this.getNodeParameter("method") as string;
    const url = this.getNodeParameter("url") as string;

    // Debug logging to see what we actually received
    this.logger.info("HTTP Request - Parameter values received", {
      method,
      url,
      urlType: typeof url,
      urlLength: url?.length,
    });

    const headers =
      (this.getNodeParameter("headers") as Record<string, string>) ||
      {};
    const body = this.getNodeParameter("body");
    const timeout =
      (this.getNodeParameter("timeout") as number) || 30000;
    const followRedirects = this.getNodeParameter(
      "followRedirects"
    ) as boolean;
    const maxRedirects =
      (this.getNodeParameter("maxRedirects") as number) || 5;
    const responseFormat =
      (this.getNodeParameter("responseFormat") as string) || "dataOnly";

    // Get settings from Settings tab
    const continueOnFail = this.settings?.continueOnFail ?? false;
    const alwaysOutputData = this.settings?.alwaysOutputData ?? false;

    this.logger.info(
      `[HTTP Request] Settings - continueOnFail: ${continueOnFail}, alwaysOutputData: ${alwaysOutputData}`
    );

    if (!url) {
      throw new Error("URL is required");
    }

    // Parse headers if they're a string
    let parsedHeaders: Record<string, string> = {};
    if (typeof headers === "string") {
      try {
        parsedHeaders = JSON.parse(headers);
      } catch (error) {
        throw new Error("Invalid headers JSON format");
      }
    } else {
      parsedHeaders = headers;
    }

    // Handle credentials if provided
    let finalUrl = url;
    try {
      // Check for Basic Auth
      const basicAuth = await this.getCredentials("httpBasicAuth");
      if (basicAuth && basicAuth.username && basicAuth.password) {
        const authString = Buffer.from(
          `${basicAuth.username}:${basicAuth.password}`
        ).toString("base64");
        parsedHeaders["Authorization"] = `Basic ${authString}`;
        this.logger.info("Applied Basic Auth credentials");
      }
    } catch (error) {
      // Credential not configured, skip
    }

    try {
      // Check for Bearer Token
      const bearerAuth = await this.getCredentials("httpBearerAuth");
      if (bearerAuth && bearerAuth.token) {
        parsedHeaders["Authorization"] = `Bearer ${bearerAuth.token}`;
        this.logger.info("Applied Bearer Token credentials");
      }
    } catch (error) {
      // Credential not configured, skip
    }

    try {
      // Check for Header Auth
      const headerAuth = await this.getCredentials("httpHeaderAuth");
      if (headerAuth && headerAuth.name && headerAuth.value) {
        parsedHeaders[headerAuth.name as string] = headerAuth.value as string;
        this.logger.info(`Applied Header Auth credentials: ${headerAuth.name}`);
      }
    } catch (error) {
      // Credential not configured, skip
    }

    try {
      // Check for API Key
      const apiKeyAuth = await this.getCredentials("apiKey");
      if (apiKeyAuth && apiKeyAuth.apiKey) {
        const addTo = apiKeyAuth.addTo || "header";
        const keyName = apiKeyAuth.keyName || "api_key";

        if (addTo === "header") {
          parsedHeaders[keyName as string] = apiKeyAuth.apiKey as string;
          this.logger.info(`Applied API Key to header: ${keyName}`);
        } else if (addTo === "query") {
          // Add API key to query string
          const urlObj = new URL(finalUrl);
          urlObj.searchParams.set(
            keyName as string,
            apiKeyAuth.apiKey as string
          );
          finalUrl = urlObj.toString();
          this.logger.info(`Applied API Key to query parameter: ${keyName}`);
        }
      }
    } catch (error) {
      // Credential not configured, skip
    }

    // Security validation
    const urlValidation = UrlSecurityValidator.validateUrl(finalUrl);
    if (!urlValidation.isValid) {
      const errorMessages = urlValidation.errors
        .map((e) => e.message)
        .join("; ");
      this.logger.warn("HTTP Request blocked by security validation", {
        url: finalUrl,
        errors: urlValidation.errors,
        riskLevel: urlValidation.riskLevel,
      });
      throw new Error(`Security validation failed: ${errorMessages}`);
    }

    // Validate request parameters
    const paramValidation = UrlSecurityValidator.validateRequestParameters({
      headers: parsedHeaders,
      body: body,
    });
    if (!paramValidation.isValid) {
      const errorMessages = paramValidation.errors
        .map((e) => e.message)
        .join("; ");
      this.logger.warn(
        "HTTP Request parameters blocked by security validation",
        {
          errors: paramValidation.errors,
          riskLevel: paramValidation.riskLevel,
        }
      );
      throw new Error(`Parameter validation failed: ${errorMessages}`);
    }

    // Check memory limits before execution
    const memoryCheck = ResourceLimitsEnforcer.checkMemoryLimits();
    if (!memoryCheck.isValid) {
      this.logger.warn("HTTP Request blocked due to memory limits", {
        error: memoryCheck.error,
      });
      throw new Error(`Resource limit exceeded: ${memoryCheck.error}`);
    }

    // Use sanitized URL
    const sanitizedUrl = urlValidation.sanitizedUrl || finalUrl;

    // Prepare request body
    let requestBody: string | undefined;
    if (body && ["POST", "PUT", "PATCH"].includes(method)) {
      if (typeof body === "string") {
        requestBody = body;
      } else {
        requestBody = JSON.stringify(body);
        // Set content-type if not already set
        if (!parsedHeaders["Content-Type"] && !parsedHeaders["content-type"]) {
          parsedHeaders["Content-Type"] = "application/json";
        }
      }

      // Validate request body size
      const bodySize = Buffer.byteLength(requestBody, "utf8");
      const bodySizeCheck =
        ResourceLimitsEnforcer.validateRequestSize(bodySize);
      if (!bodySizeCheck.isValid) {
        this.logger.warn("HTTP Request body size exceeds limits", {
          bodySize,
          error: bodySizeCheck.error,
        });
        throw new Error(`Request body too large: ${bodySizeCheck.error}`);
      }
    }

    // Execute HTTP request with retry logic
    try {
      const result = await RetryHandler.executeWithRetry(
        async () => {
          // Import node-fetch dynamically
          const fetch = (await import("node-fetch")).default;
          const { AbortController } = await import("abort-controller");

          // Create abort controller for timeout handling
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          try {
            // Make the actual HTTP request
            const startTime = Date.now();
            const response = await fetch(sanitizedUrl, {
              method: method as any,
              headers: parsedHeaders,
              body: requestBody,
              signal: controller.signal as any,
              redirect: followRedirects ? "follow" : "manual",
              follow: followRedirects ? maxRedirects : 0,
            });

            // Clear timeout
            clearTimeout(timeoutId);

            const responseTime = Date.now() - startTime;

            // Check if response indicates an error
            // If alwaysOutputData is enabled, treat error responses as successful and return them
            if (!response.ok && !alwaysOutputData) {
              const httpError = HttpExecutionErrorFactory.createFromError(
                new Error(`HTTP ${response.status} ${response.statusText}`),
                sanitizedUrl,
                method,
                response
              );
              throw httpError;
            }

            // Validate response size
            const contentLength = response.headers.get("content-length");
            if (contentLength) {
              const responseSize = parseInt(contentLength, 10);
              const responseSizeCheck =
                ResourceLimitsEnforcer.validateResponseSize(responseSize);
              if (!responseSizeCheck.isValid) {
                this.logger.warn("HTTP Response size exceeds limits", {
                  responseSize,
                  error: responseSizeCheck.error,
                });
                throw new Error(
                  `Response too large: ${responseSizeCheck.error}`
                );
              }
            }

            // Parse response based on content type
            const contentType = response.headers.get("content-type") || "";
            let responseData: any;

            try {
              if (contentType.includes("application/json")) {
                responseData = await response.json();
              } else {
                responseData = await response.text();
              }
            } catch (parseError) {
              const httpError = HttpExecutionErrorFactory.createFromError(
                parseError,
                sanitizedUrl,
                method,
                response
              );
              throw httpError;
            }

            // Create response headers object
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
              responseHeaders[key] = value;
            });

            // Return structured response data based on format preference
            const fullResponse = {
              status: response.status,
              statusText: response.statusText,
              headers: responseHeaders,
              data: responseData,
              responseTime,
              url: response.url, // Final URL after redirects
              ok: response.ok,
            };

            // Return only data if dataOnly format is selected
            return responseFormat === "dataOnly" ? responseData : fullResponse;
          } catch (fetchError) {
            clearTimeout(timeoutId);

            // Create structured error
            const httpError = HttpExecutionErrorFactory.createFromError(
              fetchError,
              sanitizedUrl,
              method
            );
            throw httpError;
          }
        },
        {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
          maxRetryDelay: 10000,
        },
        { url: sanitizedUrl, method }
      );

      this.logger.info("HTTP Request completed", {
        method,
        url: sanitizedUrl,
        status: result.status,
        responseTime: result.responseTime,
      });

      return [{ main: [{ json: result }] }];
    } catch (error) {
      // Handle final error after all retries
      const httpError = error as any;

      this.logger.error("HTTP Request failed after retries", {
        method,
        url: sanitizedUrl,
        errorType: httpError.httpErrorType,
        statusCode: httpError.statusCode,
        error: httpError.message,
        errorStack: httpError.stack,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });

      // If continueOnFail is enabled, return error information as output data
      if (continueOnFail) {
        this.logger.info(
          "Continuing execution despite error (continueOnFail enabled)",
          {
            method,
            url: sanitizedUrl,
            error: httpError.message,
          }
        );

        // Return error details as output data so the workflow can continue
        return [
          {
            main: [
              {
                json: {
                  error: true,
                  errorMessage: httpError.message || "Request failed",
                  errorType: httpError.httpErrorType || "UNKNOWN_ERROR",
                  statusCode: httpError.statusCode,
                  url: sanitizedUrl,
                  method,
                  timestamp: new Date().toISOString(),
                  // Include any additional error details
                  details: httpError.details || {},
                },
              },
            ],
          },
        ];
      }

      // Throw user-friendly error message
      const userMessage =
        HttpExecutionErrorFactory.getUserFriendlyMessage(httpError);

      // If we don't have a user message, throw the original error for debugging
      if (
        !userMessage ||
        userMessage === "An unexpected error occurred while making the request."
      ) {
        throw error;
      }

      throw new Error(userMessage);
    }
  },
};
