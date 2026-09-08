# Auth Service (Flux)

The **auth-service** provides **OAuth2 Single Sign-On (SSO)** and **JWT-based session management** for the **Flux platform**.

It enables users to authenticate seamlessly with third-party identity providers (**Google** and **GitHub**), persists user profiles in **MongoDB**, and issues secure, HTTP-only JWT cookies that are verified across the platform.

The service is exposed behind the **Nginx reverse proxy** under the `/auth/` route prefix.

---

## 🎯 Responsibilities

The auth-service owns:

* Managing **Google** and **GitHub** OAuth2 authorization flows
* Persisting and updating user profiles in **MongoDB** via Mongoose
* Minting signed **JSON Web Tokens (JWT)** upon successful authentication
* Setting and clearing secure, `HttpOnly` session cookies
* Providing a `/auth/me` endpoint to verify authentication state
* Gracefully handling disabled or unconfigured OAuth providers

It does **not**:

* Mediate real-time WebSocket traffic (handled by the **Flux BFF**)
* Directly interact with Kafka (real-time data streaming is decoupled from authentication)
* Expose ports directly to the public internet (all traffic routes through Nginx)

---

## 🧠 High-Level Architecture

```
User Browser
    │
    │ 1. Click "Sign in with Google/GitHub"
    ▼
Nginx Reverse Proxy (/auth/*)
    │
    ▼
Auth Service (Express + Passport.js)
    │
    ├─ 2. Redirect to OAuth Provider (Google / GitHub)
    │
    ├─ 3. Receive OAuth Callback + Authorization Code
    │
    ├─ 4. Exchange code for user profile
    │
    ├─ 5. Upsert User in MongoDB (Mongoose)
    │
    ├─ 6. Issue signed JWT in HttpOnly Cookie (`flux_auth_token`)
    │
    ▼
Redirect back to Frontend (`CLIENT_SUCCESS_REDIRECT`)
```

---

## 📦 Directory Structure

```
auth-service/
│
├── src/
│   ├── config/
│   │   ├── env.ts              # Zod environment variable parsing & validation
│   │   ├── mongodb.ts          # Mongoose database connection lifecycle
│   │   └── passport.ts         # Passport.js Google & GitHub strategy setup
│   │
│   ├── controllers/
│   │   └── auth.controller.ts  # Route handlers (callback, /me, /logout)
│   │
│   ├── logger/
│   │   └── index.ts            # Structured logging (Pino)
│   │
│   ├── models/
│   │   └── user.model.ts       # Mongoose User schema & model
│   │
│   ├── routes/
│   │   └── auth.routes.ts      # Express route definitions
│   │
│   ├── services/
│   │   ├── auth.service.ts     # User upsert & lookup logic
│   │   └── token.service.ts    # JWT signing, verification, and cookie options
│   │
│   ├── types/
│   │   └── index.ts            # Shared TypeScript types & interfaces
│   │
│   ├── app.ts                  # Express application setup & middleware
│   └── server.ts               # HTTP server bootstrap & MongoDB connection
│
├── tests/
│   ├── integration/            # End-to-end OAuth & database tests
│   ├── unit/                   # Controller & service unit tests
│   └── setup.ts                # Jest environment configuration
│
├── Dockerfile                  # Container build definition
├── package.json
├── tsconfig.json
├── tsconfig.test.json
├── .env.example
└── README.md
```

---

## 🗄 Data Model (MongoDB)

User accounts are stored in MongoDB using the `User` schema:

```typescript
{
  userId: string;         // Unique deterministic identifier (UUID)
  provider: 'google' | 'github';
  providerId: string;     // Unique subject ID from OAuth provider
  email: string | null;   // User email address
  name: string;           // Display name
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

A compound unique index on `{ provider: 1, providerId: 1 }` guarantees that each external account maps to exactly one user record.

---

## 🔑 Session & JWT Strategy

Authentication state is maintained via a signed JWT stored inside an `HttpOnly` cookie:

* **Cookie Name**: `flux_auth_token`
* **Expiration**: 1 day (`JWT_EXPIRES_IN=1d`)
* **Flags**:
  - `HttpOnly: true` (prevents client-side JavaScript access / XSS mitigation)
  - `SameSite: Lax` (or `None` in production cross-origin setups)
  - `Secure: true` in production environments
* **Payload**: Includes `userId`, `name`, `email`, and `provider`.

---

## 🌐 API Endpoints & Nginx Routing

All endpoints are mounted under `/auth` by Nginx:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/auth/google` | Redirects user to Google OAuth consent screen |
| `GET` | `/auth/google/callback` | Handles Google OAuth callback, sets cookie, redirects |
| `GET` | `/auth/github` | Redirects user to GitHub OAuth consent screen |
| `GET` | `/auth/github/callback` | Handles GitHub OAuth callback, sets cookie, redirects |
| `GET` | `/auth/me` | Returns current authenticated user profile from JWT cookie |
| `POST` | `/auth/logout` | Clears the `flux_auth_token` cookie |

If an OAuth provider is not configured (missing client ID/secret), the service responds with `503 Service Unavailable`.

---

## ⚙️ Environment Variables

The service validates all environment configuration at startup using **Zod**:

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `4001` | HTTP port the service listens on |
| `NODE_ENV` | No | `development` | Runtime environment (`development`, `test`, `production`) |
| `LOG_LEVEL` | No | `info` | Pino log level (`trace`, `debug`, `info`, `warn`, `error`) |
| `CLIENT_ORIGIN` | No | `http://localhost` | Allowed CORS origin for the frontend |
| `JWT_SECRET` | **Yes** | — | Cryptographic secret key used to sign session JWTs |
| `JWT_EXPIRES_IN` | No | `1d` | Expiration duration for signed JWTs |
| `COOKIE_NAME` | No | `flux_auth_token` | Name of the session cookie |
| `CLIENT_SUCCESS_REDIRECT` | No | `http://localhost/auth/success` | URL where user is redirected after successful OAuth login |
| `CLIENT_FAILURE_REDIRECT` | No | `http://localhost/auth/failure` | URL where user is redirected if OAuth login fails |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string (e.g. Atlas or local instance) |
| `MONGODB_DB_NAME` | No | `flux_auth` | Target MongoDB database name |
| `GOOGLE_CLIENT_ID` | Optional | `""` | Google OAuth2 Client ID (from Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | Optional | `""` | Google OAuth2 Client Secret |
| `GOOGLE_CALLBACK_URL` | No | `http://localhost/auth/google/callback` | Registered callback URI in Google Cloud Console |
| `GITHUB_CLIENT_ID` | Optional | `""` | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | Optional | `""` | GitHub OAuth App Client Secret |
| `GITHUB_CALLBACK_URL` | No | `http://localhost/auth/github/callback` | Registered callback URI in GitHub Developer Settings |

---

## 🧪 Testing

```bash
# Run unit & integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate code coverage
npm run test:coverage
```
