/**
 * Icon Mapper - Converts icon strings to Lucide React components or SVG paths
 *
 * Supports multiple icon formats:
 * - lucide:icon-name → Lucide icon component
 * - fa:icon-name → Maps FontAwesome to Lucide equivalent
 * - svg:icon-name → Custom SVG from assets/icons folder
 * - emoji → Renders as text
 * - single letter → Renders as text
 */

import {
  Activity,
  AlertCircle,
  Archive,
  ArrowLeftRight,
  Bot,
  Calendar,
  CheckCircle,
  Clock,
  Code,
  Command,
  Database,
  ExternalLink,
  FileText,
  Filter,
  GitBranch,
  Globe,
  Image,
  Layers,
  LayoutGrid,
  Link,
  LucideIcon,
  Mail,
  MessageCircle,
  MessageSquare,
  PanelTop,
  Phone,
  Play,
  RefreshCw,
  Repeat,
  Send,
  Settings,
  Shuffle,
  Terminal,
  Timer,
  Upload,
  Wand2,
  Webhook,
  Zap,
} from "lucide-react";
import { env } from "../config/env";

/**
 * Type for icon component or SVG path
 */
export type IconType = LucideIcon | string;

/**
 * Registry of custom SVG icons
 * Maps icon names to SVG file paths in assets/icons
 * Note: file: prefix icons are automatically handled via backend API
 */
const SVG_ICON_REGISTRY: Record<string, string> = {
  openai: "/icons/openai.svg",
  split: "/icons/split.svg",
  merge: "/icons/merge.svg",
};

/**
 * Registry of Lucide icons
 * Maps icon names (lowercase, dash-separated) to Lucide components
 */
const LUCIDE_ICON_REGISTRY: Record<string, LucideIcon> = {
  // Trigger icons
  play: Play,
  "play-circle": Play,
  zap: Zap,
  bolt: Zap,
  lightning: Zap,
  webhook: Webhook,
  calendar: Calendar,
  clock: Clock,
  timer: Timer,
  "message-circle": MessageCircle,
  "message-square": MessageSquare,
  "message-square-reply": ArrowLeftRight,
  "arrow-left-right": ArrowLeftRight,
  "external-link": ExternalLink,
  link: Link,
  phone: Phone,
  "phone-call": Phone,

  // Action icons
  globe: Globe,
  send: Send,
  mail: Mail,
  database: Database,
  "refresh-cw": RefreshCw,

  // Transform icons
  code: Code,
  "file-text": FileText,
  settings: Settings,
  filter: Filter,
  layers: Layers,
  "layout-grid": LayoutGrid,
  terminal: Terminal,

  // Logic icons
  "git-branch": GitBranch,
  shuffle: Shuffle,
  "panel-top": PanelTop,
  "check-circle": CheckCircle,
  "alert-circle": AlertCircle,

  // Utility icons
  activity: Activity,
  archive: Archive,
  command: Command,
  repeat: Repeat,
  image: Image,
  upload: Upload,
  wand2: Wand2,
  magic: Wand2,
  
  // AI/Agent icons
  bot: Bot,
  robot: Bot,
};

/**
 * FontAwesome to Lucide mapping
 * Maps common FontAwesome icon names to Lucide equivalents
 */
const FA_TO_LUCIDE_MAP: Record<string, string> = {
  // Trigger icons
  "play-circle": "play",
  bolt: "zap",
  flash: "zap",
  clock: "calendar",
  "clock-o": "calendar",

  // Action icons
  globe: "globe",
  envelope: "mail",
  "paper-plane": "send",
  database: "database",
  refresh: "refresh-cw",

  // Transform icons
  code: "code",
  "file-alt": "file-text",
  cog: "settings",
  sliders: "settings",
  terminal: "terminal",

  // Logic icons
  "code-branch": "git-branch",
  random: "shuffle",
  "exchange-alt": "shuffle",

  // Communication icons
  "phone-alt": "phone",
  link: "external-link",
  "external-link-alt": "external-link",
  comment: "message-circle",
  comments: "message-square",

  // Utility icons
  "exclamation-circle": "alert-circle",
  "check-circle": "check-circle",
  archive: "archive",
  repeat: "repeat",
  image: "image",
  upload: "upload",
  magic: "magic",
};

/**
 * Parse icon string and return the appropriate icon component or SVG path
 *
 * @param iconString - Icon identifier (e.g., "lucide:play", "fa:globe", "svg:openai", "file:postgres.svg", "⚡", "H")
 * @param nodeType - Optional node type for fallback logic and file: icon resolution
 * @param nodeGroup - Optional node group array for category-based icons
 * @param nodeCategory - Optional node category for better categorization
 * @returns Lucide icon component, SVG path string, or null
 */
export function getIconComponent(
  iconString?: string,
  nodeType?: string,
  nodeGroup?: string[],
  nodeCategory?: string
): IconType | null {
  // No icon string provided
  if (!iconString) {
    return getFallbackIcon(nodeType, nodeGroup, nodeCategory);
  }

  // Check for file: prefix (custom node SVG files from backend)
  if (iconString.startsWith("file:")) {
    if (!nodeType) {
      console.warn("file: icon requires nodeType parameter");
      return null;
    }
    // Return backend API endpoint for the node's icon
    return `${env.API_BASE_URL}/nodes/${nodeType}/icon`;
  }

  // Check for svg: prefix (custom SVG files)
  if (iconString.startsWith("svg:")) {
    const svgName = iconString.replace("svg:", "").toLowerCase();
    return SVG_ICON_REGISTRY[svgName] || null;
  }

  // Check for lucide: prefix
  if (iconString.startsWith("lucide:")) {
    const iconName = iconString.replace("lucide:", "").toLowerCase();
    return LUCIDE_ICON_REGISTRY[iconName] || null;
  }

  // Check for fa: prefix (FontAwesome)
  if (iconString.startsWith("fa:")) {
    const faIconName = iconString.replace("fa:", "").toLowerCase();
    const lucideIconName = FA_TO_LUCIDE_MAP[faIconName];
    return lucideIconName ? LUCIDE_ICON_REGISTRY[lucideIconName] : null;
  }

  // If it's just a single character or emoji, return null (will be rendered as text)
  if (iconString.length <= 2) {
    return null;
  }

  // Try direct lookup (in case it's just the icon name)
  const normalizedName = iconString.toLowerCase().replace(/_/g, "-");
  return LUCIDE_ICON_REGISTRY[normalizedName] || null;
}

/**
 * Get fallback icon based on node type and group
 */
function getFallbackIcon(
  nodeType?: string,
  nodeGroup?: string[],
  nodeCategory?: string
): LucideIcon | null {
  if (!nodeType && !nodeGroup) {
    return Command; // Default fallback
  }

  // Check nodeCategory (all trigger nodes have this now)
  const isTrigger = nodeCategory === "trigger";
  
  if (isTrigger) {
    // Trigger-specific fallback based on type
    if (nodeType) {
      const lowerType = nodeType.toLowerCase();
      if (lowerType.includes("manual")) return Play;
      if (lowerType.includes("webhook")) return Webhook;
      if (lowerType.includes("schedule") || lowerType.includes("cron"))
        return Calendar;
      if (lowerType.includes("chat")) return MessageCircle;
      if (lowerType.includes("workflow")) return ExternalLink;
    }
    return Zap; // Default trigger icon
  }

  // Check other node groups
  if (nodeGroup) {
    if (nodeGroup.includes("transform")) return Zap;
    if (nodeGroup.includes("logic")) return GitBranch;
    if (nodeGroup.includes("action")) return Send;
  }

  // Check node type keywords
  if (nodeType) {
    const lowerType = nodeType.toLowerCase();
    if (lowerType.includes("http") || lowerType.includes("request"))
      return Globe;
    if (lowerType.includes("json") || lowerType.includes("code")) return Code;
    if (lowerType.includes("database") || lowerType.includes("db"))
      return Database;
    if (lowerType.includes("mail") || lowerType.includes("email")) return Mail;
    if (lowerType.includes("set")) return Settings;
    if (lowerType.includes("if") || lowerType.includes("switch"))
      return GitBranch;
  }

  return Command; // Final fallback
}

/**
 * Check if an icon string will render as a Lucide component
 */
export function hasLucideIcon(iconString?: string): boolean {
  if (!iconString) return false;

  if (iconString.startsWith("lucide:")) {
    const iconName = iconString.replace("lucide:", "").toLowerCase();
    return iconName in LUCIDE_ICON_REGISTRY;
  }

  if (iconString.startsWith("fa:")) {
    const faIconName = iconString.replace("fa:", "").toLowerCase();
    const lucideIconName = FA_TO_LUCIDE_MAP[faIconName];
    return lucideIconName ? lucideIconName in LUCIDE_ICON_REGISTRY : false;
  }

  const normalizedName = iconString.toLowerCase().replace(/_/g, "-");
  return normalizedName in LUCIDE_ICON_REGISTRY;
}

/**
 * Check if an icon string is an emoji or text character
 */
export function isTextIcon(iconString?: string): boolean {
  if (!iconString) return false;
  return (
    iconString.length <= 2 &&
    !hasLucideIcon(iconString) &&
    !isSvgIcon(iconString)
  );
}

/**
 * Check if an icon string is a custom SVG
 */
export function isSvgIcon(iconString?: string): boolean {
  if (!iconString) return false;

  // file: icons are SVG files served from backend
  if (iconString.startsWith("file:")) {
    return true;
  }

  if (iconString.startsWith("svg:")) {
    const svgName = iconString.replace("svg:", "").toLowerCase();
    return svgName in SVG_ICON_REGISTRY;
  }

  return false;
}

/**
 * Get SVG path if the icon is a custom SVG
 */
export function getSvgPath(iconString?: string): string | null {
  if (!iconString || !iconString.startsWith("svg:")) return null;

  const svgName = iconString.replace("svg:", "").toLowerCase();
  return SVG_ICON_REGISTRY[svgName] || null;
}

/**
 * Get all available Lucide icon names
 */
export function getAvailableIconNames(): string[] {
  return Object.keys(LUCIDE_ICON_REGISTRY).sort();
}

/**
 * Register a custom Lucide icon mapping
 */
export function registerIcon(name: string, component: LucideIcon): void {
  LUCIDE_ICON_REGISTRY[name.toLowerCase().replace(/_/g, "-")] = component;
}

/**
 * Register a custom SVG icon
 */
export function registerSvgIcon(name: string, svgPath: string): void {
  SVG_ICON_REGISTRY[name.toLowerCase().replace(/_/g, "-")] = svgPath;
}
