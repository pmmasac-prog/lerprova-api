from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
from datetime import datetime
import json
import time
import logging
import os
from pydantic import BaseModel
from typing import Optional
import models
import users_db
from database import get_db
from dependencies import get_current_user
from omr_engine import OMREngine

router = APIRouter(tags=["provas"])
logger = logging.getLogger("lerprova-api")
omr = OMREngine()

class ProcessRequest(BaseModel):
    image: str
    num_questions: Optional[int] = 10
    gabarito_id: Optional[int] = None
    aluno_id: Optional[int] = None

API_KEY_SECRET = os.getenv("API_KEY_SECRET", "lp_secret_key_2026_batch")

@router.post("/omr/process")
async def process_omr(data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
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
    layout_version = data.get("layout_version", "v1")
    
    if not image_base64:
        return {"success": False, "error": "Imagem não enviada"}
        
    result = omr.process_image(
        image_base64, 
        num_questions=num_questions, 
        return_images=return_images, 
        return_audit=return_audit, 
        layout_version=layout_version
    )
    
    if result.get("success"):
        user.total_corrections_used += 1
        db.commit()

    duration = time.time() - start_time
    telemetry = {
        "event": "omr_processed",
        "success": result.get("success"),
        "anchors": result.get("anchors_found", 0),
        "duration_ms": int(duration * 1000)
    }
    logger.info(f"OMR_STAT: {json.dumps(telemetry)}")
    return result

@router.post("/omr/preview")
async def process_omr_preview(data: dict, x_api_key: str = Header(None)):
    if x_api_key != API_KEY_SECRET:
        raise HTTPException(status_code=403, detail="Acesso negado")

    image_base64 = data.get("image")
    if not image_base64:
        return {"success": False, "error": "Imagem não enviada"}
        
    return omr.detect_anchors_only(image_base64)

@router.post("/provas/processar")
async def processar_prova(req: ProcessRequest, db: Session = Depends(get_db), current_user: users_db.User = Depends(get_current_user)):
    try:
        result = omr.process_image(req.image, num_questions=req.num_questions)
        if not result.get("success"):
            return result

        qr = result.get("qr_data")
        aluno_id = req.aluno_id
        gabarito_id = req.gabarito_id
        
        if qr and isinstance(qr, dict):
            if "aid" in qr and qr["aid"] != 0: aluno_id = qr["aid"]
            if "gid" in qr: gabarito_id = qr["gid"]
            
        if not gabarito_id:
            return {"success": False, "error": "Identificação falhou: Gabarito não encontrado via QR Code e não informado manualmente."}
            
        gabarito = db.query(models.Gabarito).filter(models.Gabarito.id == gabarito_id).first()
        if not gabarito:
            return {"success": False, "error": f"Gabarito ID {gabarito_id} não encontrado no banco de dados."}
            
        corretas = json.loads(gabarito.respostas_corretas)
        detectadas = result.get("answers", [])
        
        acertos = 0
        total = min(len(corretas), len(detectadas))
        for i in range(total):
            if detectadas[i] == corretas[i]:
                acertos += 1
                
        nota = (acertos / total) * 10 if total > 0 else 0
        
        resultado_id = None
        if aluno_id:
            aluno = db.query(models.Aluno).filter(models.Aluno.id == aluno_id).first()
            if aluno:
                resultado_existente = db.query(models.Resultado).filter(
                    models.Resultado.aluno_id == aluno.id,
                    models.Resultado.gabarito_id == gabarito.id
                ).first()
                
                if resultado_existente:
                    resultado_existente.acertos = acertos
                    resultado_existente.nota = nota
                    resultado_existente.respostas_aluno = json.dumps(detectadas)
                    resultado_existente.data_correcao = datetime.utcnow()
                    db.commit()
                    db.refresh(resultado_existente)
                    resultado_id = resultado_existente.id
                else:
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
