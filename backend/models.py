from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text, Table, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
from passlib.context import CryptContext

# Configuração de criptografia de senha
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="professor")
    escola = Column(String, nullable=True)
    disciplina = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Novos campos para monetização
    plan_type = Column(String, default="free") 
    subscription_expires_at = Column(DateTime, nullable=True)
    total_corrections_used = Column(Integer, default=0)
    
    # Relacionamentos
    turmas = relationship("Turma", back_populates="professor")

    def verify_password(self, password: str):
        return pwd_context.verify(password, self.hashed_password)

class Turma(Base):
    __tablename__ = "turmas"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String)
    disciplina = Column(String, nullable=True)
    dias_semana = Column(JSON, nullable=True) # Lista de inteiros
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    professor = relationship("User", back_populates="turmas")
    
    alunos = relationship("Aluno", secondary="aluno_turma", back_populates="turmas")
    gabaritos = relationship("Gabarito", secondary="gabarito_turma", back_populates="turmas")

# Tabela de associação para Gabarito e Turma (Muitos-para-Muitos)
gabarito_turma = Table(
    "gabarito_turma",
    Base.metadata,
    Column("gabarito_id", Integer, ForeignKey("gabaritos.id", ondelete="CASCADE"), primary_key=True),
    Column("turma_id", Integer, ForeignKey("turmas.id", ondelete="CASCADE"), primary_key=True),
)

# Tabela de associação para Aluno e Turma (Muitos-para-Muitos)
aluno_turma = Table(
    "aluno_turma",
    Base.metadata,
    Column("aluno_id", Integer, ForeignKey("alunos.id", ondelete="CASCADE"), primary_key=True),
    Column("turma_id", Integer, ForeignKey("turmas.id", ondelete="CASCADE"), primary_key=True),
)

class Aluno(Base):
    __tablename__ = "alunos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String)
    codigo = Column(String, index=True) # Matrícula ou código único
    # turma_id REMOVIDO — usar apenas M2M (aluno_turma)
    qr_token = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    turmas = relationship("Turma", secondary="aluno_turma", back_populates="alunos")
    resultados = relationship("Resultado", back_populates="aluno", cascade="all, delete-orphan")

class Gabarito(Base):
    __tablename__ = "gabaritos"

    id = Column(Integer, primary_key=True, index=True)
    # turma_id REMOVIDO — usar apenas M2M (gabarito_turma)
    titulo = Column(String) # Ex: "Prova Bimestral"
    assunto = Column(String, nullable=True)
    disciplina = Column(String, nullable=True)
    data_prova = Column(String, nullable=True) # Data da prova
    num_questoes = Column(Integer, default=10)
    respostas_corretas = Column(JSON) # Lista de strings
    periodo = Column(Integer, nullable=True) # Bimestre/Trimestre (1 a 4)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    turmas = relationship("Turma", secondary="gabarito_turma", back_populates="gabaritos")
    resultados = relationship("Resultado", back_populates="gabarito", cascade="all, delete-orphan")

class Resultado(Base):
    __tablename__ = "resultados"

    id = Column(Integer, primary_key=True, index=True)
    aluno_id = Column(Integer, ForeignKey("alunos.id", ondelete="CASCADE"))
    gabarito_id = Column(Integer, ForeignKey("gabaritos.id", ondelete="CASCADE"))
    acertos = Column(Integer)
    nota = Column(Float)
    respostas_aluno = Column(JSON, nullable=True) # Lista de strings
    data_correcao = Column(DateTime, default=datetime.utcnow)
    imagem_path = Column(String, nullable=True) # Caminho da imagem da prova corrigida

    # Campos de auditoria OMR
    status_list = Column(JSON, nullable=True)          # Lista de strings
    confidence_scores = Column(JSON, nullable=True)    # Lista de floats
    avg_confidence = Column(Float, default=0.0)
    layout_version = Column(String, nullable=True)
    anchors_found = Column(Integer, default=0)

    # Relacionamentos
    aluno = relationship("Aluno", back_populates="resultados")
    gabarito = relationship("Gabarito", back_populates="resultados")

class Frequencia(Base):
    __tablename__ = "frequencia"

    id = Column(Integer, primary_key=True, index=True)
    turma_id = Column(Integer, ForeignKey("turmas.id", ondelete="CASCADE"))
    aluno_id = Column(Integer, ForeignKey("alunos.id", ondelete="CASCADE"))
    data = Column(String) # YYYY-MM-DD
    presente = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    turma = relationship("Turma")
    aluno = relationship("Aluno")

class Plano(Base):
    __tablename__ = "planos"

    id = Column(Integer, primary_key=True, index=True)
    turma_id = Column(Integer, ForeignKey("turmas.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id"))
    titulo = Column(String)
    disciplina = Column(String, nullable=True)
    data_inicio = Column(String)  # YYYY-MM-DD
    dias_semana = Column(JSON, nullable=True) # Lista de inteiros
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    turma = relationship("Turma")
    aulas = relationship("AulaPlanejada", back_populates="plano", cascade="all, delete-orphan")

class AulaPlanejada(Base):
    __tablename__ = "aulas_planejadas"

    id = Column(Integer, primary_key=True, index=True)
    plano_id = Column(Integer, ForeignKey("planos.id", ondelete="CASCADE"))
    ordem = Column(Integer)
    titulo = Column(String)
    scheduled_date = Column(String)  # YYYY-MM-DD
    status = Column(String, default="pending")  # pending, done, skipped
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    plano = relationship("Plano", back_populates="aulas")
    registros = relationship("RegistroAula", back_populates="aula", cascade="all, delete-orphan")

class RegistroAula(Base):
    __tablename__ = "registros_aula"

    id = Column(Integer, primary_key=True, index=True)
    aula_id = Column(Integer, ForeignKey("aulas_planejadas.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id"))
    data_registro = Column(DateTime, default=datetime.utcnow)
    percepcoes = Column(JSON, nullable=True)  # Lista de strings
    observacoes = Column(Text, nullable=True)
    ajustes_feitos = Column(JSON, nullable=True) # Objeto/Dicionário

    # Relacionamentos
    aula = relationship("AulaPlanejada", back_populates="registros")

class AnalyticsDaily(Base):
    __tablename__ = "analytics_daily"

    id = Column(Integer, primary_key=True, index=True)
    turma_id = Column(Integer, ForeignKey("turmas.id", ondelete="CASCADE"))
    data = Column(String)  # YYYY-MM-DD
    engajamento_score = Column(Float, default=0.0)  # 0-1
    alerta_score = Column(Float, default=0.0)  # 0-1
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    turma = relationship("Turma")
