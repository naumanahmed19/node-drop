# PowerShell script to test webhook CORS
# Run with: .\test-webhook-cors.ps1

$webhookUrl = "http://localhost:4000/webhook/255e5ffb-3a41-4eb1-9c1a-832f3bc87216/users/?test=true"

Write-Host "🧪 Testing Webhook CORS Behavior" -ForegroundColor Cyan
Write-Host ""
Write-Host "Webhook URL: $webhookUrl"
Write-Host "Allowed Origin: https://example.com"
Write-Host ""

# Test 1: No Origin Header
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "Test 1: No Origin Header" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "Expected: ✅ Success (no CORS check applies)"
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $webhookUrl
    Write-Host "✅ Status: Success" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Allowed Origin
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "Test 2: With Allowed Origin (https://example.com)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "Expected: ✅ Success"
Write-Host ""

try {
    $headers = @{
        "Origin" = "https://example.com"
    }
    $response = Invoke-WebRequest -Uri $webhookUrl -Headers $headers
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "CORS Header: $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Disallowed Origin
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "Test 3: With Disallowed Origin (https://evil.com)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "Expected: ❌ 403 Forbidden"
Write-Host ""

try {
    $headers = @{
        "Origin" = "https://evil.com"
    }
    $response = Invoke-WebRequest -Uri $webhookUrl -Headers $headers
    Write-Host "❌ Should have been blocked! Status: $($response.StatusCode)" -ForegroundColor Red
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 403 -or $statusCode -eq 405) {
        Write-Host "✅ Correctly blocked! Status: $statusCode" -ForegroundColor Green
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response:" -ForegroundColor Green
            $responseBody | ConvertFrom-Json | ConvertTo-Json -Depth 3
        } catch {
            Write-Host "Response: $($_.Exception.Message)"
        }
    } else {
        Write-Host "❌ Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# Summary
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ CORS only applies to requests WITH Origin header"
Write-Host "✅ Direct browser navigation has NO Origin header"
Write-Host "✅ PowerShell without -Headers has NO Origin header"
Write-Host "✅ Browser fetch/XHR automatically adds Origin header"
Write-Host ""
Write-Host "📝 This is standard CORS behavior!" -ForegroundColor Green
