# PaceScope

A self-hosted web app for tracking and analyzing your running activities. Upload GPX files from any device, sync from Strava, and explore your data through personal dashboards, activity comparisons, and an optional global leaderboard.

## Features

- **GPX upload** — import runs from any GPS watch or app that exports GPX
- **Strava sync** — connect your Strava account and import activities automatically
- **Personal dashboard** — distance, pace, elevation, and heart rate trends over configurable time ranges
- **Best efforts** — fastest recorded times for standard distances (1K, 5K, 10K, half, full marathon)
- **Activity comparison** — overlay GPS tracks, pace, elevation, and heart rate across multiple runs
- **Similar route finder** — discover past runs on the same course
- **Global leaderboard** — opt-in weekly/monthly rankings across all users
- **Admin panel** — manage users and roles

## Quick Start (Docker)

The easiest way to run PaceScope is with Docker Compose.

**1. Clone the repository**

```bash
git clone <repo-url>
cd pacescope
```

**2. Generate required secrets**

```bash
export AUTH_SECRET=$(openssl rand -base64 32)
export ENCRYPTION_KEY=$(openssl rand -hex 32)
```

**3. Create a `.env` file**

```env
DATABASE_URL=postgresql://pacescope:pacescope@db:5432/pacescope
AUTH_SECRET=<your AUTH_SECRET>
AUTH_URL=http://localhost:3000
ENCRYPTION_KEY=<your ENCRYPTION_KEY>
```

**4. Start the stack**

```bash
docker compose up -d
```

The app starts at [http://localhost:3000](http://localhost:3000). PostgreSQL runs on port 5432.

**5. Create the admin account**

```bash
docker compose exec app npm run db:seed
```

Default credentials: `admin@pacescope.local` / `Admin123!` — **change the password after first login**.

---

## Manual Setup

**Prerequisites:** Node.js 20+, PostgreSQL 16

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env — see Configuration below

# Set up the database
npm run db:push      # apply schema
npm run db:seed      # create admin user

# Start the development server
npm run dev          # http://localhost:3000
```

---

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Session signing key — `openssl rand -base64 32` |
| `AUTH_URL` | Yes | Full URL of your deployment (e.g. `https://pace.example.com`) |
| `ENCRYPTION_KEY` | Yes* | AES-256 key for Strava token storage — `openssl rand -hex 32` |
| `STRAVA_CLIENT_ID` | No | Strava OAuth app ID |
| `STRAVA_CLIENT_SECRET` | No | Strava OAuth app secret |

\* Required only if you enable Strava integration.

---

## Strava Integration

To enable Strava sync:

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api) and create an API application
2. Set the **Authorization Callback Domain** to your host (e.g. `localhost` for local dev)
3. Add `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` to your `.env`
4. Restart the app, then connect your account from the Strava page inside the app

---

## Usage

### Uploading a run

Go to **Activities → Upload** and select a `.gpx` file. Choose the activity type (Run, Trail Run, or Treadmill) and an optional name. Metrics are computed automatically on upload.

### Syncing from Strava

Go to the **Strava** page and click **Connect with Strava**. After authorizing, click **Sync Now** to import your activities. Subsequent syncs only fetch new activities.

### Comparing activities

From the **Activities** list, select up to 20 runs and open **Compare**. The compare view overlays GPS tracks on a map and shows side-by-side pace, elevation, and heart rate charts.

### Finding similar routes

Open any activity and click **Find Similar Routes**. PaceScope uses GPS fingerprinting to find past runs on the same course, ranked by similarity.

### Global leaderboard

Opt in to the leaderboard from **Settings → Show me on the global leaderboard**. Weekly and monthly rankings are visible to all opted-in users on the **Global** page.

---

## Production Deployment

For a production setup:

- Set `AUTH_URL` to your public HTTPS URL
- Generate fresh `AUTH_SECRET` and `ENCRYPTION_KEY` values — never reuse development secrets
- Use a managed PostgreSQL instance or a dedicated database container with persistent volumes
- Put the app behind a reverse proxy (nginx, Caddy) that handles TLS termination

---

## For Developers

See [DEVELOPER.md](./DEVELOPER.md) for architecture details, API reference, library documentation, and contribution guidelines.
