from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
import users_db
import auth_utils
import models

import logging
logger = logging.getLogger("lerprova-api")

async def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token ausente ou inválido")
    
    token = authorization.split(" ")[1]
    payload = auth_utils.decode_access_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Sessão expirada ou inválida")
    
    user = db.query(users_db.User).filter(users_db.User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # Log de depuração (remover se ficar muito ruidoso)
    # logger.info(f"AUTH: user={user.email} role={user.role} id={user.id}")
    
    return user
