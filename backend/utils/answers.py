"""
Utilitário central para normalizar respostas de gabarito e aluno.
Garante que respostas_corretas e respostas_aluno sejam sempre JSON-lista.
"""
import json
from fastapi import HTTPException


def parse_json_list(value, field_name="value"):
    """
    Converte qualquer formato de respostas em uma lista Python normalizada.
    Aceita: list, JSON string, CSV string, string simples, None.
    """
    if value is None:
        return []
    if isinstance(value, list):
        return [str(x).strip() if x is not None else None for x in value]
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return []
        # Tenta JSON
        if s.startswith("["):
            try:
                arr = json.loads(s)
                if isinstance(arr, list):
                    return [str(x).strip() if x is not None else None for x in arr]
            except json.JSONDecodeError:
                pass
        # Fallback CSV
        if "," in s:
            return [x.strip() for x in s.split(",")]
        return [s]
    raise HTTPException(status_code=422, detail=f"{field_name} inválido (esperado lista/string)")


def dump_json_list(arr):
    """Serializa lista para JSON string."""
    return json.dumps(arr, ensure_ascii=False)
