# Run on a fresh Windows runner after electron-builder. Never use a developer's app data.
$ErrorActionPreference = 'Stop'
$stage = 'Locate Windows installer'
try {
  $version = node -p "require('./package.json').version"
  $expected = 'Nedenmis-Studio-{0}-Setup.exe' -f $version
  $setups = @(Get-ChildItem -LiteralPath 'dist/installer' -File -Filter '*Setup.exe')
  if ($setups.Count -ne 1 -or $setups[0].Name -cne $expected) {
    throw "Expected $expected; found: $($setups.Name -join ', ')"
  }

  $stage = 'Silent NSIS install'
  # electron-builder's NSIS /D parser accepts this single, space-free argument.
  # Do not infer the .exe location from WSH shortcut metadata, which can be empty.
  $target = Join-Path $env:RUNNER_TEMP 'StudioInstall'
  $install = Start-Process -FilePath $setups[0].FullName -ArgumentList "/S /D=$target" -Wait -PassThru
  if ($install.ExitCode -ne 0) { throw "Installer exit code: $($install.ExitCode)" }

  $stage = 'Launch installed app'
  $app = Get-Item -LiteralPath (Join-Path $target 'Nedenmiş Studio.exe')
  $reportFile = Join-Path $env:TEMP 'Nedenmis-install-report.json'
  if (Test-Path -LiteralPath $reportFile) { Remove-Item -LiteralPath $reportFile }
  # A present executable that cannot open DevTools. Require fallback to real Edge/Chrome
  # from the installed app, with neither a development cwd nor a browser cache in it.
  $env:STUDIO_BROWSER = Join-Path $env:SystemRoot 'System32/where.exe'
  $cwd = New-Item -ItemType Directory -Force -Path (Join-Path $env:RUNNER_TEMP 'Boş çalışma dizini')
  $process = Start-Process -FilePath $app.FullName -WorkingDirectory $cwd.FullName -ArgumentList '--verify-install' -PassThru
  if (!$process.WaitForExit(120000)) { $process.Kill(); throw 'Installed app timed out' }

  $stage = 'Verify installed Remotion browser'
  $rawReport = Get-Content -LiteralPath $reportFile -Raw
  Write-Output $rawReport
  if ($process.ExitCode -ne 0) { throw "Installed app exit code $($process.ExitCode): $rawReport" }
  $report = $rawReport | ConvertFrom-Json
  if (!$report.secureStorage -or !$report.plannerSecureStorage) { throw 'Provider credential isolation not verified' }
  if ($report.fixedMotionStage.actors -ne 2 -or $report.fixedMotionStage.objects -ne 5) { throw 'Packaged flat SVG object scene not verified' }
  $remotion = $report.checks | Where-Object id -eq 'remotion'
  if (!$report.installed -or !$remotion.ok -or $remotion.detail -notmatch '(msedge|chrome|chromium)\.exe$') {
    throw "Expected a connected system browser: $rawReport"
  }
  Copy-Item -LiteralPath $reportFile -Destination 'out/render-control/install-report.json'
  $exeHash = (Get-FileHash -LiteralPath $setups[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  Write-Output "::notice title=Verified Windows installer::${expected} (SHA-256: $exeHash); $($remotion.detail)"
} catch {
  $detail = $_.Exception.Message -replace '[\r\n]+', ' '
  Write-Output "::error title=${stage}::${detail}"
  throw
}
