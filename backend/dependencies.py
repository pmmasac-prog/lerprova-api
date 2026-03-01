from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
import users_db
import auth_utils
import models

import logging
logger = logging.getLogger("lerprova-api")

async def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    # logger.info(f"DEBUG AUTH: header={authorization[:20] if authorization else 'NONE'}")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token ausente ou inválido")
    
    token = authorization.split(" ")[1]
    payload = auth_utils.decode_access_token(token)
    
    if not payload:
        # Tenta descobrir o motivo da falha se possível (o auth_utils já logou)
        raise HTTPException(status_code=401, detail="Sessão expirada ou inválida (Token Decode Fail)")
    
    user_id_val = payload.get("sub")
    role = payload.get("role", "professor")
    
    if role == "student":
        student = db.query(models.Aluno).filter(models.Aluno.codigo == user_id_val).first()
        if not student:
            raise HTTPException(status_code=404, detail="Aluno não encontrado")
        # Adicionar atributo role virtual para compatibilidade se necessário
        student.role = "student"
        return student
    
    if user_id_val:
        user_id_val = user_id_val.lower()
    
    user = db.query(models.User).filter(models.User.email.ilike(user_id_val)).first()
    if not user:
        logger.warning(f"AUTH FAIL: User not found in DB for email/code: {user_id_val}")
        raise HTTPException(status_code=404, detail=f"Usuário não encontrado ({user_id_val})")
    
    logger.info(f"AUTH SUCCESS: user={user.email} role={user.role} id={user.id}")
    return user
