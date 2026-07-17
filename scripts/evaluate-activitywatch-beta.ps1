param(
    [string]$EvidenceRoot = '.trellis\tasks\07-17-v0-7-2-collector-reliability\evidence\activitywatch-v0.14.0b1'
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path $EvidenceRoot
$base = Join-Path $root 'expanded\activitywatch'
$dbDirectory = Join-Path $root 'isolated-db'
New-Item -ItemType Directory -Force -Path $dbDirectory | Out-Null
$db = Join-Path $dbDirectory 'sqlite.db'
$server = Start-Process `
    -FilePath (Join-Path $base 'aw-server-rust\aw-server-rust.exe') `
    -ArgumentList @('--host', '127.0.0.1', '--port', '5601', "--dbpath=`"$db`"", '--no-legacy-import') `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $root 'server-stdout.log') `
    -RedirectStandardError (Join-Path $root 'server-stderr.log') `
    -PassThru
$windowWatcher = $null
$afkWatcher = $null

try {
    $ready = $false
    for ($index = 0; $index -lt 30; $index += 1) {
        try {
            $info = Invoke-RestMethod -Uri 'http://127.0.0.1:5601/api/0/info' -TimeoutSec 1
            $ready = $true
            break
        } catch {
            Start-Sleep -Milliseconds 250
        }
    }
    if (-not $ready) { throw 'beta server did not become ready' }

    $windowWatcher = Start-Process `
        -FilePath (Join-Path $base 'aw-watcher-window\aw-watcher-window.exe') `
        -ArgumentList @('--host', '127.0.0.1', '--port', '5601', '--poll-time', '1') `
        -WindowStyle Hidden -PassThru
    $afkWatcher = Start-Process `
        -FilePath (Join-Path $base 'aw-watcher-afk\aw-watcher-afk.exe') `
        -ArgumentList @('--host', '127.0.0.1', '--port', '5601', '--poll-time', '1') `
        -WindowStyle Hidden -PassThru
    Start-Sleep -Seconds 4

    $buckets = Invoke-RestMethod -Uri 'http://127.0.0.1:5601/api/0/buckets/' -TimeoutSec 3
    $windowBucket = $buckets.PSObject.Properties | Where-Object { $_.Value.type -eq 'currentwindow' } | Select-Object -First 1
    $afkBucket = $buckets.PSObject.Properties | Where-Object { $_.Value.type -eq 'afkstatus' } | Select-Object -First 1
    if (-not $windowBucket -or -not $afkBucket) { throw 'beta watchers did not create required buckets' }

    $day = Get-Date -Format 'yyyy-MM-dd'
    $start = [DateTimeOffset]::Parse("$day`T00:00:00+08:00").ToString('o')
    $end = [DateTimeOffset]::Parse("$day`T23:59:59+08:00").ToString('o')
    $query = @(
        "events = flood(query_bucket(`"$($windowBucket.Name)`"));",
        'observed_seconds = sum_durations(events);',
        "not_afk = flood(query_bucket(`"$($afkBucket.Name)`"));",
        'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
        'active_events = filter_period_intersect(events, not_afk);',
        'RETURN = {"activeSeconds": sum_durations(active_events), "observedSeconds": observed_seconds};'
    )
    $body = @{ query = $query; timeperiods = @("$start/$end") } | ConvertTo-Json -Depth 4
    $queryResult = Invoke-RestMethod `
        -Method Post `
        -Uri 'http://127.0.0.1:5601/api/0/query/' `
        -ContentType 'application/json' `
        -Body $body `
        -TimeoutSec 10

    [pscustomobject]@{
        Version = $info.version
        ServerReady = $ready
        WindowBucket = $windowBucket.Name
        WindowMetadata = ($windowBucket.Value | ConvertTo-Json -Compress)
        AfkBucket = $afkBucket.Name
        AfkMetadata = ($afkBucket.Value | ConvertTo-Json -Compress)
        QueryActiveSeconds = $queryResult.activeSeconds
        QueryObservedSeconds = $queryResult.observedSeconds
        WindowExited = $windowWatcher.HasExited
        AfkExited = $afkWatcher.HasExited
    } | ConvertTo-Json
} finally {
    if ($windowWatcher -and -not $windowWatcher.HasExited) { Stop-Process -Id $windowWatcher.Id -Force }
    if ($afkWatcher -and -not $afkWatcher.HasExited) { Stop-Process -Id $afkWatcher.Id -Force }
    if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}
