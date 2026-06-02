import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db import Base, get_db
from app.main import app
from app.models import Role, User
from app.security import hash_password, create_access_token

# Setup SQLite memory engine with StaticPool
DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Enforce foreign key constraints under SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine, future=True
)

@pytest.fixture(scope="function")
def db_session():
    # Create database tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Drop tables to isolate tests completely
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    from fastapi.testclient import TestClient
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
def test_roles(db_session):
    roles = [
        Role(name="Capitaine", description="Le chef du barathon"),
        Role(name="Trésorier", description="Gère les dépenses"),
        Role(name="Sam", description="Celui qui conduit"),
    ]
    for r in roles:
        db_session.add(r)
    db_session.commit()
    return roles

@pytest.fixture(scope="function")
def test_user(db_session):
    user = User(
        email="test@pubrush.com",
        username="testuser",
        password_hash=hash_password("password123"),
        is_admin=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture(scope="function")
def test_user_2(db_session):
    user = User(
        email="test2@pubrush.com",
        username="testuser2",
        password_hash=hash_password("password456"),
        is_admin=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture(scope="function")
def admin_user(db_session):
    user = User(
        email="admin@pubrush.com",
        username="adminuser",
        password_hash=hash_password("adminpassword"),
        is_admin=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture(scope="function")
def user_auth_headers(test_user):
    token = create_access_token(
        {
            "sub": str(test_user.id),
            "email": test_user.email,
            "username": test_user.username,
            "is_admin": test_user.is_admin,
        }
    )
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="function")
def user_2_auth_headers(test_user_2):
    token = create_access_token(
        {
            "sub": str(test_user_2.id),
            "email": test_user_2.email,
            "username": test_user_2.username,
            "is_admin": test_user_2.is_admin,
        }
    )
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="function")
def admin_auth_headers(admin_user):
    token = create_access_token(
        {
            "sub": str(admin_user.id),
            "email": admin_user.email,
            "username": admin_user.username,
            "is_admin": admin_user.is_admin,
        }
    )
    return {"Authorization": f"Bearer {token}"}
