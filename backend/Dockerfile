# syntax=docker/dockerfile:1

FROM maven:3.9.9-eclipse-temurin-17 AS build

WORKDIR /workspace

ARG SERVICE_NAME

COPY backend/pom.xml backend/pom.xml
COPY backend/shared-kernel/pom.xml backend/shared-kernel/pom.xml
COPY backend/user-service/pom.xml backend/user-service/pom.xml
COPY backend/catalog-service/pom.xml backend/catalog-service/pom.xml
COPY backend/commerce-service/pom.xml backend/commerce-service/pom.xml
COPY backend/chat-service/pom.xml backend/chat-service/pom.xml
COPY backend/api-gateway/pom.xml backend/api-gateway/pom.xml
COPY backend/assistant-service/pom.xml backend/assistant-service/pom.xml

RUN test -n "$SERVICE_NAME"

COPY backend backend

RUN mvn -f backend/pom.xml -B -ntp -pl "$SERVICE_NAME" -am -DskipTests package \
    && JAR_FILE="$(find "backend/${SERVICE_NAME}/target" -maxdepth 1 -type f -name '*.jar' ! -name '*.original' | head -n 1)" \
    && test -n "$JAR_FILE" \
    && cp "$JAR_FILE" /tmp/app.jar

FROM eclipse-temurin:17-jre

WORKDIR /app

ARG APP_PORT=8080
ENV JAVA_OPTS="" \
    SERVER_PORT="${APP_PORT}"

RUN useradd --create-home --shell /usr/sbin/nologin appuser

COPY --from=build /tmp/app.jar /app/app.jar

EXPOSE ${APP_PORT}

USER appuser

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]