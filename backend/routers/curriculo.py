from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import csv
import os
from pydantic import BaseModel
from database import SessionLocal
from models import BNCCSkill, BNCCCompetency

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

class CurriculumMethodology(CurriculoBase):
    description: Optional[str] = None
    modality: Optional[str] = None

class CurriculumResource(CurriculoBase):
    type: Optional[str] = None
    url: Optional[str] = None

class BNCCSkillSchema(BaseModel):
    id: int
    code: str
    description: str
    area: Optional[str] = None
    grade: Optional[str] = None

    class Config:
        from_attributes = True

class BNCCCompetencySchema(BaseModel):
    id: int
    code: str
    title: str
    description: str

    class Config:
        from_attributes = True

class CurriculumSuggestions(BaseModel):
    methodologies: List[CurriculumMethodology]
    resources: List[CurriculumResource]

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

@router.get("/methodologies", response_model=List[CurriculumMethodology])
async def get_methodologies():
    data = load_csv("curriculum_methodologies.csv")
    return [CurriculumMethodology(id=int(row['id']), name=row['name'], description=row.get('description'), modality=row.get('modality')) for row in data if row.get('active') != 'False']

@router.get("/resources", response_model=List[CurriculumResource])
async def get_resources():
    data = load_csv("curriculum_resources.csv")
    return [CurriculumResource(id=int(row['id']), name=row['name'], type=row.get('type'), url=row.get('url')) for row in data if row.get('active') != 'False']

@router.get("/topics/{topic_id}/suggestions", response_model=CurriculumSuggestions)
async def get_suggestions(topic_id: int):
    # Load suggestion maps
    mapping_m = load_csv("curriculum_topic_methodologies.csv")
    mapping_r = load_csv("curriculum_topic_resources.csv")
    
    # Load base data
    meths = load_csv("curriculum_methodologies.csv")
    res = load_csv("curriculum_resources.csv")
    
    # Filter IDs for this topic
    m_ids = [int(row['methodology_id']) for row in mapping_m if int(row['topic_id']) == topic_id]
    r_ids = [int(row['resource_id']) for row in mapping_r if int(row['topic_id']) == topic_id]
    
    # Map to objects
    suggested_meths = [
        CurriculumMethodology(id=int(row['id']), name=row['name'], description=row.get('description'), modality=row.get('modality')) 
        for row in meths if int(row['id']) in m_ids
    ]
    suggested_res = [
        CurriculumResource(id=int(row['id']), name=row['name'], type=row.get('type'), url=row.get('url')) 
        for row in res if int(row['id']) in r_ids
    ]
    
    return CurriculumSuggestions(methodologies=suggested_meths, resources=suggested_res)

@router.get("/bncc/skills", response_model=List[BNCCSkillSchema])
async def search_skills(q: Optional[str] = None, subject_id: Optional[int] = None, grade: Optional[str] = None):
    db = SessionLocal()
    query = db.query(BNCCSkill)
    if q:
        query = query.filter(BNCCSkill.description.ilike(f"%{q}%") | BNCCSkill.code.ilike(f"%{q}%"))
    if subject_id:
        query = query.filter(BNCCSkill.subject_id == subject_id)
    if grade:
        query = query.filter(BNCCSkill.grade == grade)
    
    skills = query.limit(50).all()
    db.close()
    return skills

@router.get("/bncc/competencies", response_model=List[BNCCCompetencySchema])
async def get_competencies():
    db = SessionLocal()
    comps = db.query(BNCCCompetency).all()
    db.close()
    return comps
