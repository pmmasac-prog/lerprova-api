
import openpyxl
import json
import os

def get_xlsx_info(filepath):
    try:
        wb = openpyxl.load_workbook(filepath, data_only=True)
        sheet = wb.active
        rows = list(sheet.iter_rows(values_only=True))
        if not rows: return {"error": "empty"}
        return {
            "headers": [str(h) if h is not None else f"Column_{i}" for i, h in enumerate(rows[0])],
            "sample": [ [str(c) for c in row] for row in rows[1:3]]
        }
    except Exception as e:
        return {"error": str(e)}

data_dir = r"c:\projetos\LERPROVA\data"
info = {
    "planejamento_anual": get_xlsx_info(os.path.join(data_dir, "planejamento_anual.xlsx")),
    "plano_atividade_docente": get_xlsx_info(os.path.join(data_dir, "plano_atividade_docente.xlsx"))
}

with open(r"c:\projetos\LERPROVA\data_info.json", "w", encoding="utf-8") as f:
    json.dump(info, f, indent=4, ensure_ascii=False)
print("Info saved to data_info.json")
