# PubRush 🍻

PubRush is an innovative, high-performance mobile application designed to organize, manage, and track **pub crawls (barathons)** in real time. By combining a highly asynchronous **Python (FastAPI)** backend with a fluid **React Native (Expo)** mobile application, PubRush solves the core challenges of group events: scattered participants, chaotic coordination, and poor scheduling.

The application leverages real-time GPS tracking, bidirectional event broadcasting via WebSockets, and immersive role-based gamification to ensure a cohesive and engaging user experience.

---

## 🚀 Key Features

### 🔒 Authentication & Profiles
* **Secure Session Management:** User registration and login utilizing secure JWT bearer tokens.
* **Local Persistence:** Automated, persistent login sessions handled securely on-device via Expo `SecureStore`.

### 🗺️ Dynamic Pub Crawl Creation
* **Interactive Map Selector:** Build custom routes by pinning exact bar and pub locations onto an integrated map.
* **Timeline Orchestration:** Set exact start times, custom stop durations per venue, and rearrange live checkpoints smoothly.

### ⚡ Live Event Tracking (Real-Time Mode)
* **WebSocket Synchronization:** Low-latency, bidirectional state synchronization between the cluster and all live participants.
* **Live GPS Tracking:** Real-time location sharing rendered directly onto a shared map interface to keep the group unified.
* **Active Countdown Timers:** Global synchronization of step timers indicating the exact time remaining before moving to the next venue.
* **Instant Broadcasts:** Reactive system events triggered upon destination arrival or sudden route changes.

### 🎭 Gamification & Role Distribution
* **Event Roles:** Automated or manual assignment of group archetypes (e.g., Organizer, Guide, Photographer) at event launch[cite: 2].
* **Role-Specific Cards:** Dedicated UI view outlining tailored objectives, tasks, and actions during the active run[cite: 2].

---

## 🛠️ Tech Stack & Architecture

### Backend (`/backend`)
* **Framework:** FastAPI (Asynchronous Python ASGI framework for rapid, type-safe API building)[cite: 1, 2].
* **ASGI Server:** Uvicorn paired with `uvloop` for drop-in, lightning-fast loop event handling[cite: 1, 2].
* **Database:** PostgreSQL (Relational storage equipped for spatial data structures)[cite: 2].
* **ORM:** SQLAlchemy 2.0 (Configured for full async/await execution)[cite: 2].
* **Database Migrations:** Alembic (Incremental version control for schema changes)[cite: 1, 2].
* **Real-time Gateway:** Native WebSocket connections managed via an ephemeral session layer[cite: 1, 2].

### Mobile App (`/mobile`)
* **Framework:** React Native managed via Expo (Native performance compiled from a single JavaScript/TypeScript codebase)[cite: 2].
* **Language:** TypeScript (Strict static typing ensuring software reliability)[cite: 2].
* **Navigation:** Expo Router (File-system based routing for deep linking and solid screen flows)[cite: 2].
* **Maps & Core Location:** Native mapping libraries handling live markers and overlay routes[cite: 2].
* **State & Network Hooks:** Custom hooks optimizing background location streams (`useActiveBarathonTracking`) and WebSocket lifecycle management[cite: 2].

---

## 📦 Project Directory Structure

```text
pubrush/
├── backend/                  # Server-side Python Architecture
│   ├── app/
│   │   ├── api/              # API Router Layer (REST endpoints & WebSockets)
│   │   │   ├── deps/         # FastAPI Dependency Injection (Auth, DB contexts)
│   │   │   └── routes/       # Route controllers (barathons.py, ws.py)
│   │   ├── core/             # Global configurations, security, & lifespan hooks
│   │   ├── services/         # Business logic layer (barathon_service, websocket_service)
│   │   ├── websocket/        # Real-time infrastructure (connection manager, registry)
│   │   ├── models.py         # SQLAlchemy Data Models
│   │   └── schemas.py        # Pydantic data validation and serialization schemas
│   ├── alembic/              # Database migration scripts
│   ├── alembic.ini           # Alembic initialization config
│   └── requirements.txt      # Python package manifest
│
└── mobile/                   # Client-side React Native Application
    ├── assets/               # Local static assets, icons, and branding
    ├── src/
    │   ├── app/              # Navigation architecture and screen layout (Expo Router)
    │   ├── components/       # Atomic, decoupled UI components
    │   ├── constants/        # Design system primitives, colors, and styling rules
    │   ├── features/         # Domain-driven feature slicing
    │   │   ├── active_barathon/  # Live view maps, location loops, and sockets
    │   │   ├── auth/             # Login & Registration workflows
    │   │   ├── create_barathon/  # Multi-step route builder
    │   │   └── home/             # Landing view & user location resolution
    │   └── lib/              # Networking layers & API Clients (apiClient.ts)
    ├── app.json              # Global Expo configuration
    └── package.json          # Node.js package manifest
