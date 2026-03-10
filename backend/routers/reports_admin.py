"""
Relatórios Avançados de Frequência e Evasão - LERPROVA
====================================================
Módulo completo para gestão de frequência escolar com:
- Monitoramento de infrequência
- Alertas de faltas consecutivas
- Detecção de risco de evasão
- Acompanhamento de alunos em risco
- Relatórios gerenciais
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_, desc
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta, date
import models
from database import get_db
from dependencies import get_current_user
import logging

router = APIRouter(prefix="/admin/reports", tags=["admin-reports"])
logger = logging.getLogger("lerprova-api")


# ==================== SCHEMAS ====================

class PeriodoRequest(BaseModel):
    data_inicio: str  # YYYY-MM-DD
    data_fim: str     # YYYY-MM-DD
    turma_id: Optional[int] = None
    turno: Optional[str] = None


class AcompanhamentoRequest(BaseModel):
    aluno_id: int
    alerta_id: Optional[int] = None
    tipo_acao: str
    responsavel_acao: str
    resultado: Optional[str] = None
    observacao: Optional[str] = None
    data_retorno_previsto: Optional[str] = None


class AtualizarStatusAlunoRequest(BaseModel):
    aluno_id: int
    situacao_matricula: str  # ativo, infrequente, em_risco, abandono_presumido, evadido, transferido


class ConfiguracaoFrequenciaRequest(BaseModel):
    faixa_regular: Optional[float] = 90.0
    faixa_atencao: Optional[float] = 85.0
    faixa_risco: Optional[float] = 75.0
    faltas_atencao: Optional[int] = 2
    faltas_alerta: Optional[int] = 3
    faltas_critico: Optional[int] = 5
    faltas_abandono: Optional[int] = 7


# ==================== FUNÇÕES AUXILIARES ====================

def get_dias_letivos(db: Session, data_inicio: str, data_fim: str) -> List[str]:
    """Retorna lista de dias letivos no período (dias úteis por padrão, excluindo feriados)"""
    # Buscar dias letivos cadastrados
    dias_cadastrados = db.query(models.DiaLetivo).filter(
        models.DiaLetivo.data >= data_inicio,
        models.DiaLetivo.data <= data_fim,
        models.DiaLetivo.is_school_day == True
    ).all()
    
    if dias_cadastrados:
        return [d.data for d in dias_cadastrados]
    
    # Se não houver dias letivos cadastrados, considerar dias úteis
    # excluindo eventos marcados como não-letivos
    eventos_nao_letivos = db.query(models.Event).filter(
        models.Event.start_date <= data_fim,
        models.Event.end_date >= data_inicio,
        models.Event.is_school_day == False
    ).all()
    
    datas_nao_letivas = set()
    for evt in eventos_nao_letivos:
        start = datetime.strptime(evt.start_date, "%Y-%m-%d").date()
        end = datetime.strptime(evt.end_date, "%Y-%m-%d").date()
        current = start
        while current <= end:
            datas_nao_letivas.add(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)
    
    # Gerar dias úteis (segunda a sexta)
    dias_letivos = []
    start_date = datetime.strptime(data_inicio, "%Y-%m-%d").date()
    end_date = datetime.strptime(data_fim, "%Y-%m-%d").date()
    current = start_date
    
    while current <= end_date:
        # 0 = segunda, 4 = sexta
        if current.weekday() < 5 and current.strftime("%Y-%m-%d") not in datas_nao_letivas:
            dias_letivos.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    
    return dias_letivos


def calcular_faltas_consecutivas(db: Session, aluno_id: int, dias_letivos: List[str]) -> dict:
    """Calcula faltas consecutivas e última presença do aluno"""
    if not dias_letivos:
        return {"consecutivas": 0, "ultima_presenca": None, "dias_sem_entrada": 0}
    
    presencas = db.query(models.Frequencia).filter(
        models.Frequencia.aluno_id == aluno_id,
        models.Frequencia.data.in_(dias_letivos),
        models.Frequencia.presente == True
    ).all()
    
    datas_presentes = {p.data for p in presencas}
    
    # Calcular faltas consecutivas (do mais recente para o mais antigo)
    dias_ordenados = sorted(dias_letivos, reverse=True)
    faltas_consecutivas = 0
    ultima_presenca = None
    
    for dia in dias_ordenados:
        if dia in datas_presentes:
            ultima_presenca = dia
            break
        faltas_consecutivas += 1
    
    # Calcular dias sem entrada
    hoje = datetime.now().strftime("%Y-%m-%d")
    dias_sem_entrada = 0
    if ultima_presenca:
        for dia in dias_ordenados:
            if dia <= hoje and dia > ultima_presenca:
                dias_sem_entrada += 1
    else:
        dias_sem_entrada = len([d for d in dias_ordenados if d <= hoje])
    
    return {
        "consecutivas": faltas_consecutivas,
        "ultima_presenca": ultima_presenca,
        "dias_sem_entrada": dias_sem_entrada
    }


def calcular_score_risco(frequencia_pct: float, faltas_consecutivas: int, 
                         frequencia_anterior: float = None, faltas_alternadas: int = 0) -> dict:
    """Calcula score de risco de evasão baseado em múltiplos fatores"""
    score = 0
    motivos = []
    
    # Fator 1: Frequência baixa
    if frequencia_pct < 75:
        score += 40
        motivos.append(f"frequência crítica ({frequencia_pct:.1f}%)")
    elif frequencia_pct < 85:
        score += 25
        motivos.append(f"frequência em risco ({frequencia_pct:.1f}%)")
    elif frequencia_pct < 90:
        score += 10
        motivos.append(f"frequência em atenção ({frequencia_pct:.1f}%)")
    
    # Fator 2: Faltas consecutivas
    if faltas_consecutivas >= 7:
        score += 35
        motivos.append(f"{faltas_consecutivas} faltas consecutivas (possível abandono)")
    elif faltas_consecutivas >= 5:
        score += 25
        motivos.append(f"{faltas_consecutivas} faltas consecutivas")
    elif faltas_consecutivas >= 3:
        score += 15
        motivos.append(f"{faltas_consecutivas} faltas consecutivas")
    elif faltas_consecutivas >= 2:
        score += 5
        motivos.append(f"{faltas_consecutivas} faltas consecutivas")
    
    # Fator 3: Queda de frequência
    if frequencia_anterior is not None:
        queda = frequencia_anterior - frequencia_pct
        if queda >= 15:
            score += 20
            motivos.append(f"queda de {queda:.1f}% na frequência")
        elif queda >= 10:
            score += 10
            motivos.append(f"queda de {queda:.1f}% na frequência")
    
    # Fator 4: Faltas alternadas
    if faltas_alternadas >= 5:
        score += 10
        motivos.append(f"{faltas_alternadas} faltas alternadas no período")
    
    # Determinar nível
    if score >= 60:
        nivel = "critico"
    elif score >= 40:
        nivel = "alto"
    elif score >= 20:
        nivel = "medio"
    else:
        nivel = "baixo"
    
    # Ação recomendada
    acoes = {
        "critico": "Busca ativa urgente - risco de abandono",
        "alto": "Contato imediato com responsável",
        "medio": "Monitorar e notificar coordenação",
        "baixo": "Acompanhamento de rotina"
    }
    
    return {
        "score": min(score, 100),
        "nivel": nivel,
        "motivo_principal": motivos[0] if motivos else "sem alertas",
        "motivos": motivos,
        "acao_recomendada": acoes[nivel]
    }


def extrair_turno(turma_nome: str) -> str:
    """Extrai o turno do nome da turma"""
    if not turma_nome:
        return "Matutino"
    lower = turma_nome.lower()
    if "noite" in lower or "noturno" in lower:
        return "Noturno"
    if "tarde" in lower or "vespertino" in lower:
        return "Vespertino"
    return "Matutino"


def calcular_idade(data_nascimento: str) -> int:
    """Calcula idade a partir da data de nascimento"""
    if not data_nascimento:
        return None
    try:
        nascimento = datetime.strptime(data_nascimento, "%Y-%m-%d").date()
        hoje = date.today()
        idade = hoje.year - nascimento.year - ((hoje.month, hoje.day) < (nascimento.month, nascimento.day))
        return idade
    except:
        return None


# ==================== ENDPOINTS ====================

@router.get("/configuracao")
async def get_configuracao_frequencia(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna configurações atuais de frequência"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    config = db.query(models.ConfiguracaoFrequencia).first()
    if not config:
        # Criar configuração padrão
        config = models.ConfiguracaoFrequencia()
        db.add(config)
        db.commit()
        db.refresh(config)
    
    return {
        "faixa_regular": config.faixa_regular,
        "faixa_atencao": config.faixa_atencao,
        "faixa_risco": config.faixa_risco,
        "faltas_atencao": config.faltas_atencao,
        "faltas_alerta": config.faltas_alerta,
        "faltas_critico": config.faltas_critico,
        "faltas_abandono": config.faltas_abandono,
        "frequencia_minima_ldb": config.frequencia_minima_ldb,
        "notificar_responsavel_menor": config.notificar_responsavel_menor,
        "dias_para_notificar": config.dias_para_notificar
    }


@router.post("/configuracao")
async def update_configuracao_frequencia(
    request: ConfiguracaoFrequenciaRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Atualiza configurações de frequência"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    config = db.query(models.ConfiguracaoFrequencia).first()
    if not config:
        config = models.ConfiguracaoFrequencia()
        db.add(config)
    
    for key, value in request.dict(exclude_unset=True).items():
        setattr(config, key, value)
    
    db.commit()
    return {"message": "Configurações atualizadas com sucesso"}


# ==================== 1. RELATÓRIO DE INFREQUÊNCIA POR PERÍODO ====================

@router.post("/infrequencia")
async def relatorio_infrequencia(
    request: PeriodoRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Relatório de infrequência por período.
    
    Campos: aluno, turma, turno, total dias letivos, dias presentes, dias ausentes,
    frequência percentual, faltas justificadas, faltas não justificadas,
    faltas consecutivas, última presença, status de risco
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    dias_letivos = get_dias_letivos(db, request.data_inicio, request.data_fim)
    total_dias_letivos = len(dias_letivos)
    
    if total_dias_letivos == 0:
        return {"alunos": [], "total_dias_letivos": 0, "periodo": {"inicio": request.data_inicio, "fim": request.data_fim}}
    
    # Buscar alunos
    query = db.query(models.Aluno).options(joinedload(models.Aluno.turmas))
    
    if request.turma_id:
        query = query.join(models.aluno_turma).filter(models.aluno_turma.c.turma_id == request.turma_id)
    
    alunos = query.all()
    resultado = []
    
    for aluno in alunos:
        turma_nomes = [t.nome for t in aluno.turmas]
        turma_str = turma_nomes[0] if turma_nomes else ""
        turno = extrair_turno(turma_str)
        
        if request.turno and turno != request.turno:
            continue
        
        # Buscar frequência do aluno no período
        frequencias = db.query(models.Frequencia).filter(
            models.Frequencia.aluno_id == aluno.id,
            models.Frequencia.data.in_(dias_letivos)
        ).all()
        
        dias_presentes = len([f for f in frequencias if f.presente])
        dias_ausentes = total_dias_letivos - dias_presentes
        faltas_justificadas = len([f for f in frequencias if not f.presente and f.falta_justificada])
        faltas_nao_justificadas = dias_ausentes - faltas_justificadas
        
        frequencia_pct = (dias_presentes / total_dias_letivos * 100) if total_dias_letivos > 0 else 0
        
        # Calcular faltas consecutivas
        info_consecutivas = calcular_faltas_consecutivas(db, aluno.id, dias_letivos)
        
        # Calcular status de risco
        risco = calcular_score_risco(frequencia_pct, info_consecutivas["consecutivas"])
        
        # Determinar classificação
        if frequencia_pct >= 90:
            classificacao = "regular"
        elif frequencia_pct >= 85:
            classificacao = "atencao"
        elif frequencia_pct >= 75:
            classificacao = "risco"
        else:
            classificacao = "critico"
        
        resultado.append({
            "aluno_id": aluno.id,
            "aluno_nome": aluno.nome,
            "aluno_codigo": aluno.codigo,
            "turma": turma_str,
            "turno": turno,
            "total_dias_letivos": total_dias_letivos,
            "dias_presentes": dias_presentes,
            "dias_ausentes": dias_ausentes,
            "frequencia_percentual": round(frequencia_pct, 2),
            "responsavel": aluno.nome_responsavel,
            "telefone": aluno.telefone_responsavel,
            "faltas_justificadas": faltas_justificadas,
            "faltas_nao_justificadas": faltas_nao_justificadas,
            "faltas_consecutivas": info_consecutivas["consecutivas"],
            "ultima_presenca": info_consecutivas["ultima_presenca"],
            "status_risco": risco["nivel"],
            "classificacao": classificacao,
            "situacao_matricula": aluno.situacao_matricula or "ativo"
        })
    
    # Ordenar por frequência (menor primeiro) para destacar problemáticos
    resultado.sort(key=lambda x: x["frequencia_percentual"])
    
    return {
        "alunos": resultado,
        "total_dias_letivos": total_dias_letivos,
        "periodo": {"inicio": request.data_inicio, "fim": request.data_fim},
        "total_alunos": len(resultado),
        "resumo": {
            "regulares": len([a for a in resultado if a["classificacao"] == "regular"]),
            "atencao": len([a for a in resultado if a["classificacao"] == "atencao"]),
            "risco": len([a for a in resultado if a["classificacao"] == "risco"]),
            "criticos": len([a for a in resultado if a["classificacao"] == "critico"])
        }
    }


# ==================== 2. RELATÓRIO DE FALTAS CONSECUTIVAS ====================

@router.get("/faltas-consecutivas")
async def relatorio_faltas_consecutivas(
    minimo: int = Query(2, description="Mínimo de faltas consecutivas"),
    turma_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Relatório de faltas consecutivas.
    
    Campos: aluno, turma, faltas consecutivas, última presença,
    dias sem entrada, responsável, telefone, status
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    # Período: últimos 30 dias úteis
    hoje = datetime.now().strftime("%Y-%m-%d")
    inicio = (datetime.now() - timedelta(days=45)).strftime("%Y-%m-%d")
    dias_letivos = get_dias_letivos(db, inicio, hoje)
    
    query = db.query(models.Aluno).options(joinedload(models.Aluno.turmas))
    
    if turma_id:
        query = query.join(models.aluno_turma).filter(models.aluno_turma.c.turma_id == turma_id)
    
    alunos = query.filter(models.Aluno.situacao_matricula != "transferido").all()
    resultado = []
    
    for aluno in alunos:
        info = calcular_faltas_consecutivas(db, aluno.id, dias_letivos)
        
        if info["consecutivas"] >= minimo:
            turma_nomes = [t.nome for t in aluno.turmas]
            
            # Determinar nível de alerta
            if info["consecutivas"] >= 7:
                nivel = "abandono"
                status = "Possível abandono"
            elif info["consecutivas"] >= 5:
                nivel = "critico"
                status = "Crítico"
            elif info["consecutivas"] >= 3:
                nivel = "alerta"
                status = "Alerta"
            else:
                nivel = "atencao"
                status = "Atenção"
            
            # Verificar se há acompanhamento recente
            acompanhamento = db.query(models.AcompanhamentoAluno).filter(
                models.AcompanhamentoAluno.aluno_id == aluno.id
            ).order_by(desc(models.AcompanhamentoAluno.data_acao)).first()
            
            status_contato = "Pendente"
            if acompanhamento:
                if acompanhamento.resultado == "sucesso":
                    status_contato = "Contatado"
                elif acompanhamento.resultado == "sem_retorno":
                    status_contato = "Sem retorno"
                else:
                    status_contato = "Em andamento"
            
            resultado.append({
                "aluno_id": aluno.id,
                "aluno_nome": aluno.nome,
                "aluno_codigo": aluno.codigo,
                "turma": turma_nomes[0] if turma_nomes else "",
                "faltas_consecutivas": info["consecutivas"],
                "ultima_presenca": info["ultima_presenca"],
                "dias_sem_entrada": info["dias_sem_entrada"],
                "responsavel": aluno.nome_responsavel,
                "telefone": aluno.telefone_responsavel,
                "nivel": nivel,
                "status_alerta": status,
                "status_contato": status_contato
            })
    
    # Ordenar por quantidade de faltas (maior primeiro)
    resultado.sort(key=lambda x: x["faltas_consecutivas"], reverse=True)
    
    return {
        "alunos": resultado,
        "total": len(resultado),
        "por_nivel": {
            "abandono": len([a for a in resultado if a["nivel"] == "abandono"]),
            "critico": len([a for a in resultado if a["nivel"] == "critico"]),
            "alerta": len([a for a in resultado if a["nivel"] == "alerta"]),
            "atencao": len([a for a in resultado if a["nivel"] == "atencao"])
        }
    }


# ==================== 3. ALUNOS EM RISCO DE EVASÃO ====================

@router.post("/risco-evasao")
async def relatorio_risco_evasao(
    request: PeriodoRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Relatório de alunos em risco de evasão.
    
    Critérios: frequência <85%, 3+ faltas consecutivas, queda de frequência,
    faltas alternadas, dias sem entrada
    
    Saída: aluno, score, nível, motivo, ação recomendada
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    dias_letivos = get_dias_letivos(db, request.data_inicio, request.data_fim)
    total_dias = len(dias_letivos)
    
    # Período anterior para comparação (mesma duração, antes do início)
    duracao = (datetime.strptime(request.data_fim, "%Y-%m-%d") - 
               datetime.strptime(request.data_inicio, "%Y-%m-%d")).days
    periodo_ant_fim = (datetime.strptime(request.data_inicio, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    periodo_ant_inicio = (datetime.strptime(request.data_inicio, "%Y-%m-%d") - timedelta(days=duracao+1)).strftime("%Y-%m-%d")
    dias_letivos_ant = get_dias_letivos(db, periodo_ant_inicio, periodo_ant_fim)
    
    query = db.query(models.Aluno).options(joinedload(models.Aluno.turmas))
    
    if request.turma_id:
        query = query.join(models.aluno_turma).filter(models.aluno_turma.c.turma_id == request.turma_id)
    
    alunos = query.filter(
        models.Aluno.situacao_matricula.in_(["ativo", "infrequente", "em_risco"])
    ).all()
    
    resultado = []
    
    for aluno in alunos:
        # Frequência atual
        presencas = db.query(models.Frequencia).filter(
            models.Frequencia.aluno_id == aluno.id,
            models.Frequencia.data.in_(dias_letivos),
            models.Frequencia.presente == True
        ).count()
        
        freq_atual = (presencas / total_dias * 100) if total_dias > 0 else 100
        
        # Frequência anterior
        freq_anterior = None
        if dias_letivos_ant:
            presencas_ant = db.query(models.Frequencia).filter(
                models.Frequencia.aluno_id == aluno.id,
                models.Frequencia.data.in_(dias_letivos_ant),
                models.Frequencia.presente == True
            ).count()
            freq_anterior = (presencas_ant / len(dias_letivos_ant) * 100) if dias_letivos_ant else None
        
        # Faltas consecutivas
        info_consec = calcular_faltas_consecutivas(db, aluno.id, dias_letivos)
        
        # Faltas alternadas (faltas que não são consecutivas)
        todas_faltas = db.query(models.Frequencia).filter(
            models.Frequencia.aluno_id == aluno.id,
            models.Frequencia.data.in_(dias_letivos),
            models.Frequencia.presente == False
        ).count()
        faltas_alternadas = max(0, todas_faltas - info_consec["consecutivas"])
        
        # Calcular score de risco
        risco = calcular_score_risco(
            freq_atual,
            info_consec["consecutivas"],
            freq_anterior,
            faltas_alternadas
        )
        
        # Incluir apenas alunos com risco médio ou maior
        if risco["nivel"] in ["medio", "alto", "critico"]:
            turma_nomes = [t.nome for t in aluno.turmas]
            
            resultado.append({
                "aluno_id": aluno.id,
                "aluno_nome": aluno.nome,
                "aluno_codigo": aluno.codigo,
                "turma": turma_nomes[0] if turma_nomes else "",
                "turno": extrair_turno(turma_nomes[0] if turma_nomes else ""),
                "score_risco": risco["score"],
                "nivel_risco": risco["nivel"],
                "motivo_principal": risco["motivo_principal"],
                "motivos": risco["motivos"],
                "acao_recomendada": risco["acao_recomendada"],
                "frequencia_atual": round(freq_atual, 2),
                "frequencia_anterior": round(freq_anterior, 2) if freq_anterior else None,
                "faltas_consecutivas": info_consec["consecutivas"],
                "ultima_presenca": info_consec["ultima_presenca"],
                "dias_sem_entrada": info_consec["dias_sem_entrada"],
                "responsavel": aluno.nome_responsavel,
                "telefone": aluno.telefone_responsavel
            })
    
    # Ordenar por score (maior primeiro)
    resultado.sort(key=lambda x: x["score_risco"], reverse=True)
    
    return {
        "alunos_em_risco": resultado,
        "total": len(resultado),
        "por_nivel": {
            "critico": len([a for a in resultado if a["nivel_risco"] == "critico"]),
            "alto": len([a for a in resultado if a["nivel_risco"] == "alto"]),
            "medio": len([a for a in resultado if a["nivel_risco"] == "medio"])
        },
        "periodo": {"inicio": request.data_inicio, "fim": request.data_fim}
    }


# ==================== 4. POSSÍVEL EVASÃO / ABANDONO ====================

@router.get("/evasao-abandono")
async def relatorio_evasao_abandono(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Relatório de possível evasão/abandono.
    
    Classificação:
    - ativo: frequência regular
    - infrequente: frequência baixa mas comparece
    - em_risco: indicadores de risco
    - abandono_presumido: 5-7 dias letivos sem entrada
    - evadido_confirmado: confirmado pela escola
    - transferido: transferência oficial
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    # Período: últimos 30 dias
    hoje = datetime.now().strftime("%Y-%m-%d")
    inicio = (datetime.now() - timedelta(days=45)).strftime("%Y-%m-%d")
    dias_letivos = get_dias_letivos(db, inicio, hoje)
    
    alunos = db.query(models.Aluno).options(joinedload(models.Aluno.turmas)).all()
    
    categorias = {
        "ativo": [],
        "infrequente": [],
        "em_risco": [],
        "abandono_presumido": [],
        "evadido_confirmado": [],
        "transferido": []
    }
    
    for aluno in alunos:
        info = calcular_faltas_consecutivas(db, aluno.id, dias_letivos)
        turma_nomes = [t.nome for t in aluno.turmas]
        
        aluno_data = {
            "aluno_id": aluno.id,
            "aluno_nome": aluno.nome,
            "aluno_codigo": aluno.codigo,
            "turma": turma_nomes[0] if turma_nomes else "",
            "faltas_consecutivas": info["consecutivas"],
            "ultima_presenca": info["ultima_presenca"],
            "dias_sem_entrada": info["dias_sem_entrada"],
            "situacao_atual": aluno.situacao_matricula or "ativo"
        }
        
        # Classificar baseado no status atual ou calcular
        if aluno.situacao_matricula == "transferido":
            categorias["transferido"].append(aluno_data)
        elif aluno.situacao_matricula == "evadido":
            categorias["evadido_confirmado"].append(aluno_data)
        elif info["consecutivas"] >= 7:
            categorias["abandono_presumido"].append(aluno_data)
        elif info["consecutivas"] >= 5:
            categorias["abandono_presumido"].append(aluno_data)
        elif info["consecutivas"] >= 3:
            categorias["em_risco"].append(aluno_data)
        elif info["consecutivas"] >= 2 or aluno.situacao_matricula == "infrequente":
            categorias["infrequente"].append(aluno_data)
        else:
            categorias["ativo"].append(aluno_data)
    
    return {
        "categorias": categorias,
        "resumo": {
            "total_alunos": len(alunos),
            "ativos": len(categorias["ativo"]),
            "infrequentes": len(categorias["infrequente"]),
            "em_risco": len(categorias["em_risco"]),
            "abandono_presumido": len(categorias["abandono_presumido"]),
            "evadidos": len(categorias["evadido_confirmado"]),
            "transferidos": len(categorias["transferido"])
        }
    }


# ==================== 5. MENORES COM COMUNICAÇÃO OBRIGATÓRIA ====================

@router.get("/menores-comunicacao")
async def relatorio_menores_comunicacao(
    minimo_faltas: int = Query(3, description="Mínimo de faltas para alerta"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Relatório de menores de idade com comunicação obrigatória aos responsáveis.
    
    Cruza: menor de idade, faltas consecutivas, frequência baixa,
    ausência não justificada, tempo sem entrada
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    # Período: últimos 30 dias
    hoje = datetime.now().strftime("%Y-%m-%d")
    inicio = (datetime.now() - timedelta(days=45)).strftime("%Y-%m-%d")
    dias_letivos = get_dias_letivos(db, inicio, hoje)
    total_dias = len(dias_letivos)
    
    alunos = db.query(models.Aluno).options(joinedload(models.Aluno.turmas)).filter(
        models.Aluno.situacao_matricula.in_(["ativo", "infrequente", "em_risco"])
    ).all()
    
    resultado = []
    
    for aluno in alunos:
        idade = calcular_idade(aluno.data_nascimento)
        
        # Só menores de 18 anos
        if idade is not None and idade >= 18:
            continue
        
        info = calcular_faltas_consecutivas(db, aluno.id, dias_letivos)
        
        # Calcular frequência
        presencas = db.query(models.Frequencia).filter(
            models.Frequencia.aluno_id == aluno.id,
            models.Frequencia.data.in_(dias_letivos),
            models.Frequencia.presente == True
        ).count()
        
        freq_pct = (presencas / total_dias * 100) if total_dias > 0 else 100
        
        # Faltas não justificadas
        faltas_totais = total_dias - presencas
        faltas_justificadas = db.query(models.Frequencia).filter(
            models.Frequencia.aluno_id == aluno.id,
            models.Frequencia.data.in_(dias_letivos),
            models.Frequencia.presente == False,
            models.Frequencia.falta_justificada == True
        ).count()
        faltas_nao_justificadas = faltas_totais - faltas_justificadas
        
        # Critérios para comunicação:
        need_contact = (
            info["consecutivas"] >= minimo_faltas or
            freq_pct < 85 or
            info["dias_sem_entrada"] >= 5
        )
        
        if need_contact:
            # Verificar último contato
            ultimo_contato = db.query(models.AcompanhamentoAluno).filter(
                models.AcompanhamentoAluno.aluno_id == aluno.id,
                models.AcompanhamentoAluno.tipo_acao == "aviso_responsavel"
            ).order_by(desc(models.AcompanhamentoAluno.data_acao)).first()
            
            # Determinar motivo do alerta
            if info["consecutivas"] >= 5:
                motivo = f"{info['consecutivas']} faltas consecutivas"
            elif info["dias_sem_entrada"] >= 5:
                motivo = f"{info['dias_sem_entrada']} dias sem entrada"
            elif freq_pct < 75:
                motivo = f"Frequência crítica ({freq_pct:.1f}%)"
            elif freq_pct < 85:
                motivo = f"Frequência em risco ({freq_pct:.1f}%)"
            else:
                motivo = f"{info['consecutivas']} faltas consecutivas"
            
            # Status de situação
            if ultimo_contato:
                if ultimo_contato.resultado == "sucesso":
                    situacao = "resolvido"
                elif ultimo_contato.resultado == "sem_retorno":
                    situacao = "sem_retorno"
                else:
                    situacao = "avisado"
                data_ultimo_aviso = ultimo_contato.data_acao.strftime("%Y-%m-%d")
            else:
                situacao = "pendente"
                data_ultimo_aviso = None
            
            turma_nomes = [t.nome for t in aluno.turmas]
            
            resultado.append({
                "aluno_id": aluno.id,
                "aluno_nome": aluno.nome,
                "aluno_codigo": aluno.codigo,
                "turma": turma_nomes[0] if turma_nomes else "",
                "idade": idade,
                "responsavel": aluno.nome_responsavel,
                "contato": aluno.telefone_responsavel or aluno.email_responsavel,
                "quantidade_faltas": faltas_totais,
                "faltas_nao_justificadas": faltas_nao_justificadas,
                "faltas_consecutivas": info["consecutivas"],
                "ultima_entrada": info["ultima_presenca"],
                "frequencia_percentual": round(freq_pct, 2),
                "motivo_alerta": motivo,
                "data_ultimo_aviso": data_ultimo_aviso,
                "situacao": situacao
            })
    
    # Ordenar: pendentes primeiro, depois por faltas
    resultado.sort(key=lambda x: (0 if x["situacao"] == "pendente" else 1, -x["faltas_consecutivas"]))
    
    return {
        "alunos": resultado,
        "total": len(resultado),
        "por_situacao": {
            "pendente": len([a for a in resultado if a["situacao"] == "pendente"]),
            "avisado": len([a for a in resultado if a["situacao"] == "avisado"]),
            "sem_retorno": len([a for a in resultado if a["situacao"] == "sem_retorno"]),
            "resolvido": len([a for a in resultado if a["situacao"] == "resolvido"])
        }
    }


# ==================== 6. RELATÓRIO GERENCIAL ====================

@router.post("/gerencial")
async def relatorio_gerencial(
    request: PeriodoRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Relatório gerencial completo.
    
    Mostra: turmas com maior infrequência, alunos em risco por turma,
    taxa média de frequência, alunos com mais faltas, evolução,
    casos com alerta aberto, alunos recuperados
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    dias_letivos = get_dias_letivos(db, request.data_inicio, request.data_fim)
    total_dias = len(dias_letivos)
    
    if total_dias == 0:
        return {"message": "Nenhum dia letivo no período"}
    
    turmas = db.query(models.Turma).all()
    turmas_data = []
    
    for turma in turmas:
        # Buscar alunos da turma
        alunos = db.query(models.Aluno).join(models.aluno_turma).filter(
            models.aluno_turma.c.turma_id == turma.id
        ).all()
        
        if not alunos:
            continue
        
        total_presencas = 0
        alunos_risco = 0
        alunos_criticos = 0
        
        for aluno in alunos:
            presencas = db.query(models.Frequencia).filter(
                models.Frequencia.aluno_id == aluno.id,
                models.Frequencia.data.in_(dias_letivos),
                models.Frequencia.presente == True
            ).count()
            
            total_presencas += presencas
            freq_pct = (presencas / total_dias * 100) if total_dias > 0 else 100
            
            if freq_pct < 75:
                alunos_criticos += 1
            elif freq_pct < 85:
                alunos_risco += 1
        
        taxa_media = (total_presencas / (len(alunos) * total_dias) * 100) if len(alunos) > 0 else 0
        
        turmas_data.append({
            "turma_id": turma.id,
            "turma_nome": turma.nome,
            "turno": extrair_turno(turma.nome),
            "total_alunos": len(alunos),
            "taxa_frequencia": round(taxa_media, 2),
            "alunos_risco": alunos_risco,
            "alunos_criticos": alunos_criticos
        })
    
    # Ordenar por taxa de frequência (menor primeiro)
    turmas_data.sort(key=lambda x: x["taxa_frequencia"])
    
    # Top 10 alunos com mais faltas
    alunos_mais_faltas = []
    todos_alunos = db.query(models.Aluno).options(joinedload(models.Aluno.turmas)).all()
    
    for aluno in todos_alunos:
        faltas = total_dias - db.query(models.Frequencia).filter(
            models.Frequencia.aluno_id == aluno.id,
            models.Frequencia.data.in_(dias_letivos),
            models.Frequencia.presente == True
        ).count()
        
        if faltas > 0:
            turma_nomes = [t.nome for t in aluno.turmas]
            alunos_mais_faltas.append({
                "aluno_id": aluno.id,
                "aluno_nome": aluno.nome,
                "turma": turma_nomes[0] if turma_nomes else "",
                "total_faltas": faltas,
                "frequencia": round((1 - faltas/total_dias) * 100, 2) if total_dias > 0 else 100
            })
    
    alunos_mais_faltas.sort(key=lambda x: x["total_faltas"], reverse=True)
    
    # Alertas abertos
    alertas_abertos = db.query(models.AlertaFrequencia).filter(
        models.AlertaFrequencia.status == "aberto"
    ).count()
    
    # Alunos recuperados (com acompanhamento bem-sucedido)
    recuperados = db.query(models.AcompanhamentoAluno).filter(
        models.AcompanhamentoAluno.aluno_retornou == True,
        models.AcompanhamentoAluno.data_acao >= request.data_inicio
    ).count()
    
    # Taxa média geral
    total_presencas_geral = db.query(models.Frequencia).filter(
        models.Frequencia.data.in_(dias_letivos),
        models.Frequencia.presente == True
    ).count()
    
    total_registros_esperados = len(todos_alunos) * total_dias
    taxa_geral = (total_presencas_geral / total_registros_esperados * 100) if total_registros_esperados > 0 else 0
    
    return {
        "periodo": {"inicio": request.data_inicio, "fim": request.data_fim},
        "dias_letivos": total_dias,
        "resumo_geral": {
            "total_alunos": len(todos_alunos),
            "taxa_frequencia_geral": round(taxa_geral, 2),
            "alertas_abertos": alertas_abertos,
            "alunos_recuperados": recuperados
        },
        "turmas_por_frequencia": turmas_data[:10],  # Top 10 piores
        "alunos_mais_faltas": alunos_mais_faltas[:10],  # Top 10
        "turmas_em_risco": [t for t in turmas_data if t["taxa_frequencia"] < 85]
    }


# ==================== GESTÃO DE ACOMPANHAMENTO ====================

@router.post("/acompanhamento")
async def registrar_acompanhamento(
    request: AcompanhamentoRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Registra uma ação de acompanhamento para um aluno"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    aluno = db.query(models.Aluno).filter(models.Aluno.id == request.aluno_id).first()
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    acompanhamento = models.AcompanhamentoAluno(
        aluno_id=request.aluno_id,
        alerta_id=request.alerta_id,
        tipo_acao=request.tipo_acao,
        responsavel_acao=request.responsavel_acao,
        resultado=request.resultado,
        observacao=request.observacao,
        data_retorno_previsto=request.data_retorno_previsto
    )
    
    db.add(acompanhamento)
    
    # Se houver alerta associado, atualizar status
    if request.alerta_id:
        alerta = db.query(models.AlertaFrequencia).filter(
            models.AlertaFrequencia.id == request.alerta_id
        ).first()
        if alerta:
            alerta.status = "em_acompanhamento"
    
    db.commit()
    db.refresh(acompanhamento)
    
    return {
        "message": "Acompanhamento registrado com sucesso",
        "id": acompanhamento.id
    }


@router.get("/acompanhamento/aluno/{aluno_id}")
async def listar_acompanhamentos_aluno(
    aluno_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Lista histórico de acompanhamentos de um aluno"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    acompanhamentos = db.query(models.AcompanhamentoAluno).filter(
        models.AcompanhamentoAluno.aluno_id == aluno_id
    ).order_by(desc(models.AcompanhamentoAluno.data_acao)).all()
    
    return [{
        "id": a.id,
        "tipo_acao": a.tipo_acao,
        "data_acao": a.data_acao.isoformat() if a.data_acao else None,
        "responsavel_acao": a.responsavel_acao,
        "resultado": a.resultado,
        "observacao": a.observacao,
        "aluno_retornou": a.aluno_retornou,
        "data_retorno_aluno": a.data_retorno_aluno
    } for a in acompanhamentos]


@router.put("/acompanhamento/{acompanhamento_id}/retorno")
async def registrar_retorno_aluno(
    acompanhamento_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Marca que o aluno retornou após acompanhamento"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    acomp = db.query(models.AcompanhamentoAluno).filter(
        models.AcompanhamentoAluno.id == acompanhamento_id
    ).first()
    
    if not acomp:
        raise HTTPException(status_code=404, detail="Acompanhamento não encontrado")
    
    acomp.aluno_retornou = True
    acomp.data_retorno_aluno = datetime.now().strftime("%Y-%m-%d")
    acomp.resultado = "sucesso"
    
    # Atualizar status do aluno
    aluno = db.query(models.Aluno).filter(models.Aluno.id == acomp.aluno_id).first()
    if aluno:
        aluno.situacao_matricula = "ativo"
    
    # Resolver alertas abertos
    db.query(models.AlertaFrequencia).filter(
        models.AlertaFrequencia.aluno_id == acomp.aluno_id,
        models.AlertaFrequencia.status.in_(["aberto", "em_acompanhamento"])
    ).update({"status": "resolvido", "data_resolucao": datetime.now()})
    
    db.commit()
    
    return {"message": "Retorno do aluno registrado com sucesso"}


@router.put("/aluno/status")
async def atualizar_status_aluno(
    request: AtualizarStatusAlunoRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Atualiza o status de matrícula do aluno"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    aluno = db.query(models.Aluno).filter(models.Aluno.id == request.aluno_id).first()
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    valid_status = ["ativo", "infrequente", "em_risco", "abandono_presumido", "evadido", "transferido"]
    if request.situacao_matricula not in valid_status:
        raise HTTPException(status_code=400, detail=f"Status inválido. Use: {valid_status}")
    
    aluno.situacao_matricula = request.situacao_matricula
    db.commit()
    
    return {"message": f"Status do aluno atualizado para: {request.situacao_matricula}"}


# ==================== ALERTAS ====================

@router.get("/alertas")
async def listar_alertas(
    status: Optional[str] = Query(None, description="Filtrar por status: aberto, em_acompanhamento, resolvido"),
    nivel: Optional[str] = Query(None, description="Filtrar por nível: atencao, alerta, risco, critico"),
    limit: int = Query(50, description="Limite de resultados"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Lista alertas de frequência"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    query = db.query(models.AlertaFrequencia).options(
        joinedload(models.AlertaFrequencia.aluno)
    )
    
    if status:
        query = query.filter(models.AlertaFrequencia.status == status)
    if nivel:
        query = query.filter(models.AlertaFrequencia.nivel_risco == nivel)
    
    alertas = query.order_by(desc(models.AlertaFrequencia.data_geracao)).limit(limit).all()
    
    return [{
        "id": a.id,
        "aluno_id": a.aluno_id,
        "aluno_nome": a.aluno.nome if a.aluno else None,
        "tipo_alerta": a.tipo_alerta,
        "nivel_risco": a.nivel_risco,
        "motivo": a.motivo,
        "data_geracao": a.data_geracao.isoformat() if a.data_geracao else None,
        "status": a.status,
        "faltas_consecutivas": a.faltas_consecutivas,
        "frequencia_percentual": a.frequencia_percentual,
        "ultima_presenca": a.ultima_presenca,
        "acao_recomendada": a.acao_recomendada
    } for a in alertas]


@router.post("/gerar-alertas")
async def gerar_alertas_automaticos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Gera alertas automáticos baseados nas regras configuradas"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    # Buscar configurações
    config = db.query(models.ConfiguracaoFrequencia).first()
    if not config:
        config = models.ConfiguracaoFrequencia()
    
    # Período: últimos 30 dias
    hoje = datetime.now().strftime("%Y-%m-%d")
    inicio = (datetime.now() - timedelta(days=45)).strftime("%Y-%m-%d")
    dias_letivos = get_dias_letivos(db, inicio, hoje)
    total_dias = len(dias_letivos)
    
    alunos = db.query(models.Aluno).filter(
        models.Aluno.situacao_matricula.in_(["ativo", "infrequente", "em_risco"])
    ).all()
    
    alertas_criados = 0
    
    for aluno in alunos:
        # Verificar se já existe alerta aberto recente
        alerta_existente = db.query(models.AlertaFrequencia).filter(
            models.AlertaFrequencia.aluno_id == aluno.id,
            models.AlertaFrequencia.status == "aberto",
            models.AlertaFrequencia.data_geracao >= datetime.now() - timedelta(days=7)
        ).first()
        
        if alerta_existente:
            continue
        
        info = calcular_faltas_consecutivas(db, aluno.id, dias_letivos)
        
        # Calcular frequência
        presencas = db.query(models.Frequencia).filter(
            models.Frequencia.aluno_id == aluno.id,
            models.Frequencia.data.in_(dias_letivos),
            models.Frequencia.presente == True
        ).count()
        
        freq_pct = (presencas / total_dias * 100) if total_dias > 0 else 100
        
        # Verificar gatilhos
        tipo_alerta = None
        nivel_risco = None
        motivo = None
        acao = None
        
        if info["consecutivas"] >= config.faltas_abandono:
            tipo_alerta = "abandono_presumido"
            nivel_risco = "critico"
            motivo = f"{info['consecutivas']} faltas consecutivas - possível abandono"
            acao = "Busca ativa urgente"
        elif info["consecutivas"] >= config.faltas_critico:
            tipo_alerta = "faltas_consecutivas"
            nivel_risco = "critico"
            motivo = f"{info['consecutivas']} faltas consecutivas"
            acao = "Contato imediato com responsável"
        elif info["consecutivas"] >= config.faltas_alerta:
            tipo_alerta = "faltas_consecutivas"
            nivel_risco = "alerta"
            motivo = f"{info['consecutivas']} faltas consecutivas"
            acao = "Notificar coordenação"
        elif freq_pct < config.faixa_risco:
            tipo_alerta = "baixa_frequencia"
            nivel_risco = "risco"
            motivo = f"Frequência em {freq_pct:.1f}%"
            acao = "Monitorar e contatar"
        elif freq_pct < config.faixa_atencao:
            tipo_alerta = "baixa_frequencia"
            nivel_risco = "atencao"
            motivo = f"Frequência em {freq_pct:.1f}%"
            acao = "Acompanhar"
        
        if tipo_alerta:
            novo_alerta = models.AlertaFrequencia(
                aluno_id=aluno.id,
                tipo_alerta=tipo_alerta,
                nivel_risco=nivel_risco,
                motivo=motivo,
                faltas_consecutivas=info["consecutivas"],
                frequencia_percentual=freq_pct,
                ultima_presenca=info["ultima_presenca"],
                dias_sem_entrada=info["dias_sem_entrada"],
                acao_recomendada=acao
            )
            db.add(novo_alerta)
            alertas_criados += 1
            
            # Atualizar situação do aluno
            if nivel_risco == "critico":
                aluno.situacao_matricula = "em_risco"
            elif nivel_risco in ["risco", "alerta"]:
                aluno.situacao_matricula = "infrequente"
    
    db.commit()
    
    return {
        "message": f"{alertas_criados} alertas gerados",
        "total_alertas": alertas_criados
    }


# ==================== DASHBOARD RESUMO ====================

@router.get("/dashboard")
async def dashboard_frequencia(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Dashboard resumido de frequência para a tela principal"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    # Período: mês atual
    hoje = datetime.now()
    inicio_mes = hoje.replace(day=1).strftime("%Y-%m-%d")
    hoje_str = hoje.strftime("%Y-%m-%d")
    dias_letivos = get_dias_letivos(db, inicio_mes, hoje_str)
    total_dias = len(dias_letivos)
    
    total_alunos = db.query(models.Aluno).filter(
        models.Aluno.situacao_matricula != "transferido"
    ).count()
    
    # Alertas abertos
    alertas_abertos = db.query(models.AlertaFrequencia).filter(
        models.AlertaFrequencia.status == "aberto"
    ).count()
    
    alertas_criticos = db.query(models.AlertaFrequencia).filter(
        models.AlertaFrequencia.status == "aberto",
        models.AlertaFrequencia.nivel_risco == "critico"
    ).count()
    
    # Situação dos alunos
    situacao = db.query(
        models.Aluno.situacao_matricula,
        func.count(models.Aluno.id)
    ).group_by(models.Aluno.situacao_matricula).all()
    
    situacao_dict = {s[0] or "ativo": s[1] for s in situacao}
    
    # Taxa de frequência média do mês
    if total_dias > 0 and total_alunos > 0:
        total_presencas = db.query(models.Frequencia).filter(
            models.Frequencia.data.in_(dias_letivos),
            models.Frequencia.presente == True
        ).count()
        taxa_media = (total_presencas / (total_alunos * total_dias)) * 100
    else:
        taxa_media = 0
    
    # Pendências de comunicação (menores sem contato)
    # Simplificado para evitar queries complexas
    pendencias = db.query(models.AlertaFrequencia).filter(
        models.AlertaFrequencia.status == "aberto",
        models.AlertaFrequencia.nivel_risco.in_(["critico", "alerta"])
    ).count()
    
    return {
        "total_alunos": total_alunos,
        "taxa_frequencia_mes": round(taxa_media, 2),
        "dias_letivos_mes": total_dias,
        "alertas": {
            "abertos": alertas_abertos,
            "criticos": alertas_criticos
        },
        "situacao_alunos": {
            "ativos": situacao_dict.get("ativo", 0),
            "infrequentes": situacao_dict.get("infrequente", 0),
            "em_risco": situacao_dict.get("em_risco", 0),
            "abandono_presumido": situacao_dict.get("abandono_presumido", 0),
            "evadidos": situacao_dict.get("evadido", 0)
        },
        "pendencias_comunicacao": pendencias,
        "periodo": {"inicio": inicio_mes, "fim": hoje_str}
    }
