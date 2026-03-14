import sys
import traceback
from database import SessionLocal
import models
from agents.agent_tools import listar_turmas

try:
    db = SessionLocal()
    professor = db.query(models.User).filter(models.User.role == "professor").first()
    if professor:
        print("Professor found:", professor.nome)
        print("Turmas P:", listar_turmas(professor))
        
    aluno = db.query(models.Aluno).first()
    if aluno:
        print("Aluno found:", getattr(aluno, "nome", "No name"))
        aluno.role = "student"
        print("Turmas A:", listar_turmas(aluno))
except Exception as e:
    print("--- RAW TRACEBACK ---")
    traceback.print_exc(file=sys.stdout)
