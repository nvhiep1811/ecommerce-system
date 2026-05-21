param(
    [ValidateSet("smoke", "local", "flash-1k", "flash-5k", "flash-10k")]
    [string]$Profile = "smoke",
    [switch]$Docker
)

$ErrorActionPreference = "Stop"

$env:PROFILE = $Profile

if (-not $env:BASE_URL -and $Docker) {
    $env:BASE_URL = "http://host.docker.internal:8080/api"
}

if (-not $env:BASE_URL) {
    $env:BASE_URL = "http://localhost:8080/api"
}

if (-not (Test-Path -LiteralPath "results")) {
    New-Item -ItemType Directory -Path "results" | Out-Null
}

if ($Docker) {
    $workdir = (Get-Location).Path
    docker run --rm `
        -e PROFILE `
        -e BASE_URL `
        -e CAMPAIGN_ID `
        -e ITEM_ID `
        -e CLAIM_PATH `
        -e PRELOAD `
        -e PRELOAD_STOCK `
        -e PRELOAD_PER_USER_LIMIT `
        -e ADMIN_TOKEN `
        -e ADMIN_EMAIL `
        -e ADMIN_PASSWORD `
        -e ACCESS_TOKEN `
        -e TOKENS `
        -e LOGIN_EMAIL `
        -e LOGIN_PASSWORD `
        -e LOGIN_USERS `
        -e USERS_FILE `
        -e QUANTITY `
        -e SLEEP_MS `
        -e REQUEST_TIMEOUT `
        -e SUMMARY_PATH `
        -v "${workdir}:/scripts" `
        -w /scripts `
        grafana/k6:latest run flash-sale-claim.js
    exit $LASTEXITCODE
}

k6 run flash-sale-claim.js
