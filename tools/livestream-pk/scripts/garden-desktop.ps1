param([switch]$CleanupOnly, [switch]$SelfTest)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent

function Test-GardenTestBrowser($process) {
    $tempRoot = [regex]::Escape([IO.Path]::GetTempPath().TrimEnd('\'))
    return $process.Name -eq 'chrome.exe' -and $process.CommandLine -match "--user-data-dir=`"?$tempRoot[\\/](garden-browser-smoke-out|garden-gift-stage-shots)[\\/]"
}

if ($SelfTest) {
    $profile = Join-Path ([IO.Path]::GetTempPath()) 'garden-browser-smoke-out\profile-overlay-desktop'
    if (!(Test-GardenTestBrowser @{Name='chrome.exe';CommandLine="chrome --user-data-dir=`"$profile`""})) { throw 'Missed isolated test browser' }
    foreach ($sample in @(
        @{Name='chrome.exe';CommandLine='chrome --user-data-dir=C:\Users\normal\profile'},
        @{Name='TikTok LIVE Studio.exe';CommandLine="--user-data-dir=$profile"},
        @{Name='chrome.exe';CommandLine="chrome --screenshot=$profile"},
        @{Name='chrome.exe';CommandLine="chrome --user-data-dir=${profile}-outside" -replace 'garden-browser-smoke-out\\','garden-browser-smoke-outside\'},
        @{Name='chrome.exe';CommandLine=$null}
    )) { if (Test-GardenTestBrowser $sample) { throw 'Unsafe browser cleanup selection' } }
    'PASS: cleanup selects only Chrome with an isolated Garden test profile.'
    exit 0
}

$mutex = New-Object Threading.Mutex($false, 'Local\ZodiacGardenDesktopLauncher')
if (!$mutex.WaitOne(0)) { Write-Host 'Garden launcher is already working.'; $mutex.Dispose(); exit 0 }
try {
    Set-Location -LiteralPath $repo
    Write-Host 'GARDEN LIVE - prepare resources' -ForegroundColor Cyan
    $targets = @(Get-CimInstance Win32_Process | Where-Object { Test-GardenTestBrowser $_ })
    foreach ($target in $targets) {
        try { Stop-Process -Id $target.ProcessId -ErrorAction Stop }
        catch { Write-Warning "Could not stop test Chrome PID $($target.ProcessId): $($_.Exception.Message)" }
    }
    Write-Host "Requested cleanup of $($targets.Count) isolated test Chrome processes."
    if ($CleanupOnly) { return }

    $node = (Get-Command node -ErrorAction Stop).Source
    $settings = & $node --env-file-if-exists=.env -e 'console.log(JSON.stringify({port:Number(process.env.PK_GARDEN_PORT||4858),share:Number(process.env.PK_GARDEN_SHARE_PORT||4859)}))'
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read Garden environment.' }
    $settings = $settings | ConvertFrom-Json
    $base = "http://127.0.0.1:$($settings.port)"
    $shareBase = "http://127.0.0.1:$($settings.share)"
    $logDir = Join-Path $repo 'logs\garden-desktop'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $status = $null
    try { $status = Invoke-RestMethod "$base/api/status" -TimeoutSec 3 } catch {}
    if (!$status) {
        if (Get-NetTCPConnection -LocalPort $settings.port -State Listen -ErrorAction SilentlyContinue) { throw "Port $($settings.port) is occupied by another service. Nothing was stopped." }
        if (Get-NetTCPConnection -LocalPort 4848 -State Listen -ErrorAction SilentlyContinue) { throw 'PK is running on 4848. Stop PK before starting another TikTok connector.' }
        $serverLog = Join-Path $logDir "$stamp-server"
        $server = Start-Process -FilePath $node -ArgumentList '--env-file-if-exists=.env','garden/server.mjs' -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput "$serverLog.out.log" -RedirectStandardError "$serverLog.err.log" -PassThru
        for ($i=0; $i -lt 20; $i++) {
            Start-Sleep -Milliseconds 500
            try { $status = Invoke-RestMethod "$base/api/status" -TimeoutSec 2; break } catch {}
            if ($server.HasExited) { break }
        }
        if (!$status) { throw "Garden did not start. Check $serverLog.err.log" }
    }
    if ($status.simulator -ne $false -or !$status.build -or !$status.camera) { throw 'This is not a LIVE Garden server. Keep existing process unchanged; stop Simulator manually first.' }
    if ($status.runtimeSourceChanged) { Write-Warning 'Garden code changed after startup. Restart deliberately after the current LIVE.' }
    Write-Host "Garden is running. TikTok state: $($status.tiktok.state)"
    $response = Invoke-WebRequest "$shareBase/" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -ne 200) { throw 'Read-only share port is unavailable.' }

    $originPattern = '--url\s+"?' + [regex]::Escape($shareBase) + '/?(?:"|\s|$)'
    $tunnels = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cloudflared.exe' -and $_.CommandLine -match $originPattern })
    if ($tunnels.Count) {
        Write-Host 'Existing Garden tunnel kept. Keep the current Link URL in Studio.' -ForegroundColor Green
    } else {
        $cloud = Get-Command cloudflared -ErrorAction SilentlyContinue
        $cloudExe = if ($cloud) { $cloud.Source } else {
            @(${env:ProgramFiles},${env:ProgramFiles(x86)}) | Where-Object { $_ } | ForEach-Object { Join-Path $_ 'cloudflared\cloudflared.exe' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        }
        if (!$cloudExe) { throw 'cloudflared is missing. Install it before sharing Garden.' }
        $tunnelLog = Join-Path $logDir "$stamp-tunnel"
        $tunnel = Start-Process -FilePath $cloudExe -ArgumentList 'tunnel','--no-autoupdate','--url',$shareBase -WindowStyle Hidden -RedirectStandardOutput "$tunnelLog.out.log" -RedirectStandardError "$tunnelLog.err.log" -PassThru
        $link = $null
        for ($i=0; $i -lt 45; $i++) {
            Start-Sleep -Seconds 1
            $text = (Get-Content "$tunnelLog.out.log","$tunnelLog.err.log" -Raw -ErrorAction SilentlyContinue) -join "`n"
            $match = [regex]::Match($text, 'https://[a-z0-9-]+\.trycloudflare\.com')
            if ($match.Success) { $link = $match.Value + '/?music=0.16&sfx=0.2'; break }
            if ($tunnel.HasExited) { break }
        }
        if (!$link) { throw "Tunnel did not provide a URL. Check $tunnelLog.err.log; Garden was left running." }
        Set-Content -LiteralPath (Join-Path $logDir 'last-link.txt') -Value $link -Encoding UTF8
        Write-Host "`nPaste this NEW Link into Studio:`n$link`n" -ForegroundColor Green
        try { Set-Clipboard -Value $link; Write-Host 'Link copied to clipboard.' } catch { Write-Warning 'Copy the Link above manually.' }
    }
    Write-Host "Control (open only when needed): $base/control"
    Write-Host 'Use one Studio Link source, 1080x1920, zoom 100%, one Garden audio source.'
    Write-Host 'No preview browser was opened. Background services keep running after this window closes.'
    Write-Host "Logs: $logDir"
} finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
