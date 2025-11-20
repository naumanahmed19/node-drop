/**
 * Shared webhook validation utilities
 * Used by all webhook-based triggers (webhooks, forms, chats)
 */

import { Request, Response } from 'express';

export interface WebhookOptions {
  allowedOrigins?: string;
  saveRequestLogs?: boolean;
  ipWhitelist?: string;
  ignoreBots?: boolean;
  rateLimitPerIP?: number;
  [key: string]: any;
}

/**
 * Check if origin is allowed based on CORS settings
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string
): boolean {
  if (!origin) return true; // No origin header (non-browser request)
  if (allowedOrigins === "*") return true;

  const origins = allowedOrigins
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  // Check exact match
  if (origins.includes(origin)) return true;

  // Check wildcard subdomain match (e.g., *.example.com)
  for (const allowed of origins) {
    if (allowed.startsWith("*.")) {
      const domain = allowed.substring(2); // Remove *.
      if (origin.endsWith(domain)) return true;
    }
  }

  return false;
}

/**
 * Apply CORS headers based on webhook options
 */
export function applyCorsHeaders(
  req: Request,
  res: Response,
  options: WebhookOptions
): boolean {
  const allowedOrigins = options.allowedOrigins || "*";
  const origin = req.get("Origin");

  if (allowedOrigins === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
    return true;
  }

  if (origin && isOriginAllowed(origin, allowedOrigins)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
    return true;
  }

  // Origin not allowed
  return false;
}

/**
 * Check if IP is in whitelist
 */
export function isIpWhitelisted(
  ip: string | undefined,
  ipWhitelist: string
): boolean {
  if (!ipWhitelist || ipWhitelist.trim() === "") return true; // No whitelist = allow all
  if (!ip) return false;

  const allowedIps = ipWhitelist
    .split(",")
    .map((i) => i.trim())
    .filter((i) => i.length > 0);

  for (const allowed of allowedIps) {
    // Exact IP match
    if (allowed === ip) return true;

    // CIDR range match (basic implementation)
    if (allowed.includes("/")) {
      // TODO: Implement proper CIDR matching
      // For now, just check if IP starts with the network part
      const [network] = allowed.split("/");
      if (ip.startsWith(network.substring(0, network.lastIndexOf(".")))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if request is from a bot
 */
export function isBot(userAgent: string | undefined): boolean {
  if (!userAgent) return false;

  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /slurp/i,
    /googlebot/i,
    /bingbot/i,
    /yandex/i,
    /baiduspider/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /rogerbot/i,
    /linkedinbot/i,
    /embedly/i,
    /quora link preview/i,
    /showyoubot/i,
    /outbrain/i,
    /pinterest/i,
    /slackbot/i,
    /vkshare/i,
    /w3c_validator/i,
    /redditbot/i,
    /applebot/i,
    /whatsapp/i,
    /flipboard/i,
    /tumblr/i,
    /bitlybot/i,
    /skypeuripreview/i,
    /nuzzel/i,
    /discordbot/i,
    /qwantify/i,
    /pinterestbot/i,
    /telegrambot/i,
  ];

  return botPatterns.some((pattern) => pattern.test(userAgent));
}

/**
 * Validate webhook request based on options
 * Returns { allowed: boolean, reason?: string }
 */
export function validateWebhookRequest(
  req: Request,
  options: WebhookOptions
): { allowed: boolean; reason?: string } {
  // Check IP whitelist
  if (options.ipWhitelist) {
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    if (!isIpWhitelisted(ip, options.ipWhitelist)) {
      return { allowed: false, reason: "IP address not whitelisted" };
    }
  }

  // Check if should ignore bots
  if (options.ignoreBots) {
    const userAgent = req.get("User-Agent");
    if (isBot(userAgent)) {
      return { allowed: false, reason: "Bot request ignored" };
    }
  }

  // Check CORS (if origin is present)
  if (options.allowedOrigins && options.allowedOrigins !== "*") {
    const origin = req.get("Origin");
    if (origin && !isOriginAllowed(origin, options.allowedOrigins)) {
      return { allowed: false, reason: "Origin not allowed" };
    }
  }

  return { allowed: true };
}

/**
 * Get webhook options from node parameters
 * Supports both nested (options.*) and flat structure for backward compatibility
 */
export function getWebhookOptions(nodeParameters: any): WebhookOptions {
  const options: WebhookOptions = {};

  // Try nested structure first (new)
  if (nodeParameters?.options) {
    Object.assign(options, nodeParameters.options);
  }

  // Fallback to flat structure (old) for backward compatibility
  if (nodeParameters?.allowedOrigins !== undefined) {
    options.allowedOrigins = nodeParameters.allowedOrigins;
  }
  if (nodeParameters?.saveRequestLogs !== undefined) {
    options.saveRequestLogs = nodeParameters.saveRequestLogs;
  }
  if (nodeParameters?.ipWhitelist !== undefined) {
    options.ipWhitelist = nodeParameters.ipWhitelist;
  }
  if (nodeParameters?.ignoreBots !== undefined) {
    options.ignoreBots = nodeParameters.ignoreBots;
  }
  if (nodeParameters?.rateLimitPerIP !== undefined) {
    options.rateLimitPerIP = nodeParameters.rateLimitPerIP;
  }

  // Set defaults
  if (options.allowedOrigins === undefined) options.allowedOrigins = "*";
  if (options.saveRequestLogs === undefined) options.saveRequestLogs = false;
  if (options.ipWhitelist === undefined) options.ipWhitelist = "";
  if (options.ignoreBots === undefined) options.ignoreBots = false;

  return options;
}

/**
 * Check if request logging is enabled
 */
export function shouldLogRequest(options: WebhookOptions): boolean {
  return options.saveRequestLogs === true;
}
