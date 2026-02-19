
from database import SessionLocal
from models import BNCCSkill

db = SessionLocal()
count = db.query(BNCCSkill).count()
print(f"Total BNCC Skills: {count}")

skills = db.query(BNCCSkill).limit(5).all()
for s in skills:
    print(f"[{s.code}] {s.description[:50]}...")

search_q = "EM13"
results = db.query(BNCCSkill).filter(BNCCSkill.description.ilike(f"%{search_q}%") | BNCCSkill.code.ilike(f"%{search_q}%")).limit(5).all()
print(f"Search results for '{search_q}': {len(results)}")
for r in results:
    print(f" - [{r.code}] {r.description[:50]}")

db.close()
