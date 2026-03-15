import sys
import os

# Adjust path to import modules from backend
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app
from models import User, Turma, Aluno, pwd_context

# USE SQLITE FOR TEST
TEST_DB_URL = "sqlite:///./test_wipe.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

def test_wipe_endpoint():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # 1. Create Admin
    admin = User(
        nome="Admin",
        email="admin@test.com",
        hashed_password=pwd_context.hash("pass"),
        role="admin"
    )
    db.add(admin)
    db.commit()
    
    # 2. Create Turma
    turma = Turma(nome="Turma Wipe", user_id=admin.id)
    db.add(turma)
    db.commit()
    
    # 3. Add Students
    a1 = Aluno(nome="Aluno 1", codigo="A1")
    a2 = Aluno(nome="Aluno 2", codigo="A2")
    turma.alunos.append(a1)
    turma.alunos.append(a2)
    db.commit()
    
    turma_id = turma.id
    a1_id = a1.id
    a2_id = a2.id
    print(f"Created Turma {turma_id} with students")
    
    client = TestClient(app)
    # Login to get token
    login_res = client.post("/auth/login", json={"email": "admin@test.com", "password": "pass"})
    token = login_res.json()["access_token"]
    
    # 4. Call Wipe
    wipe_res = client.delete(f"/turmas/{turma_id}/wipe", headers={"Authorization": f"Bearer {token}"})
    print(f"Wipe Response: {wipe_res.status_code} - {wipe_res.json()}")
    
    assert wipe_res.status_code == 200
    
    # 5. Verify Deletion
    db = SessionLocal() # New session to be sure
    t_exists = db.query(Turma).filter(Turma.id == turma_id).first()
    a1_exists = db.query(Aluno).filter(Aluno.id == a1_id).first()
    a2_exists = db.query(Aluno).filter(Aluno.id == a2_id).first()
    
    print(f"Turma {turma_id} exists: {t_exists is not None}")
    print(f"Aluno {a1_id} exists: {a1_exists is not None}")
    print(f"Aluno {a2_id} exists: {a2_exists is not None}")
    
    assert t_exists is None
    assert a1_exists is None
    assert a2_exists is None
    print("Verification Successful!")
    
    assert t_exists is None
    assert a1_exists is None
    assert a2_exists is None
    print("Verification Successful!")

if __name__ == "__main__":
    test_wipe_endpoint()
