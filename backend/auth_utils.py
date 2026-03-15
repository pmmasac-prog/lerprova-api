import jwt
from datetime import datetime, timedelta
from typing import Optional
import os
import logging
logger = logging.getLogger("lerprova-api")

# LGPD/Segurança: JWT_SECRET_KEY DEVE ser definido via variável de ambiente
_env_secret = os.getenv("JWT_SECRET_KEY")
if not _env_secret:
    import secrets
    _env_secret = secrets.token_hex(32)
    logger.critical("⚠️  JWT_SECRET_KEY não definido! Usando chave gerada aleatoriamente. "
                    "Todos os tokens serão invalidados ao reiniciar. "
                    "Defina JWT_SECRET_KEY como variável de ambiente em produção!")

SECRET_KEY = _env_secret
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 horas

# Log de diagnóstico (mascarado)
logger.info(f"JWT_CONFIG: Algorithm={ALGORITHM} SecretKeyLen={len(SECRET_KEY)}")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    # Garante que seja string (em algumas versões de PyJWT retorna bytes)
    if isinstance(encoded_jwt, bytes):
        return encoded_jwt.decode('utf-8')
    return encoded_jwt

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT Decode Fail: Token Expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"JWT Decode Fail: Invalid Token ({e})")
        return None
    except Exception as e:
        logger.error(f"JWT Decode Fail: Unexpected Error ({e})")
        return None
