"""
Router para expor dados de calendário e eventos
Disponível para todos os usuários autenticados
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Event, Period, AcademicYear, School
from dependencies import get_current_user
from typing import List

router = APIRouter(
    prefix="/calendar",
    tags=["calendar"],
    dependencies=[Depends(get_current_user)]  # Requer autenticação
)


@router.get("/events")
async def list_events(db: Session = Depends(get_db)):
    """
    Lista todos os eventos do calendário escolar
    Retorna eventos com informações completas
    """
    try:
        events = db.query(Event).order_by(Event.start_date).all()
        
        return {
            "success": True,
            "count": len(events),
            "data": [
                {
                    "id": e.id,
                    "title": e.title,
                    "type": e.event_type_id,
                    "start_date": e.start_date,
                    "end_date": e.end_date,
                    "is_school_day": e.is_school_day,
                    "description": e.description,
                    "academic_year_id": e.academic_year_id,
                } for e in events
            ]
        }
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))


@router.get("/events/{event_type}")
async def list_events_by_type(event_type: str, db: Session = Depends(get_db)):
    """
    Lista eventos filtrados por tipo
    Tipos: holiday, vacation, planning, meeting, planning, assessment, etc.
    """
    try:
        events = db.query(Event)\
            .filter(Event.event_type_id == event_type)\
            .order_by(Event.start_date)\
            .all()
        
        return {
            "success": True,
            "type": event_type,
            "count": len(events),
            "data": [
                {
                    "id": e.id,
                    "title": e.title,
                    "start_date": e.start_date,
                    "end_date": e.end_date,
                    "description": e.description,
                } for e in events
            ]
        }
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))


@router.get("/periods")
async def list_periods(db: Session = Depends(get_db)):
    """
    Lista todos os períodos letivos
    """
    try:
        periods = db.query(Period).order_by(Period.period_number).all()
        
        return {
            "success": True,
            "count": len(periods),
            "data": [
                {
                    "id": p.id,
                    "number": p.period_number,
                    "name": p.period_name,
                    "start_date": p.start_date,
                    "end_date": p.end_date,
                    "status": p.status,
                    "academic_year_id": p.academic_year_id,
                } for p in periods
            ]
        }
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))


@router.get("/academic-years")
async def list_academic_years(db: Session = Depends(get_db)):
    """
    Lista todos os anos letivos configurados
    """
    try:
        years = db.query(AcademicYear).order_by(AcademicYear.year_label.desc()).all()
        
        return {
            "success": True,
            "count": len(years),
            "data": [
                {
                    "id": y.id,
                    "year": y.year_label,
                    "school_id": y.school_id,
                    "start_date": y.start_date,
                    "end_date": y.end_date,
                    "total_school_days": y.total_school_days,
                    "notes": y.notes,
                } for y in years
            ]
        }
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))


@router.get("/schools")
async def list_schools(db: Session = Depends(get_db)):
    """
    Lista todas as escolas configuradas
    """
    try:
        schools = db.query(School).all()
        
        return {
            "success": True,
            "count": len(schools),
            "data": [
                {
                    "id": s.id,
                    "name": s.school_name,
                    "organization": s.organization_name,
                    "active": s.active,
                } for s in schools
            ]
        }
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))


@router.get("/full-calendar")
async def get_full_calendar(db: Session = Depends(get_db)):
    """
    Retorna o calendário completo com todas as informações
    (escolas, anos letivos, períodos e eventos)
    """
    try:
        schools = db.query(School).all()
        academic_years = db.query(AcademicYear).all()
        periods = db.query(Period).all()
        events = db.query(Event).order_by(Event.start_date).all()
        
        return {
            "success": True,
            "calendar": {
                "schools": [
                    {
                        "id": s.id,
                        "name": s.school_name,
                        "organization": s.organization_name,
                    } for s in schools
                ],
                "academic_years": [
                    {
                        "id": y.id,
                        "year": y.year_label,
                        "school_id": y.school_id,
                        "start_date": y.start_date,
                        "end_date": y.end_date,
                    } for y in academic_years
                ],
                "periods": [
                    {
                        "id": p.id,
                        "name": p.period_name,
                        "number": p.period_number,
                        "start_date": p.start_date,
                        "end_date": p.end_date,
                        "academic_year_id": p.academic_year_id,
                    } for p in periods
                ],
                "events": [
                    {
                        "id": e.id,
                        "title": e.title,
                        "type": e.event_type_id,
                        "start_date": e.start_date,
                        "end_date": e.end_date,
                        "is_school_day": e.is_school_day,
                        "description": e.description,
                        "academic_year_id": e.academic_year_id,
                    } for e in events
                ]
            },
            "summary": {
                "schools_count": len(schools),
                "academic_years_count": len(academic_years),
                "periods_count": len(periods),
                "events_count": len(events),
            }
        }
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))
