from database import SessionLocal

def limpar_frequencias():
    db = SessionLocal()
    from sqlalchemy import text
    try:
        db.execute(text('DELETE FROM frequencia'))
        db.commit()
        print('Todos os dados de frequência foram apagados.')
    finally:
        db.close()

if __name__ == "__main__":
    limpar_frequencias()
