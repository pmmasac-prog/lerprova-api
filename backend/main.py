from fastapi import FastAPI, Header, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
import time
import logging
import json
import os
import traceback
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
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
from routers import admin, planejamento, auth, turmas, alunos, gabaritos, resultados, frequencia, provas, reports, curriculo, dashboard, notifications, alunos_portal, calendar, reports_admin, agents

# Inicializar Banco de Dados
models.Base.metadata.create_all(bind=engine) # Criar tabelas iniciais
run_migrations(engine)  # Aplicar migrações/alterações de colunas extras

# Verificar e Inicializar Sistema Completo
logger.info("\n" + "="*60)
logger.info("🔧 VERIFICAÇÃO E INICIALIZAÇÃO DO SISTEMA")
logger.info("="*60)
try:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent))
    from scripts.init_complete_system import seed_complete_system
    seed_complete_system()
    logger.info("="*60 + "\n")
except Exception as e:
    logger.error(f"\n❌ Erro na inicialização: {e}")
    import traceback
    traceback.print_exc()

app = FastAPI(title="LERPROVA API", version="1.3.1")

# Inclusão dos Roteadores
app.include_router(auth.router)
app.include_router(turmas.router)
app.include_router(alunos.router)
app.include_router(alunos_portal.router)
app.include_router(gabaritos.router)
app.include_router(resultados.router)
app.include_router(frequencia.router)
app.include_router(provas.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(planejamento.router)
app.include_router(curriculo.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)
app.include_router(reports_admin.router)
app.include_router(agents.router)
app.include_router(calendar.router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "db": "connected"}

@app.get("/")
async def root():
    return {"message": "LERPROVA Pro API - Modularizada e Ativa", "version": "1.3.1"}

# Configuração de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["Content-Type", "Authorization"],  # Explicit allow para Auth header
    allow_credentials=True,  # Allow credentials para que Auth header funcione
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        body = await request.body()
        logger.error(f"VALERRO 422: {exc.errors()} | PATH: {request.url.path} | BODY: {body.decode()}")
    except:
        logger.error(f"VALERRO 422: {exc.errors()} (Body unreadable)")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    trace = traceback.format_exc()
    err_msg = f"Erro Global: {str(exc)}\n{trace}"
    logger.error(err_msg)
    
    # Função para limpar objetos não serializáveis (como bytes)
    def clean_json(obj):
        if isinstance(obj, bytes):
            return obj.decode('utf-8', errors='replace')
        if isinstance(obj, dict):
            return {k: clean_json(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [clean_json(i) for i in obj]
        return str(obj) if not isinstance(obj, (str, int, float, bool, type(None))) else obj

    response_content = {
        "detail": "Erro interno no servidor", 
        "error_message": clean_json(str(exc)),
        "trace": clean_json(trace)
    }
    
    response = JSONResponse(
        status_code=500,
        content=response_content
    )
    # CORS
    response.headers["Access-Control-Allow-Origin"] = "*"
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
