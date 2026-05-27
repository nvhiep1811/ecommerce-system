pipeline {
  agent any

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
  }
}
