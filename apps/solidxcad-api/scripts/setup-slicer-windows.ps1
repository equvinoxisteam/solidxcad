# Install OrcaSlicer portable and write slicer profile for SolidX CAD API.
# Run from repo: powershell -File apps/solidxcad-api/scripts/setup-slicer-windows.ps1

$ErrorActionPreference = "Stop"
$installDir = Join-Path $env:LOCALAPPDATA "OrcaSlicer"
$version = "v2.3.2"
$zipUrl = "https://github.com/OrcaSlicer/OrcaSlicer/releases/download/$version/OrcaSlicer_Windows_V2.3.2_portable.zip"
$zipPath = Join-Path $env:TEMP "OrcaSlicer_Windows_V2.3.2_portable.zip"
$orcaExe = Join-Path $installDir "orca-slicer.exe"

if (-not (Test-Path $orcaExe)) {
  Write-Host "Downloading OrcaSlicer $version..."
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
  New-Item -ItemType Directory -Force -Path $installDir | Out-Null
  Expand-Archive -Path $zipPath -DestinationPath $installDir -Force
  Write-Host "Installed to $installDir"
} else {
  Write-Host "OrcaSlicer already at $orcaExe"
}

$profilesRoot = Join-Path $installDir "resources\profiles\Creality"
$process = Join-Path $profilesRoot "process\0.20mm Standard @Creality Ender3 0.4.json"
$filament = Join-Path $profilesRoot "filament\Creality Generic PLA.json"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiRoot = Split-Path -Parent $scriptDir
$machinePatch = Join-Path $apiRoot "config\orcaslicer-ender3-machine.json"
$configPath = Join-Path $apiRoot "config\orcaslicer-ender3-pla.json"

@'
{
  "type": "machine",
  "name": "Creality Ender-3 0.4 nozzle",
  "inherits": "Creality Ender-3 0.4 nozzle",
  "from": "User",
  "instantiation": "true",
  "before_layer_change_gcode": ";BEFORE_LAYER_CHANGE\n;[layer_z]\nG92 E0\n"
}
'@ | Set-Content -Path $machinePatch -Encoding UTF8

$profile = @{
  backend = "orcaslicer"
  native_config = $machinePatch
  native_settings = @($machinePatch, $process)
  native_filaments = @($filament)
  machine = @{
    name = "Creality Ender-3"
    bed_size_mm = @(220, 220)
    z_height_mm = 250
    motion_bounds_mm = @{
      x = @(0, 220)
      y = @(0, 220)
      z = @(0, 250)
    }
  }
  filament = @{
    type = "PLA"
    nozzle_temp_c = 220
    bed_temp_c = 60
  }
}

$profile | ConvertTo-Json -Depth 6 | Set-Content -Path $configPath -Encoding UTF8
Write-Host "Wrote profile: $configPath"

$envFile = Join-Path $apiRoot ".env"
if (Test-Path $envFile) {
  $content = Get-Content $envFile -Raw
  $orcaLine = "ORCASLICER_BIN=$($orcaExe -replace '\\','/')"
  $profileLine = "SLICER_PROFILE_PATH=$($configPath -replace '\\','/')"
  if ($content -match '(?m)^ORCASLICER_BIN=') {
    $content = $content -replace '(?m)^ORCASLICER_BIN=.*', $orcaLine
  } else {
    $content += "`n$orcaLine`n"
  }
  if ($content -match '(?m)^SLICER_PROFILE_PATH=') {
    $content = $content -replace '(?m)^SLICER_PROFILE_PATH=.*', $profileLine
  } else {
    $content += "$profileLine`n"
  }
  Set-Content -Path $envFile -Value $content.TrimEnd() -Encoding UTF8
  Write-Host "Updated $envFile"
}

Write-Host ""
Write-Host "Verify:"
Write-Host "  `$env:ORCASLICER_BIN = '$orcaExe'"
$python = Join-Path (Split-Path -Parent (Split-Path -Parent $apiRoot)) ".venv\Scripts\python.exe"
if (Test-Path $python) {
  & $python (Join-Path (Split-Path -Parent (Split-Path -Parent $apiRoot)) "skills\gcode\scripts\gcode_tool.py") discover
}
