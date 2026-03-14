import traceback
from database import SessionLocal
import models
from agents.agent_tools import listar_turmas

try:
    db = SessionLocal()
    professor = db.query(models.User).filter(models.User.role == "professor").first()
    if professor:
        res1 = listar_turmas(professor)
        print("Professor success.")
        
    aluno = db.query(models.Aluno).first()
    if aluno:
        aluno.role = "student"
        res2 = listar_turmas(aluno)
        print("Aluno success.")
        
except Exception as e:
    with open("tb_dump.txt", "w") as f:
        f.write(traceback.format_exc())
