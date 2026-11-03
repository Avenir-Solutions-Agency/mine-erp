# Stops the scale bridge task and removes it. Asks for administrator rights itself.
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Start-Process powershell -Verb RunAs -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
  exit
}
Stop-ScheduledTask -TaskName 'MineERP Merleg-hid' -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'MineERP Merleg-hid' -Confirm:$false -ErrorAction SilentlyContinue
# Stopping the task does not always end node itself.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*portal.ts*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Write-Host 'A mérleg-híd leállítva, az automatikus indítás törölve.'
Read-Host 'Nyomj Entert a bezáráshoz'
