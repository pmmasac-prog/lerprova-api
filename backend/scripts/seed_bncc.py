import csv
import os
import sys

# Adicionar o diretório atual ao path para importar database e models
sys.path.append(os.getcwd())

from database import SessionLocal, engine
import models
from models import BNCCSkill, BNCCCompetency, bncc_skill_competency
from sqlalchemy import insert, text

def seed_bncc():
    # Garantir que as tabelas existem
    print("Criando tabelas novas se não existirem...")
    models.Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    # Caminho corrigido para a pasta pack v4
    csv_dir = os.path.join(os.getcwd(), "curriculum_schema_pack_v4", "initdb", "csv")
    
    print(f"Buscando CSVs em: {csv_dir}")

    # Load Competencies
    comp_file = os.path.join(csv_dir, "curriculum_competencies.csv")
    if os.path.exists(comp_file):
        print("Populando Competências...")
        with open(comp_file, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                exists = db.query(BNCCCompetency).filter_by(code=row['code']).first()
                if not exists:
                    comp = BNCCCompetency(
                        # id=int(row['id']), # Deixar o DB auto-incrementar para evitar conflitos se rodar múltiplas vezes
                        code=row['code'],
                        title=row['title'],
                        description=row['description'],
                        area=row['area'],
                        subject_id=int(float(row['subject_id'])) if row.get('subject_id') and row['subject_id'].strip() else None,
                        grade=row.get('grade'),
                        source=row.get('source'),
                        active=row.get('active') == 'True'
                    )
                    db.add(comp)
                    count += 1
        db.commit()
        print(f"{count} competências adicionadas.")
    
    # Load Skills
    skill_file = os.path.join(csv_dir, "curriculum_skills.csv")
    if os.path.exists(skill_file):
        print("Populando Habilidades...")
        with open(skill_file, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                exists = db.query(BNCCSkill).filter_by(code=row['code']).first()
                if not exists:
                    skill = BNCCSkill(
                        code=row['code'],
                        title=row.get('title') if row.get('title') else None,
                        description=row['description'],
                        area=row['area'],
                        subject_id=int(float(row['subject_id'])) if row.get('subject_id') and row['subject_id'].strip() else None,
                        grade=row.get('grade'),
                        difficulty=row.get('difficulty'),
                        tags=row.get('tags'),
                        source=row.get('source'),
                        active=row.get('active') == 'True'
                    )
                    db.add(skill)
                    count += 1
        db.commit()
        print(f"{count} habilidades adicionadas.")
        
    # Load Mapping (Skill <-> Competency)
    # Nota: Como os IDs originais dos CSVs podem mudar no banco (auto-incremento), 
    # o ideal seria mapear por CODE, mas o curriculum_skill_competencies.csv usa IDs.
    # Se os IDs forem preservados, funciona. Vamos tentar preservar IDs para o mapeamento simplificado.
    
    db.close()

if __name__ == "__main__":
    seed_bncc()
