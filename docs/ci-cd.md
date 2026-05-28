# CI/CD Integration

This repository now includes both GitLab CI/CD and Jenkins pipeline definitions.

- GitLab: `.gitlab-ci.yml`
- Jenkins: `Jenkinsfile`
- Shared backend image build: `backend/Dockerfile`
- Docker Compose runtime layer: `backend/docker-compose.apps.yml`

## Current Project Shape

- Backend is a multi-module Maven project under `backend`.
- Backend runtime uses Java 17 and Spring Boot 3.3.
- Mobile is an Expo app under `mobile-app`.
- Backend services use `ddl-auto=validate`; CI tests should stay unit-focused unless a test database bootstrap step is added.
- Business secrets must be configured through CI variables or Jenkins credentials, never committed to source.

## Docker Delivery Model

The backend uses one reusable multi-stage Dockerfile. Each image is built by passing the Maven module name:

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

Local compose startup with Kafka, Redis, Kafka Connect, and all backend services:

```bash
docker compose --env-file backend/.env -f backend/docker-compose.yml -f backend/docker-compose.apps.yml up -d --build
```

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

2. `test`
   - Backend Maven tests
   - JUnit reports from Surefire

3. `package`
   - Backend JAR packaging on the default branch or tags
   - JAR artifacts retained for handoff/deployment

4. `image`
   - Builds one Docker image per backend service
   - Pushes immutable `$CI_COMMIT_SHORT_SHA` tags to GitLab Container Registry
   - Also pushes `$CI_COMMIT_REF_SLUG`; tags push `$CI_COMMIT_TAG`; default branch pushes `latest`

5. `deploy`
   - Manual `deploy:staging`
   - Copies compose files to the staging host
   - Pulls the immutable SHA-tagged images and runs `docker compose up -d`

Recommended GitLab variables:

```text
ECOMMERCE_JWT_SECRET
AUTH_OTP_SECRET
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
```

Mark production-like variables as **masked** and **protected**.

GitLab Runner requirements for Docker image builds:

- Docker-in-Docker capable runner, usually privileged.
- Access to GitLab Container Registry through the built-in `CI_REGISTRY_*` variables.

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
3. Backend package on `main`, `master`, `develop`, or tags
4. Optional Docker image build/push when `BUILD_DOCKER_IMAGES=true` or `DEPLOY_STAGING=true`
5. Optional staging deploy when `DEPLOY_STAGING=true`

For Jenkins production setup, store sensitive values in Jenkins Credentials and inject them into the environment instead of editing the `Jenkinsfile`.

Jenkins parameters:

```text
BUILD_DOCKER_IMAGES
DEPLOY_STAGING
REGISTRY_IMAGE
IMAGE_TAG
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
docker compose --env-file backend/.env -f backend/docker-compose.yml -f backend/docker-compose.apps.yml -f backend/docker-compose.observability.yml up -d
```

Kubernetes base manifests for stateless backend rollout live in `backend/k8s/base`.

Mobile:

```bash
cd mobile-app
npm ci
npm run lint
npm run typecheck
```
