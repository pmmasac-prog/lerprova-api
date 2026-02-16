from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import List, Optional
import users_db
import auth_utils
from database import get_db
from sqlalchemy.orm import Session

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
async def verify_admin(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token ausente ou inválido")
    
    token = authorization.split(" ")[1]
    payload = auth_utils.decode_access_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Sessão expirada ou inválida")
    
    user = users_db.get_user_by_email(db, payload.get("sub"))
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    return user

@router.get("/users")
async def list_users(admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    users = db.query(users_db.User).all()
    # Retorna usuários sem o hash da senha
    return users

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

