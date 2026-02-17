from fastapi import FastAPI, Header, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
import time
import logging
import json
import os
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from dotenv import load_dotenv
import traceback
from fastapi.responses import JSONResponse

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

# Configuração de Logging Estruturado (Simplificado)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lerprova-api")

from omr_engine import OMREngine
import users_db
import models # Importar os novos modelos
import auth_utils
from database import get_db, engine, SessionLocal
from sqlalchemy.orm import Session, joinedload
from dependencies import get_current_user

# Inicializar Banco de Dados (Cria todas as tabelas: users, turmas, alunos, etc.)
users_db.Base.metadata.create_all(bind=engine)
models.Base.metadata.create_all(bind=engine) # Garantir que modelos novos sejam criados

# Opcional: Popular com usuários iniciais se estiver vazio
db = SessionLocal()
users_db.init_default_users(db)
db.close()

from routers import admin, planejamento

app = FastAPI(title="LERPROVA API", version="1.2.0")
omr = OMREngine()

app.include_router(admin.router)
app.include_router(planejamento.router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "db": "connected"}

# Chave de API simples para uso interno
API_KEY_SECRET = os.getenv("API_KEY_SECRET", "lp_secret_key_2026_batch")

class SyncRequest(BaseModel):
    turmas: Optional[List[dict]] = []
    alunos: Optional[List[dict]] = []
    gabaritos: Optional[List[dict]] = []
    resultados: Optional[List[dict]] = []

class ProcessRequest(BaseModel):
    image: str
    num_questions: Optional[int] = 10
    gabarito_id: Optional[int] = None
    aluno_id: Optional[int] = None

class ResultadoUpdate(BaseModel):
    respostas_aluno: Optional[List[str]] = None
    nota: Optional[float] = None
    acertos: Optional[int] = None

class ResultadoCreate(BaseModel):
    aluno_id: int
    gabarito_id: int
    respostas_aluno: Optional[List[str]] = None
    nota: Optional[float] = None
    acertos: Optional[int] = None

# Configuração de CORS
# Permitimos a URL do frontend do Render explicitamente para evitar bloqueios
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://lerprova-frontend-app.onrender.com",
    "https://lerprova-frontend-app-vzbd.onrender.com", # Adicionando a URL específica vista no log
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Mantendo * para facilitar, mas com allow_credentials=False
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
            "error": str(exc),
            "trace": traceback.format_exc() if os.getenv("DEBUG") == "true" else "Trace oculto em produção"
        }
    )
    # Adicionando CORS manual pois exception handlers pulam o middleware em alguns casos
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
        
        # Log estruturado da requisição
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
        # Re-raise para o global_exception_handler pegar e devolver JSON + CORS
        raise e

async def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY_SECRET:
        raise HTTPException(status_code=403, detail="Chave de API inválida ou ausente")
    return x_api_key


@app.get("/stats")
async def get_stats(user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Filtros baseados no papel do usuário
    if user.role != "admin":
        turmas_count = db.query(models.Turma).filter(models.Turma.user_id == user.id).count()
        alunos_count = db.query(models.Aluno).join(models.Turma, models.Aluno.turmas).filter(models.Turma.user_id == user.id).distinct().count()
        provas_count = db.query(models.Resultado).join(models.Gabarito).filter(models.Gabarito.turmas.any(models.Turma.user_id == user.id)).count()
    else:
        turmas_count = db.query(models.Turma).count()
        alunos_count = db.query(models.Aluno).count()
        provas_count = db.query(models.Resultado).count()
        
    return {
        "turmas": turmas_count,
        "alunos": alunos_count,
        "provas_corrigidas": provas_count,
        "professor": user.nome
    }

@app.get("/stats/turma/{turma_id}")
async def get_stats_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validar Acesso à Turma (RBAC)
    turma = db.query(models.Turma).filter(models.Turma.id == turma_id).first()
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
    
    if user.role != "admin" and turma.user_id != user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")
        
    resultados = db.query(models.Resultado).join(models.Gabarito).filter(models.Gabarito.turmas.any(models.Turma.id == turma_id)).all()
    
    total_provas = len(resultados)
    media_geral = sum(r.nota for r in resultados) / total_provas if total_provas > 0 else 0
    
    return {
        "turma": turma.nome,
        "total_provas": total_provas,
        "media_geral": round(media_geral, 1),
        "alunos_count": len(turma.alunos)
    }

@app.get("/billing/status")
async def get_billing_status(user: users_db.User = Depends(get_current_user)):
    return {
        "plan": user.plan_type,
        "corrections_used": user.total_corrections_used,
        "is_pro": user.plan_type in ["pro", "school"],
        "expires_at": user.subscription_expires_at
    }

@app.post("/billing/upgrade")
async def upgrade_plan(data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Simulação de upgrade para Pro (Em prod, aqui integraria com o Webhook do Mercado Pago)
    target_plan = data.get("plan", "pro")
    user.plan_type = target_plan
    db.commit()
    return {"message": f"Sucesso! Seu plano foi atualizado para {target_plan}.", "plan": user.plan_type}

@app.get("/")
async def root():
    return {"message": "LERPROVA Pro API - Autenticação JWT Ativa"}

@app.post("/auth/login")
async def login(data: dict, db: Session = Depends(get_db)):
    email = data.get("email")
    password = data.get("password")
    
    user = users_db.get_user_by_email(db, email)
    
    if user and user.verify_password(password):
        # Gerar Token JWT Real
        token = auth_utils.create_access_token(data={"sub": user.email, "user_id": user.id, "role": user.role})
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "nome": user.nome,
                "email": user.email,
                "escola": user.escola,
                "role": user.role
            }
        }
    
    raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")

# --- Endpoints de Turmas (Banco de Dados) ---

@app.get("/turmas")
async def get_turmas(user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(models.Turma)
    if user.role != "admin":
        query = query.filter(models.Turma.user_id == user.id)
    
    turmas = query.all()
    # Retornar dicionários simples para evitar recursão de serialização
    return [
        {
            "id": t.id,
            "nome": t.nome,
            "disciplina": t.disciplina,
            "user_id": t.user_id,
            "created_at": t.created_at.isoformat() if t.created_at else None
        } for t in turmas
    ]

@app.post("/turmas")
async def create_turma(data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validar se já existe? Por enquanto simplificado
    nova_turma = models.Turma(
        nome=data.get("nome"),
        disciplina=data.get("disciplina"),
        user_id=user.id # Vincula a turma ao professor logado
    )
    db.add(nova_turma)
    db.commit()
    db.refresh(nova_turma)
    print(f"Turma criada: {nova_turma.nome} pelo usuário {user.email}")
    return {"message": "Turma cadastrada com sucesso", "id": nova_turma.id}

@app.delete("/turmas/{turma_id}")
async def delete_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(models.Turma).filter(models.Turma.id == turma_id)
    
    # Se não for admin, garante que só pode deletar suas próprias turmas
    if user.role != "admin":
        query = query.filter(models.Turma.user_id == user.id)
        
    turma = query.first()
    
    if turma:
        db.delete(turma)
        db.commit()
        return {"message": "Turma excluída com sucesso"}
    
    # Se não encontrou (seja porque não existe ou porque não pertence ao user)
    raise HTTPException(status_code=404, detail="Turma não encontrada ou acesso negado")


# --- Endpoints de Alunos (Banco de Dados) ---

@app.post("/alunos")
async def create_aluno(data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    codigo = data.get("codigo")
    raw_turma_id = data.get("turma_id")
    nome = data.get("nome")
    
    # 1. Validar turma_id de forma segura
    try:
        turma_id = int(raw_turma_id) if raw_turma_id is not None and str(raw_turma_id).strip() != "" else None
    except (ValueError, TypeError):
        turma_id = None
        
    # Validar se o usuário tem permissão para adicionar nesta turma
    if turma_id and user.role != "admin":
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
        if not turma:
            raise HTTPException(status_code=403, detail="Você não tem permissão para adicionar alunos nesta turma")
    
    # 1. Tentar encontrar aluno existente pelo código
    aluno = db.query(models.Aluno).filter(models.Aluno.codigo == codigo).first()
    
    if not aluno:
        # 2. Se não existir, criar novo
        import uuid
        token = data.get("qr_token")
        if not token:
            token = f"ALUNO-{uuid.uuid4().hex[:8].upper()}"

        aluno = models.Aluno(
            nome=nome,
            codigo=codigo,
            qr_token=token
        )
        db.add(aluno)
        db.flush() # Para pegar o ID
    
    # 3. Vincular à turma se fornecido e se ainda não estiver vinculado
    if turma_id:
        try:
            turma = db.query(models.Turma).filter(models.Turma.id == turma_id).first()
            if not turma:
                 logger.warning(f"Tentativa de vincular a turma inexistente: {turma_id}")
            elif turma not in aluno.turmas:
                logger.info(f"Vinculando aluno {aluno.id} à turma {turma_id}")
                aluno.turmas.append(turma)
        except Exception as e:
            logger.error(f"Erro ao vincular aluno à turma: {e}")
            # Não falha o processo todo se for apenas erro de vínculo (ex: já existe)
    
    try:
        db.commit()
        db.refresh(aluno)
    except Exception as e:
        logger.error(f"Erro no commit de criação de aluno: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao salvar aluno: {str(e)}")

    return {"message": "Aluno processado com sucesso", "id": aluno.id, "novo_cadastro": aluno.nome == nome}

@app.get("/alunos")
async def get_alunos(user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == "admin":
        alunos = db.query(models.Aluno).all()
    else:
        # Se professor, retorna apenas alunos das suas turmas
        alunos = db.query(models.Aluno).join(models.Turma, models.Aluno.turmas).filter(models.Turma.user_id == user.id).distinct().all()
    
    return [
        {
            "id": a.id,
            "nome": a.nome,
            "codigo": a.codigo,
            "qr_token": a.qr_token,
            "turmas_nomes": [t.nome for t in a.turmas]
        } for a in alunos
    ]

@app.get("/alunos/turma/{turma_id}")
async def get_alunos_by_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validar acesso à turma
    query = db.query(models.Turma).filter(models.Turma.id == turma_id)
    if user.role != "admin":
        query = query.filter(models.Turma.user_id == user.id)
    
    turma = query.first()
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada ou acesso negado")
    return turma.alunos

@app.delete("/alunos/{aluno_id}")
async def delete_aluno(aluno_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Se admin, pode deletar qualquer um. Se professor, apenas se o aluno estiver vinculado a alguma turma dele?
    # Melhor: Professor pode remover aluno da SUA turma (unlink), mas deletar do sistema talvez so admin
    # Mas o requisito diz "gerenciar". Vamos permitir professor deletar aluno se ele criou/estiver na turma dele.
    
    aluno = db.query(models.Aluno).filter(models.Aluno.id == aluno_id).first()
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    if user.role != "admin":
        # Verifica se o aluno pertence a alguma turma do professor
        pertence = any(t.user_id == user.id for t in aluno.turmas)
        if not pertence:
             raise HTTPException(status_code=403, detail="Você só pode excluir alunos das suas turmas")

    db.delete(aluno)
    db.commit()
    return {"message": "Aluno excluído com sucesso"}

@app.delete("/turmas/{turma_id}/alunos/{aluno_id}")
async def unlink_aluno_from_turma(turma_id: int, aluno_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validar acesso à turma
    turma_query = db.query(models.Turma).filter(models.Turma.id == turma_id)
    if user.role != "admin":
        turma_query = turma_query.filter(models.Turma.user_id == user.id)
        
    turma = turma_query.first()
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada ou acesso negado")

    aluno = db.query(models.Aluno).filter(models.Aluno.id == aluno_id).first()
    
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    if aluno in turma.alunos:
        turma.alunos.remove(aluno)
        db.commit()
        return {"message": "Aluno removido da turma com sucesso"}
    
    return {"message": "Aluno não estava vinculado a esta turma"}


# --- Endpoints de Gabaritos (Banco de Dados) ---

@app.post("/gabaritos")
async def create_gabarito(data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # O model espera JSON string em 'respostas_corretas'
    respostas = data.get("respostas")
    if isinstance(respostas, list):
        respostas = json.dumps(respostas)
    
    # Se ja vier string "A,B,C" converter para JSON array string
    if isinstance(respostas, str) and "," in respostas:
        arr = [x.strip() for x in respostas.split(",")]
        respostas = json.dumps(arr)

    # Turma(s)
    turma_ids = data.get("turma_ids", [])
    if data.get("turma_id") and int(data.get("turma_id")) not in turma_ids:
        turma_ids.append(int(data.get("turma_id")))

    # RBAC: Verificar se o usuário tem permissão para criar prova para estas turmas
    if user.role != "admin" and turma_ids:
        # Conta quantas dessas turmas pertencem ao usuário
        user_turmas_count = db.query(models.Turma).filter(models.Turma.id.in_(turma_ids), models.Turma.user_id == user.id).count()
        if user_turmas_count != len(turma_ids):
             raise HTTPException(status_code=403, detail="Você não tem permissão para criar provas para turmas que não são suas")

    novo_gabarito = models.Gabarito(
        turma_id=turma_ids[0] if turma_ids else None, # Compatibilidade
        titulo=data.get("titulo", data.get("assunto")),
        assunto=data.get("assunto"),
        disciplina=data.get("disciplina"),
        data_prova=data.get("data"), # Front manda 'data'
        num_questoes=int(data.get("questoes") or data.get("num_questoes") or 10),
        respostas_corretas=respostas,
        periodo=data.get("periodo")
    )

    if turma_ids:
        turmas = db.query(models.Turma).filter(models.Turma.id.in_(turma_ids)).all()
        novo_gabarito.turmas = turmas

    db.add(novo_gabarito)
    db.commit()
    db.refresh(novo_gabarito)
    return {"message": "Gabarito criado com sucesso", "id": novo_gabarito.id}

@app.put("/gabaritos/{gabarito_id}")
async def update_gabarito(gabarito_id: int, data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    gabarito = db.query(models.Gabarito).filter(models.Gabarito.id == gabarito_id).first()
    if not gabarito:
        raise HTTPException(status_code=404, detail="Gabarito não encontrado")
    
    # RBAC: Verificar acesso
    if user.role != "admin":
        has_access = any(t.user_id == user.id for t in gabarito.turmas)
        if not has_access and gabarito.turmas: # Se não tiver turmas, talvez seja orfão, admin lida. Se tiver, check
             # Se o gabarito não tem turmas, vamos assumir que só quem criou ou admin (mas não salvamos criador).
             # Se tem turmas, o user tem que ser dono de pelo menos uma.
             raise HTTPException(status_code=403, detail="Acesso negado a este gabarito")

    # Update fields
    if "titulo" in data or "assunto" in data:
        gabarito.titulo = data.get("titulo", data.get("assunto"))
        gabarito.assunto = data.get("assunto", gabarito.assunto)
    
    if "disciplina" in data:
        gabarito.disciplina = data.get("disciplina")
    
    if "data" in data:
        gabarito.data_prova = data.get("data")
    
    if "num_questoes" in data or "questoes" in data:
        gabarito.num_questoes = int(data.get("questoes") or data.get("num_questoes") or gabarito.num_questoes)
    
    if "respostas" in data:
        respostas = data.get("respostas")
        if isinstance(respostas, list):
            respostas = json.dumps(respostas)
        gabarito.respostas_corretas = respostas

    if "periodo" in data:
        gabarito.periodo = data.get("periodo")

    if "turma_ids" in data:
        turma_ids = data.get("turma_ids", [])
        
        # RBAC na atualização de turmas
        if user.role != "admin" and turma_ids:
             user_turmas_count = db.query(models.Turma).filter(models.Turma.id.in_(turma_ids), models.Turma.user_id == user.id).count()
             if user_turmas_count != len(turma_ids):
                  raise HTTPException(status_code=403, detail="Você não pode vincular este gabarito a turmas que não são suas")

        turmas = db.query(models.Turma).filter(models.Turma.id.in_(turma_ids)).all()
        gabarito.turmas = turmas
        if turma_ids:
            gabarito.turma_id = turma_ids[0]

    db.commit()
    return {"message": "Gabarito atualizado com sucesso"}

@app.get("/gabaritos")
async def get_gabaritos(user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Usar joinedload para trazer as turmas vinculadas
    query = db.query(models.Gabarito).options(joinedload(models.Gabarito.turmas))
    
    if user.role != "admin":
        # Retorna apenas gabaritos associados as turmas do professor
        # Como é M-to-M, idealmente usaríamos .join(models.Gabarito.turmas), mas o joinedload já faz join?
        # Vamos filtrar onde gabarito.turmas contem alguma turma do user.
        # SQLAlchemy 'any':
        query = query.filter(models.Gabarito.turmas.any(models.Turma.user_id == user.id))

    gabaritos = query.all()
    
    # Formatação para o front (incluindo nomes das turmas e contagem de resultados)
    result = []
    for g in gabaritos:
        count = db.query(models.Resultado).filter(models.Resultado.gabarito_id == g.id).count()
        g_dict = {
            "id": g.id,
            "turma_id": g.turma_id,
            "turma_nome": ", ".join([t.nome for t in g.turmas]) if g.turmas else "N/A",
            "turma_ids": [t.id for t in g.turmas],
            "titulo": g.titulo,
            "assunto": g.assunto,
            "disciplina": g.disciplina,
            "data": g.data_prova or "",
            "num_questoes": g.num_questoes,
            "respostas_corretas": g.respostas_corretas,
            "periodo": g.periodo,
            "total_resultados": count
        }
        result.append(g_dict)
    
    return result

@app.get("/disciplinas")
async def get_disciplinas(db: Session = Depends(get_db)):
    # Pegar disciplinas únicas de Turmas e Gabaritos
    disc_turmas = db.query(models.Turma.disciplina).filter(models.Turma.disciplina != None).distinct().all()
    disc_gabas = db.query(models.Gabarito.disciplina).filter(models.Gabarito.disciplina != None).distinct().all()
    
    all_discs = set([d[0] for d in disc_turmas] + [d[0] for d in disc_gabas])
    return sorted(list(all_discs))

@app.delete("/gabaritos/{gabarito_id}")
async def delete_gabarito(gabarito_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    gabarito = db.query(models.Gabarito).filter(models.Gabarito.id == gabarito_id).first()
    if not gabarito:
        raise HTTPException(status_code=404, detail="Gabarito não encontrado")

    if user.role != "admin":
        has_access = any(t.user_id == user.id for t in gabarito.turmas)
        if not has_access and gabarito.turmas:
             raise HTTPException(status_code=403, detail="Acesso negado para excluir este gabarito")

    db.delete(gabarito)
    db.commit()
    return {"message": "Gabarito excluído com sucesso"}


# --- Endpoints de Resultados (Banco de Dados) ---

@app.get("/resultados")
async def get_resultados(user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(models.Resultado).options(
        joinedload(models.Resultado.aluno),
        joinedload(models.Resultado.gabarito).joinedload(models.Gabarito.turmas)
    )
    
    if user.role != "admin":
        query = query.join(models.Gabarito).filter(models.Gabarito.turmas.any(models.Turma.user_id == user.id))

    resultados = query.all()
    
    return [
        {
            "id": r.id,
            "aluno_id": r.aluno_id,
            "gabarito_id": r.gabarito_id,
            "acertos": r.acertos,
            "nota": r.nota,
            "respostas_aluno": r.respostas_aluno,
            "data": r.data_correcao.strftime("%Y-%m-%d %H:%M:%S") if r.data_correcao else None,
            "nome": r.aluno.nome if r.aluno else "N/A",
            "aluno_codigo": r.aluno.codigo if r.aluno else "N/A",
            "assunto": r.gabarito.titulo or r.gabarito.assunto if r.gabarito else "N/A",
            "periodo": r.gabarito.periodo if r.gabarito else None,
            "turma_id": r.gabarito.turmas[0].id if r.gabarito and r.gabarito.turmas else None
        } for r in resultados
    ]

@app.get("/resultados/turma/{turma_id}/aluno/{aluno_id}")
async def get_resultados_aluno_turma(turma_id: int, aluno_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validar Acesso a Turma
    if user.role != "admin":
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
        if not turma:
            raise HTTPException(status_code=403, detail="Acesso negado a esta turma")

    # Filtra resultados de um aluno específico dentro de um gabarito que pertence a esta turma
    resultados = db.query(models.Resultado).join(models.Gabarito).filter(
        models.Resultado.aluno_id == aluno_id,
        models.Gabarito.turmas.any(models.Turma.id == turma_id)
    ).all()
    
    resp = []
    for r in resultados:
        r_dict = r.__dict__.copy()
        if "_sa_instance_state" in r_dict: del r_dict["_sa_instance_state"]
        if r.gabarito:
            r_dict["assunto"] = r.gabarito.titulo or r.gabarito.assunto
            r_dict["data"] = r.data_correcao.strftime("%Y-%m-%d %H:%M:%S") if r.data_correcao else None
        resp.append(r_dict)
    return resp

@app.get("/frequencia/turma/{turma_id}/aluno/{aluno_id}")
async def get_frequencia_aluno_turma(turma_id: int, aluno_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validar Acesso a Turma
    if user.role != "admin":
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
        if not turma:
            raise HTTPException(status_code=403, detail="Acesso negado a esta turma")

    # Retorna estatísticas de frequência do aluno apenas nesta turma
    freqs = db.query(models.Frequencia).filter(
        models.Frequencia.turma_id == turma_id,
        models.Frequencia.aluno_id == aluno_id
    ).all()
    
    total_aulas = len(freqs)
    total_presencas = len([f for f in freqs if f.presente])
    
    percentage = 0
    if total_aulas > 0:
        percentage = int((total_presencas / total_aulas) * 100)
        
    return {
        "aluno_id": aluno_id,
        "turma_id": turma_id,
        "total_aulas": total_aulas,
        "total_presencas": total_presencas,
        "percentual": f"{percentage}%",
        "historico": freqs # Opcional: retornar histórico se quiser mostrar lista
    }

@app.get("/resultados/turma/{turma_id}")
async def get_resultados_by_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validar Acesso a Turma
    if user.role != "admin":
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
        if not turma:
            raise HTTPException(status_code=403, detail="Acesso negado a esta turma")

    # Filtro agora baseado na associação do Gabarito com a Turma
    # Isso traz os resultados de todas as provas aplicadas para ESTA turma
    resultados = db.query(models.Resultado).join(models.Gabarito).filter(
        models.Gabarito.turmas.any(models.Turma.id == turma_id)
    ).options(
        joinedload(models.Resultado.aluno),
        joinedload(models.Resultado.gabarito)
    ).all()

    resp = []
    for r in resultados:
        r_dict = r.__dict__.copy()
        if "_sa_instance_state" in r_dict: del r_dict["_sa_instance_state"]
        if r.aluno:
            r_dict["nome"] = r.aluno.nome
            r_dict["aluno_codigo"] = r.aluno.codigo
        if r.gabarito:
            r_dict["assunto"] = r.gabarito.titulo or r.gabarito.assunto
            r_dict["periodo"] = r.gabarito.periodo
            r_dict["turma_id"] = turma_id # Como filtramos por esta turma
        if r.data_correcao:
            r_dict["data"] = r.data_correcao.strftime("%Y-%m-%d %H:%M:%S")
        resp.append(r_dict)
    return resp

@app.get("/resultados/gabarito/{gabarito_id}")
async def get_resultados_by_gabarito(gabarito_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    gabarito = db.query(models.Gabarito).filter(models.Gabarito.id == gabarito_id).first()
    if not gabarito:
        raise HTTPException(status_code=404, detail="Gabarito não encontrado")

    if user.role != "admin":
        has_access = any(t.user_id == user.id for t in gabarito.turmas)
        if not has_access and gabarito.turmas:
             raise HTTPException(status_code=403, detail="Acesso negado a este gabarito")

    resultados = db.query(models.Resultado).filter(models.Resultado.gabarito_id == gabarito_id).all()
    resp = []
    for r in resultados:
        r_dict = r.__dict__.copy()
        if r.aluno:
            r_dict["nome"] = r.aluno.nome
        if "_sa_instance_state" in r_dict:
            del r_dict["_sa_instance_state"]
        resp.append(r_dict)
    return resp

@app.post("/resultados")
async def create_resultado_manual(data: ResultadoCreate, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    gabarito = db.query(models.Gabarito).filter(models.Gabarito.id == data.gabarito_id).first()
    if not gabarito:
        raise HTTPException(status_code=404, detail="Gabarito não encontrado")

    if user.role != "admin":
        has_access = any(t.user_id == user.id for t in gabarito.turmas)
        if not has_access and gabarito.turmas:
             raise HTTPException(status_code=403, detail="Você não tem permissão para lançar resultados neste gabarito")
    
    nota = 0.0
    acertos = 0
    total = gabarito.num_questoes
    
    # Se a nota foi fornecida diretamente (Lançamento Rápido)
    if data.nota is not None:
        nota = data.nota
        # Se acertos não foi fornecido, estimar proporcionalmente
        if data.acertos is not None:
            acertos = data.acertos
        else:
            acertos = int((nota / 10) * total)
    elif data.respostas_aluno is not None:
        # Lançamento Completo por respostas
        try:
            corretas = json.loads(gabarito.respostas_corretas) if gabarito.respostas_corretas else []
        except:
            corretas = []
        
        detectadas = data.respostas_aluno
        acertos = 0
        total_gab = len(corretas)
        for i in range(min(total_gab, len(detectadas))):
            if detectadas[i] == corretas[i]:
                acertos += 1
        
        nota = (acertos / total_gab) * 10 if total_gab > 0 else 0
    # Verificar se já existe um resultado para este aluno nest prova
    resultado_existente = db.query(models.Resultado).filter(
        models.Resultado.aluno_id == data.aluno_id,
        models.Resultado.gabarito_id == data.gabarito_id
    ).first()

    if resultado_existente:
        # Atualizar existente
        resultado_existente.acertos = acertos
        resultado_existente.nota = nota
        resultado_existente.respostas_aluno = json.dumps(data.respostas_aluno) if data.respostas_aluno else None
        resultado_existente.data_correcao = datetime.utcnow()
        db.commit()
        db.refresh(resultado_existente)
        return {"message": "Resultado atualizado com sucesso", "id": resultado_existente.id, "nota": nota}
    else:
        # Criar novo
        novo_resultado = models.Resultado(
            aluno_id=data.aluno_id,
            gabarito_id=data.gabarito_id,
            acertos=acertos,
            nota=nota,
            respostas_aluno=json.dumps(data.respostas_aluno) if data.respostas_aluno else None,
            data_correcao=datetime.utcnow()
        )
        db.add(novo_resultado)
        db.commit()
        db.refresh(novo_resultado)
        return {"message": "Resultado registrado com sucesso", "id": novo_resultado.id, "nota": nota}

@app.patch("/resultados/{resultado_id}")
async def update_resultado(resultado_id: int, data: ResultadoUpdate, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    resultado = db.query(models.Resultado).filter(models.Resultado.id == resultado_id).first()
    if not resultado:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")
    
    gabarito = resultado.gabarito
    if not gabarito:
        raise HTTPException(status_code=400, detail="Gabarito associado não encontrado")

    if user.role != "admin":
        has_access = any(t.user_id == user.id for t in gabarito.turmas)
        if not has_access and gabarito.turmas:
             raise HTTPException(status_code=403, detail="Você não tem permissão para editar este resultado")
    
    if data.nota is not None:
        resultado.nota = data.nota
        if data.acertos is not None:
            resultado.acertos = data.acertos
        else:
            resultado.acertos = int((data.nota / 10) * gabarito.num_questoes)
            
    if data.respostas_aluno is not None:
        resultado.respostas_aluno = json.dumps(data.respostas_aluno)
        # Se apenas as respostas vieram, recalcular nota
        if data.nota is None:
            try:
                corretas = json.loads(gabarito.respostas_corretas) if gabarito.respostas_corretas else []
            except:
                corretas = []
            
            detectadas = data.respostas_aluno
            acertos = 0
            total_gab = len(corretas)
            for i in range(min(total_gab, len(detectadas))):
                if detectadas[i] == corretas[i]:
                    acertos += 1
            resultado.acertos = acertos
            resultado.nota = (acertos / total_gab) * 10 if total_gab > 0 else 0
    
    db.commit()
    db.refresh(resultado)
    return {"message": "Resultado atualizado com sucesso", "nota": resultado.nota, "acertos": resultado.acertos}

@app.delete("/resultados/{resultado_id}")
async def delete_resultado(resultado_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    resultado = db.query(models.Resultado).filter(models.Resultado.id == resultado_id).first()
    if not resultado:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    if user.role != "admin":
        gabarito = resultado.gabarito
        if gabarito:
            has_access = any(t.user_id == user.id for t in gabarito.turmas)
            if not has_access and gabarito.turmas:
                raise HTTPException(status_code=403, detail="Acesso negado")

    db.delete(resultado)
    db.commit()
    return {"message": "Resultado excluído com sucesso"}

# --- Endpoints de Frequência ---

@app.post("/frequencia")
async def save_frequencia(data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # data: { turma_id: 1, data: "2023-10-27", alunos: [{aluno_id: 1, presente: true}, ...] }
    turma_id = data.get("turma_id")
    data_frequencia = data.get("data")
    alunos_lista = data.get("alunos", [])

    # RBAC
    if user.role != "admin":
         turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
         if not turma:
              raise HTTPException(status_code=403, detail="Você não tem permissão para lançar frequência nesta turma")

    # Verificar se já existe frequência para esta data e turma, se sim, deletar (overwrite) ou atualizar
    # Vamos optar por deletar e recriar para simplificar atualização em lote
    existing = db.query(models.Frequencia).filter(
        models.Frequencia.turma_id == turma_id,
        models.Frequencia.data == data_frequencia
    ).all()
    
    for e in existing:
        db.delete(e)
    
    # Criar novos registros
    count = 0
    for item in alunos_lista:
        freq = models.Frequencia(
            turma_id=turma_id,
            aluno_id=item.get("id") or item.get("aluno_id"),
            data=data_frequencia,
            presente=item.get("presente", False)
        )
        db.add(freq)
        count += 1
    
    db.commit()
    return {"message": "Frequência salva com sucesso", "registros": count}

@app.get("/frequencia/turma/{turma_id}")
async def get_frequencia_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
         turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
         if not turma:
              raise HTTPException(status_code=403, detail="Acesso negado a esta turma")
    return db.query(models.Frequencia).filter(models.Frequencia.turma_id == turma_id).all()

@app.get("/frequencia/aluno/{aluno_id}")
async def get_frequencia_aluno(aluno_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Retorna estatísticas: total de aulas, total de presenças
    query = db.query(models.Frequencia).filter(models.Frequencia.aluno_id == aluno_id)
    
    if user.role != "admin":
        # Filtrar apenas frequências das turmas deste professor
        query = query.join(models.Turma).filter(models.Turma.user_id == user.id)

    freqs = query.all()
    total_aulas = len(freqs)
    total_presencas = len([f for f in freqs if f.presente])
    
    percentage = 0
    if total_aulas > 0:
        percentage = int((total_presencas / total_aulas) * 100)
        
    return {
        "aluno_id": aluno_id,
        "total_aulas": total_aulas,
        "total_presencas": total_presencas,
        "percentual": f"{percentage}%"
    }

@app.get("/frequencia/turma/{turma_id}/dates")
async def get_frequencia_dates_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
         turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
         if not turma:
              raise HTTPException(status_code=403, detail="Acesso negado")
              
    # Retorna lista de datas únicas que tem frequência registrada para a turma
    # Usar distinct
    dates = db.query(models.Frequencia.data).filter(models.Frequencia.turma_id == turma_id).distinct().all()
    # dates é lista de tupas [('2023-10-27',), ('2023-10-28',)]
    return [d[0] for d in dates]

# --- Estatísticas ---

@app.get("/stats")
async def get_stats(user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == "admin":
        return {
            "total_turmas": db.query(models.Turma).count(),
            "total_alunos": db.query(models.Aluno).count(),
            "total_gabaritos": db.query(models.Gabarito).count(),
            "total_resultados": db.query(models.Resultado).count()
        }
    else:
        # Estatísticas do Professor
        my_turmas_count = db.query(models.Turma).filter(models.Turma.user_id == user.id).count()
        my_alunos_count = db.query(models.Aluno).join(models.Turma, models.Aluno.turmas).filter(models.Turma.user_id == user.id).distinct().count()
        my_gabaritos_count = db.query(models.Gabarito).filter(models.Gabarito.turmas.any(models.Turma.user_id == user.id)).count()
        my_resultados_count = db.query(models.Resultado).join(models.Gabarito).filter(models.Gabarito.turmas.any(models.Turma.user_id == user.id)).count()
        
        return {
            "total_turmas": my_turmas_count,
            "total_alunos": my_alunos_count,
            "total_gabaritos": my_gabaritos_count,
            "total_resultados": my_resultados_count
        }

@app.get("/stats/turma/{turma_id}")
async def get_stats_by_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
         turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
         if not turma:
              raise HTTPException(status_code=403, detail="Acesso negado a esta turma")

    total_alunos = db.query(models.Aluno).filter(models.Aluno.turmas.any(models.Turma.id == turma_id)).count()
    # Calcular media baseada nos resultados dos gabaritos vinculados a esta turma
    resultados = db.query(models.Resultado).join(models.Gabarito).filter(
        models.Gabarito.turmas.any(models.Turma.id == turma_id)
    ).all()
    media = 0
    aprovacao = 0
    if resultados:
        media = sum([r.nota for r in resultados]) / len(resultados)
        aprovados = len([r for r in resultados if r.nota >= 7.0])
        aprovacao = int((aprovados / len(resultados)) * 100)
    
    return {
        "turma_id": turma_id,
        "total_alunos": total_alunos,
        "media_geral": round(media, 1),
        "aprovacao": aprovacao
    }



@app.post("/batch/sync")
async def batch_sync(request: SyncRequest, x_api_key: str = Header(None)):
    if x_api_key != API_KEY_SECRET:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Simulação de processamento em lote
    counts = {
        "turmas": len(request.turmas),
        "alunos": len(request.alunos),
        "gabaritos": len(request.gabaritos),
        "resultados": len(request.resultados)
    }
    
    if counts["turmas"] > 0: print(f"Sync: {counts['turmas']} turmas")
    if counts["alunos"] > 0: print(f"Sync: {counts['alunos']} alunos")
    if counts["gabaritos"] > 0: print(f"Sync: {counts['gabaritos']} gabaritos")
    if counts["resultados"] > 0: print(f"Sync: {counts['resultados']} resultados")
    
    return {
        "success": True,
        "message": "Sincronização em lote concluída",
        "processed": counts
    }

@app.get("/relatorios/{turma_id}")
async def get_relatorio(turma_id: int, disciplina: str = None):
    # Mock de geração de relatório
    base_data = [
        {"materia": "Matemática", "media": 6.8},
        {"materia": "Português", "media": 8.2},
        {"materia": "História", "media": 7.5},
        {"materia": "Geografia", "media": 7.1}
    ]
    
    # Filtrar se disciplina for passada
    if disciplina:
        filtered_data = [d for d in base_data if disciplina.lower() in d["materia"].lower()]
        desempenho = filtered_data if filtered_data else base_data # Fallback se não achar
    else:
        desempenho = base_data

    return {
        "turma": f"Turma {turma_id}",
        "media_geral": 7.5,
        "total_alunos": 32,
        "aprovados": 28,
        "reprovados": 4,
        "desempenho_por_materia": desempenho
    }

@app.post("/omr/process")
async def process_omr(data: dict, request: Request, authorization: str = Header(None), db: Session = Depends(get_db)):
    # Autenticação via JWT (Fase 4 - Comercial)
    user = await get_current_user(authorization, db)
    
    # Verificar limites por plano
    FREE_LIMIT = 50
    if user.plan_type == "free" and user.total_corrections_used >= FREE_LIMIT:
        raise HTTPException(
            status_code=403, 
            detail="Limite de correções do Plano Grátis atingido. Faça o upgrade para o Plano Pro!"
        )

    start_time = time.time()
    image_base64 = data.get("image")
    num_questions = int(data.get("num_questions", 10))
    return_images = bool(data.get("return_images", False))
    return_audit = bool(data.get("return_audit", False))
    layout_version = data.get("layout_version", "v1") # Suporte a versionamento
    
    if not image_base64:
        return {"success": False, "error": "Imagem não enviada"}
        
    result = omr.process_image(
        image_base64, 
        num_questions=num_questions, 
        return_images=return_images, 
        return_audit=return_audit, 
        layout_version=layout_version
    )
    
    # Incrementar uso em caso de sucesso
    if result.get("success"):
        user.total_corrections_used += 1
        db.commit()

    duration = time.time() - start_time
    # Log de telemetria OMR
    telemetry = {
        "event": "omr_processed",
        "success": result.get("success"),
        "anchors": result.get("anchors_found", 0),
        "avg_confidence": result.get("avg_confidence", 0),
        "duration_ms": int(duration * 1000),
        "layout": layout_version
    }
    logger.info(f"OMR_STAT: {json.dumps(telemetry)}")
    
    return result

@app.post("/omr/preview")
async def process_omr_preview(data: dict, x_api_key: str = Header(None)):
    if x_api_key != API_KEY_SECRET:
        raise HTTPException(status_code=403, detail="Acesso negado")

    image_base64 = data.get("image")
    if not image_base64:
        return {"success": False, "error": "Imagem não enviada"}
        
    return omr.detect_anchors_only(image_base64)

if __name__ == "__main__":
    import uvicorn
    # Em execução local, usa porta 8000. No Render, o Dockerfile cuida do binding.
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

@app.post("/provas/processar")
async def processar_prova(req: ProcessRequest, db: Session = Depends(get_db), current_user: users_db.User = Depends(get_current_user)):
    try:
        # 1. Processar Imagem via OMR Engine
        result = omr.process_image(req.image, num_questions=req.num_questions)
        
        if not result.get("success"):
            return result

        # 2. Identificação (QR Code ou Manual)
        qr = result.get("qr_data")
        aluno_id = req.aluno_id
        gabarito_id = req.gabarito_id
        
        if qr and isinstance(qr, dict):
            if "aid" in qr and qr["aid"] != 0: aluno_id = qr["aid"]
            if "gid" in qr: gabarito_id = qr["gid"]
            
        if not gabarito_id:
            return {"success": False, "error": "Identificação falhou: Gabarito não encontrado via QR Code e não informado manualmente."}
            
        # 3. Buscar Gabarito e Aluno no Banco
        gabarito = db.query(models.Gabarito).filter(models.Gabarito.id == gabarito_id).first()
        if not gabarito:
            return {"success": False, "error": f"Gabarito ID {gabarito_id} não encontrado no banco de dados."}
            
        # 4. Comparar Respostas e Calcular Nota
        corretas = json.loads(gabarito.respostas_corretas)
        detectadas = result.get("answers", [])
        
        acertos = 0
        total = min(len(corretas), len(detectadas))
        for i in range(total):
            if detectadas[i] == corretas[i]:
                acertos += 1
                
        nota = (acertos / total) * 10 if total > 0 else 0
        
        # 5. Salvar Resultado se Aluno for identificado
        resultado_id = None
        if aluno_id:
            aluno = db.query(models.Aluno).filter(models.Aluno.id == aluno_id).first()
            if aluno:
                # Verificar se já existe resultado para este aluno nesta prova
                resultado_existente = db.query(models.Resultado).filter(
                    models.Resultado.aluno_id == aluno.id,
                    models.Resultado.gabarito_id == gabarito.id
                ).first()
                
                if resultado_existente:
                    # Atualizar existente
                    resultado_existente.acertos = acertos
                    resultado_existente.nota = nota
                    resultado_existente.respostas_aluno = json.dumps(detectadas)
                    resultado_existente.data_correcao = datetime.utcnow()
                    db.commit()
                    db.refresh(resultado_existente)
                    resultado_id = resultado_existente.id
                else:
                    # Criar novo
                    novo_resultado = models.Resultado(
                        aluno_id=aluno.id,
                        gabarito_id=gabarito.id,
                        acertos=acertos,
                        nota=nota,
                        respostas_aluno=json.dumps(detectadas),
                        data_correcao=datetime.utcnow()
                    )
                    db.add(novo_resultado)
                    db.commit()
                    db.refresh(novo_resultado)
                    resultado_id = novo_resultado.id

        # 6. Retornar Resumo
        return {
            "success": True,
            "aluno_id": aluno_id,
            "aluno_nome": aluno.nome if aluno_id and aluno else "Digitalizado (Não Identificado)",
            "gabarito_id": gabarito_id,
            "assunto": gabarito.assunto,
            "acertos": acertos,
            "nota": round(nota, 1),
            "resultado_id": resultado_id,
            "processed_image": result.get("processed_image"),
            "audit_map": result.get("audit_map")
        }

    except Exception as e:
        logger.error(f"Erro no processamento de prova: {e}")
        return {"success": False, "error": f"Erro interno: {str(e)}"}
