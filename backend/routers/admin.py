from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import users_db
import models
from database import get_db
from sqlalchemy.orm import Session, joinedload
from dependencies import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

class UserCreate(BaseModel):
    nome: str
    email: str
    password: str
    role: str = "professor"
    escola: Optional[str] = ""
    disciplina: Optional[str] = ""

class UserUpdate(BaseModel):
    nome: Optional[str] = None
    role: Optional[str] = None
    escola: Optional[str] = None
    disciplina: Optional[str] = None

# Dependência para verificar se o usuário é admin via JWT
async def verify_admin(user = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return user

@router.get("/users")
async def list_users(admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    users = db.query(users_db.User).all()
    # Retorna usuários sem o hash da senha e em formato dicionário simples
    return [
        {
            "id": u.id,
            "nome": u.nome,
            "email": u.email,
            "role": u.role,
            "escola": u.escola,
            "disciplina": u.disciplina,
            "is_active": u.is_active,
            "plan_type": u.plan_type,
            "total_corrections_used": u.total_corrections_used
        } for u in users
    ]

@router.post("/users")
async def create_new_user(user: UserCreate, admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    existing = users_db.get_user_by_email(db, user.email)
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    
    new_user = users_db.create_user(db, user.dict())
    return {"message": "Usuário criado com sucesso", "user": {"id": new_user.id, "email": new_user.email}}

@router.delete("/users/{user_id}")
async def delete_user(user_id: int, admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    user = db.query(users_db.User).filter(users_db.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if user.id == admin_user.id:
        raise HTTPException(status_code=400, detail="Não é possível excluir a si mesmo")
        
    db.delete(user)
    db.commit()
    return {"message": "Usuário removido com sucesso"}


@router.get("/turmas")
async def list_all_turmas(admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    # Retorna todas as turmas com info do professor
    turmas = db.query(models.Turma).options(joinedload(models.Turma.professor)).all()
    
    result = []
    for t in turmas:
        t_dict = {
            "id": t.id,
            "nome": t.nome,
            "disciplina": t.disciplina,
            "user_id": t.user_id,
            "professor_nome": t.professor.nome if t.professor else "Sem Professor",
            "professor_email": t.professor.email if t.professor else ""
        }
        result.append(t_dict)
    return result

@router.put("/turmas/{turma_id}/transfer/{user_id}")
async def transfer_turma(turma_id: int, user_id: int, admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    turma = db.query(models.Turma).filter(models.Turma.id == turma_id).first()
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
    
    new_prof = db.query(users_db.User).filter(users_db.User.id == user_id).first()
    if not new_prof:
         raise HTTPException(status_code=404, detail="Novo professor não encontrado")
         
    turma.user_id = user_id
    db.commit()
    
    return {"message": f"Turma '{turma.nome}' transferida para {new_prof.nome}"}
