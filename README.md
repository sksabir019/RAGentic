docker-compose -f docker-compose.dev.yml up
# RAGentic

Enterprise-ready retrieval-augmented generation platform with a modular multi-agent architecture, TypeScript end to end, and first-class DevOps tooling.

## Table of Contents

- [Overview](#overview)
- [System Highlights](#system-highlights)
- [Architecture Snapshot](#architecture-snapshot)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Quick Start with Docker Compose](#quick-start-with-docker-compose)
  - [Manual Setup](#manual-setup)
- [Services](#services)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Development Workflow](#development-workflow)
- [Documentation](#documentation)
- [License & Support](#license--support)

## Overview

RAGentic combines a React frontend, an Express API gateway, and six specialized microservices to deliver production-ready retrieval-augmented generation. Upload documents, extract knowledge, and serve contextual answers with source citations, confidence scoring, and audit trails.

## System Highlights

- **Multi-agent pipeline** powered by CrewAI: ingestion, parsing, retrieval, ranking, generation, and validation agents.
- **TypeScript everywhere** with shared domain models, strong typing, and consistent linting.
- **Enterprise foundations**: JWT auth, RBAC-ready user model, rate limiting, structured logging, and distributed tracing.
- **Adaptive RAG engine** with keyword fallback, Groq/OpenAI LLM support, and document chunk management backed by pgvector similarity search.
- **Asynchronous ingestion** pipeline powered by Redis + BullMQ workers to keep uploads fast.
- **Operational visibility** with ingestion status endpoints and job history for troubleshooting.
- **Self-service reprocessing** so users can requeue documents without re-uploading data.
- **Composable infrastructure**: Docker Compose for local orchestration, Redis caching, MongoDB or Postgres pluggable via adapter layer.

## Architecture Snapshot

```
Frontend (React) ─┐
                  ├── REST API Gateway (Express) ─── Redis Cache
Agents (CrewAI) ──┘            │
                               ├── Database Adapter (Postgres | MongoDB)
                               └── AI Providers (OpenAI, Groq) → RAG Service → Clients
```

Each agent exposes a focused contract, enabling independent scaling and fault isolation. The API gateway handles authentication, document processing, query routing, and history persistence.

## Getting Started

### Prerequisites

- Docker Desktop **20.10+**
- Node.js **18+** and npm **9+** (for local development)
- Optional: Python **3.11** for crew control workflows

### Quick Start with Docker Compose

```bash
# Copy environment template and adjust values as needed
cp .env.example .env

# Launch the full stack (backend, frontend, agents, databases, ingestion worker)
docker-compose -f docker-compose.dev.yml up --build

# Health checks
curl http://localhost:3000/health          # Backend API
curl http://localhost:3001/health || true  # Ingestion agent (if enabled)
```

Access points:

- Frontend SPA: `http://localhost:3001`
- REST API: `http://localhost:3000/api`
- Agents: `http://localhost:3001-3006`

Stop the stack:

```bash

```

### Manual Setup

```bash
npm run install:all        # Install root, frontend, backend dependencies

cd backend
npm run migrate            # Apply database migrations (requires Postgres with vector extension)
npm run dev                # Starts API gateway (requires database + redis)
npm run worker:documents   # In a second terminal, start the ingestion worker

cd ../frontend
npm run dev                # Starts Vite dev server at http://localhost:5173
```

Recommended companion services for manual runs:

- MongoDB or Postgres (configure via `.env`)
- Redis (for caching and rate limiting)

## Services

| Component | Location | Purpose |
|-----------|----------|---------|
| Frontend SPA | `frontend/` | React + Vite chat interface, uploads, analytics |
| API Gateway | `backend/` | Auth, document processing, RAG orchestration |
| Agents | `agents/` | CrewAI-powered microservices for ingestion, parsing, retrieval, ranking, generation, validation |
| Crew Control | `crew-control/` | Python orchestration utilities |
| Infra | `infra/` | Infrastructure-as-code, deployment assets |

## Project Structure

```
ragentic/
├── frontend/              # React 18 + Tailwind UI, see frontend/README.md
├── backend/               # Express API gateway, see backend/README.md
├── agents/                # Specialized microservices
├── crew-control/          # CrewAI orchestration (Python)
├── infra/                 # Terraform/K8s/infra templates
├── docs/ *.md             # Architecture and process documentation
├── docker-compose.*.yml   # Environment stacks
└── package.json           # Monorepo tooling entry
```

## Configuration

- Copy `.env.example` to `.env` at the repository root.
- Key variables:
  - `DATABASE_TYPE`, `DB_*` or `MONGO_*` for persistence backend.
  - `REDIS_URL` for caching and rate limiting.
  - `VECTOR_DIMENSION` for pgvector embedding size, `DOCUMENT_INGESTION_*` for queue behaviour.
  - `OPENAI_API_KEY`, `GROQ_API_KEY`, `LLM_PROVIDER` for LLM selection.
  - `MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES` for ingestion guardrails.
  - Agent URLs (`INGESTION_AGENT_URL`, etc.) when running distributed microservices.
- Frontend-specific values (e.g., `REACT_APP_API_URL`) can be overridden via environment or `.env` files inside `frontend/`.

## Development Workflow

```bash
npm run lint            # Root lint task
cd backend && npm run lint
cd frontend && npm run lint

npm test                # Run backend unit tests (Jest)
docker logs backend     # Tail API gateway logs when using Docker
npm run worker:documents # Start ingestion worker (backend)

# Formatting & quality
cd backend && npm run lint:fix
cd frontend && npm run format   # if configured via package scripts
```

Recommended steps when contributing:

1. Branch from `main`.
2. Update or add tests for behavioral changes.
3. Run lint and unit tests locally.
4. Document relevant changes in the appropriate README.

## Documentation

- **Frontend Guide**: [`frontend/README.md`](frontend/README.md)
- **Backend Guide**: [`backend/README.md`](backend/README.md)
- **Architecture Overview**: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- **Agent Contracts**: [`AGENT_SPEC.md`](AGENT_SPEC.md)
- **Crew Workflows**: [`WORKFLOW.md`](WORKFLOW.md)
- **Design Decisions**: [`DESIGN_PRINCIPLES.md`](DESIGN_PRINCIPLES.md)
- **Database Options**: [`DATABASE_SETUP.md`](DATABASE_SETUP.md)
- **Implementation Checklist**: [`IMPLEMENTATION.md`](IMPLEMENTATION.md)

## License & Support

- Distributed under the MIT License (align with your organization’s compliance policies before release).
- File issues and feature requests through GitHub Issues.
- For operational questions, consult the documentation listed above or contact the maintainers referenced in project metadata.
