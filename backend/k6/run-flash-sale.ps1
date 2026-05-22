param(
    [ValidateSet("smoke", "claim-once", "local", "flash-1k", "flash-5k", "flash-10k")]
    [string]$Profile = "smoke",
    [switch]$Docker,
    [string]$BaseUrl,
    [string]$AuthBaseUrl,
    [string]$CampaignId,
    [string]$ItemId,
    [switch]$Preload,
    [switch]$PreloadResetProjection,
    [int]$PreloadStock,
    [int]$PreloadPerUserLimit,
    [string]$AdminEmail,
    [string]$AdminPassword,
    [string]$UsersFile,
    [switch]$LoginUsers,
    [int]$LoginUsersLimit,
    [int]$LoginDelayMs,
    [int]$Iterations,
    [int]$Vus,
    [string]$TokenPickStrategy,
    [switch]$UseSeededDemoCredentials
)

$ErrorActionPreference = "Stop"

$k6EnvNames = @(
    "PROFILE",
    "BASE_URL",
    "AUTH_BASE_URL",
    "AUTH_LOGIN_PATH",
    "CAMPAIGN_ID",
    "ITEM_ID",
    "CLAIM_PATH",
    "PRELOAD",
    "PRELOAD_RESET_PROJECTION",
    "PRELOAD_STOCK",
    "PRELOAD_PER_USER_LIMIT",
    "ADMIN_TOKEN",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
    "ACCESS_TOKEN",
    "TOKENS",
    "LOGIN_EMAIL",
    "LOGIN_PASSWORD",
    "LOGIN_USERS",
    "LOGIN_USERS_LIMIT",
    "LOGIN_DELAY_MS",
    "ITERATIONS",
    "VUS",
    "TOKEN_PICK_STRATEGY",
    "USERS_FILE",
    "QUANTITY",
    "SLEEP_MS",
    "REQUEST_TIMEOUT",
    "SUMMARY_PATH"
)

$env:PROFILE = $Profile

if ($BaseUrl) {
    $env:BASE_URL = $BaseUrl
}

if ($AuthBaseUrl) {
    $env:AUTH_BASE_URL = $AuthBaseUrl
}

if ($CampaignId) {
    $env:CAMPAIGN_ID = $CampaignId
}

if ($ItemId) {
    $env:ITEM_ID = $ItemId
}

if ($Preload) {
    $env:PRELOAD = "true"
}

if ($PreloadResetProjection) {
    $env:PRELOAD_RESET_PROJECTION = "true"
}

if ($PreloadStock -gt 0) {
    $env:PRELOAD_STOCK = [string]$PreloadStock
}

if ($PreloadPerUserLimit -gt 0) {
    $env:PRELOAD_PER_USER_LIMIT = [string]$PreloadPerUserLimit
}

if ($AdminEmail) {
    $env:ADMIN_EMAIL = $AdminEmail
}

if ($AdminPassword) {
    $env:ADMIN_PASSWORD = $AdminPassword
}

if ($UsersFile) {
    $env:USERS_FILE = $UsersFile
}

if ($LoginUsers) {
    $env:LOGIN_USERS = "true"
}

if ($LoginUsersLimit -gt 0) {
    $env:LOGIN_USERS_LIMIT = [string]$LoginUsersLimit
}

if ($LoginDelayMs -gt 0) {
    $env:LOGIN_DELAY_MS = [string]$LoginDelayMs
}

if ($Iterations -gt 0) {
    $env:ITERATIONS = [string]$Iterations
}

if ($Vus -gt 0) {
    $env:VUS = [string]$Vus
}

if ($TokenPickStrategy) {
    $env:TOKEN_PICK_STRATEGY = $TokenPickStrategy
}

if ($UseSeededDemoCredentials) {
    if (-not $env:AUTH_BASE_URL) {
        $env:AUTH_BASE_URL = if ($Docker) { "http://host.docker.internal:8081" } else { "http://localhost:8081" }
    }
    if (-not $env:ADMIN_EMAIL) {
        $env:ADMIN_EMAIL = "admin@ecommerce.local"
    }
    if (-not $env:ADMIN_PASSWORD) {
        $env:ADMIN_PASSWORD = "Admin@123"
    }
    if ($Profile -eq "smoke" -and -not $env:ACCESS_TOKEN -and -not $env:TOKENS -and -not $env:LOGIN_EMAIL -and -not $env:LOGIN_USERS) {
        $env:LOGIN_EMAIL = "loadtest.customer001@ecommerce.local"
        $env:LOGIN_PASSWORD = "Customer@123"
    } elseif (-not $env:LOGIN_USERS -and -not $env:ACCESS_TOKEN -and -not $env:TOKENS -and -not $env:LOGIN_EMAIL) {
        $env:LOGIN_USERS = "true"
    }
    if (-not $env:USERS_FILE) {
        $env:USERS_FILE = "./users.local.json"
    }
}

if (-not $env:BASE_URL -and $Docker) {
    $env:BASE_URL = "http://host.docker.internal:8080/api"
}

if (-not $env:BASE_URL) {
    $env:BASE_URL = "http://localhost:8080/api"
}

if (-not (Test-Path -LiteralPath "results")) {
    New-Item -ItemType Directory -Path "results" | Out-Null
}

if ($env:PRELOAD -eq "true" -and -not $env:ADMIN_TOKEN -and (-not $env:ADMIN_EMAIL -or -not $env:ADMIN_PASSWORD)) {
    throw "PRELOAD=true requires ADMIN_TOKEN or ADMIN_EMAIL/ADMIN_PASSWORD. For seeded local data, run with -UseSeededDemoCredentials."
}

if ($env:LOGIN_USERS -eq "true" -and $env:USERS_FILE -and -not (Test-Path -LiteralPath $env:USERS_FILE)) {
    throw "USERS_FILE '$env:USERS_FILE' does not exist. Run .\generate-loadtest-users.ps1 -Count 200 -Output users.local.json first."
}

if ($Docker) {
    $workdir = (Get-Location).Path
    docker run --rm `
        -e PROFILE `
        -e BASE_URL `
        -e AUTH_BASE_URL `
        -e AUTH_LOGIN_PATH `
        -e CAMPAIGN_ID `
        -e ITEM_ID `
        -e CLAIM_PATH `
        -e PRELOAD `
        -e PRELOAD_RESET_PROJECTION `
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
        -e LOGIN_USERS_LIMIT `
        -e LOGIN_DELAY_MS `
        -e ITERATIONS `
        -e VUS `
        -e TOKEN_PICK_STRATEGY `
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

$k6Args = @("run")
foreach ($name in $k6EnvNames) {
    $value = [Environment]::GetEnvironmentVariable($name, "Process")
    if ($value) {
        $k6Args += @("-e", "$name=$value")
    }
}
$k6Args += "flash-sale-claim.js"

k6 @k6Args
