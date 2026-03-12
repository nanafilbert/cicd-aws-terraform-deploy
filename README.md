# cicd-aws-terraform-deploy

![CI/CD](https://github.com/your-username/cicd-aws-terraform-deploy/actions/workflows/ci-cd.yml/badge.svg)
![AWS](https://img.shields.io/badge/AWS-deployed-orange?logo=amazon-aws)
![Terraform](https://img.shields.io/badge/terraform-1.7-blueviolet?logo=terraform)
![Docker](https://img.shields.io/badge/docker-multi--stage-blue?logo=docker)
![Node](https://img.shields.io/badge/node-20-green?logo=node.js)
![Coverage](https://img.shields.io/badge/coverage-80%25%2B-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

A **production-grade DevOps project** demonstrating end-to-end software delivery: a containerised Node.js REST API, a 7-stage CI/CD pipeline with security scanning, and fully modularised AWS infrastructure provisioned with Terraform.

Built to reflect real-world engineering standards — not a tutorial.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Actions                           │
│  Lint → Test → Security Scan → Build → Plan → Deploy → Smoke   │
└────────────────────────────┬────────────────────────────────────┘
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
│              │     │ Container│  + Winston logging              │
│              │     └──────────┘  + Graceful shutdown            │
│              │                   + Rate limiting                 │
│         Health checks            + Helmet security headers      │
│         (/health/ready)                                         │
│                                                                 │
│   Remote State: S3 + DynamoDB lock                             │
│   IAM: Least-privilege EC2 role + SSM (no bastion needed)      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Application** | Node.js 20, Express | REST API |
| **Security** | Helmet, express-rate-limit, CORS | HTTP hardening |
| **Logging** | Winston (structured JSON) | Observability |
| **Testing** | Jest + Supertest | Unit & integration tests |
| **Containerisation** | Docker (multi-stage build) | Reproducible builds |
| **Reverse Proxy** | Nginx | Load balancing, TLS termination |
| **Monitoring** | Prometheus + Grafana | Metrics & alerting |
| **CI/CD** | GitHub Actions (7 stages) | Automated delivery |
| **Security Scanning** | Trivy | CVE scanning (filesystem + image) |
| **IaC** | Terraform 1.7 (modular) | AWS infrastructure |
| **Compute** | AWS EC2 + Auto Scaling Group | Scalable compute |
| **Load Balancing** | AWS ALB | Health-check routing |
| **State Management** | S3 + DynamoDB | Remote Terraform state |
| **Access** | AWS SSM Session Manager | No SSH bastion needed |

---

## Key Engineering Decisions

**Why a multi-stage Dockerfile?**
Separates build-time tools from the runtime image. The production image contains only what's needed to run — significantly smaller and with a reduced attack surface.

**Why Auto Scaling Group instead of a single EC2 instance?**
The ASG with instance refresh enables zero-downtime rolling deployments — new instances are healthy-checked by the ALB before old ones are terminated.

**Why modular Terraform?**
`networking`, `security`, and `compute` are independent modules. This mirrors how infrastructure scales in real teams — each module can be versioned, tested, and reused independently.

**Why IMDSv2 required on EC2?**
IMDSv1 is vulnerable to SSRF attacks. Requiring IMDSv2 (token-based) is an AWS security best practice enforced in the launch template.

**Why Trivy for security scanning?**
Trivy scans both the filesystem (dependencies) and the built Docker image for known CVEs before anything is pushed or deployed. The pipeline fails on HIGH or CRITICAL vulnerabilities.

---

## Project Structure

```
production-ready-devops/
├── app/
│   ├── src/
│   │   ├── app.js               # Entry point + graceful shutdown
│   │   ├── server.js            # Express app + all middleware
│   │   ├── routes/
│   │   │   ├── tasks.js         # CRUD endpoints
│   │   │   └── health.js        # Liveness, readiness, metrics
│   │   ├── middleware/
│   │   │   ├── errorHandler.js  # Centralised error handling
│   │   │   └── validator.js     # Request validation
│   │   └── utils/
│   │       └── logger.js        # Structured JSON logging (Winston)
│   ├── tests/
│   │   └── api.test.js          # 18 integration tests
│   ├── public/
│   │   └── index.html           # Kanban dashboard UI
│   ├── Dockerfile               # Multi-stage (deps → test → production)
│   └── package.json
│
├── .github/
│   └── workflows/
│       └── ci-cd.yml            # 7-stage pipeline
│
├── terraform/
│   ├── modules/
│   │   ├── networking/          # VPC, subnets, IGW, route tables
│   │   ├── security/            # Security groups (ALB + app, least-privilege)
│   │   └── compute/             # ALB, ASG, launch template, IAM, scaling policy
│   └── envs/
│       └── prod/                # Root module (wires modules + remote state)
│
├── nginx/
│   └── conf.d/app.conf          # Security headers, gzip, proxy config
├── monitoring/
│   └── prometheus.yml           # Scrape config
└── docker-compose.yml           # Full local stack (app + nginx + prometheus + grafana)
```

---

## Running Locally

**Requirements:** Docker + Docker Compose

```bash
git clone https://github.com/your-username/production-ready-devops
cd production-ready-devops

# Start full stack (app + nginx + prometheus + grafana)
docker-compose up --build

# Access points:
# App:        http://localhost
# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3001  (admin / admin)
```

## Running Tests

```bash
cd app
npm install
npm test

# With coverage report
npm run test:ci
```

**Test coverage requirement:** 80% across branches, functions, lines, and statements (enforced in CI).

---

## CI/CD Pipeline

Every push to `main` triggers a 7-stage pipeline:

```
Lint → Test → Security Scan → Build & Push → Terraform Plan → Deploy → Smoke Test
```

| Stage | What it does |
|-------|-------------|
| **Lint** | ESLint checks code quality |
| **Test** | Jest runs 18 tests + coverage enforced at 80% |
| **Security Scan** | Trivy scans dependencies for CVEs — pipeline fails on HIGH/CRITICAL |
| **Build & Push** | Multi-stage Docker build, pushed to Docker Hub with SHA + semver tags, SBOM generated |
| **Image Scan** | Trivy rescans the built image |
| **Terraform Plan** | `terraform plan` output posted as a PR comment for review |
| **Deploy** | `terraform apply` with rolling ASG instance refresh |
| **Smoke Test** | Polls `/health/ready` for 2 minutes post-deploy — fails the pipeline if unhealthy |

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `AWS_ACCESS_KEY_ID` | AWS IAM key (least-privilege policy) |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret |
| `AWS_REGION` | Target region (e.g. `us-east-1`) |

---

## Terraform Setup

```bash
# 1. Create S3 bucket and DynamoDB table for remote state (one-time)
aws s3 mb s3://production-ready-devops-tfstate
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# 2. Deploy
cd terraform/envs/prod
terraform init
terraform plan -var="key_pair_name=your-key" -var="dockerhub_username=yourusername"
terraform apply
```

After `apply`, Terraform outputs the ALB DNS name to point your domain at.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe (used by ALB) |
| `GET` | `/health/metrics` | Process + system metrics |
| `GET` | `/api` | Endpoint manifest |
| `GET` | `/api/tasks` | List tasks (`?status=`, `?priority=`, `?sort=`) |
| `GET` | `/api/tasks/:id` | Get single task |
| `POST` | `/api/tasks` | Create task |
| `PATCH` | `/api/tasks/:id` | Update task |
| `DELETE` | `/api/tasks/:id` | Delete task |

All responses follow a consistent envelope: `{ data: ... }` for success, `{ error: { message, status, details? } }` for errors.

---

## License

MIT
