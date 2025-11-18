# PowerShell script to update all built-in nodes from 'type' to 'nodeId'

$nodeDirs = @(
    "backend/src/nodes/Anthropic",
    "backend/src/nodes/Chat",
    "backend/src/nodes/Code",
    "backend/src/nodes/CustomTemplate",
    "backend/src/nodes/DataPreview",
    "backend/src/nodes/DynamicProperties",
    "backend/src/nodes/GoogleSheetsTrigger",
    "backend/src/nodes/HttpRequest",
    "backend/src/nodes/IfElse",
    "backend/src/nodes/Ifxxxxxx",
    "backend/src/nodes/ImagePreview",
    "backend/src/nodes/Json",
    "backend/src/nodes/Loop",
    "backend/src/nodes/ManualTrigger",
    "backend/src/nodes/Merge",
    "backend/src/nodes/OpenAI",
    "backend/src/nodes/ScheduleTrigger",
    "backend/src/nodes/Set",
    "backend/src/nodes/Split",
    "backend/src/nodes/Switch",
    "backend/src/nodes/TestUpload",
    "backend/src/nodes/WebhookTrigger",
    "backend/src/nodes/WorkflowCalled",
    "backend/src/nodes/WorkflowTrigger"
)

$filesUpdated = 0

foreach ($dir in $nodeDirs) {
    $nodeFiles = Get-ChildItem -Path $dir -Filter "*.node.ts" -File
    
    foreach ($file in $nodeFiles) {
        $content = Get-Content $file.FullName -Raw
        $originalContent = $content
        
        # Replace 'type:' with 'nodeId:' at the start of node definition
        # This regex looks for 'type:' followed by a string literal at the beginning of an object
        $content = $content -replace '(?m)^(\s*)type:\s*([''"`])([^''"`]+)\2,?\s*$', '$1nodeId: $2$3$2,'
        
        if ($content -ne $originalContent) {
            Set-Content -Path $file.FullName -Value $content -NoNewline
            Write-Host "Updated: $($file.FullName)" -ForegroundColor Green
            $filesUpdated++
        }
    }
}

Write-Host "`nUpdated $filesUpdated built-in node files" -ForegroundColor Cyan
