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
from utils.answers import parse_json_list, dump_json_list

router = APIRouter(tags=["provas"])
logger = logging.getLogger("lerprova-api")
omr = OMREngine()

class ProcessRequest(BaseModel):
    image: str
    num_questions: Optional[int] = 10
    gabarito_id: Optional[int] = None
    aluno_id: Optional[int] = None

# ===== Segurança: API Key sem default hardcoded =====
API_KEY_SECRET = os.getenv("API_KEY_SECRET")

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
    if not API_KEY_SECRET:
        raise HTTPException(status_code=500, detail="API_KEY_SECRET não configurada no servidor")
    if x_api_key != API_KEY_SECRET:
        raise HTTPException(status_code=403, detail="Acesso negado")

    image_base64 = data.get("image")
    if not image_base64:
        return {"success": False, "error": "Imagem não enviada"}
        
    return omr.detect_anchors_only(image_base64)

@router.post("/provas/processar")
async def processar_prova(req: ProcessRequest, db: Session = Depends(get_db), current_user: users_db.User = Depends(get_current_user)):
    try:
        layout_version = "v1"
        result = omr.process_image(req.image, num_questions=req.num_questions, layout_version=layout_version)
        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result.get("error", "Falha no processamento da imagem."))

        # ===== 1. QR Code e Identificação =====
        qr = result.get("qr_data")
        aluno_id = req.aluno_id
        gabarito_id = req.gabarito_id
        
        if qr and isinstance(qr, dict):
            qr_aid = int(qr.get("aid") or 0)
            qr_gid = int(qr.get("gid") or 0)

            # Validação cruzada: QR gid deve bater com gabarito_id informado
            if req.gabarito_id and qr_gid and qr_gid != req.gabarito_id:
                raise HTTPException(status_code=422, detail="QR Code não corresponde ao gabarito selecionado.")

            if qr_gid:
                gabarito_id = qr_gid
            if qr_aid:
                aluno_id = qr_aid
            
        if not gabarito_id:
            raise HTTPException(status_code=422, detail="Identificação falhou: Gabarito não encontrado via QR Code e não informado manualmente.")

        # ===== 2. Autorização: professor só corrige seus gabaritos =====
        if current_user.role != "admin":
            gabarito = db.query(models.Gabarito).filter(
                models.Gabarito.id == gabarito_id,
                models.Gabarito.turmas.any(models.Turma.user_id == current_user.id)
            ).first()
        else:
            gabarito = db.query(models.Gabarito).filter(models.Gabarito.id == gabarito_id).first()

        if not gabarito:
            raise HTTPException(status_code=422, detail=f"Gabarito ID {gabarito_id} não encontrado ou acesso negado.")

        # ===== 3. Validação cruzada: aluno pertence às turmas do gabarito =====
        aluno = None
        if aluno_id:
            turma_ids_gabarito = [t.id for t in gabarito.turmas]
            aluno = db.query(models.Aluno).filter(
                models.Aluno.id == aluno_id,
                models.Aluno.turmas.any(models.Turma.id.in_(turma_ids_gabarito))
            ).first()
            if not aluno:
                raise HTTPException(status_code=422, detail="Aluno não pertence às turmas deste gabarito.")

        # ===== 4. Parse robusto das respostas corretas =====
        corretas = parse_json_list(gabarito.respostas_corretas, "gabarito.respostas_corretas")
        total = gabarito.num_questoes or len(corretas)
        total = max(total, len(corretas))

        # Respostas detectadas padronizadas
        detectadas = result.get("answers") or []
        # Garante mesmo tamanho
        detectadas = (detectadas + [None] * total)[:total]
        corretas = (corretas + [None] * total)[:total]

        # ===== 5. Qualidade OMR: rejeita leituras ruins =====
        status_counts = result.get("status_counts") or {}
        avg_conf = float(result.get("avg_confidence") or 0.0)

        if status_counts.get("invalid", 0) > 0:
            raise HTTPException(
                status_code=422, 
                detail=f"Marcação múltipla detectada. Refaça a foto. (Métricas: {json.dumps(status_counts)})"
            )
            
        if status_counts.get("ambiguous", 0) > 3 or avg_conf < 0.75:
            raise HTTPException(
                status_code=422, 
                detail=f"Leitura com baixa confiança ({avg_conf:.2f}). Refaça a foto. (Métricas: {json.dumps(status_counts)})"
            )

        # ===== 6. Cálculo de acertos baseado no total do gabarito =====
        acertos = sum(
            1 for i in range(total)
            if detectadas[i] is not None and corretas[i] is not None and detectadas[i] == corretas[i]
        )
        nota = (acertos / total) * 10 if total else 0.0
        
        # ===== 7. Salvar resultado com auditoria OMR =====
        resultado_id = None
        if aluno_id and aluno:
            resultado_existente = db.query(models.Resultado).filter(
                models.Resultado.aluno_id == aluno.id,
                models.Resultado.gabarito_id == gabarito.id
            ).first()
            
            audit_data = {
                "status_list": json.dumps(result.get("question_status")),
                "confidence_scores": json.dumps(result.get("confidence_scores")),
                "avg_confidence": avg_conf,
                "layout_version": layout_version,
                "anchors_found": int(result.get("anchors_found") or 0),
            }
            
            if resultado_existente:
                resultado_existente.acertos = acertos
                resultado_existente.nota = nota
                resultado_existente.respostas_aluno = dump_json_list(detectadas)
                resultado_existente.data_correcao = datetime.utcnow()
                for k, v in audit_data.items():
                    setattr(resultado_existente, k, v)
                db.commit()
                db.refresh(resultado_existente)
                resultado_id = resultado_existente.id
            else:
                novo_resultado = models.Resultado(
                    aluno_id=aluno.id,
                    gabarito_id=gabarito.id,
                    acertos=acertos,
                    nota=nota,
                    respostas_aluno=dump_json_list(detectadas),
                    data_correcao=datetime.utcnow(),
                    **audit_data
                )
                db.add(novo_resultado)
                db.commit()
                db.refresh(novo_resultado)
                resultado_id = novo_resultado.id

        return {
            "success": True,
            "aluno_id": aluno_id,
            "aluno_nome": aluno.nome if aluno else "Digitalizado (Não Identificado)",
            "gabarito_id": gabarito_id,
            "assunto": gabarito.assunto,
            "acertos": acertos,
            "nota": round(nota, 1),
            "resultado_id": resultado_id,
            "processed_image": result.get("processed_image"),
            "audit_map": result.get("audit_map")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro no processamento de prova: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")
