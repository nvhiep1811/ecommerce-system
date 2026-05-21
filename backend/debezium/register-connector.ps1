param(
    [string] $ConnectUrl = "http://localhost:8084",
    [string] $ConnectorName = "ecommerce-outbox-postgres",
    [string] $ConfigPath = "$PSScriptRoot/ecommerce-outbox-postgres.connector.local.json",
    [int] $ReadyTimeoutSeconds = 60
)

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Connector config not found. Copy backend/debezium/ecommerce-outbox-postgres.connector.example.json to backend/debezium/ecommerce-outbox-postgres.connector.local.json and fill database credentials first."
}

$resolvedConfigPath = Resolve-Path -LiteralPath $ConfigPath
$uri = "$ConnectUrl/connectors/$ConnectorName/config"
$configBody = Get-Content -Raw -LiteralPath $resolvedConfigPath

Write-Host "Waiting for Kafka Connect REST API at $ConnectUrl"
$deadline = (Get-Date).AddSeconds($ReadyTimeoutSeconds)
do {
    try {
        Invoke-RestMethod -Method Get -Uri "$ConnectUrl/connectors" -TimeoutSec 5 -ErrorAction Stop | Out-Null
        break
    } catch {
        if ((Get-Date) -ge $deadline) {
            throw "Kafka Connect REST API is not ready after $ReadyTimeoutSeconds seconds at $ConnectUrl"
        }
        Start-Sleep -Seconds 2
    }
} while ($true)

Write-Host "Registering Debezium connector '$ConnectorName' at $uri"
try {
    Invoke-RestMethod `
        -Method Put `
        -Uri $uri `
        -ContentType "application/json" `
        -Body $configBody `
        -ErrorAction Stop

    Write-Host "Connector registered. Check status at $ConnectUrl/connectors/$ConnectorName/status"
} catch {
    Write-Error "Failed to register Debezium connector. Check the connector config and Kafka Connect error message above."
    throw
}
