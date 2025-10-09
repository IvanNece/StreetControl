# StreetControl Backend

Backend server for managing Streetlifting competitions with dual-database architecture (local SQLite + remote PostgreSQL).

## Tech Stack

- **Node.js** + Express.js + Socket.IO
- **SQLite3** (local offline database)
- **PostgreSQL** (Supabase remote database)
- **ES Modules** (import/export)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create `.env` file in backend root:

```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Local Database
DATABASE_LOCAL_PATH=./data/street_control.db

# Remote Database (Supabase)
DATABASE_REMOTE_URL=postgresql://user:password@host:5432/database

# Socket.IO
SOCKET_PING_TIMEOUT=60000
SOCKET_PING_INTERVAL=25000
```

### 3. Initialize Remote Database

Execute `src/database/remote/init_remote_schema.sql` in Supabase SQL Editor to create tables and seed data.

### 4. Initialize Local Database

```bash
npm run init-db
```

Creates SQLite database at `data/street_control.db` with schema for competition management.

### 5. Seed Test Data (Optional)

```bash
npm run seed
```

Populates local database with test data (30 athletes, 1 meet, 3 judges, 2 flights, 120 attempts).

## Development

### Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:3000` with auto-reload (nodemon).

### Start Production Server

```bash
npm start
```

### Test Phase 2.1 Implementation

```bash
node test/test-2.1-endpoints.js
```

Runs automated test suite (7 tests) to verify server, database, Socket.IO, and error handling.

## API Endpoints

- **GET** `/` - Server info
- **GET** `/api` - API documentation
- **GET** `/api/health` - Health check

## Workflow

### During Competition (Offline)

System operates fully offline using SQLite local database.

### After Competition (Sync)

Synchronize results to remote database:

```bash
node src/database/sync.js <MEET_CODE>
```

Example: `node src/database/sync.js SLI-2025-ITALIA-01`

Syncs athletes, meet data, results, and updates records using ID-agnostic design (CF codes, meet_code, category names).




