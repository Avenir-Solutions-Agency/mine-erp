# Registers the scale bridge as a Windows task that starts at every boot, without a sign-in,
# as the user who installs it (S4U: no stored password, limited rights), with no time limit.
# Not SYSTEM: the folder is user-writable, so SYSTEM would run whatever someone puts there. Started by telepites.cmd; asks for administrator rights itself.
param([string]$PortalDb, [string]$RunAs)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$task = 'MineERP Merleg-hid'

# The user and their portal.db are taken before elevation: an administrator who approves the
# prompt with other credentials would otherwise get the task.
if (-not $PortalDb) { $PortalDb = Join-Path $env:LOCALAPPDATA 'HidmerlegPortaprogram\portal.db' }
if (-not $RunAs) { $RunAs = [Security.Principal.WindowsIdentity]::GetCurrent().Name }
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Start-Process powershell -Verb RunAs -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-PortalDb', "`"$PortalDb`"", '-RunAs', "`"$RunAs`"")
  exit
}

try {
  if (-not (Test-Path $PortalDb)) { Write-Host "Figyelem: nem található a PORTAL AI adatbázis: $PortalDb" }
  Set-Content -Encoding ASCII -Path (Join-Path $here 'portal-db.cmd') -Value "set `"PORTAL_DB=$PortalDb`""
  Remove-Item -ErrorAction SilentlyContinue (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\mine-erp-merleg-hid.cmd')

  $start = Join-Path $here 'start.cmd'
  $log = Join-Path $here 'hid.log'
  $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"`"$start`" > `"$log`" 2>&1`""
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
  $principal = New-ScheduledTaskPrincipal -UserId $RunAs -LogonType S4U -RunLevel Limited
  Stop-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
  Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  Start-ScheduledTask -TaskName $task
  Write-Host "Kész. A mérleg-híd fut ($RunAs nevében), és a Windows minden indításakor magától elindul."
  Write-Host "Napló: $log"
} catch {
  Write-Host "A telepítés nem sikerült: $($_.Exception.Message)"
}
Read-Host 'Nyomj Entert a bezáráshoz'
