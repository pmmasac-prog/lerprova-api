from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models
import users_db
from database import get_db
from dependencies import get_current_user
import logging
import datetime
import json

router = APIRouter(tags=["frequencia"])
logger = logging.getLogger("lerprova-api")

@router.post("/frequencia")
async def save_frequencia(data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    turma_id = data.get("turma_id")
    data_frequencia = data.get("data")
    alunos_lista = data.get("alunos", [])

    if user.role != "admin":
         turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
         if not turma:
              raise HTTPException(status_code=403, detail="Você não tem permissão para lançar frequência nesta turma")

    existing = db.query(models.Frequencia).filter(
        models.Frequencia.turma_id == turma_id,
        models.Frequencia.data == data_frequencia
    ).all()
    
    for e in existing:
        db.delete(e)
    
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

@router.get("/frequencia/turma/{turma_id}")
async def get_frequencia_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
         turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
         if not turma:
              raise HTTPException(status_code=403, detail="Acesso negado a esta turma")
    return db.query(models.Frequencia).filter(models.Frequencia.turma_id == turma_id).all()

@router.get("/frequencia/aluno/{aluno_id}")
async def get_frequencia_aluno(aluno_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(models.Frequencia).filter(models.Frequencia.aluno_id == aluno_id)
    
    if user.role != "admin":
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

@router.get("/frequencia/turma/{turma_id}/dates")
async def get_frequencia_dates_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
         turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
         if not turma:
              raise HTTPException(status_code=403, detail="Acesso negado")
              
    dates = db.query(models.Frequencia.data).filter(models.Frequencia.turma_id == turma_id).distinct().all()
    return [d[0] for d in dates]

@router.get("/frequencia/turma/{turma_id}/aluno/{aluno_id}")
async def get_frequencia_aluno_turma(turma_id: int, aluno_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
        if not turma:
            raise HTTPException(status_code=403, detail="Acesso negado a esta turma")

    freqs = db.query(models.Frequencia).filter(
        models.Frequencia.turma_id == turma_id,
        models.Frequencia.aluno_id == aluno_id
    ).all()
    
    total_presencas = len([f for f in freqs if f.presente])
    total_aulas = len(freqs)
    
    percentage = 0
    if total_aulas > 0:
        percentage = int((total_presencas / total_aulas) * 100)
        
    return {
        "aluno_id": aluno_id,
        "turma_id": turma_id,
        "total_aulas": total_aulas,
        "total_presencas": total_presencas,
        "percentual": f"{percentage}%",
        "historico": [
            {"data": f.data, "presente": f.presente} for f in freqs
        ]
    }

@router.post("/qr-scan")
async def scan_qr_attendance(data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    qr_token = data.get("qr_token")
    if not qr_token:
        raise HTTPException(status_code=400, detail="Token QR não fornecido")

    # Normaliza o token para diferentes formatos
    normalized_token = qr_token.strip().upper()
    
    # Tenta buscar pelo token exato primeiro
    aluno = db.query(models.Aluno).filter(models.Aluno.qr_token == qr_token).first()
    
    # Se não encontrou, tenta formatos alternativos
    if not aluno:
        # Tenta com o token normalizado
        aluno = db.query(models.Aluno).filter(models.Aluno.qr_token == normalized_token).first()
    
    if not aluno:
        # Se começa com LERPROVA:, extrai o código
        if normalized_token.startswith('LERPROVA:'):
            codigo = normalized_token.replace('LERPROVA:', '')
            aluno = db.query(models.Aluno).filter(models.Aluno.codigo == codigo).first()
            if not aluno:
                aluno = db.query(models.Aluno).filter(models.Aluno.qr_token == f'ALUNO_{codigo}').first()
    
    if not aluno:
        # Se começa com ALUNO_, extrai e busca pelo código
        if normalized_token.startswith('ALUNO_'):
            codigo = normalized_token.replace('ALUNO_', '')
            aluno = db.query(models.Aluno).filter(models.Aluno.codigo == codigo).first()
    
    if not aluno:
        # Última tentativa: busca diretamente pelo código (se for apenas o código)
        aluno = db.query(models.Aluno).filter(models.Aluno.codigo == qr_token).first()
        if not aluno:
            aluno = db.query(models.Aluno).filter(models.Aluno.codigo == normalized_token).first()
    
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado com este QR Code")

    import datetime
    now = datetime.datetime.now()
    today_index = now.weekday() # 0-6 (Mon-Sun) - dps comparamos com Turma.dias_semana (0-4)
    today_str = now.strftime("%Y-%m-%d")

    # Turmas do professor que ocorrem hoje e contêm o aluno
    minhas_turmas = db.query(models.Turma).filter(models.Turma.user_id == user.id).all()
    
    turmas_atingidas = []
    
    for t in minhas_turmas:
        dias = []
        if isinstance(t.dias_semana, list):
            dias = t.dias_semana
        elif isinstance(t.dias_semana, str):
            try: dias = json.loads(t.dias_semana)
            except: pass
            
        if today_index not in dias:
            continue
            
        is_in_turma = db.query(models.aluno_turma).filter(
            models.aluno_turma.c.aluno_id == aluno.id,
            models.aluno_turma.c.turma_id == t.id
        ).first()
        
        if is_in_turma:
            existente = db.query(models.Frequencia).filter(
                models.Frequencia.turma_id == t.id,
                models.Frequencia.aluno_id == aluno.id,
                models.Frequencia.data == today_str
            ).first()
            
            if not existente:
                nova_freq = models.Frequencia(
                    turma_id=t.id,
                    aluno_id=aluno.id,
                    data=today_str,
                    presente=True
                )
                db.add(nova_freq)
                turmas_atingidas.append({"turma": t.nome, "novo": True})
            else:
                if not existente.presente:
                    existente.presente = True
                    turmas_atingidas.append({"turma": t.nome, "novo": True})
                else:
                    # Já tinha presença
                    turmas_atingidas.append({"turma": t.nome, "novo": False})

    db.commit()
    
    turmas_novas = [t["turma"] for t in turmas_atingidas if t["novo"]]
    turmas_ja_presente = [t["turma"] for t in turmas_atingidas if not t["novo"]]
    
    if not turmas_atingidas:
        return {
            "message": f"⚠️ {aluno.nome} identificado, mas sem aulas hoje.",
            "success": True,
            "status": "no_class",
            "count": 0,
            "aluno": aluno.nome
        }
    
    if not turmas_novas and turmas_ja_presente:
        # Todas as turmas já tinham presença
        return {
            "message": f"✓ {aluno.nome} já está presente em: {', '.join(turmas_ja_presente)}",
            "success": True,
            "status": "already_present",
            "count": 0,
            "aluno": aluno.nome
        }

    if turmas_novas:
        msg = f"✓ Presença registrada para {aluno.nome} em: {', '.join(turmas_novas)}"
        if turmas_ja_presente:
            msg += f" (já presente em: {', '.join(turmas_ja_presente)})"
        return {
            "message": msg,
            "success": True, 
            "status": "registered",
            "count": len(turmas_novas),
            "aluno": aluno.nome
        }
