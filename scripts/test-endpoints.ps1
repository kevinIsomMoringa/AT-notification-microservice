# Live endpoint checks (requires a running server on localhost:3000)
#
# Primary automated suite:
#   npm test
#
# Full local gate:
#   npm run test:all
#
# Optional live smoke test against a running dev/prod instance:
#   npm run test:live

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ApiKey = "change-me-to-a-strong-secret"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$payloadDir = Join-Path $scriptDir "payloads"

function Test-Endpoint {
  param(
    [string]$Name,
    [string]$Method = "GET",
    [string]$Path,
    [hashtable]$Headers = @{},
    [string]$Body = $null,
    [string]$BodyFile = $null,
    [int[]]$ExpectedStatus
  )

  $url = "$BaseUrl$Path"
  $args = @("-s", "-w", "`nHTTP %{http_code}`n", "-X", $Method, $url)
  foreach ($h in $Headers.GetEnumerator()) {
    $args += @("-H", "$($h.Key): $($h.Value)")
  }
  if ($BodyFile) {
    $args += @("--data-binary", "@$BodyFile")
  } elseif ($null -ne $Body) {
    $args += @("-d", $Body)
  }

  Write-Host "`n=== $Name ==="
  $output = & curl.exe @args
  Write-Host $output

  $lines = $output -split "`n"
  $statusLine = $lines | Where-Object { $_ -match "^HTTP " } | Select-Object -Last 1
  if (-not $statusLine) {
    throw "${Name}: no HTTP status line in response"
  }
  $status = [int]($statusLine -replace "^HTTP ", "")
  if ($ExpectedStatus -notcontains $status) {
    throw "${Name}: expected $($ExpectedStatus -join ' or '), got $status"
  }
  Write-Host "PASS ($status)"
}

New-Item -ItemType Directory -Force -Path $payloadDir | Out-Null
@'
{"channel":"sms","to":"+254712345678","message":"Live endpoint test SMS"}
'@ | Set-Content -Encoding UTF8 (Join-Path $payloadDir "sms.json")
@'
{"channel":"email","to":"test@example.com","subject":"Test","message":"Live endpoint test email"}
'@ | Set-Content -Encoding UTF8 (Join-Path $payloadDir "email.json")
@'
{"channel":"whatsapp","to":"+254712345678","message":"Live endpoint test whatsapp"}
'@ | Set-Content -Encoding UTF8 (Join-Path $payloadDir "whatsapp.json")
@'
{"channel":"sms","to":"bad-phone","message":"test"}
'@ | Set-Content -Encoding UTF8 (Join-Path $payloadDir "invalid.json")

Test-Endpoint -Name "GET /health" -Path "/health" -ExpectedStatus @(200)
Test-Endpoint -Name "GET /ready" -Path "/ready" -ExpectedStatus @(200)
Test-Endpoint -Name "GET /metrics" -Path "/metrics" -ExpectedStatus @(200)
Test-Endpoint -Name "GET /openapi.json" -Path "/openapi.json" -ExpectedStatus @(200)
Test-Endpoint -Name "GET /docs (Swagger UI)" -Path "/docs/" -ExpectedStatus @(200)
Test-Endpoint -Name "GET /diagnostics/log" -Path "/diagnostics/log?limit=1" -ExpectedStatus @(200)
Test-Endpoint -Name "GET unknown route" -Path "/does-not-exist" -ExpectedStatus @(404)
Test-Endpoint -Name "POST missing auth" -Method POST -Path "/api/v1/notifications" -Headers @{"Content-Type"="application/json"} -BodyFile (Join-Path $payloadDir "sms.json") -ExpectedStatus @(401)
Test-Endpoint -Name "POST bad api key" -Method POST -Path "/api/v1/notifications" -Headers @{"Content-Type"="application/json"; "x-api-key"="wrong"} -BodyFile (Join-Path $payloadDir "sms.json") -ExpectedStatus @(401)
Test-Endpoint -Name "POST invalid payload" -Method POST -Path "/api/v1/notifications" -Headers @{"Content-Type"="application/json"; "x-api-key"=$ApiKey} -BodyFile (Join-Path $payloadDir "invalid.json") -ExpectedStatus @(400)
Test-Endpoint -Name "POST invalid JSON" -Method POST -Path "/api/v1/notifications" -Headers @{"Content-Type"="application/json"; "x-api-key"=$ApiKey} -Body "{bad json" -ExpectedStatus @(400)
Test-Endpoint -Name "POST SMS" -Method POST -Path "/api/v1/notifications" -Headers @{"Content-Type"="application/json"; "x-api-key"=$ApiKey} -BodyFile (Join-Path $payloadDir "sms.json") -ExpectedStatus @(202)
Test-Endpoint -Name "POST email" -Method POST -Path "/api/v1/notifications" -Headers @{"Content-Type"="application/json"; "x-api-key"=$ApiKey} -BodyFile (Join-Path $payloadDir "email.json") -ExpectedStatus @(202)
Test-Endpoint -Name "POST whatsapp" -Method POST -Path "/api/v1/notifications" -Headers @{"Content-Type"="application/json"; "x-api-key"=$ApiKey} -BodyFile (Join-Path $payloadDir "whatsapp.json") -ExpectedStatus @(202)

Write-Host "`nAll live endpoint checks passed."
