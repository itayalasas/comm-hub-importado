$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputDir = Join-Path $scriptDir "output"
$renderedHtmlPath = Join-Path $outputDir "rendered.html"
$pdfPath = Join-Path $outputDir "gotenberg-output.pdf"
$base64Path = Join-Path $outputDir "gotenberg-output.base64.txt"
$resultJsonPath = Join-Path $outputDir "gotenberg-result.json"
$containerName = "gotenberg-poc"
$gotenbergUrl = "http://127.0.0.1:3000"
$gotenbergHealthUrl = "$gotenbergUrl/health"

if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

Write-Host "[poc] Rendering HTML from sample template..."
node (Join-Path $scriptDir "render-template.mjs") | Out-Host

if (-not (Test-Path $renderedHtmlPath)) {
  throw "Rendered HTML file was not created: $renderedHtmlPath"
}

$containerId = docker ps -aq -f "name=^${containerName}$"
if (-not $containerId) {
  Write-Host "[poc] Starting Gotenberg container..."
  docker run -d --rm -p 3000:3000 --name $containerName gotenberg/gotenberg:8 | Out-Host
} else {
  $isRunning = docker inspect -f "{{.State.Running}}" $containerName
  if ($isRunning -ne "true") {
    Write-Host "[poc] Starting existing Gotenberg container..."
    docker start $containerName | Out-Host
  } else {
    Write-Host "[poc] Reusing running Gotenberg container..."
  }
}

Write-Host "[poc] Waiting for Gotenberg to become healthy..."
$attempt = 0
do {
  Start-Sleep -Seconds 2
  $attempt++
  try {
    curl.exe --silent --fail --output NUL "$gotenbergHealthUrl"
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
    } else {
      $ready = $false
    }
  } catch {
    $ready = $false
  }
} while (-not $ready -and $attempt -lt 40)

if (-not $ready) {
  throw "Gotenberg did not become ready at $gotenbergHealthUrl"
}

Write-Host "[poc] Sending rendered HTML to Gotenberg..."
if (Test-Path $pdfPath) {
  Remove-Item $pdfPath -Force
}

curl.exe --silent --show-error `
  --request POST `
  --url "$gotenbergUrl/forms/chromium/convert/html" `
  --header "Gotenberg-Output-Filename: gotenberg-output" `
  --form "files=@$renderedHtmlPath;filename=index.html" `
  --output "$pdfPath"

if (-not (Test-Path $pdfPath)) {
  throw "PDF output was not created: $pdfPath"
}

$pdfBytes = [System.IO.File]::ReadAllBytes($pdfPath)
$base64 = [System.Convert]::ToBase64String($pdfBytes)
[System.IO.File]::WriteAllText($base64Path, $base64)

$result = [ordered]@{
  generated_at = (Get-Date).ToString("o")
  renderer = "Gotenberg (Chromium)"
  rendered_html_path = $renderedHtmlPath
  pdf_path = $pdfPath
  pdf_size_bytes = $pdfBytes.Length
  pdf_base64_path = $base64Path
  pdf_base64_length = $base64.Length
  pdf_base64_prefix = $base64.Substring(0, [Math]::Min(60, $base64.Length))
}

$result | ConvertTo-Json -Depth 5 | Set-Content $resultJsonPath

Write-Host "[poc] Done."
Write-Host "[poc] PDF: $pdfPath"
Write-Host "[poc] Base64: $base64Path"
Write-Host "[poc] Summary: $resultJsonPath"
