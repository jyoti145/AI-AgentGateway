# AgentGateway

A lightweight API Gateway built for **AI agent workloads** — authenticating, rate-limiting, and routing requests from AI agents to downstream services through a single gateway layer.

## Why this exists

AI agents call APIs differently than humans do — programmatically, repeatedly, and often in tight loops. Without a gateway in front of your services, any agent can call any backend directly, with no shared authentication, no protection against a misbehaving agent hammering your infrastructure, and no visibility into abuse patterns.

AgentGateway centralizes that into one pipeline every request passes through:

```
Agent Request
   │
   ▼
┌──────────────────────────────────────────┐
│  Rate Limiter  →  JWT Auth  →  RBAC  →     │
│  Proxy                                     │
└──────────────────────────────────────────┘
   │
   ▼
Downstream Service
```

Each stage is an independent Express middleware with one job — any stage can reject a request early without the rest of the pipeline ever running.

## Features

**Implemented:**
- ✅ Redis-backed **rate limiting** (50 req/min per IP) using an atomic `INCR` counter with TTL-based expiry, returning `429` once exceeded
- ✅ **JWT authentication** with short-lived access tokens and long-lived, rotating refresh tokens
- ✅ **Refresh token rotation with reuse detection** — a replayed/stolen refresh token triggers full session revocation
- ✅ **Role-Based Access Control (RBAC)** — a reusable, parameterized middleware factory (`authorizeRoles(...roles)`) protecting admin-only routes
- ✅ **Reverse proxy** — forwards authenticated requests to a downstream AI/LLM service and relays the response back
- ✅ MongoDB-backed Agent identity store, with API keys and refresh tokens stored only as bcrypt hashes

**Planned:**
- 🔜 Logging rate-limited/flagged requests to an AWS S3 bucket
- 🔜 React admin dashboard (login + agent list view)
- 🔜 Automated tests

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ES Modules) |
| Framework | Express |
| Database | MongoDB (Mongoose) |
| Rate limiting store | Redis (ioredis) |
| Auth | JWT (jsonwebtoken), bcrypt |
| Planned | AWS S3, React |

## Project structure

```
src/
├── config/
│   ├── db.js                    # MongoDB connection
│   └── redis.js                 # Redis connection
├── controllers/
│   ├── auth.controller.js       # login / refresh / logout logic
│   ├── agent.controller.js      # admin-only agent management
│   └── proxy.controller.js      # forwards requests to downstream AI service
├── middleware/
│   ├── auth.middleware.js       # JWT access-token verification
│   ├── rbac.middleware.js       # role-based route protection
│   └── rateLimiter.middleware.js # Redis fixed-window rate limiter
├── models/
│   └── Agent.model.js           # Agent schema (identity, role, rate tier)
├── routes/
│   ├── auth.routes.js
│   ├── agent.routes.js
│   └── proxy.routes.js
├── scripts/
│   ├── seedAgent.js              # creates a test agent (role: agent)
│   └── seedAdmin.js              # creates a test agent (role: admin)
├── utils/
│   └── token.util.js             # JWT signing helpers
└── server.js                     # app entry point
```

## Getting started

### Prerequisites
- Node.js v18+
- A MongoDB connection string (e.g. free tier on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
- A Redis connection string (e.g. free tier on [Upstash](https://upstash.com))

### Installation

```bash
git clone https://github.com/jyoti145/AI-AgentGateway.git
cd AI-AgentGateway
npm install
```

### Environment variables

Create a `.env` file in the project root:

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
REDIS_URL=your_redis_connection_string
JWT_ACCESS_SECRET=long_random_string
JWT_REFRESH_SECRET=another_long_random_string
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
DOWNSTREAM_AI_API_URL=your_llm_provider_endpoint
DOWNSTREAM_AI_API_KEY=your_llm_provider_key
DOWNSTREAM_AI_MODEL=your_model_name
```

Generate strong secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Seed test agents

```bash
npm run seed        # creates a regular agent (name: billing-bot)
npm run seed:admin   # creates an admin agent (name: admin-bot)
```
Each script prints a plain-text API key **once** — save it, it isn't recoverable afterward.

### Run the server

```bash
npm run dev
```

Server starts on `http://localhost:5000`.

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
Rotates the refresh token and returns a new `{ accessToken, refreshToken }` pair. Reusing an already-rotated refresh token returns `403` and revokes the session.

### `POST /auth/logout`
Requires `Authorization: Bearer <accessToken>`. Invalidates the current refresh token.

### `GET /agents`
Requires an **admin**-role access token. Returns all agents (excluding hashed credentials).

### `POST /api/proxy/chat`
Requires a valid access token. Forwards `{ "message": "..." }` to the configured downstream AI service and returns `{ "reply": "..." }`.

## Rate limiting

Every request is checked against a Redis-backed fixed-window counter (50 requests/minute per IP) before reaching any route, including `/auth/login` — protecting the gateway from brute-force attempts, not just downstream services. Requests over the limit receive `429 Too Many Requests`.

## Architecture decisions worth knowing

- **Rate limiting runs before authentication** — deliberately, so unauthenticated brute-force attempts against `/auth/login` are throttled before they can even attempt credential guessing.
- **Refresh tokens are stored (hashed) in the database, access tokens are not** — access tokens stay stateless and fast to verify; refresh tokens trade a bit of statelessness for revocability.
- **Every refresh issues a brand-new token pair and invalidates the old one** — reusing an already-rotated refresh token is treated as a possible compromise and revokes the entire session.

## License

ISC
