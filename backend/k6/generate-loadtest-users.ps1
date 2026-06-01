param(
    [int]$Count = 200,
    [string]$Output = "users.local.json"
)

$ErrorActionPreference = "Stop"

if ($Count -lt 1) {
    throw "Count must be greater than zero."
}

$users = 1..$Count | ForEach-Object {
    [pscustomobject]@{
        email = "loadtest.customer{0:D3}@ecommerce.local" -f $_
        password = "Customer@123"
    }
}

$users | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $Output -Encoding UTF8
Write-Host "Generated $Count K6 login users at $Output"
