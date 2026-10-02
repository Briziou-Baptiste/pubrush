# PubRush Backend (FastAPI)

This is the backend service for PubRush, built with FastAPI, PostgreSQL, and WebSockets.

## Features
- **FastAPI**: Modern, fast web framework for building APIs with Python 3.10+.
- **PostgreSQL & SQLAlchemy**: Relational database with ORM.
- **Alembic**: Database migrations.
- **WebSockets**: Real-time communication for live location sharing during barathons.
- **Pytest**: Comprehensive test suite.

## Setup Instructions

### 1. Virtual Environment
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Database & Environment Variables
Copy the example environment file and update it with your credentials:
```bash
cp .env.example .env
```
Ensure you have a PostgreSQL instance running and configured in `.env`.

### 3. Migrations
Run Alembic migrations to create the necessary tables:
```bash
alembic upgrade head
```

### 4. Running the Server
Start the development server:
```bash
uvicorn app.main:app --reload
```
The API docs will be available at `http://localhost:8000/docs`.

## Testing
Run the test suite using `pytest`:
```bash
PYTHONPATH=. .venv/bin/pytest
```
Ensure that all tests pass before making any new commits.
