$ACCOUNT_ID="316544164613"
$REGION="ap-southeast-1"
$REGISTRY="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
$TAG="phase3"

$services = @(
  @{Name="api-gateway"; Repo="ecommerce-api-gateway"; Port="8080"},
  @{Name="user-service"; Repo="ecommerce-user-service"; Port="8081"},
  @{Name="catalog-service"; Repo="ecommerce-catalog-service"; Port="8082"},
  @{Name="commerce-service"; Repo="ecommerce-commerce-service"; Port="8083"},
  @{Name="assistant-service"; Repo="ecommerce-assistant-service"; Port="8084"},
  @{Name="chat-service"; Repo="ecommerce-chat-service"; Port="8086"}
)

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REGISTRY

foreach ($svc in $services) {
  $localImage="$($svc.Repo):$TAG"
  $remoteImage="$REGISTRY/$($svc.Repo):$TAG"

  Write-Host "Building $($svc.Name) on port $($svc.Port)..." -ForegroundColor Cyan

  docker build -f backend/Dockerfile `
    --build-arg SERVICE_NAME=$($svc.Name) `
    --build-arg APP_PORT=$($svc.Port) `
    -t $localImage .

  if ($LASTEXITCODE -ne 0) {
    throw "Docker build failed for $($svc.Name)"
  }

  docker tag $localImage $remoteImage
  docker push $remoteImage

  if ($LASTEXITCODE -ne 0) {
    throw "Docker push failed for $($svc.Name)"
  }

  Write-Host "Pushed $remoteImage" -ForegroundColor Green
}
