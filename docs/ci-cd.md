# CI/CD Integration

This repository now includes both GitLab CI/CD and Jenkins pipeline definitions.

- GitLab: `.gitlab-ci.yml`
- Jenkins: `Jenkinsfile`
- Shared backend image build: `backend/Dockerfile`
- Admin web image build: `admin-web/Dockerfile`
- Docker Compose runtime layer: `backend/docker-compose.apps.yml`

## Current Project Shape

- Backend is a multi-module Maven project under `backend`.
- Backend runtime uses Java 17 and Spring Boot 3.3.
- Admin web is a Vite/React app under `admin-web`.
- Mobile is an Expo app under `mobile-app`.
- Backend services use `ddl-auto=validate`; CI tests should stay unit-focused unless a test database bootstrap step is added.
- Business secrets must be configured through CI variables or Jenkins credentials, never committed to source.

## Docker Delivery Model

The backend uses one reusable multi-stage Dockerfile at `backend/Dockerfile`. Keep it there rather than duplicating a root `Dockerfile`; the Docker build context should still be the repository root (`.`) so the Maven parent POM and all backend modules are available. A root-level Dockerfile would be easy to forget when the backend build changes, so treat `backend/Dockerfile` as the canonical backend image definition.

```bash
docker build -f backend/Dockerfile --build-arg SERVICE_NAME=api-gateway -t ecommerce-system/api-gateway:local .
```

Supported backend image names:

```text
api-gateway
user-service
catalog-service
commerce-service
chat-service
assistant-service
```

The admin web is delivered as a static Nginx image:

```bash
docker build -f admin-web/Dockerfile --build-arg VITE_API_BASE_URL=http://localhost:8080/api -t ecommerce-system/admin-web:local .
```

Local compose startup with Kafka, Redis, Kafka Connect, and all backend services:

```bash
docker compose --env-file backend/.env -f backend/docker-compose.yml -f backend/docker-compose.apps.yml up -d --build
```

The app layer also starts `admin-web` on `${ADMIN_WEB_HOST_PORT:-3001}`. The Vite API base URL is baked into the admin web build through `ADMIN_WEB_API_BASE_URL`, defaulting to `http://localhost:8080/api`.

Local compose startup with Prometheus and Grafana:

```bash
docker compose --env-file backend/.env -f backend/docker-compose.yml -f backend/docker-compose.apps.yml -f backend/docker-compose.observability.yml up -d --build
```

The compose app layer reads runtime values from `backend/.env` by default. For container networking it overrides service-to-service URLs to Docker DNS names, for example `http://user-service:8081` and `kafka:29092`.

For local Docker Compose against a host PostgreSQL database, set `ECOMMERCE_DB_URL` to a container-reachable address such as `jdbc:postgresql://host.docker.internal:5432/ecommerce`. For staging/production, point it at Supabase or the managed PostgreSQL endpoint.

## GitLab CI/CD

The GitLab pipeline has five stages:

1. `validate`
   - Mobile `npm ci`
   - Expo lint
   - TypeScript typecheck
   - Admin web `npm ci`
   - Admin web lint
   - Admin web production build

2. `test`
   - Backend Maven tests
   - JUnit reports from Surefire

3. `package`
   - Backend JAR packaging on the default branch or tags
   - Admin web `dist` artifact on the default branch or tags
   - JAR artifacts retained for handoff/deployment

4. `image`
   - Builds one Docker image per backend service
   - Builds the `admin-web` Nginx image
   - Pushes immutable `$CI_COMMIT_SHORT_SHA` tags to GitLab Container Registry
   - Pushes backend service images to AWS ECR with the same repository mapping as `build-and-push-ecr.ps1`
   - Also pushes `$CI_COMMIT_REF_SLUG`; tags push `$CI_COMMIT_TAG`; default branch pushes `latest`

5. `deploy`
   - Manual `deploy:staging`
   - Manual `deploy:admin-web_staging`
   - Manual `deploy:ecs_production_like`
   - Copies compose files to the staging host
   - Pulls immutable SHA-tagged images and runs `docker compose up -d`
   - Forces ECS services to redeploy from ECR for production-like environments

`deploy:staging` updates backend services only. `deploy:admin-web_staging` updates the static admin web image with `docker compose up -d --no-deps admin-web`, so frontend-only releases do not require rebuilding backend images for the same commit SHA.

Recommended GitLab variables:

```text
ECOMMERCE_JWT_SECRET
AUTH_OTP_SECRET
ADMIN_WEB_API_BASE_URL
ECOMMERCE_DB_URL
ECOMMERCE_DB_USERNAME
ECOMMERCE_DB_PASSWORD
REDIS_HOST
REDIS_PASSWORD
KAFKA_BOOTSTRAP_SERVERS
EVENTS_KAFKA_ENABLED
EVENTS_KAFKA_RETRY_MAX_ATTEMPTS
EVENTS_KAFKA_RETRY_BACKOFF_MS
EVENTS_KAFKA_DLT_SUFFIX
PAYMENT_EXPIRATION_QUEUE_ENABLED
PAYMENT_EXPIRATION_QUEUE_REDIS_KEY
PAYMENT_EXPIRATION_QUEUE_POLL_DELAY_MS
PAYMENT_EXPIRATION_QUEUE_BATCH_SIZE
MAIL_HOST
MAIL_PORT
MAIL_USERNAME
MAIL_PASSWORD
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SEPAY_MERCHANT_ID
SEPAY_SECRET_KEY
SEPAY_WEBHOOK_SECRET
DEPLOY_HOST
DEPLOY_USER
DEPLOY_PATH
DEPLOY_SSH_PRIVATE_KEY
AWS_REGION
ECR_REGISTRY
AWS_ROLE_ARN
ECR_CREATE_REPOSITORIES
ECR_EXTRA_TAG
ECS_CLUSTER
ECS_SERVICE_NAMES
ECS_WAIT_FOR_STABILITY
```

Mark production-like variables as **masked** and **protected**.

For ECR, the default registry and region mirror `build-and-push-ecr.ps1`:

```text
AWS_REGION=ap-southeast-1
ECR_REGISTRY=316544164613.dkr.ecr.ap-southeast-1.amazonaws.com
ECR_EXTRA_TAG=phase3
```

The registry host is:

```text
316544164613.dkr.ecr.ap-southeast-1.amazonaws.com
```

The `backend:ecr` job builds each image with `backend/Dockerfile`, passes the same service port build args as the PowerShell script, and pushes these repositories:

```text
api-gateway       -> ecommerce-api-gateway       -> APP_PORT=8080
user-service      -> ecommerce-user-service      -> APP_PORT=8081
catalog-service   -> ecommerce-catalog-service   -> APP_PORT=8082
commerce-service  -> ecommerce-commerce-service  -> APP_PORT=8083
assistant-service -> ecommerce-assistant-service -> APP_PORT=8084
chat-service      -> ecommerce-chat-service      -> APP_PORT=8086
```

Each ECR run pushes `$CI_COMMIT_SHORT_SHA`, `$CI_COMMIT_REF_SLUG`, the compatibility tag from `ECR_EXTRA_TAG` (`phase3` by default), `$CI_COMMIT_TAG` on release tags, and `latest` on the default branch.

Backend image jobs run automatically for release tags and the default branch. On non-default branch pipelines they appear as manual jobs, which lets the team test ECR publishing from a review branch without pushing images on every branch update.

Prefer GitLab OIDC by configuring `AWS_ROLE_ARN`. The GitLab OIDC token audience is `sts.amazonaws.com`, so the AWS IAM OIDC provider and role trust policy must use the same audience. If OIDC is not ready yet, GitLab CI variables `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` also work with the AWS CLI, but they should be masked, protected, and rotated.

When `AWS_ROLE_ARN` is marked as a protected GitLab variable, it is only injected into pipelines for protected branches or protected tags. To test ECR from a review branch, either protect that review branch temporarily or run the job from a protected release/default branch.

The `deploy:ecs_production_like` job is manual and uses the same AWS credential path as `backend:ecr`. It defaults to ECS cluster `ecommerce-prod-cluster`; override `ECS_CLUSTER` in GitLab variables if another cluster is used. By default it redeploys:

```text
api-gateway user-service catalog-service commerce-service assistant-service chat-service
```

Override `ECS_SERVICE_NAMES` if the ECS service names differ. The job runs `aws ecs update-service --force-new-deployment` for each service and, by default, waits for rollout stability with `aws ecs wait services-stable`. Set `ECS_WAIT_FOR_STABILITY=false` only for fire-and-forget rollout tests.

The IAM role used by `AWS_ROLE_ARN` needs these additional ECS permissions:

```text
ecs:UpdateService
ecs:DescribeServices
```

GitLab Runner requirements for Docker image builds:

- Docker-in-Docker capable runner, usually privileged.
- Access to GitLab Container Registry through the built-in `CI_REGISTRY_*` variables.
- For ECR jobs, network access to AWS ECR and either GitLab OIDC role assumption or AWS credential variables. The ECR job uses the pinned `amazon/aws-cli:2.34.57` image and installs the Docker client with `yum`, avoiding Alpine `aws-cli` package issues.

Staging host requirements:

- Docker Engine and Docker Compose plugin.
- A persistent `.env` file in `DEPLOY_PATH`.
- Network access to the database, Redis/Kafka if managed externally, and the container registry.

## Jenkins

The `Jenkinsfile` is designed for a Linux Jenkins agent with:

- JDK 17
- Maven 3.9+
- Node.js 20+
- npm
- Docker CLI/Engine access

Pipeline stages:

1. Checkout
2. Parallel verification
   - Backend Maven tests
   - Mobile lint and typecheck
   - Admin web lint and build
3. Backend and admin web package on `main`, `master`, `develop`, or tags
4. Optional Docker image build/push when `BUILD_DOCKER_IMAGES=true`, `BUILD_ADMIN_WEB_IMAGE=true`, or `DEPLOY_STAGING=true`
5. Optional staging deploy when `DEPLOY_STAGING=true`

For Jenkins production setup, store sensitive values in Jenkins Credentials and inject them into the environment instead of editing the `Jenkinsfile`.

Jenkins parameters:

```text
BUILD_DOCKER_IMAGES
BUILD_ADMIN_WEB_IMAGE
DEPLOY_STAGING
REGISTRY_IMAGE
IMAGE_TAG
ADMIN_WEB_API_BASE_URL
DOCKER_REGISTRY_CREDENTIALS_ID
DEPLOY_HOST
DEPLOY_USER
DEPLOY_PATH
STAGING_SSH_CREDENTIALS_ID
```

Recommended Jenkins credentials:

- `docker-registry-credentials`: username/password credential for the container registry.
- `staging-ssh-key`: SSH private key credential for the staging host.

## Local Equivalent Commands

Backend:

```bash
cd backend
./mvnw -B -ntp test
./mvnw -B -ntp -DskipTests package
```

Docker:

```bash
docker compose --env-file backend/.env -f backend/docker-compose.yml -f backend/docker-compose.apps.yml build
docker compose --env-file backend/.env -f backend/docker-compose.yml -f backend/docker-compose.apps.yml up -d
docker compose --env-file backend/.env -f backend/docker-compose.yml -f backend/docker-compose.apps.yml -f backend/docker-compose.observability.yml up -d --build
```

ECR:

```powershell
.\build-and-push-ecr.ps1
```

Kubernetes base manifests for stateless backend rollout live in `backend/k8s/base`.

Mobile:

```bash
cd mobile-app
npm ci
npm run lint
npm run typecheck
```

Admin web:

```bash
cd admin-web
npm ci
npm run lint
npm run build
```
