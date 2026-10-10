# TENT 3D :: make_icon.ps1
# Renders tool/icon/icon.html at every size with headless Chrome and packs the
# PNG frames into windows/runner/resources/app_icon.ico.
param(
  [int[]]$Sizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$html = Join-Path $PSScriptRoot 'icon.html'
$out = Join-Path $PSScriptRoot 'frames'
$ico = Join-Path $root 'windows\runner\resources\app_icon.ico'

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'Chrome not found' }

New-Item -ItemType Directory -Path $out -Force | Out-Null
$src = (Resolve-Path $html).Path -replace '\\', '/'

foreach ($s in $Sizes) {
  $png = Join-Path $out "icon_$s.png"
  $url = "file:///$src`?s=$s"
  # Chrome writes progress chatter to stderr, so keep the preference lenient here.
  $ErrorActionPreference = 'Continue'
  & $chrome --headless=new --disable-gpu --hide-scrollbars --log-level=3 `
    --force-device-scale-factor=1 --window-size="$s,$s" `
    --default-background-color=00000000 `
    --screenshot="$png" $url 2>&1 | Out-Null
  $ErrorActionPreference = 'Stop'
  if (-not (Test-Path $png)) { throw "frame $s not rendered" }
}

$frames = foreach ($s in $Sizes) {
  $png = Join-Path $out "icon_$s.png"
  [pscustomobject]@{ Size = $s; Bytes = [System.IO.File]::ReadAllBytes($png) }
}

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$frames.Count)
$offset = 6 + 16 * $frames.Count
foreach ($f in $frames) {
  $dim = if ($f.Size -ge 256) { 0 } else { $f.Size }
  $bw.Write([byte]$dim); $bw.Write([byte]$dim)
  $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([uint16]1); $bw.Write([uint16]32)
  $bw.Write([uint32]$f.Bytes.Length); $bw.Write([uint32]$offset)
  $offset += $f.Bytes.Length
}
foreach ($f in $frames) { $bw.Write($f.Bytes) }
$bw.Flush()
[System.IO.File]::WriteAllBytes($ico, $ms.ToArray())
Write-Output "wrote $ico ($($ms.Length) bytes, $($frames.Count) frames)"