from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text, Table
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class Turma(Base):
    __tablename__ = "turmas"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String)
    disciplina = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    professor = relationship("User", back_populates="turmas")
    
    alunos = relationship("Aluno", secondary="aluno_turma", back_populates="turmas")
    gabaritos = relationship("Gabarito", secondary="gabarito_turma", back_populates="turmas")

# Tabela de associação para Gabarito e Turma (Muitos-para-Muitos)
gabarito_turma = Table(
    "gabarito_turma",
    Base.metadata,
    Column("gabarito_id", Integer, ForeignKey("gabaritos.id"), primary_key=True),
    Column("turma_id", Integer, ForeignKey("turmas.id"), primary_key=True),
)

# Tabela de associação para Aluno e Turma (Muitos-para-Muitos)
aluno_turma = Table(
    "aluno_turma",
    Base.metadata,
    Column("aluno_id", Integer, ForeignKey("alunos.id"), primary_key=True),
    Column("turma_id", Integer, ForeignKey("turmas.id"), primary_key=True),
)

class Aluno(Base):
    __tablename__ = "alunos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String)
    codigo = Column(String, index=True) # Matrícula ou código único
    turma_id = Column(Integer, ForeignKey("turmas.id"))
    qr_token = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    turmas = relationship("Turma", secondary="aluno_turma", back_populates="alunos")
    # turma = relationship("Turma", back_populates="alunos") # Deprecated
    resultados = relationship("Resultado", back_populates="aluno", cascade="all, delete-orphan")

class Gabarito(Base):
    __tablename__ = "gabaritos"

    id = Column(Integer, primary_key=True, index=True)
    turma_id = Column(Integer, ForeignKey("turmas.id"), nullable=True) # Pode ser global ou por turma? Assumindo por turma ou geral
    titulo = Column(String) # Ex: "Prova Bimestral"
    assunto = Column(String, nullable=True)
    disciplina = Column(String, nullable=True)
    data_prova = Column(String, nullable=True) # Data da prova
    num_questoes = Column(Integer, default=10)
    respostas_corretas = Column(Text) # JSON string: ["A", "B", ...]
    periodo = Column(Integer, nullable=True) # Bimestre/Trimestre (1 a 4)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    turmas = relationship("Turma", secondary="gabarito_turma", back_populates="gabaritos")
    resultados = relationship("Resultado", back_populates="gabarito", cascade="all, delete-orphan")

class Resultado(Base):
    __tablename__ = "resultados"

    id = Column(Integer, primary_key=True, index=True)
    aluno_id = Column(Integer, ForeignKey("alunos.id"))
    gabarito_id = Column(Integer, ForeignKey("gabaritos.id"))
    acertos = Column(Integer)
    nota = Column(Float)
    respostas_aluno = Column(Text, nullable=True) # JSON string das respostas do aluno
    data_correcao = Column(DateTime, default=datetime.utcnow)
    imagem_path = Column(String, nullable=True) # Caminho da imagem da prova corrigida

    # Relacionamentos
    aluno = relationship("Aluno", back_populates="resultados")
    gabarito = relationship("Gabarito", back_populates="resultados")

class Frequencia(Base):
    __tablename__ = "frequencia"

    id = Column(Integer, primary_key=True, index=True)
    turma_id = Column(Integer, ForeignKey("turmas.id"))
    aluno_id = Column(Integer, ForeignKey("alunos.id"))
    data = Column(String) # YYYY-MM-DD
    presente = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    turma = relationship("Turma")
    aluno = relationship("Aluno")

class Plano(Base):
    __tablename__ = "planos"

    id = Column(Integer, primary_key=True, index=True)
    turma_id = Column(Integer, ForeignKey("turmas.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    titulo = Column(String)
    disciplina = Column(String, nullable=True)
    data_inicio = Column(String)  # YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    turma = relationship("Turma")
    aulas = relationship("AulaPlanejada", back_populates="plano", cascade="all, delete-orphan")

class AulaPlanejada(Base):
    __tablename__ = "aulas_planejadas"

    id = Column(Integer, primary_key=True, index=True)
    plano_id = Column(Integer, ForeignKey("planos.id"))
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
    aula_id = Column(Integer, ForeignKey("aulas_planejadas.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    data_registro = Column(DateTime, default=datetime.utcnow)
    percepcoes = Column(Text, nullable=True)  # JSON: ["engajados", "duvida"]
    observacoes = Column(Text, nullable=True)
    ajustes_feitos = Column(Text, nullable=True)  # JSON: {"reforco_inserido": true, "datas_recalculadas": 3}

    # Relacionamentos
    aula = relationship("AulaPlanejada", back_populates="registros")

class AnalyticsDaily(Base):
    __tablename__ = "analytics_daily"

    id = Column(Integer, primary_key=True, index=True)
    turma_id = Column(Integer, ForeignKey("turmas.id"))
    data = Column(String)  # YYYY-MM-DD
    engajamento_score = Column(Float, default=0.0)  # 0-1
    alerta_score = Column(Float, default=0.0)  # 0-1
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    turma = relationship("Turma")
