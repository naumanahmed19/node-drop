import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";

/**
 * Check if request is from a bot based on user agent
 */
export function isBot(userAgent: string | undefined): boolean {
  if (!userAgent) return false;

  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /preview/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /slackbot/i,
    /discordbot/i,
    /whatsapp/i,
    /telegram/i,
  ];

  return botPatterns.some((pattern) => pattern.test(userAgent));
}

/**
 * Check if IP address is in whitelist
 * Supports individual IPs and CIDR notation
 */
export function isIpWhitelisted(
  clientIp: string,
  whitelist: string[]
): boolean {
  if (!whitelist || whitelist.length === 0) return true;

  for (const entry of whitelist) {
    const trimmedEntry = entry.trim();

    // Check for CIDR notation
    if (trimmedEntry.includes("/")) {
      if (isIpInCidr(clientIp, trimmedEntry)) {
        return true;
      }
    } else {
      // Direct IP match
      if (clientIp === trimmedEntry) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if IP is in CIDR range
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    const [range, bits] = cidr.split("/");
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);

    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);

    return (ipNum & mask) === (rangeNum & mask);
  } catch (error) {
    console.error(`Invalid CIDR notation: ${cidr}`, error);
    return false;
  }
}

/**
 * Convert IP address to number
 */
function ipToNumber(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
}

/**
 * Validate CORS origin
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
    .filter((o) => o);

  return origins.some((allowed) => {
    // Exact match
    if (allowed === origin) return true;

    // Wildcard subdomain match (e.g., *.example.com)
    if (allowed.startsWith("*.")) {
      const domain = allowed.substring(2);
      return origin.endsWith(domain);
    }

    return false;
  });
}

/**
 * Middleware to validate webhook options
 */
export function validateWebhookOptions(webhookOptions: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if bots should be ignored
      if (webhookOptions.ignoreBots) {
        const userAgent = req.get("User-Agent");
        if (isBot(userAgent)) {
          throw new AppError(
            "Bot requests are not allowed",
            403,
            "BOT_REQUEST_BLOCKED"
          );
        }
      }

      // Check IP whitelist
      if (webhookOptions.ipWhitelist) {
        const whitelist = webhookOptions.ipWhitelist
          .split(",")
          .map((ip: string) => ip.trim())
          .filter((ip: string) => ip);

        if (whitelist.length > 0) {
          const clientIp =
            req.ip || req.socket.remoteAddress || "unknown";

          if (!isIpWhitelisted(clientIp, whitelist)) {
            throw new AppError(
              "IP address not whitelisted",
              403,
              "IP_NOT_WHITELISTED"
            );
          }
        }
      }

      // Handle CORS
      if (webhookOptions.allowedOrigins) {
        const origin = req.get("Origin");
        if (origin && !isOriginAllowed(origin, webhookOptions.allowedOrigins)) {
          throw new AppError(
            "Origin not allowed",
            403,
            "ORIGIN_NOT_ALLOWED"
          );
        }

        // Set CORS headers
        if (webhookOptions.allowedOrigins === "*") {
          res.setHeader("Access-Control-Allow-Origin", "*");
        } else if (origin && isOriginAllowed(origin, webhookOptions.allowedOrigins)) {
          res.setHeader("Access-Control-Allow-Origin", origin);
        }

        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Access-Control-Allow-Credentials", "true");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
