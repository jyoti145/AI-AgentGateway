# AgentGateway

A lightweight, production-style API Gateway built specifically for **AI agent workloads** — authenticating, rate-limiting, caching, monitoring, and routing requests from AI agents to downstream AI/LLM services through a single, secure gateway layer.

## Why this exists

AI agents call APIs differently than humans do — programmatically, repeatedly, and often in tight loops. Without a gateway in front of your services, any agent can call any backend directly, with no shared authentication, no protection against a misbehaving agent hammering your infrastructure, no caching of redundant/expensive calls, and no visibility into abuse patterns.

AgentGateway centralizes all of that into one pipeline that every request passes through before it ever reaches a real backend service:

```
Agent Request
   │
   ▼
┌────────────────────────────────────────────────────────────────┐
│  Rate Limiter → JWT Auth → RBAC → Cache → Anomaly Check → Proxy  │
└────────────────────────────────────────────────────────────────┘
   │
   ▼
Downstream AI/LLM Service
```

Each stage is an independent Express middleware with exactly one responsibility — any stage can reject or short-circuit a request early, so a misbehaving or unauthorized request never gets anywhere near the real backend.

## Features

- **Redis sliding-window rate limiting** — 50 req/min per caller, implemented atomically via a Lua script (no race conditions between concurrent requests), rejecting excess traffic with `429` before it costs a single downstream API call.
- **JWT authentication** with short-lived access tokens (15 min) and long-lived refresh tokens (7 days).
- **Refresh token rotation with reuse detection** — every refresh issues a brand-new token pair and invalidates the old one; presenting an already-used refresh token revokes the entire session, treating replay as a possible compromise.
- **Role-Based Access Control (RBAC)** — a reusable `authorizeRoles(...roles)` middleware factory protecting admin-only routes (e.g. agent management) from regular agents.
- **Response caching** — identical proxied requests within a TTL window are served from Redis instead of hitting the downstream AI service again, cutting redundant LLM API cost and latency.
- **Threshold-based anomaly detection** — callers repeatedly hitting their rate limit are flagged and logged as structured JSON events to an AWS S3 bucket for audit/review, without blocking legitimate traffic.
- **Reverse proxy to a real downstream AI service** — authenticated, authorized, rate-limited, cached requests are forwarded to a live LLM completion endpoint and the response relayed back to the agent.
- **MongoDB-backed Agent identity store** — API keys and refresh tokens are never stored in plain text, only as bcrypt hashes.
- **Dockerized** — the entire gateway runs as a single container, with `docker-compose` for local orchestration alongside Redis.
- **Tested** — Jest + Supertest coverage over the auth flow, RBAC, and rate limiter.

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ES Modules) |
| Framework | Express |
| Database | MongoDB (Mongoose) |
| Rate limiting / caching store | Redis (ioredis) |
| Auth | JWT (jsonwebtoken), bcrypt |
| Object storage (anomaly logs) | AWS S3 |
| Containerization | Docker, Docker Compose |
| Testing | Jest, Supertest |

## Project structure

```
src/
├── config/
│   ├── db.js                      # MongoDB connection
│   ├── redis.js                   # Redis connection
│   └── s3.js                      # AWS S3 client config
├── controllers/
│   ├── auth.controller.js         # login / refresh / logout
│   ├── agent.controller.js        # admin-only agent management
│   └── proxy.controller.js        # forwards requests to the downstream AI service
├── middleware/
│   ├── auth.middleware.js         # JWT access-token verification
│   ├── rbac.middleware.js         # role-based route protection
│   ├── rateLimiter.middleware.js  # Redis sliding-window rate limiter
│   ├── cache.middleware.js        # Redis response cache
│   └── anomaly.middleware.js      # threshold-based abuse flagging → S3
├── models/
│   └── Agent.model.js             # Agent schema (identity, role, rate tier)
├── routes/
│   ├── auth.routes.js
│   ├── agent.routes.js
│   └── proxy.routes.js
├── scripts/
│   ├── seedAgent.js               # creates a test agent (role: agent)
│   └── seedAdmin.js               # creates a test agent (role: admin)
├── utils/
│   ├── token.util.js              # JWT signing helpers
│   └── s3Logger.util.js           # writes anomaly events to S3
└── server.js                      # app entry point

tests/                             # Jest + Supertest suites
Dockerfile
docker-compose.yml
```

## Getting started

### Prerequisites
- Node.js v18+
- MongoDB connection string ([MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free tier works)
- Redis connection string ([Upstash](https://upstash.com) or Redis Cloud free tier works)
- AWS account with an S3 bucket + IAM credentials (for anomaly log storage)
- Docker (optional, for containerized run)

### Installation

```bash
git clone https://github.com/jyoti145/AI-AgentGateway.git
cd AI-AgentGateway
npm install
```

### Environment variables

Create a `.env` file in the project root (see `.env.example`):

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
REDIS_URL=your_redis_connection_string
JWT_ACCESS_SECRET=long_random_string
JWT_REFRESH_SECRET=another_long_random_string
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=your_aws_region
S3_BUCKET_NAME=your_bucket_name
DOWNSTREAM_AI_API_URL=your_llm_provider_endpoint
DOWNSTREAM_AI_API_KEY=your_llm_provider_key
```

Generate strong JWT secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Seed test agents

```bash
npm run seed        # creates a regular agent (name: billing-bot)
npm run seed:admin   # creates an admin agent (name: admin-bot)
```
Each script prints a plain-text API key **once** — save it; only its hash is stored afterward.

### Run locally

```bash
npm run dev
```

### Run with Docker

```bash
docker-compose up --build
```
This starts the gateway container alongside a local Redis instance (MongoDB and S3 remain cloud-hosted).

### Run tests

```bash
npm test
```

## API reference

### `GET /health`
Health check. No auth required.

### `POST /auth/login`
```json
{ "name": "billing-bot", "apiKey": "your-api-key" }
```
Returns `{ accessToken, refreshToken }`.

### `POST /auth/refresh`
```json
{ "refreshToken": "..." }
```
Rotates the refresh token, returning a new pair. Reusing an already-rotated token returns `403` and revokes the session.

### `POST /auth/logout`
Requires `Authorization: Bearer <accessToken>`. Invalidates the current refresh token.

### `GET /agents`
Requires an **admin**-role access token. Returns all agents, excluding hashed credentials.

### `POST /api/proxy/chat`
Requires a valid access token. Forwards the request body to the configured downstream AI service and returns its response. Subject to rate limiting, caching, and anomaly monitoring like every other route.

## Rate limiting & caching

Every request passes through the Redis sliding-window limiter (50 req/min per caller) before reaching any route — including `/auth/login`, protecting the gateway itself from brute-force attempts. Requests to `/api/proxy/chat` are additionally cached by request signature for a short TTL, so identical calls don't redundantly hit the downstream AI provider (and its cost) twice.

## Anomaly detection

Callers who repeatedly hit their rate limit are flagged by the anomaly middleware and logged as structured events (`agent/IP, timestamp, endpoint, reason`) to an S3 bucket — creating an audit trail for reviewing abuse patterns without blocking legitimate traffic outright.

## Architecture decisions worth knowing

- **Rate limiting runs before authentication** — deliberately, so unauthenticated brute-force attempts against `/auth/login` are throttled before they can even attempt credential guessing.
- **Refresh tokens are stored (hashed) in the database, access tokens are not** — access tokens stay stateless and fast to verify; refresh tokens trade a bit of statelessness for revocability.
- **The sliding-window rate limiter uses a Lua script**, not separate read-then-write Redis calls, specifically to make the check-and-increment operation atomic and eliminate race conditions under concurrent requests.

## License

ISC
