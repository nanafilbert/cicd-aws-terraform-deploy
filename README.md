# cicd-aws-terraform-deploy

![CI/CD](https://github.com/nanafilbert/cicd-aws-terraform-deploy/actions/workflows/ci-cd.yml/badge.svg)
![AWS](https://img.shields.io/badge/AWS-deployed-orange?logo=amazon-aws)
![Terraform](https://img.shields.io/badge/terraform-1.7-blueviolet?logo=terraform)
![Docker](https://img.shields.io/badge/docker-multi--stage-blue?logo=docker)
![Node](https://img.shields.io/badge/node-20-green?logo=node.js)
![Coverage](https://img.shields.io/badge/coverage-80%25%2B-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

A **production-grade DevOps project** demonstrating end-to-end software delivery: a containerised Node.js REST API, an 8-stage CI/CD pipeline with OIDC authentication and security scanning, and fully modularised AWS infrastructure provisioned with Terraform.

Built to reflect real-world engineering standards — not a tutorial.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Actions                           │
│  Lint → Test → Security → Build → Plan → Deploy → Smoke → Summary
│                   (OIDC — no static AWS keys)                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ docker push
                         ▼
                   Docker Hub
                         │
                         │ terraform apply
                         ▼
┌─────────────────── AWS (us-east-1) ────────────────────────────┐
│                                                                 │
│   Internet → ALB → Auto Scaling Group (EC2 t3.small)           │
│              │          │                                       │
│              │     ┌────┴─────┐                                 │
│              │     │  Docker  │  Node.js API (port 3000)        │
│              │     │ Container│  + Winston structured logging   │
│              │     └──────────┘  + Graceful shutdown (SIGTERM)  │
│              │                   + Rate limiting                 │
│         Health checks            + Helmet security headers      │
│         (/health/ready)          + Kanban dashboard UI          │
│                                                                 │
│   Remote State: S3 (encrypted + versioned) + DynamoDB lock     │
│   IAM: Least-privilege role + SSM Session Manager (no bastion) │
│   EC2: IMDSv2 required, encrypted EBS (gp3, 30GB)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Application** | Node.js 20, Express | REST API + Kanban UI |
| **Security** | Helmet, express-rate-limit, CORS | HTTP hardening |
| **Logging** | Winston (structured JSON) | Observability |
| **Testing** | Jest + Supertest (19 tests) | Unit & integration tests |
| **Containerisation** | Docker (multi-stage, Alpine 3.21) | Reproducible builds |
| **Reverse Proxy** | Nginx | Load balancing, TLS termination |
| **Monitoring** | Prometheus + Grafana | Metrics & alerting |
| **CI/CD** | GitHub Actions (8 stages) | Automated delivery |
| **Auth** | OIDC (no static AWS keys) | Keyless AWS authentication |
| **Security Scanning** | Trivy | CVE scanning (filesystem + image) |
| **IaC** | Terraform 1.7 (modular) | AWS infrastructure |
| **Compute** | AWS EC2 t3.small + ASG | Scalable compute |
| **Load Balancing** | AWS ALB | Health-check routing |
| **State Management** | S3 + DynamoDB | Remote Terraform state |
| **Access** | AWS SSM Session Manager | No SSH bastion needed |

---

## Key Engineering Decisions

**Why OIDC instead of static AWS keys?**
GitHub Actions authenticates to AWS via short-lived OIDC tokens instead of long-lived IAM access keys. No secrets to rotate, no credentials to leak. The IAM role trust policy restricts assumption to this specific repo only.

**Why a multi-stage Dockerfile?**
Three stages: `deps` (prod dependencies only), `test` (runs Jest inside the build — a broken image cannot be pushed), and `production` (minimal Alpine 3.21, non-root user). The final image contains only what's needed to run.

**Why Alpine 3.21 pinned explicitly?**
`node:20-alpine` floats to the latest Alpine release. Pinning to `alpine3.21` ensures a reproducible, auditable base image where patched packages (zlib, OpenSSL) are known quantities.

**Why Auto Scaling Group instead of a single EC2?**
The ASG with instance refresh enables zero-downtime rolling deployments — new instances must pass ALB health checks before old ones are terminated.

**Why modular Terraform?**
`networking`, `security`, and `compute` are independent reusable modules. Each can be versioned and tested in isolation — mirrors how infrastructure scales in real teams.

**Why IMDSv2 required on EC2?**
IMDSv1 is vulnerable to SSRF attacks that can leak IAM credentials from the metadata endpoint. Requiring IMDSv2 (token-based) is enforced in the launch template.

**Why a bootstrap folder in Terraform?**
The OIDC provider, IAM role, S3 bucket, and DynamoDB table are one-time prerequisites that must exist before the pipeline can run. Keeping them in a separate `bootstrap/` module makes the chicken-and-egg relationship explicit and auditable.

---

## Project Structure

```
cicd-aws-terraform-deploy/
├── app/
│   ├── src/
│   │   ├── app.js               # Entry point + graceful shutdown (SIGTERM/SIGINT)
│   │   ├── server.js            # Express + middleware + static file serving
│   │   ├── routes/
│   │   │   ├── tasks.js         # CRUD endpoints
│   │   │   └── health.js        # Liveness, readiness, metrics
│   │   ├── middleware/
│   │   │   ├── errorHandler.js  # Centralised error handling + 404
│   │   │   └── validator.js     # Request validation, 422 responses
│   │   └── utils/
│   │       └── logger.js        # Structured JSON logging (Winston)
│   ├── tests/
│   │   └── api.test.js          # 19 integration tests
│   ├── public/
│   │   └── index.html           # Kanban dashboard UI
│   ├── .eslintrc.js             # ESLint config (node + jest env)
│   ├── Dockerfile               # Multi-stage: deps → test → production
│   └── package.json             # npm overrides for transitive dep CVEs
│
├── .github/
│   └── workflows/
│       └── ci-cd.yml            # 8-stage pipeline + manual destroy
│
├── terraform/
│   ├── bootstrap/               # One-time: OIDC provider, IAM role, S3, DynamoDB
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── terraform.tfvars.example
│   ├── modules/
│   │   ├── networking/          # VPC, subnets, IGW, route tables
│   │   ├── security/            # Security groups (ALB + app, least-privilege)
│   │   └── compute/             # ALB, ASG, launch template, IAM, scaling policy
│   └── envs/
│       └── prod/                # Root module (wires modules + remote state backend)
│
├── nginx/
│   └── conf.d/app.conf          # Security headers, gzip, proxy config
├── monitoring/
│   └── prometheus.yml           # Scrape config
└── docker-compose.yml           # Full local stack: app + nginx + prometheus + grafana
```

---

## Deployment Guide

### Prerequisites

- AWS account with permissions to create IAM roles, S3, DynamoDB, EC2, ALB, VPC
- AWS CLI configured locally
- Terraform 1.7+
- Docker Hub account
- GitHub repo with Actions enabled

---

### Step 1 — Bootstrap AWS prerequisites (one-time)

The bootstrap creates the OIDC provider, IAM role, S3 state bucket, and DynamoDB lock table that the pipeline depends on.

```bash
cd terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
github_repo       = "nanafilbert/cicd-aws-terraform-deploy"
state_bucket_name = "cicd-aws-terraform-deploy-tfstate-<yourname>"
aws_region        = "us-east-1"
```

Apply:

```bash
terraform init
terraform apply
```

Copy the `role_arn` from the output — you will need it in the next step.

---

### Step 2 — Configure GitHub Secrets

Go to your repo → **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | ARN from bootstrap output |
| `AWS_REGION` | `us-east-1` |
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token (not your password) |
| `TF_VAR_KEY_PAIR_NAME` | Name of an existing EC2 key pair in your AWS account |

---

### Step 3 — Update Terraform backend

Edit `terraform/envs/prod/main.tf` and set the correct bucket name:

```hcl
backend "s3" {
  bucket         = "cicd-aws-terraform-deploy-tfstate-<yourname>"
  key            = "prod/terraform.tfstate"
  region         = "us-east-1"
  dynamodb_table = "terraform-state-lock"
  encrypt        = true
}
```

---

### Step 4 — Create Docker Hub repository

Create a public repository named `cicd-aws-terraform-deploy` on Docker Hub.

---

### Step 5 — Push to main

```bash
git push origin main
```

The pipeline fires automatically. On success, Terraform outputs the ALB DNS name.

---

### Destroy infrastructure

To tear down all AWS resources go to **Actions → CI/CD Pipeline → Run workflow** and select `destroy`. No resources are left running after a destroy run.

---

## Running Locally

**Requirements:** Docker + Docker Compose

```bash
git clone https://github.com/nanafilbert/cicd-aws-terraform-deploy
cd cicd-aws-terraform-deploy

# Start full stack (app + nginx + prometheus + grafana)
docker-compose up --build

# Access:
# App:        http://localhost
# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3001  (admin / admin)
```

### Running Tests

```bash
cd app
npm install
npm test

# With coverage report
npm run test:ci
```

Coverage thresholds enforced in CI: **80% branches, functions, lines, and statements**.

---

## CI/CD Pipeline

Every push to `main` (excluding `README.md` changes) triggers an 8-stage pipeline:

```
Lint → Test → Security Scan → Build & Push → Terraform Plan → Deploy → Smoke Test → Summary
```

| Stage | What it does |
|-------|-------------|
| **🔍 Lint** | ESLint checks code quality |
| **🧪 Test** | Jest runs 19 tests, coverage enforced at 80% |
| **🔐 Security Scan** | Trivy scans dependencies — fails on HIGH/CRITICAL unfixed CVEs |
| **🐳 Build & Push** | Multi-stage Docker build pushed to Docker Hub with SHA + branch tags, SBOM generated, image rescanned |
| **📋 Terraform Plan** | `terraform plan` saved as artifact, posted as PR comment |
| **🚀 Deploy** | `terraform apply` using saved plan file |
| **✅ Smoke Test** | Polls `/health/ready` for up to 6 minutes post-deploy |
| **📊 Summary** | Pass/fail table written to GitHub Actions job summary |
| **💣 Destroy** | Manual only — triggered via `workflow_dispatch` → destroy option |

### Pipeline Authentication

The pipeline uses **OIDC** — no AWS access keys stored as GitHub Secrets. GitHub Actions requests a short-lived token, assumes the IAM role via `sts:AssumeRoleWithWebIdentity`, and the token expires when the job ends.

```yaml
permissions:
  id-token: write
  contents: read

- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: ${{ secrets.AWS_REGION }}
```

---

## API Reference

Base URL: `http://<alb-dns-name>`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Kanban dashboard UI |
| `GET` | `/health` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe (ALB health check target) |
| `GET` | `/health/metrics` | Process + system metrics |
| `GET` | `/api` | Endpoint manifest |
| `GET` | `/api/tasks` | List tasks (`?status=`, `?priority=`, `?sort=`) |
| `GET` | `/api/tasks/:id` | Get single task |
| `POST` | `/api/tasks` | Create task |
| `PATCH` | `/api/tasks/:id` | Update task |
| `DELETE` | `/api/tasks/:id` | Delete task |

All responses follow a consistent envelope:
- Success: `{ "data": ... }`
- Error: `{ "error": { "message": "...", "status": 400, "details": [...] } }`

---

## Security Hardening

| Control | Implementation |
|---------|---------------|
| No static AWS credentials | OIDC keyless auth |
| Least-privilege IAM | Scoped policy on GitHub Actions role |
| Non-root container | `nodeuser` (uid 1001) in production image |
| IMDSv2 required | Enforced in EC2 launch template |
| App SG ingress from ALB only | No direct EC2 access from internet |
| SSM Session Manager | EC2 access without SSH or bastion |
| Encrypted EBS | gp3 volumes encrypted at rest |
| Trivy CVE scanning | Filesystem + image scan, blocks HIGH/CRITICAL |
| Rate limiting | express-rate-limit on all API routes |
| Security headers | Helmet middleware |
| State encryption | S3 server-side encryption + versioning |
| npm overrides | Forced patched versions of transitive dependencies |

---

## License

MIT