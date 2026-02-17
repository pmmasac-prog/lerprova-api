from sqlalchemy import create_engine, inspect
import os
from database import DATABASE_URL

def check():
    print(f"Checking DB: {DATABASE_URL}")
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    
    tables = inspector.get_table_names()
    print(f"Tables: {tables}")
    
    for table in tables:
        columns = [c['name'] for c in inspector.get_columns(table)]
        print(f"Table {table}: {columns}")

if __name__ == "__main__":
    check()
