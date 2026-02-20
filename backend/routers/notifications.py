from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models
from database import get_db
from dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/")
async def list_notifications(user = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lista todas as notificações do usuário atual."""
    notifications = db.query(models.Notification).filter(
        models.Notification.user_id == user.id
    ).order_by(models.Notification.created_at.desc()).all()
    
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "type": n.type,
            "is_read": n.is_read,
            "created_at": n.created_at
        } for n in notifications
    ]

@router.patch("/{notification_id}/read")
async def mark_as_read(notification_id: int, user = Depends(get_current_user), db: Session = Depends(get_db)):
    """Marca uma notificação específica como lida."""
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
        
    notification.is_read = True
    db.commit()
    
    return {"status": "success", "message": "Notificação marcada como lida"}

@router.get("/unread/count")
async def get_unread_count(user = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retorna a contagem de notificações não lidas."""
    count = db.query(models.Notification).filter(
        models.Notification.user_id == user.id,
        models.Notification.is_read == False
    ).count()
    
    return {"unread_count": count}
