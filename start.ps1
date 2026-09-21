<#
 One command to run everything after a fresh clone on Windows (PowerShell 5+):

   .\start.ps1                 first run installs Python + Node dependencies, then starts API and web app
   .\start.ps1 -Seed           also create 4 demo temples with 2 days of history
   .\start.ps1 -Prod           production build of the web app
   .\start.ps1 -InstallOnly    prepare environments and exit

 If scripts are blocked:  powershell -ExecutionPolicy Bypass -File .\start.ps1
 (Written to mirror start.sh; the Linux script is the one that has been tested.)
#>
param([switch]$Seed, [switch]$ResetDemo, [switch]$Prod, [switch]$NoFrontend, [switch]$InstallOnly,
      [int]$BackendPort = 8000, [int]$FrontendPort = 3000, [string]$HostName = "127.0.0.1")
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$Root = $PSScriptRoot
$ApiUrl = if ($env:NEXT_PUBLIC_API_URL) { $env:NEXT_PUBLIC_API_URL } else { "http://127.0.0.1:$BackendPort" }
function Log($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Die($m) { Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }
function UrlOk($u) { try { Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 3 | Out-Null; $true } catch { $false } }

$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py) { $py = (Get-Command py -ErrorAction SilentlyContinue).Source }
if (-not $py) { Die "Python 3.10+ is required (https://www.python.org/downloads/)." }
if (-not $NoFrontend) {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Die "Node.js 18+ is required (https://nodejs.org/)." }
  if ((node -p "process.versions.node.split('.')[0]") -lt 18) { Die "Node.js 18+ is required." }
}

Log "Backend: Python environment"
Set-Location "$Root\backend"
if (-not (Test-Path ".venv")) { & $py -m venv .venv }
$venvPy = "$Root\backend\.venv\Scripts\python.exe"
$stamp = ".venv\.requirements.sha"
$want = (Get-FileHash requirements.txt -Algorithm SHA256).Hash
if (-not (Test-Path $stamp) -or (Get-Content $stamp) -ne $want) {
  Log "Installing Python packages (first run takes a few minutes)"
  & $venvPy -m pip install --upgrade pip -q
  if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { & $venvPy -m pip install -q -r requirements.txt }
  else {
    $torch = (Select-String -Path requirements.txt -Pattern '^torch==').Line
    $tv = (Select-String -Path requirements.txt -Pattern '^torchvision==').Line
    & $venvPy -m pip install -q $torch $tv --index-url https://download.pytorch.org/whl/cpu
    Get-Content requirements.txt | Where-Object { $_ -notmatch '^(torch|torchvision)==' } | Set-Content .venv\requirements.notorch.txt
    & $venvPy -m pip install -q -r .venv\requirements.notorch.txt
  }
  Set-Content $stamp $want
}

if (-not $NoFrontend) {
  Log "Frontend: Node packages"
  Set-Location "$Root\client"
  if (-not (Test-Path node_modules)) { npm install --no-audit --no-fund }
}
if ($InstallOnly) { Log "Environments ready. Run .\start.ps1 to launch."; exit 0 }

New-Item -ItemType Directory -Force "$Root\logs" | Out-Null
Log "Starting API on http://${HostName}:$BackendPort"
$api = Start-Process -FilePath $venvPy -ArgumentList "-m","uvicorn","main:app","--host",$HostName,"--port",$BackendPort `
  -WorkingDirectory "$Root\backend" -RedirectStandardOutput "$Root\logs\backend.log" -RedirectStandardError "$Root\logs\backend.err.log" -PassThru -WindowStyle Hidden
$procs = @($api)
try {
  for ($i = 0; $i -lt 120 -and -not (UrlOk "http://127.0.0.1:$BackendPort/health"); $i++) { if ($api.HasExited) { Die "The API stopped (see logs\backend.err.log)." }; Start-Sleep 1 }
  if (-not (UrlOk "http://127.0.0.1:$BackendPort/health")) { Die "The API did not answer in time." }
  if ($Seed -or $ResetDemo) { Log "Seeding demo temples"; $a = @("scripts\seed_demo.py"); if ($ResetDemo) { $a += "--reset" }; Push-Location "$Root\backend"; & $venvPy @a; Pop-Location }

  if (-not $NoFrontend) {
    Set-Location "$Root\client"
    $env:NEXT_PUBLIC_API_URL = $ApiUrl
    if ($Prod) { Log "Building the web app"; npm run build *> "$Root\logs\frontend-build.log"; if ($LASTEXITCODE) { Die "Build failed (logs\frontend-build.log)." } }
    $script = if ($Prod) { "start" } else { "dev" }
    Log "Starting the web app on http://${HostName}:$FrontendPort"
    $web = Start-Process -FilePath "npm.cmd" -ArgumentList "run",$script,"--","-p",$FrontendPort,"-H",$HostName -WorkingDirectory "$Root\client" `
      -RedirectStandardOutput "$Root\logs\frontend.log" -RedirectStandardError "$Root\logs\frontend.err.log" -PassThru -WindowStyle Hidden
    $procs += $web
    for ($i = 0; $i -lt 120 -and -not (UrlOk "http://127.0.0.1:$FrontendPort/"); $i++) { Start-Sleep 1 }
    Write-Host "  Web app : http://localhost:$FrontendPort" -ForegroundColor Green
  }
  Write-Host "  API     : http://localhost:$BackendPort/docs" -ForegroundColor Green
  Write-Host "  Press Ctrl-C to stop everything."
  while ($true) { Start-Sleep 5 }
} finally {
  foreach ($p in $procs) { if ($p -and -not $p.HasExited) { taskkill /PID $p.Id /T /F | Out-Null } }
}
