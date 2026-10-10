param(
  [string]$Html = "C:\Users\saydu\StudioProjects\tent3d\tool\devtest\devtest.html",
  [int]$Budget = 25000
)
$ErrorActionPreference = "Stop"
$tmp = Join-Path $env:TEMP "tent3d-devtest"
if (-not (Test-Path $tmp)) { New-Item -ItemType Directory -Path $tmp | Out-Null }
$prof = Join-Path $tmp "prof-$([guid]::NewGuid().ToString('N').Substring(0,8))"
$out = Join-Path $tmp "dom.html"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$url = ([uri]$Html).AbsoluteUri

$args = @(
  "--headless=new",
  "--disable-gpu",
  "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--disable-background-networking",
  "--user-data-dir=$prof",
  "--virtual-time-budget=$Budget",
  "--dump-dom",
  $url
)
$p = Start-Process -FilePath $chrome -ArgumentList $args -NoNewWindow -PassThru -RedirectStandardOutput $out -RedirectStandardError (Join-Path $tmp "err.txt")
if (-not $p.WaitForExit(120000)) { $p.Kill(); Write-Output "TIMEOUT after 120s" }
$dom = Get-Content $out -Raw -ErrorAction SilentlyContinue
$m = [regex]::Match($dom, '(?s)<pre id="report">(.*?)</pre>')
if ($m.Success) {
  $m.Groups[1].Value -replace '&lt;', '<' -replace '&gt;', '>' -replace '&quot;', '"' -replace '&#39;', "'" -replace '&amp;', '&'
} else {
  Write-Output "NO REPORT FOUND (dom length = $($dom.Length))"
  Get-Content (Join-Path $tmp "err.txt") -Raw -ErrorAction SilentlyContinue | Select-Object -First 20
}
Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue