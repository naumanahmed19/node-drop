# Fix: Revert 'identifier:' back to 'type:' in NodeProperty definitions
# This script only fixes property type definitions, not node identifiers

Get-ChildItem "backend/src/nodes" -Recurse -Filter "*.node.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $original = $content
    
    # Revert 'identifier:' back to 'type:' in property definitions
    # This regex looks for property definitions in the properties array
    $content = $content -replace '(\s+)(identifier):\s*"(string|number|boolean|options|multiOptions|json|dateTime|collection|credential|custom|conditionRow|columnsMap|autocomplete)"', '$1type: "$3"'
    
    if ($content -ne $original) {
        Set-Content $_.FullName -Value $content -NoNewline
        Write-Host "Fixed: $($_.Name)" -ForegroundColor Green
    }
}

Write-Host "`nProperty types fixed!" -ForegroundColor Cyan
