from fastapi import FastAPI, Header, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
import time
import logging
import json
import os
import traceback
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

# Configuração de Logging Estruturado (Simplificado)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lerprova-api")

import models
import users_db
from database import engine, SessionLocal
from migrations import run_migrations
from routers import admin, planejamento, auth, turmas, alunos, gabaritos, resultados, frequencia, provas, reports

# Inicializar Banco de Dados
run_migrations(engine)  # Garantir colunas novas
models.Base.metadata.create_all(bind=engine) # Criar tabelas novas

# Opcional: Popular com usuários iniciais se estiver vazio
db = SessionLocal()
users_db.init_default_users(db)
db.close()

app = FastAPI(title="LERPROVA API", version="1.3.0")

# Inclusão dos Roteadores
app.include_router(auth.router)
app.include_router(turmas.router)
app.include_router(alunos.router)
app.include_router(gabaritos.router)
app.include_router(resultados.router)
app.include_router(frequencia.router)
app.include_router(provas.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(planejamento.router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "db": "connected"}

@app.get("/")
async def root():
    return {"message": "LERPROVA Pro API - Modularizada e Ativa"}

# Configuração de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    err_msg = f"Erro Global: {str(exc)}\n{traceback.format_exc()}"
    logger.error(err_msg)
    response = JSONResponse(
        status_code=500,
        content={
            "detail": "Erro interno no servidor", 
            "error_message": str(exc),
            "trace": traceback.format_exc() if os.getenv("DEBUG") == "true" else "Trace oculto em produção"
        }
    )
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        log_data = {
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": int(duration * 1000)
        }
        logger.info(f"REQ: {json.dumps(log_data)}")
        return response
    except Exception as e:
        logger.error(f"Erro no middleware: {str(e)}\n{traceback.format_exc()}")
        raise e

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
