param(
    [Parameter(Mandatory=$true)]
    [string] $Executable,
    [string] $ProjectsRoot = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$exe = (Resolve-Path $Executable).Path
if (-not (Test-Path (Join-Path $repoRoot "tools\studio_project\rpc_stdio.py"))) {
    throw "Zodiac source tree not found: $repoRoot"
}
$python = (Get-Command python.exe -ErrorAction Stop).Source

$env:ZODIAC_STUDIO_SOURCE_ROOT = $repoRoot
$env:ZODIAC_STUDIO_PYTHON = $python
if ($ProjectsRoot -ne "") {
    New-Item -ItemType Directory -Path $ProjectsRoot -Force | Out-Null
    $env:ZODIAC_STUDIO_PROJECTS = (Resolve-Path $ProjectsRoot).Path
}
Write-Host "Zodiac Studio P1 preview (non-production)" -ForegroundColor Cyan
Write-Host "Source: $repoRoot"
Write-Host "Runtime: $python"
Write-Host "Executable: $exe"
Push-Location $repoRoot
try {
    & $exe
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
