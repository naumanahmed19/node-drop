# PowerShell script to update all built-in nodes from 'nodeId' to 'nodeType'

$nodeDirs = Get-ChildItem -Path "backend/src/nodes" -Directory

$filesUpdated = 0

foreach ($dir in $nodeDirs) {
    $nodeFiles = Get-ChildItem -Path $dir.FullName -Filter "*.node.ts" -File
    
    foreach ($file in $nodeFiles) {
        $content = Get-Content $file.FullName -Raw
        $originalContent = $content
        
        # Replace 'nodeId:' with 'nodeType:' at the start of node definition
        # This regex looks for 'nodeId:' followed by a string literal at the beginning of an object
        $content = $content -replace '(?m)^(\s*)nodeId:\s*([''"`])([^''"`]+)\2,?\s*$', '$1nodeType: $2$3$2,'
        
        if ($content -ne $originalContent) {
            Set-Content -Path $file.FullName -Value $content -NoNewline
            Write-Host "Updated: $($file.FullName)" -ForegroundColor Green
            $filesUpdated++
        }
    }
}

Write-Host "`nUpdated $filesUpdated built-in node files" -ForegroundColor Cyan
