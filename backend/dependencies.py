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
    
    user_email = payload.get("sub")
    if user_email:
        user_email = user_email.lower() # Case-insensitive lookup safety
    
    user = db.query(models.User).filter(models.User.email.ilike(user_email)).first()
    if not user:
        logger.warning(f"AUTH FAIL: User not found in DB for email: {user_email}")
        raise HTTPException(status_code=404, detail=f"Usuário não encontrado ({user_email})")
    
    # Log de depuração (ativado para diagnóstico)
    logger.info(f"AUTH SUCCESS: user={user.email} role={user.role} id={user.id}")
    
    return user
