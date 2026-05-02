# CI/CD Integration

This repository now includes both GitLab CI/CD and Jenkins pipeline definitions.

- GitLab: `.gitlab-ci.yml`
- Jenkins: `Jenkinsfile`

The current integration focuses on reliable validation and delivery artifacts. Automated deployment is intentionally left as an environment-specific extension because the repository does not yet define Dockerfiles, a container registry target, Kubernetes manifests, or a VM deployment script.

## Current Project Shape

- Backend is a multi-module Maven project under `backend`.
- Backend runtime uses Java 17 and Spring Boot 3.3.
- Mobile is an Expo app under `mobile-app`.
- Backend services use `ddl-auto=validate`; CI tests should stay unit-focused unless a test database bootstrap step is added.
- Business secrets must be configured through CI variables or Jenkins credentials, never committed to source.

## GitLab CI/CD

The GitLab pipeline has three stages:

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

Recommended GitLab variables:

```text
ECOMMERCE_JWT_SECRET
AUTH_OTP_SECRET
ECOMMERCE_DB_URL
ECOMMERCE_DB_USERNAME
ECOMMERCE_DB_PASSWORD
REDIS_HOST
REDIS_PASSWORD
RABBITMQ_HOST
RABBITMQ_USERNAME
RABBITMQ_PASSWORD
MAIL_HOST
MAIL_PORT
MAIL_USERNAME
MAIL_PASSWORD
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SEPAY_MERCHANT_ID
SEPAY_SECRET_KEY
SEPAY_WEBHOOK_SECRET
```

Mark production-like variables as **masked** and **protected**.

## Jenkins

The `Jenkinsfile` is designed for a Linux Jenkins agent with:

- JDK 17
- Maven 3.9+
- Node.js 20+
- npm

Pipeline stages:

1. Checkout
2. Parallel verification
   - Backend Maven tests
   - Mobile lint and typecheck
3. Backend package on `main`, `master`, `develop`, or tags

For Jenkins production setup, store sensitive values in Jenkins Credentials and inject them into the environment instead of editing the `Jenkinsfile`.

## Deployment Extension Path

Before enabling true CD, decide the deployment target:

- VM/systemd services
- Docker Compose
- Kubernetes
- Cloud Run/ECS/App Platform
- Expo EAS for native mobile builds

Recommended next step for backend CD:

1. Add Dockerfiles for each Spring Boot service or a shared build image.
2. Push images to GitLab Container Registry or another registry.
3. Add a manual `deploy:staging` job that pulls immutable image tags.
4. Keep production deployment manual/protected until rollback and health checks are defined.

Recommended next step for mobile CD:

1. Add `eas.json`.
2. Store `EXPO_TOKEN` as a CI secret.
3. Add manual EAS preview/production build jobs.

## Local Equivalent Commands

Backend:

```bash
cd backend
mvn -B -ntp test
mvn -B -ntp -DskipTests package
```

Mobile:

```bash
cd mobile-app
npm ci
npm run lint
npm run typecheck
```

## Known Constraint

The local machine used during setup did not have `mvn` installed, so backend verification could not be executed locally. Mobile lint was previously verified in the project, and CI/Jenkins are expected to run backend Maven checks in their configured environments.
