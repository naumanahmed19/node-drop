import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Copy, Globe, TestTube, Sparkles, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface UrlGeneratorProps {
  value?: string; // webhookId, formPath, or chatId (UUID or path string)
  onChange?: (value: string) => void;
  disabled?: boolean;
  webhookPath?: string; // Custom webhook path from webhookPath field (only for webhook type)
  mode?: "test" | "production";
  urlType?: "webhook" | "form" | "chat"; // Type of URL to generate
  nodeId?: string; // Node ID for expression context
}

export function UrlGenerator({
  value,
  onChange,
  disabled = false,
  webhookPath = "",
  mode = "test",
  urlType = "webhook",
}: UrlGeneratorProps) {
  const [webhookId, setWebhookId] = useState<string>(() => {
    // For forms, don't auto-generate - let user provide the path
    if (urlType === "form") {
      return value || "";
    }
    
    // Auto-generate UUID on mount if no value provided (for webhooks and chats)
    if (!value) {
      try {
        return crypto.randomUUID();
      } catch (error) {
        console.error("Error generating webhook ID:", error);
        return `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      }
    }
    return value;
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedTest, setCopiedTest] = useState(false);
  const [copiedProd, setCopiedProd] = useState(false);
  const [activeTab, setActiveTab] = useState<"test" | "production">(mode);

  // Notify parent of auto-generated ID (skip for forms)
  useEffect(() => {
    if (urlType !== "form" && !value && webhookId && onChange) {
      onChange(webhookId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Get base URLs from environment or use defaults
  // All webhook-based triggers now use /webhook prefix for consistency
  const getBaseUrl = () => {
    if (urlType === "form") {
      // For forms, use frontend URL for the user-facing page
      return import.meta.env.VITE_APP_URL || "http://localhost:3000";
    } else if (urlType === "chat") {
      // For chats, use backend /webhook/chats
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const baseUrl = apiUrl.replace(/\/api$/, '');
      return `${baseUrl}/webhook/chats`;
    } else {
      // For webhooks, use /webhook prefix
      if (import.meta.env.VITE_WEBHOOK_URL) {
        return import.meta.env.VITE_WEBHOOK_URL;
      }
      
      // Build from API URL
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
      // Remove /api if present, then add /webhook
      const baseUrl = apiUrl.replace(/\/api$/, '');
      return `${baseUrl}/webhook`;
    }
  };

  const generateWebhookId = async () => {
    setIsGenerating(true);
    try {
      // Generate a unique webhook ID (UUID v4)
      const newWebhookId = crypto.randomUUID();
      setWebhookId(newWebhookId);
      
      // Notify parent component
      if (onChange) {
        onChange(newWebhookId);
      }
    } catch (error) {
      console.error("Error generating webhook ID:", error);
      // Fallback to simple ID generation
      const fallbackId = `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      setWebhookId(fallbackId);
      if (onChange) {
        onChange(fallbackId);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Construct full webhook/form/chat URLs
  const constructWebhookUrl = () => {
    const baseUrl = getBaseUrl();
    
    if (urlType === "form") {
      // Form URLs: http://localhost:3000/form/{formPath} (frontend page)
      // Use the value directly as the form path
      const formPath = webhookId?.trim().replace(/^\/+/, "") || "";
      return formPath ? `${baseUrl}/form/${formPath}` : baseUrl;
    } else if (urlType === "chat") {
      // Chat URLs: http://localhost:4000/webhook/chats/{chatId}
      return `${baseUrl}/${webhookId}`;
    } else {
      // Webhook URLs: [uuid/]path (uuid is optional)
      const cleanPath = webhookPath?.trim().replace(/^\/+/, "") || "";
      const cleanId = webhookId?.trim() || "";
      
      if (cleanId && cleanPath) {
        // Both ID and path: uuid/path
        return `${baseUrl}/${cleanId}/${cleanPath}`;
      } else if (cleanId) {
        // Only ID: uuid
        return `${baseUrl}/${cleanId}`;
      } else if (cleanPath) {
        // Only path: path
        return `${baseUrl}/${cleanPath}`;
      } else {
        // Neither: just base URL
        return baseUrl;
      }
    }
  };

  // Construct backend API URL for forms (for developers)
  const constructFormApiUrl = () => {
    if (urlType !== "form") return null;
    
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    const baseUrl = apiUrl.replace(/\/api$/, '');
    const formPath = webhookId?.trim().replace(/^\/+/, "") || "";
    
    return formPath ? `${baseUrl}/webhook/forms/${formPath}` : null;
  };

  const webhookUrl = constructWebhookUrl();
  const testWebhookUrlWithVisualization = `${webhookUrl}?test=true`;
  const formApiUrl = constructFormApiUrl();
  const formApiTestUrl = formApiUrl ? `${formApiUrl}?test=true` : null;

  // Copy to clipboard function
  const copyToClipboard = async (text: string, type: "test" | "production") => {
    try {
      await navigator.clipboard.writeText(text);
      
      if (type === "test") {
        setCopiedTest(true);
        setTimeout(() => setCopiedTest(false), 2000);
      } else {
        setCopiedProd(true);
        setTimeout(() => setCopiedProd(false), 2000);
      }
    } catch (error) {
      console.error("Failed to copy:", error);
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      
      if (type === "test") {
        setCopiedTest(true);
        setTimeout(() => setCopiedTest(false), 2000);
      } else {
        setCopiedProd(true);
        setTimeout(() => setCopiedProd(false), 2000);
      }
    }
  };

  return (
    <div className="w-full space-y-2.5">
      {/* Path Info Banner */}
      {urlType === "webhook" && webhookPath?.trim() && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-2">
          <div className="flex items-center gap-1.5 text-xs">
            <Info className="w-3 h-3 text-amber-600 dark:text-amber-500 shrink-0" />
            <span className="text-amber-900 dark:text-amber-100">Path:</span>
            <code className="font-mono font-medium bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded">
              {webhookPath.trim().replace(/^\/+/, "")}
            </code>
            {webhookPath.includes(':') && (
              <span className="text-amber-700 dark:text-amber-300 ml-1">
                → <code className="font-mono">params.*</code>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Unified URL Generator Card */}
      <div className="rounded-md border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            {urlType === "form" ? "Public Form URL" : urlType === "chat" ? "Public Chat URL" : "Webhook URL"}
          </Label>
          <div className="flex gap-0.5 bg-background rounded p-0.5 border">
            <button
              type="button"
              onClick={() => setActiveTab("test")}
              disabled={disabled}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                activeTab === "test"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TestTube className="w-2.5 h-2.5" />
              Test
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("production")}
              disabled={disabled}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                activeTab === "production"
                  ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Globe className="w-2.5 h-2.5" />
              Prod
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2.5">
          {/* ID/Path Configuration */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-muted-foreground">
                {urlType === "form" ? "Form Path" : urlType === "chat" ? "Chat ID" : "Webhook ID"}
                {urlType === "webhook" && <span className="text-muted-foreground/60"> (optional)</span>}
              </Label>
              {urlType !== "form" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generateWebhookId}
                  disabled={disabled || isGenerating}
                  className="h-5 px-2 gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                  title="Generate random UUID"
                >
                  <Sparkles className={cn("w-2.5 h-2.5", isGenerating && "animate-spin")} />
                  Generate
                </Button>
              )}
            </div>
            <Input
              value={webhookId}
              onChange={(e) => {
                const newId = e.target.value;
                setWebhookId(newId);
                if (onChange) {
                  onChange(newId);
                }
              }}
              disabled={disabled}
              placeholder={urlType === "form" ? "e.g., contact-us, feedback" : urlType === "chat" ? "Auto-generated UUID" : "Leave empty or enter custom ID"}
              className="font-mono text-xs h-8"
            />
          </div>

          {/* Divider */}
          <div className="border-t -mx-3" />

          {/* URL Display */}
          <div className="space-y-2">
            {activeTab === "test" ? (
              <>
                <div className="flex gap-1.5">
                  <div className="flex-1 relative">
                    <Input
                      value={testWebhookUrlWithVisualization}
                      readOnly
                      disabled={disabled}
                      className="font-mono text-[11px] h-8 pr-8 bg-blue-50/50 border-blue-200 dark:bg-blue-950/10 dark:border-blue-800"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(testWebhookUrlWithVisualization, "test")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                      title={copiedTest ? "Copied!" : "Copy URL"}
                    >
                      {copiedTest ? (
                        <Check className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Info className="w-2.5 h-2.5 shrink-0" />
                  Includes <code className="font-mono bg-muted px-1 rounded">?test=true</code> for debugging
                </p>
              </>
            ) : (
              <>
                <div className="flex gap-1.5">
                  <div className="flex-1 relative">
                    <Input
                      value={webhookUrl}
                      readOnly
                      disabled={disabled}
                      className="font-mono text-[11px] h-8 pr-8 bg-green-50/50 border-green-200 dark:bg-green-950/10 dark:border-green-800"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(webhookUrl, "production")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors cursor-pointer"
                      title={copiedProd ? "Copied!" : "Copy URL"}
                    >
                      {copiedProd ? (
                        <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-green-600 dark:text-green-400" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Info className="w-2.5 h-2.5 shrink-0" />
                  Ready for external use
                </p>
              </>
            )}
          </div>

          {/* Backend API URL for Forms */}
          {urlType === "form" && formApiUrl && (
            <>
              <div className="border-t -mx-3" />
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Backend API URL (for developers)
                </Label>
                <div className="flex gap-1.5">
                  <div className="flex-1 relative">
                    <Input
                      value={activeTab === "test" ? formApiTestUrl || "" : formApiUrl}
                      readOnly
                      disabled={disabled}
                      className="font-mono text-[11px] h-8 pr-8 bg-muted/50"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeTab === "test" ? formApiTestUrl || "" : formApiUrl, activeTab)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors cursor-pointer"
                      title="Copy API URL"
                    >
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Use this URL for direct API integration (GET to fetch config, POST to /submit)
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
