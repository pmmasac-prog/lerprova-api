from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import csv
import os
from pydantic import BaseModel

router = APIRouter(prefix="/curriculo", tags=["curriculo"])

CURRICULUM_DIR = "curriculo_em_base"

class CurriculoBase(BaseModel):
    id: int
    name: str

class CurriculumSubject(CurriculoBase):
    code: str
    area: str

class CurriculumUnit(CurriculoBase):
    subject_id: int
    grade: str
    title: str

class CurriculumTopic(CurriculoBase):
    unit_id: int
    order_index: int
    title: str
    default_lessons: int

def load_csv(filename):
    path = os.path.join(CURRICULUM_DIR, filename)
    if not os.path.exists(path):
        return []
    with open(path, mode='r', encoding='utf-8') as f:
        return list(csv.DictReader(f))

@router.get("/subjects", response_model=List[CurriculumSubject])
async def get_subjects():
    data = load_csv("curriculum_subjects.csv")
    return [CurriculumSubject(id=int(row['id']), code=row['code'], name=row['name'], area=row['area']) for row in data]

@router.get("/subjects/{subject_id}/units", response_model=List[CurriculumUnit])
async def get_units(subject_id: int):
    data = load_csv("curriculum_units.csv")
    units = [row for row in data if int(row['subject_id']) == subject_id]
    return [CurriculumUnit(id=int(row['id']), subject_id=int(row['subject_id']), grade=row['grade'], name=row['title'], title=row['title']) for row in units]

@router.get("/units/{unit_id}/topics", response_model=List[CurriculumTopic])
async def get_topics(unit_id: int):
    data = load_csv("curriculum_topics.csv")
    topics = [row for row in data if int(row['unit_id']) == unit_id]
    return [CurriculumTopic(id=int(row['id']), unit_id=int(row['unit_id']), order_index=int(row['order_index']), name=row['title'], title=row['title'], default_lessons=int(row['default_lessons'])) for row in topics]
