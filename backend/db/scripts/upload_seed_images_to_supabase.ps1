param(
    [string]$SupabaseUrl = "https://dglfcdxadwvvvhlqnkyp.supabase.co",
    [string]$Bucket = "product-images"
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$storageKey = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $storageKey) {
    $storageKey = $env:EXPO_PUBLIC_SUPABASE_ANON_KEY
}

if (-not $storageKey) {
    throw "Set SUPABASE_SERVICE_ROLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY before running this script."
}

function Get-ContentType([string]$path) {
    switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
        ".jpg" { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".png" { return "image/png" }
        ".webp" { return "image/webp" }
        default { return "application/octet-stream" }
    }
}

function Encode-ObjectPath([string]$objectPath) {
    return ($objectPath -split "/") | ForEach-Object { [System.Uri]::EscapeDataString($_) } | Join-String -Separator "/"
}

$uploads = @(
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/users/admin-avatar.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-asus-sat-canh-nhe-ganh-hoc-choi-slider.jpg"; object = "seed/users/seller-tech-avatar.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-laptop-van-phong-slider-t10.jpg"; object = "seed/users/seller-home-avatar.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-game-on-qua-ngon-back-to-school-2025-rog-x-tuf-gaming-slider.jpg"; object = "seed/users/chau-avatar.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/users/khang-avatar.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-asus-sat-canh-nhe-ganh-hoc-choi-slider.jpg"; object = "seed/users/mai-avatar.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/brands/apple-logo.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-asus-sat-canh-nhe-ganh-hoc-choi-slider.jpg"; object = "seed/brands/samsung-logo.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-laptop-van-phong-slider-t10.jpg"; object = "seed/brands/xiaomi-logo.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-laptop-van-phong-slider-t10.jpg"; object = "seed/brands/logitech-logo.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/brands/anker-logo.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-game-on-qua-ngon-back-to-school-2025-rog-x-tuf-gaming-slider.jpg"; object = "seed/brands/jbl-logo.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/brands/ecovacs-logo.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-game-on-qua-ngon-back-to-school-2025-rog-x-tuf-gaming-slider.jpg"; object = "seed/categories/electronics.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/categories/home-living.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-asus-sat-canh-nhe-ganh-hoc-choi-slider.jpg"; object = "seed/categories/smartphones.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-game-on-qua-ngon-back-to-school-2025-rog-x-tuf-gaming-slider.jpg"; object = "seed/categories/audio.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/categories/accessories.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/categories/smart-home.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-laptop-van-phong-slider-t10.jpg"; object = "seed/categories/desk-setup.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-asus-sat-canh-nhe-ganh-hoc-choi-slider.jpg"; object = "seed/products/iphone-15-thumbnail.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-asus-sat-canh-nhe-ganh-hoc-choi-slider.jpg"; object = "seed/products/iphone-15-front.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/iphone-15-back.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-game-on-qua-ngon-back-to-school-2025-rog-x-tuf-gaming-slider.jpg"; object = "seed/products/samsung-s24-thumbnail.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-game-on-qua-ngon-back-to-school-2025-rog-x-tuf-gaming-slider.jpg"; object = "seed/products/samsung-s24-front.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/samsung-s24-lifestyle.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/redmi-note-13-thumbnail.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/redmi-note-13-front.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/airpods-pro-2-thumbnail.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/airpods-pro-2-case.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-laptop-van-phong-slider-t10.jpg"; object = "seed/products/mx-master-3s-thumbnail.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-laptop-van-phong-slider-t10.jpg"; object = "seed/products/mx-master-3s-top.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/anker-65w-thumbnail.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/anker-65w-main.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-game-on-qua-ngon-back-to-school-2025-rog-x-tuf-gaming-slider.jpg"; object = "seed/products/jbl-flip-6-thumbnail.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-game-on-qua-ngon-back-to-school-2025-rog-x-tuf-gaming-slider.jpg"; object = "seed/products/jbl-flip-6-front.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/jbl-flip-6-outdoor.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/ecovacs-n8-thumbnail.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/ecovacs-n8-main.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/air-fryer-thumbnail.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/air-fryer-main.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/samsung-25w-thumbnail.jpg" },
    @{ source = "mobile-app/assets/images/header.jpg"; object = "seed/products/samsung-25w-main.jpg" },
    @{ source = "mobile-app/assets/images/gearvn-asus-sat-canh-nhe-ganh-hoc-choi-slider.jpg"; object = "seed/reviews/review-iphone-15.jpg" }
)

foreach ($item in $uploads) {
    $sourcePath = Join-Path $projectRoot $item.source
    if (-not (Test-Path $sourcePath)) {
        throw "Missing source image: $sourcePath"
    }

    $encodedPath = Encode-ObjectPath $item.object
    $uploadUrl = "$SupabaseUrl/storage/v1/object/$Bucket/$encodedPath"

    Write-Host "Uploading $($item.source) -> $($item.object)"
    Invoke-WebRequest `
        -Uri $uploadUrl `
        -Method Post `
        -Headers @{
            apikey = $storageKey
            Authorization = "Bearer $storageKey"
            "x-upsert" = "true"
        } `
        -ContentType (Get-ContentType $sourcePath) `
        -InFile $sourcePath | Out-Null
}

Write-Host "Done. Public base URL: $SupabaseUrl/storage/v1/object/public/$Bucket/seed/"
