def backendServices = [
  'api-gateway',
  'user-service',
  'catalog-service',
  'commerce-service',
  'chat-service',
  'assistant-service'
]

pipeline {
  agent any

  parameters {
    booleanParam(name: 'BUILD_DOCKER_IMAGES', defaultValue: false, description: 'Build and push backend Docker images.')
    booleanParam(name: 'DEPLOY_STAGING', defaultValue: false, description: 'Deploy the pushed backend images to the staging Docker Compose host.')
    string(name: 'REGISTRY_IMAGE', defaultValue: '', description: 'Registry namespace, for example registry.gitlab.com/group/ecommerce-system.')
    string(name: 'IMAGE_TAG', defaultValue: '', description: 'Image tag override. Defaults to the current Git SHA.')
    string(name: 'DOCKER_REGISTRY_CREDENTIALS_ID', defaultValue: 'docker-registry-credentials', description: 'Jenkins username/password credential for the container registry.')
    string(name: 'DEPLOY_HOST', defaultValue: '', description: 'Staging host reachable by SSH.')
    string(name: 'DEPLOY_USER', defaultValue: 'deploy', description: 'SSH user for staging deployment.')
    string(name: 'DEPLOY_PATH', defaultValue: '/opt/ecommerce-system', description: 'Remote directory containing .env and compose files.')
    string(name: 'STAGING_SSH_CREDENTIALS_ID', defaultValue: 'staging-ssh-key', description: 'Jenkins SSH key credential for the staging host.')
  }

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
  }

  environment {
    CI = 'true'
    MAVEN_OPTS = '-Dmaven.repo.local=.m2/repository'
    ECOMMERCE_JWT_SECRET = 'ci-jwt-secret-change-in-jenkins-credentials'
    AUTH_OTP_SECRET = 'ci-otp-secret-change-in-jenkins-credentials'
    ECOMMERCE_DB_URL = 'jdbc:postgresql://localhost:5432/ecommerce_ci'
    ECOMMERCE_DB_USERNAME = 'postgres'
    ECOMMERCE_DB_PASSWORD = 'postgres'
    REDIS_HOST = 'localhost'
    KAFKA_BOOTSTRAP_SERVERS = 'localhost:9092'
    EVENTS_KAFKA_ENABLED = 'true'
    MAIL_USERNAME = ''
    MAIL_PASSWORD = ''
    SUPABASE_URL = ''
    SUPABASE_SERVICE_ROLE_KEY = ''
    SEPAY_ENABLED = 'false'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Verify') {
      parallel {
        stage('Backend tests') {
          steps {
            dir('backend') {
              sh 'mvn -B -ntp test'
            }
          }
          post {
            always {
              junit allowEmptyResults: true, testResults: 'backend/**/target/surefire-reports/*.xml'
            }
          }
        }

        stage('Mobile lint and typecheck') {
          steps {
            dir('mobile-app') {
              sh 'npm ci --prefer-offline --no-audit'
              sh 'npm run lint'
              sh 'npm run typecheck'
            }
          }
        }
      }
    }

    stage('Package backend') {
      when {
        anyOf {
          branch 'main'
          branch 'master'
          branch 'develop'
          buildingTag()
        }
      }
      steps {
        dir('backend') {
          sh 'mvn -B -ntp -DskipTests package'
        }
      }
      post {
        success {
          archiveArtifacts allowEmptyArchive: true, artifacts: 'backend/*/target/*.jar', fingerprint: true
        }
      }
    }

    stage('Build and push Docker images') {
      when {
        expression {
          return params.BUILD_DOCKER_IMAGES || params.DEPLOY_STAGING
        }
      }
      steps {
        script {
          def registryImage = params.REGISTRY_IMAGE?.trim()
          if (!registryImage) {
            error 'REGISTRY_IMAGE is required when BUILD_DOCKER_IMAGES or DEPLOY_STAGING is enabled.'
          }

          def imageTag = params.IMAGE_TAG?.trim()
          if (!imageTag) {
            imageTag = sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim()
          }

          env.CD_REGISTRY_IMAGE = registryImage
          env.CD_IMAGE_TAG = imageTag
          env.CD_REGISTRY_HOST = registryImage.tokenize('/')[0]
        }

        withCredentials([usernamePassword(credentialsId: params.DOCKER_REGISTRY_CREDENTIALS_ID, usernameVariable: 'REGISTRY_USERNAME', passwordVariable: 'REGISTRY_PASSWORD')]) {
          sh '''
            set -eu
            printf '%s' "$REGISTRY_PASSWORD" | docker login -u "$REGISTRY_USERNAME" --password-stdin "$CD_REGISTRY_HOST"
          '''
        }

        script {
          backendServices.each { serviceName ->
            sh """
              set -eu
              docker build -f backend/Dockerfile --build-arg SERVICE_NAME=${serviceName} -t ${env.CD_REGISTRY_IMAGE}/${serviceName}:${env.CD_IMAGE_TAG} .
              docker push ${env.CD_REGISTRY_IMAGE}/${serviceName}:${env.CD_IMAGE_TAG}
            """
          }
        }
      }
    }

    stage('Deploy staging') {
      when {
        expression {
          return params.DEPLOY_STAGING
        }
      }
      steps {
        script {
          if (!params.DEPLOY_HOST?.trim()) {
            error 'DEPLOY_HOST is required when DEPLOY_STAGING is enabled.'
          }
          if (!params.DEPLOY_USER?.trim()) {
            error 'DEPLOY_USER is required when DEPLOY_STAGING is enabled.'
          }
          if (!params.DEPLOY_PATH?.trim()) {
            error 'DEPLOY_PATH is required when DEPLOY_STAGING is enabled.'
          }
        }

        withCredentials([usernamePassword(credentialsId: params.DOCKER_REGISTRY_CREDENTIALS_ID, usernameVariable: 'REGISTRY_USERNAME', passwordVariable: 'REGISTRY_PASSWORD')]) {
          sshagent(credentials: [params.STAGING_SSH_CREDENTIALS_ID]) {
            sh '''
              set -eu
              DEPLOY_TARGET="$DEPLOY_USER@$DEPLOY_HOST"

              ssh -o StrictHostKeyChecking=accept-new "$DEPLOY_TARGET" "mkdir -p '$DEPLOY_PATH'"
              scp -o StrictHostKeyChecking=accept-new backend/docker-compose.yml backend/docker-compose.apps.yml "$DEPLOY_TARGET:$DEPLOY_PATH/"

              printf '%s' "$REGISTRY_PASSWORD" | ssh -o StrictHostKeyChecking=accept-new "$DEPLOY_TARGET" "docker login -u '$REGISTRY_USERNAME' --password-stdin '$CD_REGISTRY_HOST'"
              ssh -o StrictHostKeyChecking=accept-new "$DEPLOY_TARGET" "
                set -e
                cd '$DEPLOY_PATH'
                REGISTRY_IMAGE='$CD_REGISTRY_IMAGE' IMAGE_TAG='$CD_IMAGE_TAG' docker compose --env-file .env -f docker-compose.yml -f docker-compose.apps.yml pull
                REGISTRY_IMAGE='$CD_REGISTRY_IMAGE' IMAGE_TAG='$CD_IMAGE_TAG' docker compose --env-file .env -f docker-compose.yml -f docker-compose.apps.yml up -d
              "
            '''
          }
        }
      }
    }
  }
}
