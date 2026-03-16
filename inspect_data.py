
import openpyxl
import json
import os

def inspect_xlsx(filepath):
    print(f"Inspecting: {filepath}")
    try:
        wb = openpyxl.load_workbook(filepath, data_only=True)
        sheet = wb.active
        rows = list(sheet.iter_rows(values_only=True))
        
        if not rows:
            print("Empty sheet")
            return
            
        headers = rows[0]
        data = rows[1:6] # first 5 rows
        
        print(f"Headers: {headers}")
        print(f"Row count: {len(rows)}")
        print("First few rows:")
        for i, row in enumerate(data):
            print(f"Row {i+1}: {row}")
        print("-" * 50)
    except Exception as e:
        print(f"Error: {e}")

data_dir = r"c:\projetos\LERPROVA\data"
files = ["planejamento_anual.xlsx", "plano_atividade_docente.xlsx"]

for f in files:
    inspect_xlsx(os.path.join(data_dir, f))
