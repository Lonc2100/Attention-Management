$ErrorActionPreference = 'Stop'

$version = '0.13.2'
$expectedSha256 = 'A067FA765678A411991826C4DA811FD2D8CA260C2DB9D6D897957565B61C369F'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot 'runtime'
$archive = Join-Path $runtimeDir "activitywatch-v$version-windows-x86_64.zip"
$destination = Join-Path $runtimeDir 'activitywatch'
$server = Join-Path $destination 'activitywatch\aw-server-rust\aw-server-rust.exe'
$url = "https://github.com/ActivityWatch/activitywatch/releases/download/v$version/activitywatch-v$version-windows-x86_64.zip"

if (Test-Path -LiteralPath $server) {
    Write-Host "ActivityWatch v$version runtime is already ready."
    exit 0
}

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
if (-not (Test-Path -LiteralPath $archive)) {
    Write-Host "Downloading ActivityWatch v$version..."
    Invoke-WebRequest -Uri $url -OutFile $archive
}

$actualSha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
if ($actualSha256 -ne $expectedSha256) {
    throw "ActivityWatch archive checksum mismatch. Expected $expectedSha256, got $actualSha256."
}

Write-Host 'Extracting verified ActivityWatch runtime...'
Expand-Archive -LiteralPath $archive -DestinationPath $destination

if (-not (Test-Path -LiteralPath $server)) {
    throw "ActivityWatch runtime extraction did not produce $server"
}

Write-Host "ActivityWatch v$version runtime is ready."
