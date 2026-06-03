def IS_TAG = ''
def BUILD_TYPE = ''
def IMAGE_VERSION = ''
def NAME_SPACE = ''
def SERVICE = 'meepo-mcp-server'

pipeline {
  agent any

  environment {
    PROJECT_NAME = 'meepo'
    REGISTRY = 'quantumteknologi'
    DOCKER_BUILDKIT = '1'
    
    REGISTRY_CRED = 'registry-docker'
    REGISTRY_URL = 'https://index.docker.io/v1/'
    SONAR_CRED = 'sonarcube'
    SONAR_INSTALLATION = 'sonar-scanner'
    SONAR_SCANNER_TOOL = 'sonar-scanner'
    SLACK_BOT_WEBHOOK_URL = credentials('slack-infra-meepo')
    GROUP_TELEGRAM = credentials('group-telegram')
    BOT_TOKEN = credentials('TELEGRAM_BOT_TOKEN')
  }

  triggers {
    githubPush()
  }

  parameters {
    booleanParam(name: 'SKIP_DEVSECOPS', defaultValue: false, description: 'Skip DevSecOps stages (SonarQube, OWASP, Trivy)')
  }

  options {
    skipDefaultCheckout(true)
    timestamps()
    disableConcurrentBuilds()
  }

  stages {

    /* =============================
     * Checkout
     * ============================= */
    stage('Checkout') {
      when {
        anyOf {
          branch 'master'
          branch 'staging'
          branch 'dev'
        }
      }
      steps {
        script {
          def scmVars = checkout([
            $class: 'GitSCM',
            branches: scm.branches,
            userRemoteConfigs: scm.userRemoteConfigs,
            extensions: [
              [$class: 'CloneOption', shallow: false, depth: 0, noTags: false],
              [$class: 'PruneStaleBranch']
            ]
          ])
          // Explicitly set the environment variables from that map
          env.GIT_COMMIT = scmVars.GIT_COMMIT
          env.GIT_PREVIOUS_COMMIT = scmVars.GIT_PREVIOUS_COMMIT
          env.GIT_PREVIOUS_SUCCESSFUL_COMMIT = scmVars.GIT_PREVIOUS_SUCCESSFUL_COMMIT
          echo "Branch: ${env.BRANCH_NAME}"
        }
      }
    }

    /* =============================
     * Tag & Branch Validation
     * ============================= */
    stage('Branch & Tag Validation') {
      steps {
        script {
          IS_TAG = sh(
            script: "git describe --exact-match --tags || echo ''",
            returnStdout: true
          ).trim()

          if (!IS_TAG || env.BRANCH_NAME == 'dev') {
            if (env.BRANCH_NAME == 'dev') {
              def commitHash = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
              IS_TAG = "dev-${commitHash}"
            } else {
              error("❌ Build must be triggered by TAG")
            }
          }
          
          echo "${IS_TAG} ${env.BRANCH_NAME}"

          if (IS_TAG.startsWith('dev-') && env.BRANCH_NAME == 'dev') {
            BUILD_TYPE = 'dev'
            env.BUILD_TYPE = 'dev'
            NAME_SPACE = "${PROJECT_NAME}-dev"
          } else if (IS_TAG.startsWith('stag-') && env.BRANCH_NAME == 'staging') {
            BUILD_TYPE = 'staging'
            env.BUILD_TYPE = 'staging'
            NAME_SPACE = "${PROJECT_NAME}-stag"
          } else if (IS_TAG.startsWith('prod-') && env.BRANCH_NAME == 'master') {
            BUILD_TYPE = 'production'
            env.BUILD_TYPE = 'production'
            NAME_SPACE = "${PROJECT_NAME}"
          } else {
            error("❌ Tag prefix & branch mismatch")
          }

          env.KUBECONFIG_DEV = "kubeconfig-${env.BUILD_TYPE}"

          /* =====================================================
           * DYNAMIC ENV INJECTION
           * =====================================================
           * Define all dynamic environment variables here.
           * These will be injected into the service at runtime
           * via Kubernetes (kubectl set env).
           * ===================================================== */
          def appEnv = (BUILD_TYPE == 'production') ? 'production' : BUILD_TYPE
          env.DYNAMIC_RUNTIME_ENVS = [
            "APP_ENV=${appEnv}"
          ].join(',')

          echo "${IS_TAG} ${env.BRANCH_NAME} ${env.KUBECONFIG_DEV}"
          echo "Dynamic runtime envs: ${env.DYNAMIC_RUNTIME_ENVS}"
          
          // Capture Commit Metadata
          env.COMMIT_MSG = sh(script: 'git log -1 --pretty=%B', returnStdout: true).trim()
          env.COMMIT_AUTHOR = sh(script: 'git log -1 --pretty=%an', returnStdout: true).trim()

          IMAGE_VERSION = IS_TAG

          sendSlack("STARTED", PROJECT_NAME, env.BRANCH_NAME, IS_TAG, BUILD_TYPE, IMAGE_VERSION)
        }
      }
    }

    /* =============================
     * SonarQube
     * ============================= */
    stage('SonarQube Analysis') {
      when {
        expression { return !params.SKIP_DEVSECOPS }
      }
      steps {
        script {
          def scannerHome = tool name: SONAR_SCANNER_TOOL, type: 'hudson.plugins.sonar.SonarRunnerInstallation'
          withSonarQubeEnv(installationName: SONAR_INSTALLATION, credentialsId: SONAR_CRED) {
            sh """
              export PATH="${scannerHome}/bin:\${PATH}"
              sonar-scanner \
                -Dsonar.projectKey=${SERVICE} \
                -Dsonar.projectName=${SERVICE} \
                -Dsonar.exclusions=**/node_modules/**,**/dist/**
            """
          }
        }
      }
    }

    stage('Sonar Quality Gate') {
      when {
        expression { return !params.SKIP_DEVSECOPS }
      }
      steps {
        timeout(time: 20, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: false
        }
      }
    }

    /* =============================
     * OWASP Dependency Check
     * ============================= */
    stage('OWASP Scan') {
      when {
        expression { return !params.SKIP_DEVSECOPS }
      }
      steps {
        dependencyCheck additionalArguments: '--scan ./', odcInstallation: 'dp'
        dependencyCheckPublisher pattern: '**/dependency-check-report.xml'
      }
      post {
        failure {
           script { env.FAILED_STAGE = 'OWASP Scan' }
        }
      }
    }

    /* =============================
     * Trivy Security Scan
     * ============================= */
    stage('Trivy Security Scan') {
      when {
        expression { return !params.SKIP_DEVSECOPS }
      }
      steps {
        script {
            def severity = 'CRITICAL'

            def exitCode = sh(
                script: """
                  export TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db
                  export TRIVY_DISABLE_MIRROR=true
                  export TRIVY_CACHE_DIR=.trivy-cache/global
                  mkdir -p .trivy-cache/global
                  trivy --download-db-only || true
                  trivy fs \
                  --severity ${severity} \
                  --ignore-unfixed \
                  --exit-code 1 .
                """,
                returnStatus: true
            )

            if (exitCode != 0) {
                env.FAILED_STAGE = "Trivy FS Scan: Critical Vulnerabilities Found"
                error("Trivy found vulnerabilities")
            }
        }
      }
      post {
        failure {
          script { env.FAILED_STAGE = 'Trivy Security Scan' }
        }
      }
    }

    /* =============================
     * Build & Deploy
     * ============================= */
    stage('Docker Build') {
      steps {  
        sh "docker build -t ${REGISTRY}/${SERVICE}:${IMAGE_VERSION} -f Dockerfile ."
      }
      post {
        failure {
          script { env.FAILED_STAGE = "Docker Build" }
        }
      }
    }

    stage('Trivy Image Scan') {
      when {
        expression { return !params.SKIP_DEVSECOPS }
      }
      steps {
        script {
          def exitCode = sh(
            script: """
              TRIVY_CACHE_DIR=.trivy-cache/${SERVICE} trivy image --exit-code 1 --severity CRITICAL --scanners vuln --timeout 15m \
              --ignore-unfixed \
              ${REGISTRY}/${SERVICE}:${IMAGE_VERSION}
            """,
            returnStatus: true
          )

          if (exitCode != 0) {
             env.FAILED_STAGE = "Trivy Image Scan: Critical Vulnerabilities Found"
             error("Trivy found vulnerabilities in ${SERVICE}")
          }
        }
      }
      post {
        failure {
           script { env.FAILED_STAGE = "Trivy Image Scan" }
        }
      }
    }

    stage('Docker Push') {
      steps {
        withDockerRegistry(url: REGISTRY_URL, credentialsId: REGISTRY_CRED) {
          sh "docker push ${REGISTRY}/${SERVICE}:${IMAGE_VERSION}"
        }
      }
      post {
        failure {
          script { env.FAILED_STAGE = "Docker Push" }
        }
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        echo "${env.KUBECONFIG_DEV}"
        withCredentials([file(credentialsId: env.KUBECONFIG_DEV, variable: 'KUBECONFIG')]) {
          script {
            sh """
              echo "Checking kubeconfig"
              kubectl config view
              kubectl set image deployment/${SERVICE} \
                ${SERVICE}=${REGISTRY}/${SERVICE}:${IMAGE_VERSION} \
                -n ${NAME_SPACE}
            """

            // Inject dynamic runtime env vars
            def envPairs = env.DYNAMIC_RUNTIME_ENVS.split(',')
            def envArgs = envPairs.collect { it.trim() }.join(' ')
            sh """
              echo "Injecting dynamic env vars into ${SERVICE}: ${envArgs}"
              kubectl set env deployment/${SERVICE} \
                ${envArgs} \
                -n ${NAME_SPACE}
            """
          }
        }
      }
      post {
        failure {
           script { env.FAILED_STAGE = "Deploy to Kubernetes" }
        }
      }
    }
  }

  post {
    success {
      sendSlack("SUCCESS", PROJECT_NAME, env.BRANCH_NAME, IS_TAG, BUILD_TYPE, IMAGE_VERSION)
    }
    failure {
      sendSlack("FAILURE", PROJECT_NAME, env.BRANCH_NAME, IS_TAG, BUILD_TYPE, IMAGE_VERSION, env.FAILED_STAGE)
    }
    always {
      sh '''
        echo "Cleaning up..."
        rm -rf dependency-check-report.xml || true
        docker image prune -f || true
      '''
    }
  }
}

/* =============================
 * Notification Helpers
 * ============================= */
def sendTelegram(String message) {
  sh """
    curl -s -X POST https://api.telegram.org/bot${BOT_TOKEN}/sendMessage \
      -d chat_id=${GROUP_TELEGRAM} \
      -d text="${message}" \
      -d parse_mode=Markdown
  """
}

def sendSlack(String status, String project, String branch, String tag, String type, String version, String failedStage = '') {
  def color = ''
  def title = ''
  def icon = ''
  
  if (status == 'STARTED') {
    color = '#3498db' // Blue
    title = 'Pipeline Started'
    icon = '🚀'
  } else if (status == 'SUCCESS') {
    color = '#2ecc71' // Green
    title = 'Build Success'
    icon = '✅'
  } else {
    color = '#e74c3c' // Red
    title = 'Build Failed'
    icon = '🚨'
  }

  def commitMsg = env.COMMIT_MSG ?: 'Unknown'
  def author = env.COMMIT_AUTHOR ?: 'Unknown'
  
  // Escape JSON special characters manually to be safe without JsonOutput
  commitMsg = commitMsg.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
  author = author.replace('\\', '\\\\').replace('"', '\\"')
  
  def payload = """
  {
    "attachments": [
      {
        "color": "${color}",
        "pretext": "*${icon} ${title}*",
        "fields": [
          { "title": "Project", "value": "${project}", "short": true },
          { "title": "Branch", "value": "${branch}", "short": true },
          { "title": "Environment", "value": "${type}", "short": true },
          { "title": "Tag", "value": "${tag}", "short": true },
          { "title": "Author", "value": "${author}", "short": true },
          { "title": "Failed Stage", "value": "${failedStage ?: 'None'}", "short": true },
          { "title": "Commit", "value": "${commitMsg}", "short": false },
          { "title": "Built Services", "value": "• ${SERVICE}", "short": false }
        ],
        "footer": "Jenkins CI",
        "ts": ${System.currentTimeMillis() / 1000},
        "actions": [
          {
            "type": "button",
            "text": "View Logs",
            "url": "${env.BUILD_URL}",
            "style": "primary"
          }
        ]
      }
    ]
  }
  """
  
  writeFile file: 'slack-payload.json', text: payload
  
  sh """
    curl -X POST ${SLACK_BOT_WEBHOOK_URL} \
      -H 'Content-Type: application/json' \
      -d @slack-payload.json
  """
}
