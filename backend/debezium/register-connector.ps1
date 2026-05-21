param(
    [string] $ConnectUrl = "http://localhost:8084",
    [string] $ConnectorName = "ecommerce-outbox-postgres",
    [string] $ConfigPath = "$PSScriptRoot/ecommerce-outbox-postgres.connector.local.json"
)

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Connector config not found. Copy backend/debezium/ecommerce-outbox-postgres.connector.example.json to backend/debezium/ecommerce-outbox-postgres.connector.local.json and fill database credentials first."
}

$resolvedConfigPath = Resolve-Path -LiteralPath $ConfigPath
$uri = "$ConnectUrl/connectors/$ConnectorName/config"

Write-Host "Registering Debezium connector '$ConnectorName' at $uri"
Invoke-RestMethod `
    -Method Put `
    -Uri $uri `
    -ContentType "application/json" `
    -InFile $resolvedConfigPath

Write-Host "Connector registered. Check status at $ConnectUrl/connectors/$ConnectorName/status"
