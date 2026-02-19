from fastapi import APIRouter, Header, HTTPException, Depends
from sqlalchemy.orm import Session
import models
from database import get_db
from pydantic import BaseModel
from typing import List, Optional
import os
import logging

router = APIRouter(tags=["reports"])
logger = logging.getLogger("lerprova-api")

class SyncRequest(BaseModel):
    turmas: Optional[List[dict]] = []
    alunos: Optional[List[dict]] = []
    gabaritos: Optional[List[dict]] = []
    resultados: Optional[List[dict]] = []

API_KEY_SECRET = os.getenv("API_KEY_SECRET")

@router.post("/batch/sync")
async def batch_sync(request: SyncRequest, x_api_key: str = Header(None)):
    if not API_KEY_SECRET:
        raise HTTPException(status_code=500, detail="API_KEY_SECRET não configurada no servidor")
    if x_api_key != API_KEY_SECRET:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    counts = {
        "turmas": len(request.turmas),
        "alunos": len(request.alunos),
        "gabaritos": len(request.gabaritos),
        "resultados": len(request.resultados)
    }
    
    logger.info(f"Batch Sync: {counts}")
    return {
        "success": True,
        "message": "Sincronização em lote concluída",
        "processed": counts
    }

@router.get("/relatorios/{turma_id}")
async def get_relatorio(turma_id: int, disciplina: str = None):
    # Mock de geração de relatório
    base_data = [
        {"materia": "Matemática", "media": 6.8},
        {"materia": "Português", "media": 8.2},
        {"materia": "História", "media": 7.5},
        {"materia": "Geografia", "media": 7.1}
    ]
    
    if disciplina:
        filtered_data = [d for d in base_data if disciplina.lower() in d["materia"].lower()]
        desempenho = filtered_data if filtered_data else base_data
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
