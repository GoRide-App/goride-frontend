[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('smoke', 'load', 'stress', 'spike')]
    [string]$Profile,
    [string]$BaseUrl,
    [string]$JMeterHome
)

$ErrorActionPreference = 'Stop'
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    throw 'Python 3 is missing. Install Python 3 and add it to PATH.'
}
& $python.Source -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)'
if ($LASTEXITCODE -ne 0) {
    throw 'Python 3.9 or newer is required.'
}
$runnerArgs = @((Join-Path $PSScriptRoot 'run_load.py'), '-Profile', $Profile)
if ($BaseUrl) { $runnerArgs += @('-BaseUrl', $BaseUrl) }
if ($JMeterHome) { $runnerArgs += @('-JMeterHome', $JMeterHome) }
# Java and JMeter print warnings on stderr; under 'Stop' Windows PowerShell would treat them as
# fatal, so the runner's own exit code decides the result instead.
$ErrorActionPreference = 'Continue'
& $python.Source @runnerArgs
exit $LASTEXITCODE
