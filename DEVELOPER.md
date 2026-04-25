# PaceScope Developer Guide

PaceScope is a self-hosted web application for centralizing and analyzing running activities. Users upload GPX files or sync from Strava, then explore metrics through personal dashboards, activity comparisons, and a global leaderboard. An admin panel provides user management. The stack is Next.js 16 (App Router), PostgreSQL, Prisma, and NextAuth v5.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Architecture](#2-architecture)
3. [Project Structure](#3-project-structure)
4. [Database](#4-database)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [API Reference](#6-api-reference)
7. [Core Libraries](#7-core-libraries)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Adding a New Feature](#9-adding-a-new-feature)
10. [Testing](#10-testing)
11. [Security](#11-security)
12. [Deployment](#12-deployment)
13. [Code Conventions](#13-code-conventions)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Quick Start

### Prerequisites

- Node.js 20+ (tested on 25.x)
- PostgreSQL 16
- Docker & Docker Compose (optional, for containerized setup)

### Local Setup

```bash
# Clone and install
git clone <repo-url> && cd pacescope
npm install

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY (see section 12)

# Set up database
npm run db:push       # push schema to PostgreSQL
npm run db:seed       # create admin user (admin@pacescope.local / Admin123!)

# Run
npm run dev           # http://localhost:3000
```

### Docker Setup

```bash
# Requires AUTH_SECRET in your shell environment or .env
export AUTH_SECRET=$(openssl rand -base64 32)
docker compose up --build
```

The app is available at `http://localhost:3000`. PostgreSQL runs on port 5432.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Create and apply migration |
| `npm run db:push` | Push schema without migration |
| `npm run db:seed` | Seed admin user |

---

## 2. Architecture

### High-Level Overview

```
                                    ┌──────────────────┐
                                    │   Strava API     │
                                    └────────┬─────────┘
                                             │ OAuth + REST
┌──────────┐    HTTPS    ┌──────────────────────────────────────────┐
│  Browser │ ──────────► │              Next.js 16                  │
│  (React) │ ◄────────── │                                          │
└──────────┘             │  ┌────────────┐   ┌───────────────────┐  │
                         │  │ Middleware  │──►│   API Routes      │  │
                         │  │ (auth +    │   │   (app/api/*)     │  │
                         │  │  headers)  │   └────────┬──────────┘  │
                         │  └────────────┘            │             │
                         │                    ┌───────▼──────────┐  │
                         │                    │   Prisma ORM     │  │
                         │                    └───────┬──────────┘  │
                         └────────────────────────────┼─────────────┘
                                                      │
                                              ┌───────▼──────────┐
                                              │   PostgreSQL 16  │
                                              └──────────────────┘
```

### Request Lifecycle

1. **Browser** sends request
2. **Middleware** (`middleware.ts`) runs on every matched route:
   - Checks authentication via NextAuth
   - Redirects unauthenticated users to `/login`
   - Checks admin role for `/admin` and `/api/admin` routes
   - Applies security headers to every response
3. **Route handler** (API route or Server Component) executes
4. **Prisma** queries PostgreSQL
5. **Response** returned with security headers

### App Router Structure

Next.js App Router uses **route groups** to organize pages without affecting URL structure:

```
app/
├── (auth)/          # Public auth pages — /login, /register
├── (dashboard)/     # Protected pages — /dashboard, /activities, /global, etc.
├── admin/           # Admin-only pages — /admin/users
└── api/             # API route handlers
```

- `(auth)` and `(dashboard)` are route groups (parentheses = no URL segment)
- Each group has its own `layout.tsx` for distinct layouts
- `(auth)` layout: centered card with no sidebar
- `(dashboard)` layout: sidebar + header + scrollable main area

### Server vs Client Components

| Component Type | Where Used | Why |
|---------------|-----------|-----|
| **Server Components** | Pages, layouts, data-fetching wrappers | Direct `await auth()` and Prisma access, zero client JS |
| **Client Components** | Forms, interactive charts, maps, filters | Need `useState`, `useEffect`, event handlers |

Convention: Client components are marked with `"use client"` at the top. Pages are server components that pass data to client components as props or render them as children.

---

## 3. Project Structure

```
pacescope/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root HTML layout
│   ├── page.tsx                      # / — redirects to /dashboard or /login
│   ├── globals.css                   # Tailwind CSS imports
│   ├── (auth)/                       # Auth route group
│   │   ├── layout.tsx                # Centered card layout
│   │   ├── login/page.tsx            # Login page
│   │   └── register/page.tsx         # Registration page
│   ├── (dashboard)/                  # Protected route group
│   │   ├── layout.tsx                # Sidebar + header layout
│   │   ├── dashboard/page.tsx        # Main dashboard
│   │   ├── activities/
│   │   │   ├── page.tsx              # Activity list
│   │   │   ├── [id]/page.tsx         # Activity detail (map, charts)
│   │   │   ├── upload/page.tsx       # GPX upload form
│   │   │   └── compare/page.tsx      # Side-by-side comparison
│   │   ├── global/page.tsx           # Global leaderboard
│   │   ├── strava/page.tsx           # Strava connection manager
│   │   └── settings/page.tsx         # User settings
│   ├── admin/
│   │   ├── layout.tsx                # Admin layout guard
│   │   └── users/page.tsx            # User management table
│   └── api/                          # API endpoints (see section 6)
│       ├── auth/
│       ├── activities/
│       ├── dashboard/
│       ├── strava/
│       ├── admin/
│       ├── user/
│       └── health/
│
├── components/                       # React components
│   ├── ui/                           # Primitives (Button, Card, Input, Label)
│   ├── layout/                       # Sidebar, Header
│   ├── auth/                         # LoginForm, RegisterForm
│   ├── activities/                   # ActivityList, UploadForm, MapView, charts
│   ├── dashboard/                    # DashboardView, filters, charts
│   ├── strava/                       # StravaManager
│   └── admin/                        # UserTable
│
├── lib/                              # Shared utilities and business logic
│   ├── calculations.ts               # Distance, pace, elevation, splits
│   ├── gpx.ts                        # GPX XML parsing
│   ├── crypto.ts                     # AES-256-GCM encryption
│   ├── strava.ts                     # Strava API client
│   ├── prisma.ts                     # Prisma client singleton
│   ├── rate-limit.ts                 # In-memory rate limiter
│   ├── utils.ts                      # cn() class merging utility
│   ├── auth/helpers.ts               # Password hashing (bcrypt)
│   ├── validators/auth.ts            # Login/register Zod schemas
│   ├── validators/activity.ts        # Activity/dashboard Zod schemas
│   └── __tests__/                    # Unit tests
│
├── types/index.ts                    # NextAuth type extensions
├── auth.ts                           # NextAuth full configuration
├── auth.config.ts                    # Edge-safe auth config (no Prisma)
├── middleware.ts                     # Route protection + security headers
│
├── prisma/
│   ├── schema.prisma                 # Database schema
│   ├── seed.ts                       # Admin user seeder
│   └── migrations/                   # Migration history
│
├── generated/prisma/                 # Auto-generated Prisma client
├── Dockerfile                        # Multi-stage production build
├── docker-compose.yml                # App + PostgreSQL stack
├── .env.example                      # Required environment variables
├── next.config.ts                    # Next.js configuration
├── vitest.config.ts                  # Test configuration
├── tsconfig.json                     # TypeScript configuration
└── package.json                      # Dependencies and scripts
```

### Conventions

- **Pages** go in `app/` following the App Router file conventions
- **Components** go in `components/<domain>/` grouped by feature area
- **Business logic** goes in `lib/` — never import from `components/` into `lib/`
- **Validation schemas** go in `lib/validators/`
- **Tests** go in `lib/__tests__/` mirroring the source file name
- **Types** that extend third-party libraries go in `types/`

---

## 4. Database

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌──────────────────┐
│    User      │       │    Activity      │       │  ActivityPoint   │
├─────────────┤       ├─────────────────┤       ├──────────────────┤
│ id (PK)     │──┐    │ id (PK)         │──┐    │ id (PK)          │
│ email       │  │    │ userId (FK)     │  │    │ activityId (FK)  │
│ name        │  │    │ type            │  │    │ index            │
│ passwordHash│  │    │ source          │  │    │ latitude         │
│ role        │  ├───►│ name            │  ├───►│ longitude        │
│ isActive    │  │    │ startDate       │  │    │ elevation        │
│ globalVis.  │  │    │ duration        │  │    │ timestamp        │
│ createdAt   │  │    │ distance        │  │    │ heartRate        │
│ updatedAt   │  │    │ elevationGain   │  │    │ cumulativeDistance│
└──────┬──────┘  │    │ averagePace     │  │    └──────────────────┘
       │         │    │ bestPace        │  │
       │         │    │ averageHeartRate│  │
       │         │    │ stravaActivityId│  │
       │         │    └─────────────────┘  │
       │         │                         │
       │    ┌────┴──────────────┐          │
       │    │ StravaConnection  │          │
       │    ├───────────────────┤          │
       └───►│ id (PK)           │          │
            │ userId (FK, uniq) │          │
            │ stravaAthleteId   │          │
            │ accessToken (enc) │          │
            │ refreshToken(enc) │          │
            │ expiresAt         │          │
            │ lastSyncAt        │          │
            └───────────────────┘          │
                                           │
  Cascade: User deletion removes all       │
  activities, points, and connections.     ─┘
```

### Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| **User** | Registered user | `email` (unique), `passwordHash`, `role` (USER/ADMIN), `globalVisibility` (opt-in leaderboard) |
| **Activity** | A single run | `type` (RUN/TRAIL_RUN/TREADMILL), `source` (GPX/STRAVA), `distance` (meters), `duration` (seconds), `averagePace` (sec/km) |
| **ActivityPoint** | GPS trackpoint | `latitude`, `longitude`, `elevation`, `timestamp`, `heartRate`, `cumulativeDistance` |
| **StravaConnection** | OAuth link | `accessToken` (AES-256-GCM encrypted), `refreshToken` (encrypted), `expiresAt` (unix timestamp) |

### Indexes

| Index | Purpose |
|-------|---------|
| `User(email)` | Fast login lookup |
| `User(role)` | Admin user filtering |
| `Activity(userId)` | User's activity list |
| `Activity(userId, startDate)` | Dashboard date-range queries |
| `Activity(startDate)` | Global leaderboard |
| `ActivityPoint(activityId)` | Load track for an activity |
| `ActivityPoint(activityId, index)` | Ordered trackpoint retrieval |
| `StravaConnection(stravaAthleteId)` | Strava deduplication |

### Database Workflows

```bash
# Development: push schema changes directly (no migration file)
npm run db:push

# Production: create a migration file for version control
npm run db:migrate

# Regenerate Prisma client after schema changes
npm run db:generate

# Seed default admin user
npm run db:seed
```

The Prisma client is generated into `generated/prisma/` (configured via `output` in `schema.prisma`). It uses the `@prisma/adapter-pg` driver adapter for PostgreSQL.

---

## 5. Authentication & Authorization

### Architecture

Authentication uses **NextAuth.js v5** (Auth.js) with a split configuration:

| File | Purpose | Runtime |
|------|---------|---------|
| `auth.config.ts` | JWT callbacks, route config, session strategy | Edge (middleware) |
| `auth.ts` | Full config with Prisma adapter and `authorize()` logic | Node.js (API routes) |
| `middleware.ts` | Route protection, security headers | Edge |

The split exists because the Edge runtime (used by middleware) cannot import Prisma. `auth.config.ts` contains only serializable configuration, while `auth.ts` adds the database adapter and credential verification.

### Login Flow

1. User submits email/password to NextAuth credentials provider
2. `auth.ts:authorize()` validates input with `loginSchema` (Zod)
3. Looks up user by email via Prisma
4. Verifies password with `bcrypt.compare()` (12 salt rounds)
5. Returns `{ id, email, name, role }` on success, `null` on failure
6. NextAuth creates a JWT containing the user's role
7. JWT stored in an httpOnly cookie

### Session Structure

The JWT is extended with the user's role. The session object available via `await auth()`:

```typescript
session.user.id       // string (cuid)
session.user.email    // string
session.user.name     // string | null
session.user.role     // "USER" | "ADMIN"
```

### Route Protection

The middleware (`middleware.ts`) enforces access:

| Route Pattern | Access |
|--------------|--------|
| `/login`, `/register` | Public (redirects to `/dashboard` if already authenticated) |
| `/api/auth/*` | Public (NextAuth handlers) |
| `/api/health` | Public (matched by middleware but no session required in handler) |
| `/admin/*`, `/api/admin/*` | Requires `ADMIN` role |
| Everything else | Requires authentication |

API routes additionally verify ownership. For example, `GET /api/activities/[id]` includes `userId: session.user.id` in the Prisma query — a user can never access another user's activities.

### Adding a New Protected Route

1. Create the page in `app/(dashboard)/your-page/page.tsx` — it's automatically protected by the route group layout
2. If it needs an API, create `app/api/your-endpoint/route.ts` and add at the top:
   ```typescript
   const session = await auth();
   if (!session?.user) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }
   ```
3. For admin-only routes, add to `middleware.ts` if outside `/admin` or `/api/admin`, or check `session.user.role !== "ADMIN"` in the handler

---

## 6. API Reference

All endpoints return JSON. Authentication is checked via `await auth()` from `@/auth`.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/[...nextauth]` | No | NextAuth sign-in |
| GET | `/api/auth/[...nextauth]` | No | NextAuth session/CSRF |

**POST `/api/auth/register`**
- Rate limit: 5 requests/minute per IP
- Body: `{ name: string, email: string, password: string }`
- Password: 8-128 chars, must contain uppercase, lowercase, and digit
- Response: `201 { message: "..." }` (same regardless of existing account)

### Activities

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/activities` | Yes | Upload GPX file |
| GET | `/api/activities` | Yes | List activities (paginated) |
| GET | `/api/activities/[id]` | Yes | Activity detail with trackpoints |
| DELETE | `/api/activities/[id]` | Yes | Delete activity |
| GET | `/api/activities/compare` | Yes | Compare up to 5 activities |
| GET | `/api/activities/[id]/similar` | Yes | Find activities with similar GPS route |

**POST `/api/activities`** (multipart/form-data)
- Fields: `file` (.gpx, max 10MB), `type` (RUN|TRAIL_RUN|TREADMILL), `name` (optional)
- Parses GPX, computes all metrics, creates Activity + ActivityPoints in a transaction
- Response: `201 { activity: {...} }`

**GET `/api/activities`**
- Query params: `page` (default 1), `limit` (default 20, max 100), `sortBy` (startDate|distance|duration|averagePace), `sortOrder` (asc|desc), `type` (optional filter)
- Response: `{ activities: [...], pagination: { page, limit, total, totalPages } }`

**GET `/api/activities/[id]`**
- Response: `{ activity: { ...fields, points: [...] } }` — includes all trackpoints ordered by index
- Returns 404 if not found or not owned by current user

**GET `/api/activities/compare?ids=id1,id2,id3`**
- Max 5 activity IDs (comma-separated)
- Returns activities with trackpoints (latitude, longitude, elevation, timestamp, cumulativeDistance, heartRate) for overlay comparison

**GET `/api/activities/[id]/similar?threshold=80&limit=20`**
- Finds activities with a similar GPS route using two-phase search:
  1. SQL pre-filter: distance range (80%-130%) + bounding box overlap
  2. Detailed comparison: resample to 50 equidistant points, symmetric average minimum distance
- Query params: `threshold` (0-100, default 80), `limit` (1-100, default 20)
- Returns: `{ similar: [{ id, name, distance, duration, averagePace, startDate, type, similarity }] }` sorted by similarity descending, then by date
- Requires activity to have GPS data (returns 400 for treadmill activities)

### Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/stats` | Yes | Personal dashboard data |
| GET | `/api/dashboard/global` | Yes | Global leaderboard |

**GET `/api/dashboard/stats`**
- Query params: `range` (7d|30d|90d|365d|ytd|all), `type` (optional)
- Response: `{ summary, weeklyData, monthlySummary, paceTrend, recentActivities }`

**GET `/api/dashboard/global`**
- Query params: `period` (weekly|monthly|all), `type` (optional)
- Response: `{ leaderboard, aggregate, currentUserOptedIn, period }`
- Only shows users who have opted in via `globalVisibility`

### Strava

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/strava/connect` | Yes | Start OAuth flow |
| GET | `/api/strava/callback` | Yes | OAuth callback |
| POST | `/api/strava/sync` | Yes | Sync activities from Strava |
| POST | `/api/strava/disconnect` | Yes | Remove Strava connection |

### Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/users` | Admin | List all users |
| PATCH | `/api/admin/users/[id]` | Admin | Update user role/status |
| DELETE | `/api/admin/users/[id]` | Admin | Delete user |
| GET | `/api/admin/users/[id]/stats` | Admin | User's activity stats |

### Other

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check (DB connectivity) |
| GET | `/api/user/settings` | Yes | Get user settings |
| PATCH | `/api/user/settings` | Yes | Update globalVisibility |

---

## 7. Core Libraries

### `lib/calculations.ts` — Running Metrics

All distance values are in **meters**, pace in **seconds per km**, duration in **seconds**.

| Function | Signature | Description |
|----------|-----------|-------------|
| `haversineDistance` | `(lat1, lon1, lat2, lon2) → number` | Great-circle distance between two GPS points (meters) |
| `computeCumulativeDistances` | `(points: TrackPoint[]) → number[]` | Running total distance at each trackpoint |
| `calculateTotalDistance` | `(points: TrackPoint[]) → number` | Sum of all segment distances |
| `calculateElevation` | `(points: TrackPoint[]) → { gain, loss }` | Total ascent/descent with 2m noise threshold |
| `calculateDuration` | `(points: TrackPoint[]) → number \| null` | Seconds between first and last timestamp |
| `calculateAveragePace` | `(distanceM, durationS) → number \| null` | Seconds per km |
| `calculateHeartRateStats` | `(points: TrackPoint[]) → { avg, max }` | Average and max heart rate from points with HR data |
| `calculateSplits` | `(points, cumDist) → Split[]` | Per-km splits with pace, elevation change, avg HR |
| `calculateBestPace` | `(splits: Split[]) → number \| null` | Minimum pace across full-km splits |
| `formatPace` | `(secPerKm) → string` | `"5:23"` format |
| `formatDuration` | `(seconds) → string` | `"1h 23m"` or `"45m 12s"` format |
| `formatDistance` | `(meters) → string` | `"10.52 km"` format |

**Key types:**

```typescript
interface TrackPoint {
  latitude: number;
  longitude: number;
  elevation: number | null;
  timestamp: Date | null;
  heartRate: number | null;
}

interface Split {
  km: number;              // 1-indexed km number
  pace: number;            // seconds per km
  elevationChange: number; // meters (positive = uphill)
  averageHeartRate: number | null;
}
```

### `lib/gpx.ts` — GPX Parsing

Parses GPX XML files using `fast-xml-parser`. No DOM dependency (works in Node.js).

- Extracts tracks from `<gpx> → <trk> → <trkseg> → <trkpt>`
- Supports multi-track and multi-segment files
- Reads heart rate from Garmin extensions (`gpxtpx:TrackPointExtension`, `ns3:TrackPointExtension`)
- Validates coordinates: latitude [-90, 90], longitude [-180, 180]
- Requires minimum 2 valid trackpoints
- Throws `GpxParseError` on invalid files
- **XXE safe**: `fast-xml-parser` does not process external entities

### `lib/crypto.ts` — Token Encryption

Encrypts Strava OAuth tokens before database storage.

- Algorithm: **AES-256-GCM** (authenticated encryption)
- IV: 12 bytes, randomly generated per encryption
- Auth tag: 16 bytes
- Key: 32 bytes from `ENCRYPTION_KEY` env var (64 hex characters)
- Storage format: `iv:authTag:ciphertext` (all hex-encoded)
- Uses Node.js built-in `crypto` module

```typescript
encrypt(plaintext: string): string   // returns "iv:authTag:ciphertext"
decrypt(encrypted: string): string   // reverses the above
```

### `lib/strava.ts` — Strava Integration

Complete OAuth and data sync client:

| Function | Purpose |
|----------|---------|
| `getAuthorizationUrl(state)` | Build Strava OAuth consent URL |
| `exchangeToken(code)` | Exchange auth code for access/refresh tokens |
| `refreshAccessToken(refreshToken)` | Get new access token |
| `getValidAccessToken(connection)` | Auto-refresh if expired, update DB |
| `fetchActivities(token, after?, page?)` | List athlete activities |
| `fetchActivityStreams(token, activityId)` | Get GPS/HR/elevation streams |
| `isRunningActivity(activity)` | Filter to Run/TrailRun/Treadmill |
| `mapStravaActivityType(sportType)` | Map Strava types to app enum |
| `convertStravaToTrackPoints(streams, startDate)` | Convert streams to `TrackPoint[]` |

**Sync flow** (`/api/strava/sync`):
1. Get valid access token (refresh if expired)
2. Fetch activities page by page (since `lastSyncAt`)
3. Skip non-running activities and duplicates (by `stravaActivityId`)
4. For each new activity: fetch GPS streams → convert to TrackPoints → compute metrics → create Activity + Points in transaction
5. Update `lastSyncAt`

### `lib/rate-limit.ts` — Rate Limiting

In-memory sliding-window rate limiter. No external dependencies.

```typescript
const limiter = rateLimit({ interval: 60_000, limit: 5 });
const { success, remaining } = limiter.check(ipAddress);
```

- Entries auto-cleaned every 60 seconds to prevent memory leaks
- Suitable for single-instance deployments
- For multi-instance, replace with Redis-backed solution (e.g., Upstash Ratelimit)

Current limits:
- Registration: **5 requests/minute** per IP
- Login: **10 requests/minute** per IP

### `lib/validators/` — Zod Schemas

| Schema | File | Purpose |
|--------|------|---------|
| `loginSchema` | `auth.ts` | Email + password (min 1 char) |
| `registerSchema` | `auth.ts` | Name (2-100), email, password (8-128, upper+lower+digit) |
| `gpxUploadSchema` | `activity.ts` | Activity type enum + optional name (max 200) |
| `activityListQuerySchema` | `activity.ts` | Pagination, sorting, type filter |
| `dashboardStatsQuerySchema` | `activity.ts` | Range (7d/30d/90d/365d/ytd/all) + type filter |
| `globalDashboardQuerySchema` | `activity.ts` | Period (weekly/monthly/all) + type filter |
| `similarRoutesQuerySchema` | `activity.ts` | Threshold (0-100) + limit (1-100) for route similarity search |

### `lib/route-similarity.ts` — Route Similarity

Computes GPS route similarity between activities. Used by the "Find Similar Routes" feature on the compare page.

| Function | Signature | Description |
|----------|-----------|-------------|
| `computeRouteFingerprint` | `(points) → RouteFingerprint \| null` | Bounding box + start point from GPS points. Stored on Activity at upload/sync time for fast SQL pre-filtering |
| `normalizeRoute` | `(points, sampleCount=50) → SamplePoint[]` | Resamples a route to N equidistant points via linear interpolation on `cumulativeDistance` |
| `computeRouteSimilarity` | `(samplesA, samplesB, tolerance=200) → number` | Symmetric average minimum distance, returns 0-100% similarity |
| `boundingBoxesOverlap` | `(a, b) → boolean` | Checks if two bounding boxes overlap (with ~200m padding) |

**Algorithm:**
- For each point on route A, find the closest point on route B (and vice versa)
- Take the worse of the two average-minimum-distances (Hausdorff-like)
- Convert to percentage: `similarity = max(0, 100 * (1 - worstAvg / toleranceMeters))`
- Rotation-invariant: same loop with different start points scores high
- Handles out-and-back routes, tolerates GPS noise

**Route fingerprint columns** on Activity model (populated at upload/sync, backfilled via `npx tsx prisma/backfill-fingerprints.ts`):
- `startLatitude`, `startLongitude` — first point of the route
- `boundingBoxMinLat`, `boundingBoxMaxLat`, `boundingBoxMinLon`, `boundingBoxMaxLon` — geographic extent

---

## 8. Frontend Architecture

### Component Organization

```
components/
├── ui/            # Generic primitives (Button, Card, Input, Label)
├── layout/        # App shell (Sidebar, Header)
├── auth/          # Login/register forms
├── activities/    # Activity list, upload, map, charts
├── dashboard/     # Dashboard view, filters, stats charts
├── strava/        # Strava connection manager
└── admin/         # User management table
```

- **`ui/`** components are style-only wrappers using `class-variance-authority` for variants (Button, Card, Input, Label, Slider, etc.). They never contain business logic.
- **Domain components** (activities, dashboard, etc.) fetch data, manage state, and render domain-specific UI.

### Server vs Client Split

Pages are server components that fetch data and pass it to client components:

```typescript
// app/(dashboard)/dashboard/page.tsx (Server Component)
export default async function DashboardPage() {
  const session = await auth();
  return <DashboardView userName={session.user.name} />;
}

// components/dashboard/dashboard-view.tsx (Client Component)
"use client";
export function DashboardView({ userName }: { userName: string }) {
  const [data, setData] = useState(null);
  useEffect(() => { fetch("/api/dashboard/stats")... }, []);
  // render charts, cards, etc.
}
```

### Dynamic Imports (Maps)

Leaflet requires the DOM and must be excluded from server-side rendering:

```typescript
// components/activities/map-wrapper.tsx
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./map-view").then(m => m.MapView), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-muted animate-pulse" />,
});
```

### Styling

- **Tailwind CSS 4** via PostCSS plugin (`@tailwindcss/postcss`)
- **`cn()` utility** (`lib/utils.ts`): merges class names with `clsx` + `tailwind-merge`
- **class-variance-authority** (`cva`): used in `ui/button.tsx` for variant props
- No CSS modules or styled-components

### Charts

All charts use **Recharts**:
- `components/activities/elevation-chart.tsx` — AreaChart for elevation profile
- `components/activities/pace-chart.tsx` — BarChart for per-km splits
- `components/dashboard/distance-chart.tsx` — BarChart for weekly distance
- `components/dashboard/pace-trend-chart.tsx` — LineChart for pace over time
- `components/dashboard/leaderboard-chart.tsx` — BarChart for global rankings
- `components/dashboard/compare-pace-chart.tsx` — Summary table + average pace BarChart
- `components/dashboard/compare-pace-along-track-chart.tsx` — LineChart: instantaneous pace vs distance (smoothed, Y-axis reversed)
- `components/dashboard/compare-elevation-chart.tsx` — LineChart: elevation overlay vs distance
- `components/dashboard/compare-heart-rate-chart.tsx` — LineChart: heart rate overlay vs distance (hidden when no HR data)

---

## 9. Adding a New Feature

### Example: Adding a New Activity Type (e.g., CYCLING)

**Step 1: Update Prisma schema**

```prisma
// prisma/schema.prisma
enum ActivityType {
  RUN
  TRAIL_RUN
  TREADMILL
  CYCLING        // ← add
}
```

**Step 2: Apply schema change**

```bash
npm run db:migrate    # creates migration file
# or for development:
npm run db:push       # pushes without migration
npm run db:generate   # regenerates Prisma client
```

**Step 3: Update Zod validators**

```typescript
// lib/validators/activity.ts — update ALL schemas that reference the type enum
z.enum(["RUN", "TRAIL_RUN", "TREADMILL", "CYCLING"])
```

Affected schemas: `gpxUploadSchema`, `activityListQuerySchema`, `dashboardStatsQuerySchema`, `globalDashboardQuerySchema`.

**Step 4: Update Strava type mapping** (if applicable)

```typescript
// lib/strava.ts
export function mapStravaActivityType(sportType: string): ActivityType | null {
  switch (sportType) {
    // ...existing cases
    case "Ride":
    case "GravelRide":
      return "CYCLING";
  }
}
```

**Step 5: Update UI selectors**

- `components/activities/upload-form.tsx` — add to type dropdown
- `components/activities/activity-list.tsx` — add to filter options
- `components/dashboard/dashboard-filters.tsx` — add to type filter

**Step 6: Add tests**

```typescript
// lib/__tests__/validators.test.ts
it("accepts CYCLING as activity type", () => {
  expect(gpxUploadSchema.safeParse({ type: "CYCLING" }).success).toBe(true);
});
```

### Generic Checklist for Any New Feature

1. **Schema**: Does this need a new model, field, or enum? → Update `schema.prisma`, run migration
2. **Validation**: Add/update Zod schemas in `lib/validators/`
3. **API route**: Create handler in `app/api/`, add auth check, validate input
4. **Business logic**: Add to `lib/` if reusable, keep in route handler if specific
5. **Page**: Create in `app/(dashboard)/` for protected pages, `app/(auth)/` for public
6. **Component**: Create in `components/<domain>/`, split server/client appropriately
7. **Navigation**: Add to `navItems` in `components/layout/sidebar.tsx`
8. **Tests**: Add unit tests for business logic in `lib/__tests__/`
9. **Build check**: Run `npm run build` to verify no type errors

---

## 10. Testing

### Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner (fast, Vite-based, Jest-compatible API) |
| `vitest.config.ts` | Configured with `@/` path alias and Node environment |

### Running Tests

```bash
npm test              # run all tests once
npm run test:watch    # re-run on file changes
```

### Test File Location

Tests live in `lib/__tests__/` and mirror the source file:

```
lib/calculations.ts      →  lib/__tests__/calculations.test.ts
lib/crypto.ts            →  lib/__tests__/crypto.test.ts
lib/gpx.ts               →  lib/__tests__/gpx.test.ts
lib/validators/auth.ts   →  lib/__tests__/validators.test.ts
lib/validators/activity.ts
```

### Existing Test Coverage

| Test File | What it Tests | ~Lines |
|-----------|--------------|--------|
| `calculations.test.ts` | Haversine, elevation, duration, pace, splits, formatting | 305 |
| `crypto.test.ts` | Encrypt/decrypt roundtrip, format, unicode, error cases | 81 |
| `gpx.test.ts` | Valid GPX, HR extensions, multi-segment, invalid files | 177 |
| `validators.test.ts` | Auth schemas, activity schemas, edge cases | 217 |

### Writing a New Test

Follow the existing patterns:

```typescript
// lib/__tests__/your-module.test.ts
import { describe, it, expect } from "vitest";
import { yourFunction } from "../your-module";

describe("yourFunction", () => {
  it("handles the base case", () => {
    expect(yourFunction(input)).toBe(expectedOutput);
  });

  it("returns null for invalid input", () => {
    expect(yourFunction(null)).toBeNull();
  });

  it("throws on missing required data", () => {
    expect(() => yourFunction(bad)).toThrow("Expected error message");
  });
});
```

**Helper pattern** (from `calculations.test.ts`):

```typescript
function makePoint(overrides: Partial<TrackPoint> = {}): TrackPoint {
  return {
    latitude: 48.8566,
    longitude: 2.3522,
    elevation: null,
    timestamp: null,
    heartRate: null,
    ...overrides,
  };
}
```

### What to Test

- Pure functions in `lib/` (calculations, parsing, validation, encryption)
- Zod schema acceptance and rejection
- Error handling and edge cases

### What Not to Test (at the unit level)

- React component rendering (use E2E tests instead)
- Prisma queries (they're type-safe by construction)
- NextAuth configuration (integration-tested by logging in)

---

## 11. Security

### Summary of Measures

| Area | Measure | Details |
|------|---------|---------|
| **Passwords** | bcrypt (12 salt rounds) | `lib/auth/helpers.ts` |
| **Token storage** | AES-256-GCM encryption at rest | `lib/crypto.ts` |
| **Input validation** | Zod schemas on all API inputs | `lib/validators/` |
| **SQL injection** | Prisma parameterized queries | No raw SQL with user input |
| **XSS** | React auto-escaping | No `dangerouslySetInnerHTML` |
| **XXE** | `fast-xml-parser` rejects external entities | Verified safe |
| **Clickjacking** | `X-Frame-Options: DENY` | `middleware.ts` |
| **MIME sniffing** | `X-Content-Type-Options: nosniff` | `middleware.ts` |
| **Referrer leakage** | `Referrer-Policy: strict-origin-when-cross-origin` | `middleware.ts` |
| **Browser APIs** | `Permissions-Policy: camera=(), microphone=(), geolocation=()` | `middleware.ts` |
| **OAuth CSRF** | Random state parameter in httpOnly cookie | `api/strava/connect` |
| **Account enumeration** | Generic response on registration | `api/auth/register` |
| **Brute force** | Rate limiting on login (10/min) and registration (5/min) | `lib/rate-limit.ts` |
| **File uploads** | Extension check, 10MB size limit, server-side parsing | `api/activities` |
| **Authorization** | Ownership filter (`userId: session.user.id`) on all queries | Every API route |
| **Admin access** | Role check in middleware + API handlers | `middleware.ts` + routes |
| **Docker** | Non-root user (UID 1001), alpine base, multi-stage build | `Dockerfile` |

### Security Headers

Applied to every response via `middleware.ts`:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-DNS-Prefetch-Control: off
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

CSP and HSTS are intentionally omitted — CSP requires per-deployment tuning (inline styles, map tile origins), and HSTS should only be enabled when HTTPS is confirmed.

---

## 12. Deployment

### Environment Variables

| Variable | Required | Description | How to Generate |
|----------|----------|-------------|-----------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `AUTH_SECRET` | Yes | NextAuth session signing key | `openssl rand -base64 32` |
| `AUTH_URL` | Yes | Application base URL | `https://your-domain.com` |
| `ENCRYPTION_KEY` | Yes* | AES-256 key for Strava tokens | `openssl rand -hex 32` |
| `STRAVA_CLIENT_ID` | No | Strava OAuth app ID | From [strava.com/settings/api](https://www.strava.com/settings/api) |
| `STRAVA_CLIENT_SECRET` | No | Strava OAuth app secret | From Strava settings |

\* Required only if Strava integration is enabled.

### Dockerfile (Multi-Stage)

The Dockerfile uses three stages to minimize the production image:

```
Stage 1 (deps):    Install node_modules from lockfile
Stage 2 (builder): Copy source + node_modules, generate Prisma, build Next.js
Stage 3 (runner):  Copy only standalone output, prisma schema, static files
                   Runs as non-root user (nextjs, UID 1001)
                   Exposes port 3000
```

### Docker Compose

```bash
# Set required secrets
export AUTH_SECRET=$(openssl rand -base64 32)

# Start services
docker compose up -d

# The app reads AUTH_SECRET from the host environment.
# DATABASE_URL is hardcoded for the internal db service.
```

Services:
- `db`: PostgreSQL 16 Alpine with persistent volume
- `app`: Next.js application (standalone mode)

### Standalone Output

`next.config.ts` sets `output: "standalone"`, which produces a self-contained `server.js` that includes only the dependencies needed at runtime. This is what the Docker image runs.

---

## 13. Code Conventions

### TypeScript

- **Strict mode** enabled (`tsconfig.json`)
- **Path alias**: `@/` maps to the project root — use `@/lib/prisma` instead of `../../lib/prisma`
- **No `any`**: use `unknown` and narrow with type guards

### Imports

Order (enforced by convention, not linter):
1. Node.js built-ins (`crypto`)
2. External packages (`next/server`, `zod`, `bcryptjs`)
3. Internal aliases (`@/auth`, `@/lib/prisma`, `@/components/ui/button`)
4. Relative imports (only within the same module, e.g., test helpers)

### API Route Pattern

Every API route follows this structure:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function METHOD(request: NextRequest) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Input validation (Zod)
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  // 3. Business logic + Prisma query (always filter by userId)
  const result = await prisma.model.findMany({
    where: { userId: session.user.id },
  });

  // 4. Return response
  return NextResponse.json({ result });
}
```

### Error Handling

- API routes wrap logic in `try/catch` and return `500` for unexpected errors
- Custom error classes (e.g., `GpxParseError`) for domain-specific errors
- Never expose stack traces or internal details in error responses
- Prisma errors are caught generically — the ORM prevents most invalid states

### Prisma Query Patterns

- Use **`select`** to limit returned fields (performance + avoid leaking sensitive data)
- Use **`include`** when you need relations (e.g., activity with points)
- Use **`$transaction`** for multi-table writes (e.g., creating activity + points)
- Always include `userId: session.user.id` in `where` clauses for user-scoped data
- Never use `$queryRawUnsafe` — use `$queryRaw` with tagged template literals

---

## 14. Troubleshooting

### Database Connection Failed

```
Error: Can't reach database server at `localhost:5432`
```

- Verify PostgreSQL is running: `pg_isready -h localhost -p 5432`
- Check `DATABASE_URL` in `.env` matches your PostgreSQL credentials
- If using Docker: ensure the `db` service is up (`docker compose ps`)

### AUTH_SECRET Missing

```
Error: AUTH_SECRET is missing
```

- Generate with: `openssl rand -base64 32`
- Add to `.env`: `AUTH_SECRET=<generated-value>`
- For Docker Compose: export it in your shell or `.env` file

### Strava Integration Not Configured

```
"Strava integration is not configured"
```

This means `STRAVA_CLIENT_ID` or `STRAVA_CLIENT_SECRET` is missing from `.env`. See [strava.com/settings/api](https://www.strava.com/settings/api) to create an app. Set "Authorization Callback Domain" to `localhost` for local development.

### Build Fails with Type Errors

```bash
# Regenerate Prisma client (fixes most type errors after schema changes)
npm run db:generate

# If persists, check for stale generated files
rm -rf generated/ && npm run db:generate
```

### Docker Compose AUTH_SECRET Error

```
ERROR: variable AUTH_SECRET is not set
```

The `docker-compose.yml` requires `AUTH_SECRET` from the host environment:

```bash
export AUTH_SECRET=$(openssl rand -base64 32)
docker compose up
```

Or add it to a `.env` file in the project root (already in `.gitignore`).

### Prisma Migration Drift

```
The database schema is not in sync with the migration history
```

- In development: `npm run db:push` (overwrites DB to match schema)
- In production: create a new migration with `npm run db:migrate` and apply it

### Rate Limit During Development

If you hit rate limits during testing (429 responses), restart the dev server — the in-memory rate limiter resets on restart.
