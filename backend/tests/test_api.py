"""
Testes Automatizados LERPROVA API
Cobre: auth, calendar, stats, turmas, saúde do sistema
"""
import sys
import os

# Ajustar path para importar módulos do backend
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app
from models import pwd_context

# ============ BANCO DE TESTES EM MEMÓRIA ============

TEST_DB_URL = "sqlite:///./test_lerprova.db"
engine_test = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Cria todas as tabelas no banco de testes"""
    Base.metadata.create_all(bind=engine_test)
    # Seed mínimo: um user admin
    db = TestSessionLocal()
    from models import User
    existing = db.query(User).filter(User.email == "test@lerprova.com").first()
    if not existing:
        user = User(
            nome="Test Admin",
            email="test@lerprova.com",
            hashed_password=pwd_context.hash("test123"),
            role="admin",
            escola="Escola Teste",
            plan_type="pro",
        )
        db.add(user)
        db.commit()
    db.close()
    yield
    # Cleanup handled by OS or next run


client = TestClient(app)


def get_auth_token():
    """Helper para obter token de autenticação"""
    response = client.post("/auth/login", json={
        "email": "test@lerprova.com",
        "password": "test123"
    })
    assert response.status_code == 200
    return response.json()["access_token"]


# ============ TESTES DE SAÚDE ============

class TestHealth:
    def test_health_check(self):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_root(self):
        r = client.get("/")
        assert r.status_code == 200
        data = r.json()
        assert "LERPROVA" in data["message"]
        assert "version" in data


# ============ TESTES DE AUTENTICAÇÃO ============

class TestAuth:
    def test_login_success(self):
        r = client.post("/auth/login", json={
            "email": "test@lerprova.com",
            "password": "test123"
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == "test@lerprova.com"
        assert data["user"]["role"] == "admin"

    def test_login_wrong_password(self):
        r = client.post("/auth/login", json={
            "email": "test@lerprova.com",
            "password": "wrongpass"
        })
        assert r.status_code == 401

    def test_login_nonexistent_user(self):
        r = client.post("/auth/login", json={
            "email": "noone@test.com",
            "password": "test123"
        })
        assert r.status_code == 401

    def test_protected_route_without_token(self):
        r = client.get("/stats")
        assert r.status_code in [401, 403]

    def test_protected_route_with_token(self):
        token = get_auth_token()
        r = client.get("/stats", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200


# ============ TESTES DE TURMAS ============

class TestTurmas:
    def test_create_turma(self):
        token = get_auth_token()
        r = client.post("/turmas", headers={"Authorization": f"Bearer {token}"}, json={
            "nome": "Turma Teste 1",
            "disciplina": "Matemática",
        })
        assert r.status_code == 200
        data = r.json()
        # Response pode ter estrutura variada dependendo do router
        assert isinstance(data, (dict, list))

    def test_list_turmas(self):
        token = get_auth_token()
        r = client.get("/turmas", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1


# ============ TESTES DE CALENDÁRIO ============

class TestCalendar:
    def test_list_events(self):
        token = get_auth_token()
        r = client.get("/calendar/events", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert "count" in data
        assert "data" in data

    def test_list_events_by_type(self):
        token = get_auth_token()
        r = client.get("/calendar/events/holiday", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["type"] == "holiday"

    def test_list_periods(self):
        token = get_auth_token()
        r = client.get("/calendar/periods", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True

    def test_list_academic_years(self):
        token = get_auth_token()
        r = client.get("/calendar/academic-years", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True

    def test_list_schools(self):
        token = get_auth_token()
        r = client.get("/calendar/schools", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True

    def test_full_calendar(self):
        token = get_auth_token()
        r = client.get("/calendar/full-calendar", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert "calendar" in data


# ============ TESTES DE STATS ============

class TestStats:
    def test_get_stats(self):
        token = get_auth_token()
        r = client.get("/stats", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert "turmas" in data
        assert "alunos" in data
        assert "provas_corrigidas" in data

    def test_billing_status(self):
        token = get_auth_token()
        r = client.get("/billing/status", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
