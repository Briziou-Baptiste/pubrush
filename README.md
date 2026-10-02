# PubRush 🍻
![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-1B1F23?style=for-the-badge&logo=expo&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

PubRush is the ultimate app for tracking, sharing, and conquering barathons with friends. Track your progress on the map, manage expenses, and sync your group's live location via WebSockets.

## Architecture

This is a monorepo containing both the frontend and backend applications:
- `mobile/` - React Native Expo application (App Store / Google Play).
- `backend/` - FastAPI backend with PostgreSQL, SQLAlchemy, Alembic, and WebSockets.
- `docs/` - Project documentation and store metadata.

## Prerequisites
- Node.js & npm (or yarn/bun)
- Python 3.10+
- PostgreSQL
- Docker & Docker Compose (optional, for easy setup)

## Quick Start

### Backend
Navigate to the `backend/` directory:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env # configure your DB
alembic upgrade head
uvicorn app.main:app --reload
```
For more details, see [Backend README](backend/README.md).

### Mobile
Navigate to the `mobile/` directory:
```bash
cd mobile
npm install
npm start
```
For more details, see [Mobile README](mobile/README.md).

### Docker setup
```bash
docker-compose up -d
```

## Documentation
Check out the `docs/store/` directory for app store release guidelines and policies:
- [Privacy Policy](docs/store/PRIVACY_POLICY.md)
- [Terms of Service](docs/store/TERMS_OF_SERVICE.md)
- [App Store Metadata](docs/store/APP_STORE_METADATA.md)
- [Google Play Metadata](docs/store/GOOGLE_PLAY_METADATA.md)
- [Release Checklist](docs/store/RELEASE_CHECKLIST.md)

## CI/CD
Continuous Integration and Deployment are handled via GitHub Actions and Expo Application Services (EAS). Build artifacts are tested via `pytest` for backend and `tsc` typechecks for the mobile app before each release.
