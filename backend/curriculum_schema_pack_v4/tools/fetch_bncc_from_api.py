#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_bncc_from_api.py

Baixa BNCC Ensino Médio (habilidades) e Competências (gerais + específicas)
a partir da API da Cientificar1992 e gera CSVs compatíveis com o schema do pacote.

Requisitos:
  pip install requests pandas

Uso típico (na raiz do pacote):
  python tools/fetch_bncc_from_api.py --out initdb/csv

Depois:
  docker compose down -v
  docker compose up -d

Obs:
- O mapeamento subject_id tenta casar pelo nome existente em curriculum_subjects.csv.
- Você pode ajustar aliases no dicionário SUBJECT_ALIASES.
"""

import argparse
import re
from pathlib import Path
import pandas as pd
import requests

API_BASE = "https://cientificar1992.pythonanywhere.com"

SUBJECT_ALIASES = {
    "língua portuguesa": ["língua portuguesa", "português", "portugues", "lingua portuguesa"],
    "matemática": ["matemática", "matematica"],
    "ciências da natureza": ["ciências da natureza", "ciencias da natureza", "química", "quimica", "física", "fisica", "biologia"],
    "ciências humanas": ["ciências humanas", "ciencias humanas", "história", "historia", "geografia", "sociologia", "filosofia"],
    "linguagens": ["linguagens", "linguagens e suas tecnologias"],
    "computação": ["computação", "computacao"],
}

def norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"\s+", " ", s)
    s = s.replace("–", "-")
    return s

def load_subject_map(csv_path: Path):
    df = pd.read_csv(csv_path)
    m = {}
    for _, r in df.iterrows():
        m[norm(str(r.get("name", "")))] = int(r["id"])
    return m

def best_subject_id(subject_map, target_name):
    tn = norm(target_name)
    if tn in subject_map:
        return subject_map[tn]
    for key, names in SUBJECT_ALIASES.items():
        if tn == norm(key):
            for n in names:
                nid = subject_map.get(norm(n))
                if nid:
                    return nid
    for k, vid in subject_map.items():
        if tn in k or k in tn:
            return vid
    return None

def get_json(path: str):
    url = f"{API_BASE}{path}"
    r = requests.get(url, timeout=90)
    r.raise_for_status()
    return r.json()

def build_skills(subject_map):
    data = get_json("/bncc_medio/?format=json")
    rows = []
    next_id = 1
    for disc_key, disc_payload in data.items():
        disc_name = disc_payload.get("nome_disciplina") or disc_key
        subject_id = best_subject_id(subject_map, disc_name)
        area = disc_name
        anos = disc_payload.get("ano") or []
        for bloco in anos:
            habilidades = bloco.get("codigo_habilidade") or []
            for h in habilidades:
                code = h.get("nome_codigo")
                desc = h.get("nome_habilidade")
                if not code or not desc:
                    continue
                rows.append({
                    "id": next_id,
                    "code": code,
                    "title": None,
                    "description": str(desc).strip(),
                    "area": area,
                    "subject_id": subject_id,
                    "grade": "EM",
                    "difficulty": None,
                    "tags": disc_key,
                    "source": "cientificar1992_api",
                    "active": True,
                })
                next_id += 1
    return pd.DataFrame(rows)

def build_competencies(subject_map):
    data = get_json("/bncc_competencias/?format=json")
    rows = []
    next_id = 1

    cg_list = (data.get("comp_gerais", {}) or {}).get("competencias") or []
    for i, desc in enumerate(cg_list, start=1):
        rows.append({
            "id": next_id,
            "code": f"CG{i:02d}",
            "title": "Competências Gerais",
            "description": str(desc).strip(),
            "area": "Geral",
            "subject_id": None,
            "grade": None,
            "source": "cientificar1992_api",
            "active": True,
        })
        next_id += 1

    def walk(node, path_keys):
        nonlocal next_id
        if isinstance(node, dict):
            if "nome_competencia" in node and "competencias" in node and isinstance(node["competencias"], list):
                nome = str(node.get("nome_competencia") or "").strip()
                comp_list = node["competencias"]
                subject_id = best_subject_id(subject_map, nome)
                for j, desc in enumerate(comp_list, start=1):
                    code = f"CE_{'_'.join(path_keys[-2:])}_{j:02d}".upper()
                    rows.append({
                        "id": next_id,
                        "code": code,
                        "title": nome,
                        "description": str(desc).strip(),
                        "area": nome,
                        "subject_id": subject_id,
                        "grade": None,
                        "source": "cientificar1992_api",
                        "active": True,
                    })
                    next_id += 1
            for k, v in node.items():
                walk(v, path_keys + [str(k)])
        elif isinstance(node, list):
            for idx, it in enumerate(node):
                walk(it, path_keys + [str(idx)])

    walk(data, ["root"])
    return pd.DataFrame(rows).drop_duplicates(subset=["code"])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="initdb/csv", help="pasta destino dos CSVs (ex.: initdb/csv)")
    ap.add_argument("--subjects", default="initdb/csv/curriculum_subjects.csv", help="CSV base de subjects")
    args = ap.parse_args()

    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    subject_map = load_subject_map(Path(args.subjects).resolve())

    skills_df = build_skills(subject_map)
    comp_df = build_competencies(subject_map)

    skills_df.to_csv(out_dir / "curriculum_skills.csv", index=False)
    comp_df.to_csv(out_dir / "curriculum_competencies.csv", index=False)

    # vínculos opcionais (sem mapeamento real no EM)
    (out_dir / "curriculum_topic_skills.csv").write_text("topic_id,skill_id,priority,note\n", encoding="utf-8")
    (out_dir / "curriculum_skill_competencies.csv").write_text("skill_id,competency_id\n", encoding="utf-8")

    print("OK: CSVs gerados em:", out_dir)
    print("skills:", len(skills_df), "| competencies:", len(comp_df))

if __name__ == "__main__":
    main()
