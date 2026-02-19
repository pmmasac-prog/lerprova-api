
from database import SessionLocal
from models import BNCCSkill
from sqlalchemy import func

db = SessionLocal()
areas = db.query(BNCCSkill.area, func.count(BNCCSkill.id)).group_by(BNCCSkill.area).all()
print("Areas in DB:")
for area, count in areas:
    print(f" - {area}: {count}")

codes_sample = db.query(BNCCSkill.code).limit(10).all()
print("Sample codes:")
for code in codes_sample:
    print(f" - {code[0]}")

db.close()
