# cicd-aws-terraform-deploy

![CI/CD](https://github.com/nanafilbert/cicd-aws-terraform-deploy/actions/workflows/ci-cd.yml/badge.svg)
![AWS](https://img.shields.io/badge/AWS-deployed-orange?logo=amazon-aws)
![Terraform](https://img.shields.io/badge/terraform-1.7-blueviolet?logo=terraform)
![Docker](https://img.shields.io/badge/docker-multi--stage-blue?logo=docker)
![Node](https://img.shields.io/badge/node-20-green?logo=node.js)
![Coverage](https://img.shields.io/badge/coverage-80%25%2B-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

A **production-grade DevOps project** demonstrating end-to-end software delivery: a containerised Node.js REST API, an 8-stage CI/CD pipeline with OIDC authentication and security scanning, fully modularised AWS infrastructure provisioned with Terraform, HTTPS via ACM, and a full local observability stack with Prometheus and Grafana.

This project is designed to simulate a real-world production deployment pipeline used by modern DevOps teams.

🌐 **Live:** [https://tasks.therealblessing.com](https://tasks.therealblessing.com)

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
                         │ terraform apply + ASG instance refresh
                         ▼
┌─────────────────── AWS (us-east-1) ────────────────────────────┐
│                                                                 │
│   Internet → Route53/Namecheap DNS → ALB (HTTPS:443)           │
│              ACM SSL Certificate    │                           │
│              HTTP → HTTPS redirect  │                           │
│                                     ▼                           │
│                          Auto Scaling Group (EC2 t3.small)      │
│                               │                                 │
│                          ┌────┴─────┐                           │
│                          │  Docker  │  Node.js API (port 3000)  │
│                          │ Container│  + Winston logging        │
│                          └──────────┘  + Graceful shutdown      │
│                                        + Rate limiting          │
│                          Health checks + Helmet security headers│
│                          (/health/ready)+ Kanban dashboard UI   │
│                                        + Prometheus metrics     │
│                                                                 │
│   Remote State: S3 (encrypted + versioned) + DynamoDB lock     │
│   IAM: Least-privilege role + SSM Session Manager (no bastion) │
│   EC2: IMDSv2 required, encrypted EBS (gp3, 30GB)             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────── Local Observability Stack ───────────────────────┐
│                                                                 │
│   App → Prometheus (scrapes /health/metrics) → Grafana          │
│   Nginx reverse proxy + Apache2 disabled                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Application** | Node.js 20, Express | REST API + Kanban UI |
| **Security** | Helmet, express-rate-limit, CORS | HTTP hardening |
| **Logging** | Winston (structured JSON) | Observability |
| **Metrics** | prom-client | Prometheus metrics endpoint |
| **Testing** | Jest + Supertest (19 tests) | Unit & integration tests |
| **Containerisation** | Docker (multi-stage, Alpine 3.21) | Reproducible builds |
| **Reverse Proxy** | Nginx | Load balancing, TLS termination |
| **Monitoring** | Prometheus + Grafana | Real-time metrics & dashboards |
| **CI/CD** | GitHub Actions (8 stages) | Automated delivery |
| **Auth** | OIDC (no static AWS keys) | Keyless AWS authentication |
| **Security Scanning** | Trivy | CVE scanning (filesystem + image) |
| **IaC** | Terraform 1.7 (modular) | AWS infrastructure |
| **Compute** | AWS EC2 t3.small + ASG | Scalable compute |
| **Load Balancing** | AWS ALB (HTTP + HTTPS) | Health-check routing + SSL termination |
| **SSL** | AWS ACM + Namecheap DNS | Free managed TLS certificate |
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
The ASG with instance refresh enables zero-downtime rolling deployments — new instances must pass ALB health checks before old ones are terminated. The pipeline explicitly triggers an instance refresh after every deploy to pull the latest Docker image.

**Why modular Terraform?**
`networking`, `security`, and `compute` are independent reusable modules. Each can be versioned and tested in isolation — mirrors how infrastructure scales in real teams.

**Why IMDSv2 required on EC2?**
IMDSv1 is vulnerable to SSRF attacks that can leak IAM credentials from the metadata endpoint. Requiring IMDSv2 (token-based) is enforced in the launch template.

**Why a bootstrap folder in Terraform?**
The OIDC provider, IAM role, S3 bucket, and DynamoDB table are one-time prerequisites that must exist before the pipeline can run. Keeping them in a separate `bootstrap/` module makes the chicken-and-egg relationship explicit and auditable.

**Why ACM for SSL instead of self-signed certs?**
ACM provides free, auto-renewing certificates managed by AWS. Combined with a CNAME record in Namecheap pointing to the ALB, this gives a fully trusted HTTPS endpoint with zero maintenance overhead.

**Why manual pipeline trigger?**
The pipeline runs on `workflow_dispatch` only — deploy and destroy are explicit decisions. This prevents accidental deploys and gives full control over when infrastructure changes are applied.

---

## Project Structure

```
cicd-aws-terraform-deploy/
├── app/
│   ├── src/
│   │   ├── app.js               # Entry point + graceful shutdown (SIGTERM/SIGINT)
│   │   ├── server.js            # Express + middleware + Prometheus metrics
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
│   │   └── index.html           # Kanban dashboard UI (no inline handlers)
│   ├── .eslintrc.js             # ESLint config (node + jest env)
│   ├── Dockerfile               # Multi-stage: deps → test → production
│   └── package.json             # npm overrides for transitive dep CVEs
│
├── .github/
│   └── workflows/
│       └── ci-cd.yml            # 8-stage pipeline + manual destroy + ASG refresh
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
│   │   └── compute/             # ALB, HTTPS listener, ASG, launch template, IAM
│   └── envs/
│       └── prod/                # Root module (wires modules + remote state backend)
│
├── nginx/
│   └── conf.d/app.conf          # Security headers, gzip, proxy config
├── monitoring/
│   └── prometheus.yml           # Scrape config (/health/metrics)
└── docker-compose.yml           # Local stack: app + nginx + prometheus + grafana
```

---

## Deployment Guide

### Prerequisites

- AWS account with permissions to create IAM roles, S3, DynamoDB, EC2, ALB, VPC, ACM
- AWS CLI configured locally (`us-east-1`)
- Terraform 1.7+
- Docker Hub account
- GitHub repo with Actions enabled
- Domain name (for HTTPS)

---

### Step 1 — Bootstrap AWS prerequisites (one-time)

The bootstrap creates the OIDC provider, IAM role, S3 state bucket, and DynamoDB lock table.

```bash
cd terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
github_repo       = "your-username/cicd-aws-terraform-deploy"
state_bucket_name = "cicd-aws-terraform-deploy-tfstate-<yourname>"
aws_region        = "us-east-1"
```

Apply:

```bash
terraform init
terraform apply
```

Copy the `role_arn` from the output.

---

### Step 2 — Configure GitHub Secrets

Go to repo → **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | ARN from bootstrap output |
| `AWS_REGION` | `us-east-1` |
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `TF_VAR_KEY_PAIR_NAME` | Name of existing EC2 key pair |

---

### Step 3 — Configure HTTPS (optional but recommended)

**Request an ACM certificate:**

```bash
aws acm request-certificate \
  --region us-east-1 \
  --domain-name tasks.yourdomain.com \
  --validation-method DNS
```

Add the DNS validation CNAME record to your domain registrar, wait for status `ISSUED`, then add the cert ARN to `terraform/envs/prod/main.tf`:

```hcl
module "compute" {
  ...
  certificate_arn = "arn:aws:acm:us-east-1:<account>:certificate/<id>"
}
```

Also add a CNAME record pointing `tasks.yourdomain.com` to the ALB DNS name.

---

### Step 4 — Update Terraform backend

Edit `terraform/envs/prod/main.tf`:

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

### Step 5 — Deploy

Go to **GitHub → Actions → CI/CD Pipeline → Run workflow → select `deploy`**.

On success the app is live at `https://tasks.yourdomain.com`.

---

### Destroy infrastructure

Go to **Actions → CI/CD Pipeline → Run workflow → select `destroy`**. All AWS resources are torn down cleanly.

---

## Running Locally

**Requirements:** Docker + Docker Compose

```bash
git clone https://github.com/nanafilbert/cicd-aws-terraform-deploy
cd cicd-aws-terraform-deploy

docker-compose up --build

# Access:
# App:        http://localhost:3000
# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3001  (admin / admin)
```

### Setting up Grafana locally

1. Open `http://localhost:3001` → login with `admin/admin`
2. Go to **Connections → Data Sources → Add data source**
3. Select **Prometheus** → URL: `http://prometheus:9090` → **Save & Test**
4. Go to **Dashboards → New → Import** → enter ID `11159` → **Import**

You will see real-time CPU, memory heap, event loop lag, and request metrics from your app.

### Generate load to see metrics spike

```bash
for i in {1..200}; do
  curl -s http://localhost:3000/api/tasks > /dev/null &
done
wait
```

Watch the Grafana graphs update live.

### Running Tests

```bash
cd app
npm install
npm test

# With coverage
npm run test:ci
```

Coverage thresholds: **80% branches, functions, lines, statements**.

---

## CI/CD Pipeline

Triggered manually via `workflow_dispatch` — select `deploy` or `destroy`.

```
Lint → Test → Security Scan → Build & Push → Terraform Plan → Deploy → ASG Refresh → Smoke Test → Summary
```

| Stage | What it does |
|-------|-------------|
| **🔍 Lint** | ESLint checks code quality |
| **🧪 Test** | Jest runs 19 tests, coverage enforced at 80% |
| **🔐 Security Scan** | Trivy scans dependencies — fails on HIGH/CRITICAL unfixed CVEs |
| **🐳 Build & Push** | Multi-stage Docker build, pushed to Docker Hub, SBOM generated, image rescanned |
| **📋 Terraform Plan** | `terraform plan` saved as artifact |
| **🚀 Deploy** | `terraform apply` using saved plan |
| **🔄 ASG Refresh** | Triggers rolling instance refresh — new instances pull latest image automatically |
| **✅ Smoke Test** | Polls `https://tasks.therealblessing.com/health/ready` for up to 6 minutes |
| **📊 Summary** | Pass/fail table written to GitHub Actions job summary |
| **💣 Destroy** | Manual only — `workflow_dispatch` → destroy |

### Pipeline Authentication

No AWS access keys stored anywhere. GitHub Actions uses OIDC:

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

Base URL: `https://tasks.therealblessing.com`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Kanban dashboard UI |
| `GET` | `/health` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe (ALB health check target) |
| `GET` | `/health/metrics` | JSON system metrics |
| `GET` | `/metrics` | Prometheus metrics (prom-client format) |
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

## Observability

### Prometheus Metrics (local)

The app exposes Prometheus-format metrics via `prom-client`:

```
# CPU usage
app_process_cpu_user_seconds_total

# Memory
app_nodejs_heap_size_used_bytes

# Event loop lag
app_nodejs_eventloop_lag_seconds

# Active handles
app_process_open_fds
```

### Grafana Dashboard (local)

Import dashboard ID `11159` for a pre-built Node.js metrics dashboard. Shows CPU, heap, event loop, and GC metrics in real time.

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
| Security headers | Helmet middleware (CSP, no HSTS on HTTP) |
| State encryption | S3 server-side encryption + versioning |
| npm overrides | Forced patched versions of transitive dependencies |
| HTTPS | ACM certificate + ALB HTTPS listener + HTTP→HTTPS redirect |

---

## License

MIT
