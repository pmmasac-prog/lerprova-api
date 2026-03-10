from database import SessionLocal
from models import Aluno

def remover_alunos_sem_turma():
    db = SessionLocal()
    try:
        alunos_sem_turma = db.query(Aluno).filter(~Aluno.turmas.any()).all()
        print(f"Encontrados {len(alunos_sem_turma)} alunos sem turma.")
        for aluno in alunos_sem_turma:
            print(f"Removendo aluno: {aluno.id} - {aluno.nome}")
            db.delete(aluno)
        db.commit()
        print("Alunos sem turma removidos com sucesso.")
    finally:
        db.close()

if __name__ == "__main__":
    remover_alunos_sem_turma()
