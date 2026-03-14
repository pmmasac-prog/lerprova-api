from sqlalchemy.orm import Session
from database import SessionLocal
import models
import logging

logger = logging.getLogger(__name__)

def listar_turmas() -> str:
    """
    Retorna uma lista resumida de todas as turmas cadastradas no banco de dados.
    Use esta ferramenta quando o usuário perguntar sobre as turmas disponíveis no sistema.
    """
    db = SessionLocal()
    try:
        turmas = db.query(models.Turma).all()
        if not turmas:
            return "Nenhuma turma encontrada no sistema."
        
        result = []
        for t in turmas:
            result.append(f"ID: {t.id} - Nome: {t.nome} - Disciplina: {t.disciplina}")
        
        return "\n".join(result)
    except Exception as e:
        logger.error(f"Erro na ferramenta listar_turmas: {e}")
        return "Desculpe, ocorreu um erro ao buscar as turmas."
    finally:
        db.close()

def listar_alunos_da_turma(turma_id: int) -> str:
    """
    Retorna a lista de alunos matriculados em uma turma específica.
    Argumentos:
        turma_id (int): O ID da turma para buscar os alunos.
    Use esta ferramenta quando o usuário quiser saber quem são os alunos de uma determinada turma.
    """
    db = SessionLocal()
    try:
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id).first()
        if not turma:
            return f"Turma com ID {turma_id} não foi encontrada."
        
        if not turma.alunos:
            return f"A turma '{turma.nome}' não possui alunos matriculados."
            
        result = [f"Alunos da turma {turma.nome}:"]
        for aluno in turma.alunos:
            status = aluno.situacao_matricula if aluno.situacao_matricula else 'ativo'
            result.append(f"- {aluno.nome} (Código: {aluno.codigo}, Situação: {status})")
            
        return "\n".join(result)
    except Exception as e:
        logger.error(f"Erro na ferramenta listar_alunos_da_turma: {e}")
        return "Desculpe, ocorreu um erro ao buscar os alunos."
    finally:
        db.close()

def resumo_frequencia_aluno(nome_aluno: str) -> str:
    """
    Busca o resumo de presença e frequência de um aluno pelo nome (ou parte do nome).
    Argumentos:
        nome_aluno (str): O nome ou parte do nome do aluno.
    Use esta ferramenta para responder perguntas sobre as faltas ou frequência de um aluno.
    """
    db = SessionLocal()
    try:
        aluno = db.query(models.Aluno).filter(models.Aluno.nome.ilike(f"%{nome_aluno}%")).first()
        if not aluno:
            return f"Nenhum aluno encontrado com o nome contendo '{nome_aluno}'."
        
        frequencias = db.query(models.Frequencia).filter(models.Frequencia.aluno_id == aluno.id).all()
        
        if not frequencias:
            return f"O aluno {aluno.nome} não possui registros de frequência no sistema."
            
        total_aulas = len(frequencias)
        presencas = sum(1 for f in frequencias if f.presente)
        faltas = total_aulas - presencas
        
        porcentagem = (presencas / total_aulas) * 100 if total_aulas > 0 else 0
        
        return f"Resumo de Frequência do aluno {aluno.nome}:\n- Total de Aulas Computadas: {total_aulas}\n- Presenças: {presencas}\n- Faltas: {faltas}\n- % Frequência: {porcentagem:.1f}%"
        
    except Exception as e:
        logger.error(f"Erro na ferramenta resumo_frequencia_aluno: {e}")
        return "Desculpe, ocorreu um erro ao calcular a frequência."
    finally:
        db.close()
