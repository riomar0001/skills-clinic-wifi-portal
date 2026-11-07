#Requires -Version 7
# Manage Wi-Fi logins.
#   .\users.ps1 list
#   .\users.ps1 add ana        (asks for the password)
#   .\users.ps1 remove ana
param(
    [Parameter(Mandatory)][ValidateSet('list', 'add', 'remove')][string]$Action,
    [string]$Name,
    [securestring]$Password
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$image = 'freeradius/freeradius-server:3.2.8'
$usersFile = Join-Path $PSScriptRoot 'data\users'
$linePattern = '^(?<name>[a-z0-9][a-z0-9._-]{0,31})\s+NT-Password\s'

if (-not (Test-Path $usersFile)) { throw "No user list at $usersFile. Run .\setup.ps1 first." }
$lines = @(Get-Content -Path $usersFile)
$names = @($lines | ForEach-Object { if ($_ -match $linePattern) { $Matches.name } })

if ($Action -eq 'list') {
    if ($names.Count -eq 0) { Write-Host 'No users yet.'; return }
    $names | Sort-Object
    return
}

# Usernames are case-sensitive at login, so only lowercase is allowed to avoid confusion.
if ($Name -notmatch '^[a-z0-9][a-z0-9._-]{0,31}$') {
    throw 'Name must be 1-32 characters: lowercase letters, digits, dot, dash or underscore.'
}

function Save-Users([string[]]$newLines) {
    # Write to a temp file in the same folder, then swap it in, so a crash never leaves half a file.
    $tmp = "$usersFile.tmp"
    ($newLines -join "`n") + "`n" | Set-Content -Path $tmp -NoNewline
    Move-Item -Path $tmp -Destination $usersFile -Force
    docker exec wifi-radius /reload-users.sh
}

if ($Action -eq 'remove') {
    if ($names -notcontains $Name) { throw "No user named '$Name'." }
    Save-Users @($lines | Where-Object { -not ($_ -match $linePattern -and $Matches.name -eq $Name) })
    Write-Host "Removed $Name. Devices already connected stay on until they reconnect."
    return
}

# add
if ($names -contains $Name) { throw "'$Name' already exists. Remove it first to change the password." }
if (-not $Password) { $Password = Read-Host "Password for $Name" -AsSecureString }
$plain = [Net.NetworkCredential]::new('', $Password).Password
if ($plain.Length -lt 8 -or $plain.Length -gt 64) { throw 'Password must be 8-64 characters.' }
if ($plain -notmatch '^[\x20-\x7E]+$') { throw 'Password may only use plain keyboard characters (no accents or emoji).' }

# Store only the NT hash (what PEAP needs), never the password itself. Sent via stdin, not the command line.
$out = $plain | docker run --rm -i --entrypoint sh $image -c 'IFS= read -r p; p=$(printf %s "$p" | tr -d "\r"); smbencrypt "$p" 2>/dev/null'
$plain = $null
$hash = ($out | Select-Object -Last 1) -split '\s+' | Where-Object { $_ } | Select-Object -Last 1
if ($hash -notmatch '^[0-9A-F]{32}$') { throw "Could not hash the password (got: $out)." }

Save-Users @($lines + "$Name NT-Password := 0x$hash")
Write-Host "Added $Name."
