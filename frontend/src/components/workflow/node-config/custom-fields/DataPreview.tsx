import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Terminal, Code, Table, FileText, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface DataPreviewProps {
  value?: string; // The data to preview
  onChange?: (value: string) => void;
  disabled?: boolean;
  // Component props from node definition
  dataField?: string;
  formatField?: string;
  maxLinesField?: string;
  timestampField?: string;
  collapseField?: string;
  // Access to other field values
  nodeParameters?: Record<string, any>;
}

export function DataPreview({
  value,
  disabled = false,
  nodeParameters = {},
}: DataPreviewProps) {
  const [preview, setPreview] = useState<string>("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lineCount, setLineCount] = useState(0);

  // Get configuration from node parameters
  const dataInput = nodeParameters?.dataInput || value || "";
  const format = nodeParameters?.previewFormat || "json";
  const maxLines = nodeParameters?.maxLines || 100;
  const showTimestamp = nodeParameters?.showTimestamp ?? true;

  useEffect(() => {
    generatePreview();
  }, [dataInput, format, maxLines]);

  const generatePreview = () => {
    if (!dataInput || dataInput.trim() === "") {
      setPreview("// No data to preview\n// Use {{json}} to reference input data");
      setLineCount(2);
      return;
    }

    try {
      let dataToPreview: any;
      
      // Try to parse if it looks like JSON
      if (dataInput.trim().startsWith("{") || dataInput.trim().startsWith("[")) {
        try {
          dataToPreview = JSON.parse(dataInput);
        } catch {
          dataToPreview = dataInput;
        }
      } else {
        dataToPreview = dataInput;
      }

      let formattedData: string;

      switch (format) {
        case "json":
          formattedData = JSON.stringify(dataToPreview, null, 2);
          break;
        
        case "json-compact":
          formattedData = JSON.stringify(dataToPreview);
          break;
        
        case "text":
          formattedData = typeof dataToPreview === "string" 
            ? dataToPreview 
            : String(dataToPreview);
          break;
        
        case "table":
          formattedData = formatAsTable(dataToPreview);
          break;
        
        default:
          formattedData = JSON.stringify(dataToPreview, null, 2);
      }

      const lines = formattedData.split("\n");
      const count = lines.length;

      if (count > maxLines) {
        formattedData = lines.slice(0, maxLines).join("\n") + 
          `\n\n... (${count - maxLines} more lines truncated)`;
        setLineCount(maxLines);
      } else {
        setLineCount(count);
      }

      setPreview(formattedData);
    } catch (error) {
      setPreview(`Error generating preview: ${error instanceof Error ? error.message : "Unknown error"}`);
      setLineCount(1);
    }
  };

  const formatAsTable = (data: any): string => {
    if (!Array.isArray(data)) {
      return "Table format requires an array of objects";
    }

    if (data.length === 0) {
      return "Empty array";
    }

    const keys = Array.from(
      new Set(data.flatMap(item => 
        typeof item === "object" && item !== null ? Object.keys(item) : []
      ))
    );

    if (keys.length === 0) {
      return "No object properties to display";
    }

    const columnWidths: { [key: string]: number } = {};
    keys.forEach(key => {
      columnWidths[key] = Math.max(
        key.length,
        ...data.map(item => {
          const value = item?.[key];
          return String(value ?? "").length;
        })
      );
      columnWidths[key] = Math.min(columnWidths[key], 30);
    });

    const lines: string[] = [];
    const separator = "+" + keys.map(key => "-".repeat(columnWidths[key] + 2)).join("+") + "+";
    
    lines.push(separator);
    lines.push(
      "| " + 
      keys.map(key => key.padEnd(columnWidths[key])).join(" | ") + 
      " |"
    );
    lines.push(separator);

    data.forEach(item => {
      const row = keys.map(key => {
        const value = item?.[key];
        let strValue = String(value ?? "");
        if (strValue.length > 30) {
          strValue = strValue.substring(0, 27) + "...";
        }
        return strValue.padEnd(columnWidths[key]);
      });
      lines.push("| " + row.join(" | ") + " |");
    });

    lines.push(separator);
    return lines.join("\n");
  };

  const getFormatIcon = () => {
    switch (format) {
      case "json":
      case "json-compact":
        return <Code className="w-3 h-3" />;
      case "table":
        return <Table className="w-3 h-3" />;
      case "text":
        return <FileText className="w-3 h-3" />;
      default:
        return <Terminal className="w-3 h-3" />;
    }
  };

  const getFormatLabel = () => {
    switch (format) {
      case "json":
        return "JSON (Pretty)";
      case "json-compact":
        return "JSON (Compact)";
      case "table":
        return "Table";
      case "text":
        return "Text";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="space-y-2">
      {/* Terminal-like Preview */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        {/* Terminal Header */}
        <div className="bg-gray-800 text-white px-3 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-3 h-3" />
            <span className="text-xs font-medium">Live Preview</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-xs h-5">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={generatePreview}
              disabled={disabled}
              className="h-5 w-5 p-0 hover:bg-gray-700"
              title="Refresh preview"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Terminal Content */}
        <div className="bg-gray-900 text-gray-100">
          <ScrollArea className="h-64 w-full">
            <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
              {preview || "// Waiting for data..."}
            </pre>
          </ScrollArea>
        </div>

        {/* Terminal Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs">
            {getFormatIcon()}
            <span className="text-gray-600">Format:</span>
            <span className="text-gray-900 font-medium">{getFormatLabel()}</span>
          </div>
          {showTimestamp && (
            <span className="text-xs text-gray-500">
              {new Date().toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Collapsible Details */}
      <details open={!isCollapsed} className="border rounded-lg">
        <summary 
          className="cursor-pointer p-2 bg-muted/30 hover:bg-muted/50 transition-colors text-xs font-medium"
          onClick={(e) => {
            e.preventDefault();
            setIsCollapsed(!isCollapsed);
          }}
        >
          Preview Settings
        </summary>
        {!isCollapsed && (
          <div className="p-3 border-t text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Max Lines:</span>
              <span className="text-gray-900 font-medium">{maxLines}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Show Timestamp:</span>
              <span className="text-gray-900 font-medium">{showTimestamp ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Data Length:</span>
              <span className="text-gray-900 font-medium">{dataInput.length} chars</span>
            </div>
          </div>
        )}
      </details>
    </div>
  );
}
