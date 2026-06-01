param(
    [string]$Bucket = $(if ($env:S3_BUCKET) { $env:S3_BUCKET } else { "ecommerce-prod-media-4ss-2026" }),
    [string]$Prefix = $(if ($env:S3_SEED_PREFIX) { $env:S3_SEED_PREFIX.Trim("/") } else { "seed" }),
    [string]$Region = $(if ($env:S3_REGION) { $env:S3_REGION } else { "ap-southeast-1" }),
    [string]$CdnBaseUrl = $(if ($env:CDN_BASE_URL) { $env:CDN_BASE_URL.TrimEnd("/") } else { "https://d35ci4s1xmcpe.cloudfront.net" }),
    [string]$SeedImageRoot = $(Join-Path $PSScriptRoot "seed-images")
)

$ErrorActionPreference = "Stop"

function Get-ContentType([string]$path) {
    switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
        ".jpg" { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".png" { return "image/png" }
        ".webp" { return "image/webp" }
        default { return "application/octet-stream" }
    }
}

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "AWS CLI is required. Install AWS CLI v2 or run this script in an environment that already has it."
}

if (-not (Test-Path $SeedImageRoot)) {
    throw "Seed image directory not found: $SeedImageRoot"
}

$root = (Resolve-Path $SeedImageRoot).Path
$rootPrefix = $root.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
$files = Get-ChildItem -Path $root -Recurse -File |
    Where-Object { $_.Extension.ToLowerInvariant() -in @(".jpg", ".jpeg", ".png", ".webp") }

if (-not $files) {
    throw "No seed images found under $root"
}

foreach ($file in $files) {
    $relativePath = $file.FullName.Substring($rootPrefix.Length).Replace("\", "/")
    $s3Key = (($Prefix, $relativePath) -join "/").Trim("/")
    $contentType = Get-ContentType $file.FullName

    Write-Host "Uploading $relativePath -> s3://$Bucket/$s3Key"
    aws s3 cp $file.FullName "s3://$Bucket/$s3Key" `
        --region $Region `
        --content-type $contentType `
        --cache-control "public, max-age=31536000, immutable" | Out-Host

    if ($LASTEXITCODE -ne 0) {
        throw "Upload failed for $relativePath"
    }
}

Write-Host "Done. Public base URL: $CdnBaseUrl/$Prefix/"
