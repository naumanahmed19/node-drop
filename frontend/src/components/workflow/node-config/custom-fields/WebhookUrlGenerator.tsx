import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Copy, Globe, RefreshCw, TestTube } from "lucide-react";
import { useState } from "react";

interface WebhookUrlGeneratorProps {
  value?: string; // webhookId, formId, or chatId (UUID)
  onChange?: (value: string) => void;
  disabled?: boolean;
  webhookPath?: string; // Custom webhook path from webhookPath field
  mode?: "test" | "production";
  urlType?: "webhook" | "form" | "chat"; // NEW: Type of URL to generate
}

export function WebhookUrlGenerator({
  value,
  onChange,
  disabled = false,
  webhookPath = "",
  mode = "test",
  urlType = "webhook",
}: WebhookUrlGeneratorProps) {
  const [webhookId, setWebhookId] = useState<string>(value || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedTest, setCopiedTest] = useState(false);
  const [copiedProd, setCopiedProd] = useState(false);

  // Get base URLs from environment or use defaults
  const getBaseUrl = (environment: "test" | "production") => {
    if (urlType === "form") {
      // For forms, use frontend URL
      if (environment === "test") {
        return import.meta.env.VITE_APP_URL || "http://localhost:3000";
      } else {
        return import.meta.env.VITE_APP_PROD_URL || "https://your-domain.com";
      }
    } else if (urlType === "chat") {
      // For chats, use API URL (add /api if not present)
      if (environment === "test") {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
        return apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
      } else {
        const apiUrl = import.meta.env.VITE_API_PROD_URL || "https://your-domain.com";
        return apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
      }
    } else {
      // For webhooks, use same base URL for both test and production
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

  // Get widget script URLs
  /* const getWidgetScriptUrl = (environment: "test" | "production") => {
    const baseUrl = environment === "test" 
      ? (import.meta.env.VITE_APP_URL || "http://localhost:3000")
      : (import.meta.env.VITE_APP_PROD_URL || "https://your-domain.com");
    
    if (urlType === "chat") {
      return `${baseUrl}/widgets/chat/nd-chat-widget.umd.js`;
    } else if (urlType === "form") {
      return `${baseUrl}/widgets/form/nd-form-widget.umd.js`;
    } else {
      return `${baseUrl}/widgets/webhook/nd-webhook-widget.umd.js`;
    }
  }; */

  // Don't auto-generate UUID - let users decide if they want one

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
      const fallbackId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setWebhookId(fallbackId);
      if (onChange) {
        onChange(fallbackId);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Construct full webhook/form/chat URLs
  const constructWebhookUrl = (environment: "test" | "production") => {
    const baseUrl = getBaseUrl(environment);
    
    if (urlType === "form") {
      // Form URLs: http://localhost:3000/form/{formId}
      return `${baseUrl}/form/${webhookId}`;
    } else if (urlType === "chat") {
      // Chat URLs: http://localhost:4000/api/public/chats/{chatId}
      return `${baseUrl}/public/chats/${webhookId}`;
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

  const testWebhookUrl = constructWebhookUrl("test");
  const productionWebhookUrl = constructWebhookUrl("production");
  
  // Add ?test=true to test URL for visualization
  const testWebhookUrlWithVisualization = `${testWebhookUrl}?test=true`;

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
    <Tabs defaultValue={mode} className="w-full">
      <div className="space-y-3">
        {/* Label and Tabs in one row */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            {urlType === "form" ? "Public Form URL" : urlType === "chat" ? "Public Chat URL" : "Webhook URL"}
          </Label>
          <TabsList className="inline-flex h-9">
            <TabsTrigger value="test" className="text-xs" disabled={disabled}>
              <TestTube className="w-3 h-3 mr-1" />
              Test
            </TabsTrigger>
            <TabsTrigger value="production" className="text-xs" disabled={disabled}>
              <Globe className="w-3 h-3 mr-1" />
              Production
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Test URL Content */}
        <TabsContent value="test" className="mt-0 space-y-2">
          <div className="flex gap-2">
            <Input
              value={testWebhookUrlWithVisualization}
              readOnly
              disabled={disabled}
              className="font-mono text-xs h-9 bg-blue-50 border-blue-200"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(testWebhookUrlWithVisualization, "test")}
              disabled={disabled || (!webhookId && !webhookPath)}
              className="shrink-0 h-9 w-9 p-0"
              title="Copy test URL with visualization"
            >
              {copiedTest ? (
                <Check className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Production URL Content */}
        <TabsContent value="production" className="mt-0">
          <div className="flex gap-2">
            <Input
              value={productionWebhookUrl}
              readOnly
              disabled={disabled}
              className="font-mono text-xs h-9 bg-green-50 border-green-200"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(productionWebhookUrl, "production")}
              disabled={disabled || (!webhookId && !webhookPath)}
              className="shrink-0 h-9 w-9 p-0"
            >
              {copiedProd ? (
                <Check className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Webhook/Form/Chat ID Display */}
        <div className="flex gap-1.5 items-end">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1">
              {urlType === "form" ? "Form ID" : urlType === "chat" ? "Chat ID" : "Webhook ID (optional)"}
            </Label>
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
              placeholder="Auto-generated UUID (can be removed)"
              className="font-mono text-xs h-8"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generateWebhookId}
            disabled={disabled || isGenerating}
            className="shrink-0 h-8 w-8 p-0"
            title="Generate random UUID"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {/* Show info when custom path is used */}
        {urlType === "webhook" && webhookPath?.trim() && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Path: <span className="font-mono font-medium">{webhookPath.trim().replace(/^\/+/, "")}</span>
            </p>
            {webhookPath.includes(':') && (
              <p className="text-xs text-muted-foreground">
                💡 Parameters will be available in the workflow output (e.g., <span className="font-mono">params.userId</span>)
              </p>
            )}
          </div>
        )}
      </div>
    </Tabs>
  );
}
