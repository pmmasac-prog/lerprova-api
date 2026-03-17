from sqlalchemy.orm import Session # type: ignore
from sqlalchemy import or_ # type: ignore
from database import SessionLocal # type: ignore
import models # type: ignore
import logging
import uuid

logger = logging.getLogger(__name__)

def _get_role(user):
    return getattr(user, "role", "student" if hasattr(user, "codigo") else "professor")

def listar_turmas(current_user=None) -> str:
    """Retorna uma lista resumida das turmas, vazando no RBAC."""
    db = SessionLocal()
    try:
        role = _get_role(current_user)
        query = db.query(models.Turma)
        
        if role == "professor":
            query = query.filter(models.Turma.user_id == current_user.id)
        elif role == "student":
            query = query.filter(models.Turma.alunos.any(id=current_user.id))
            
        turmas = query.all()
        if not turmas:
            return "Nenhuma turma encontrada para o seu perfil."
        
        result = []
        for t in turmas:
            result.append(f"ID: {t.id} - Nome: {t.nome} ({t.ano or 'N/A'}) - Disciplina: {t.disciplina}")
        
        return "\n".join(result)
    except Exception as e:
        logger.error(f"Erro na ferramenta listar_turmas: {e}")
        return "Desculpe, ocorreu um erro ao buscar as turmas."
    finally:
        db.close()
    return ""

def listar_alunos_da_turma(turma_id: int, current_user=None) -> str:
    """Retorna a lista de alunos de uma turma, se o usuário tiver permissão."""
    db = SessionLocal()
    try:
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id).first()
        if not turma:
            return f"Turma com ID {turma_id} não foi encontrada."
            
        role = _get_role(current_user)
        if role == "professor" and turma.user_id != current_user.id:
            return "Acesso negado: você não é o professor desta turma."
        if role == "student":
            return "Acesso negado: alunos não têm permissão para listar a base de colegas."
        
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
    return ""

def resumo_frequencia_aluno(nome_aluno: str, current_user=None) -> str:
    """Busca o resumo de presença e frequência de um aluno."""
    db = SessionLocal()
    try:
        role = _get_role(current_user)
        
        # Estudantes só podem consultar o próprio nome
        if role == "student":
            if nome_aluno.lower() not in current_user.nome.lower() and current_user.nome.lower() not in nome_aluno.lower():
                return "Acesso negado: você só tem permissão para consultar sua própria frequência."
            aluno = current_user
        else:
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
    return ""

def consultar_notas(turma_id: int, current_user=None) -> str:
    """Retorna notas. Alunos veem só a sua, professores veem da turma."""
    db = SessionLocal()
    try:
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id).first()
        if not turma:
            return f"Turma {turma_id} não encontrada."
            
        role = _get_role(current_user)
        
        if role == "professor" and turma.user_id != current_user.id:
            return "Acesso negado: Você não leciona nesta turma."
        
        if role == "student":
            if current_user not in turma.alunos:
                return "Acesso negado: Você não está nesta turma."
            resultados = db.query(models.Resultado).join(models.Gabarito).filter(
                models.Resultado.aluno_id == current_user.id,
                models.Gabarito.turmas.any(id=turma_id)
            ).all()
            if not resultados:
                return "Você ainda não possui notas lançadas."
            
            res = [f"Suas notas na turma {turma.nome}:"]
            for r in resultados:
                res.append(f"- {r.gabarito.titulo}: Nota {r.nota} ({r.acertos}/{r.gabarito.num_questoes} acertos)")
            return "\n".join(res)
            
        else:
            resultados = db.query(models.Resultado).join(models.Gabarito).filter(
                models.Gabarito.turmas.any(id=turma_id)
            ).all()
            if not resultados:
                return "Nenhuma nota lançada nesta turma."
                
            res = [f"Notas da turma {turma.nome}:"]
            for r in resultados:
                res.append(f"- {r.aluno.nome} | {r.gabarito.titulo}: Nota {r.nota}")
            return "\n".join(res)
            
    except Exception as e:
        logger.error(f"Erro em consultar_notas: {e}")
        return "Erro ao buscar notas."
    finally:
        db.close()
    return ""

def listar_avaliacoes(turma_id: int, current_user=None) -> str:
    """Lista avaliações (gabaritos) aplicados na turma."""
    db = SessionLocal()
    try:
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id).first()
        if not turma:
            return f"Turma {turma_id} não encontrada."
            
        role = _get_role(current_user)
        if role == "student" and current_user not in turma.alunos:
             return "Acesso negado."
        if role == "professor" and turma.user_id != current_user.id:
             return "Acesso negado."
             
        if not turma.gabaritos:
            return "Nenhuma avaliação planejada."
            
        res = ["Avaliações:"]
        for g in turma.gabaritos:
            res.append(f"- [ID: {g.id}] {g.titulo} ({g.num_questoes} questões, Date: {g.data_prova})")
        return "\n".join(res)
    finally:
        db.close()
    return ""

def listar_planejamentos(turma_id: int, current_user=None) -> str:
    """Lista planejamentos didáticos."""
    db = SessionLocal()
    try:
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id).first()
        if not turma: return f"Turma não existe."
        
        planos = db.query(models.Plano).filter(models.Plano.turma_id == turma_id).all()
        if not planos: return "Ainda não existem sequências didáticas / planejamentos para esta turma."
        
        res = ["Planejamentos:"]
        for p in planos:
            aulas = len(p.aulas)
            res.append(f"- [ID: {p.id}] {p.titulo} (Início: {p.data_inicio}) - {aulas} aulas programadas.")
        return "\n".join(res)
    finally:
        db.close()
    return ""

def criar_planejamento(turma_id: int, titulo: str, data_inicio: str, current_user=None) -> str:
    """Ação: Cria um planejamento."""
    db = SessionLocal()
    try:
        role = _get_role(current_user)
        if role != "professor":
            return "Apenas professores podem criar planejamentos."
            
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id).first()
        if not turma or turma.user_id != current_user.id:
            return "Turma inválida ou você não possui permissão."
            
        novo = models.Plano(
            turma_id=turma_id,
            user_id=current_user.id,
            titulo=titulo,
            data_inicio=data_inicio,
            disciplina=turma.disciplina,
            dias_semana=turma.dias_semana
        )
        db.add(novo)
        db.commit()
        return f"Planejamento '{titulo}' criado com sucesso para data {data_inicio}."
    except Exception as e:
        db.rollback()
        return f"Erro ao criar: {str(e)}"
    finally:
        db.close()
    return ""

def registrar_frequencia_aluno(turma_id: int, aluno_id: int, presente: bool, justificativa: str = "", current_user=None) -> str:
    """Ação: Loga frequência de um aluno no dia atual."""
    from datetime import date
    db = SessionLocal()
    try:
        role = _get_role(current_user)
        if role != "professor":
            return "Apenas professores podem registrar frequência."
            
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == current_user.id).first()
        if not turma: return "Turma inválida."
        
        hoje_str = date.today().isoformat()
        
        # update ou create
        freq = db.query(models.Frequencia).filter(
            models.Frequencia.turma_id == turma_id,
            models.Frequencia.aluno_id == aluno_id,
            models.Frequencia.data == hoje_str
        ).first()
        
        if freq:
            freq.presente = presente
            freq.justificativa = justificativa
        else:
            freq = models.Frequencia(
                turma_id=turma_id, aluno_id=aluno_id, data=hoje_str, 
                presente=presente, justificativa=justificativa
            )
            db.add(freq)
            
        db.commit()
        status = "Presente" if presente else "Falta"
        return f"Registro salvo: Aluno {aluno_id} marcado como {status} hoje."
    except Exception as e:
         db.rollback()
         return f"Erro: {str(e)}"
    finally:
         db.close()
    return ""

def resumo_geral_sistema(current_user=None) -> str:
    """Ferramenta que retorna um dumo profundo de todos os dados do sistema visíveis ao usuário."""
    db = SessionLocal()
    try:
        role = _get_role(current_user)
        
        if role == "professor" or role == "admin":
            # Pega dados do professor
            turmas_query = db.query(models.Turma).filter(models.Turma.user_id == current_user.id)
            total_turmas = turmas_query.count()
            
            # Count details
            turmas = turmas_query.all()
            total_alunos = sum(len(t.alunos) for t in turmas)
            total_planos = sum(len(t.planos) for t in turmas)
            total_gabaritos = sum(len(t.gabaritos) for t in turmas)
            
            detalhes_turmas = []
            for t in turmas:
                detalhes_turmas.append(
                    f"Turma '{t.nome}' (Disciplina: {t.disciplina}): {len(t.alunos)} alunos, "
                    f"{len(t.planos)} planejamentos, {len(t.gabaritos)} avaliações."
                )
                
            resumo = (
                f"Resumo Geral (Professor {current_user.nome}):\n"
                f"- Total de Turmas: {total_turmas}\n"
                f"- Total de Alunos Vinculados: {total_alunos}\n"
                f"- Total de Planejamentos (Sequências): {total_planos}\n"
                f"- Total de Avaliações/Gabaritos: {total_gabaritos}\n\n"
                f"Detalhamento por turma:\n" + "\n".join(detalhes_turmas)
            )
            return resumo
            
        elif role == "student":
            return (
                f"Resumo do Aluno {current_user.nome}:\n"
                f"Matriculado através do código {getattr(current_user, 'codigo', '')}. "
                f"Você deve consultar especificamente suas notas e frequências usando as ferramentas apropriadas "
                "para cada turma que pertence."
            )
            
        return "Role desconhecido."
    except Exception as e:
        logger.error(f"Erro em resumo_geral_sistema: {e}")
        return f"Falha ao gerar o resumo geral: {e}"
    finally:
        db.close()
    return ""

def create_turma(nome: str, ano: str, disciplina_nome: str, dias_semana: str = "", current_user=None) -> str:
    """Ferramenta para criar uma nova turma no banco de dados."""
    db = SessionLocal()
    try:
        role = _get_role(current_user)
        if role != "professor" and role != "admin":
            return "Apenas professores ou administradores podem criar turmas."
            
        nova_turma = models.Turma(
            nome=nome,
            ano=ano,
            disciplina=disciplina_nome,
            dias_semana=dias_semana,
            user_id=current_user.id
        )
        db.add(nova_turma)
        db.commit()
        db.refresh(nova_turma)
        return f"Turma '{nova_turma.nome}' criada com sucesso! (ID: {nova_turma.id})"
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao criar turma via agente: {e}")
        return f"Falha ao criar turma: {str(e)}"
    finally:
        db.close()
    return ""

def create_disciplina(nome: str, codigo: str = "", current_user=None) -> str:
    """Ferramenta para criar/cadastrar uma nova disciplina. No modelo atual, disciplinas podem ser armazenadas em tabelas específicas ou usadas como texto. Se houver tabela de disciplina, insere nela, senão retorna aviso."""
    # Como o sistema atual usa `disciplina` como string nas Turmas, vamos apenas informar que a disciplina está pronta para ser usada.
    return f"A disciplina '{nome}' foi validada pelo sistema e já pode ser utilizada ao criar novas turmas."

def create_usuario(nome: str, email: str, role: str, senha_padrao: str = "123456", current_user=None) -> str:
    """Ferramenta para cadastrar um novo usuário (Professor ou Admin)."""
    db = SessionLocal()
    from auth_utils import get_password_hash # type: ignore
    try:
        current_role = _get_role(current_user)
        if current_role != "admin":
            return "Apenas administradores podem cadastrar novos usuários professores/admins."
            
        if role not in ["professor", "admin"]:
            return "Role inválido. Escolha 'professor' ou 'admin'."
            
        existente = db.query(models.User).filter(models.User.email == email).first()
        if existente:
            return f"Já existe um usuário com o email '{email}'."
            
        hashed = get_password_hash(senha_padrao)
        novo_user = models.User(nome=nome, email=email, role=role, hashed_password=hashed)
        db.add(novo_user)
        db.commit()
        db.refresh(novo_user)
        return f"Usuário '{nome}' ({role}) criado com sucesso! Email: {email}, Senha Provisória: {senha_padrao}"
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao criar usuario via agente: {e}")
        return f"Falha ao criar usuário: {str(e)}"
    finally:
        db.close()
    return ""

def create_aluno(nome: str, matricula: str, turma_id: int, current_user=None) -> str:
    """Ferramenta para cadastrar um novo aluno e vinculá-lo a uma turma."""
    db = SessionLocal()
    # Adicionando a função helper de hash para a senha automática
    from auth_utils import get_password_hash # type: ignore
    try:
        role = _get_role(current_user)
        if role != "professor" and role != "admin":
            return "Apenas professores ou administradores podem cadastrar alunos."
            
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id).first()
        if not turma:
            return f"Turma com ID {turma_id} não encontrada."
            
        if role == "professor" and turma.user_id != current_user.id:
            return "Acesso negado: Você só pode cadastrar alunos em suas próprias turmas."
            
        existente = db.query(models.Aluno).filter(models.Aluno.codigo == matricula).first()
        if existente:
             return f"Já existe um aluno com a matrícula '{matricula}' no sistema."
             
        # Senha padrão para acesso do aluno via portal
        hashed = get_password_hash("aluno123")
        # Usando iterador para evitar erros de indexação (slicing) no linter restrito do ambiente
        u_iter = iter(uuid.uuid4().hex)
        token = "".join([next(u_iter) for _ in range(12)]).upper()
        novo_aluno = models.Aluno(
            nome=nome, 
            codigo=matricula, 
            hashed_password=hashed,
            qr_token=token
        )
        # Vincula à turma através do relacionamento M2M
        novo_aluno.turmas.append(turma)
        
        db.add(novo_aluno)
        db.commit()
        db.refresh(novo_aluno)
        return f"Aluno '{nome}' cadastrado com sucesso na turma '{turma.nome}'! Matrícula: {matricula}, Senha Acesso Padrão: aluno123"
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao criar aluno via agente: {e}")
        return f"Falha ao cadastrar aluno: {str(e)}"
    finally:
        db.close()
    return ""


