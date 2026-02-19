# Curriculum Schema Pack v3 (PostgreSQL) + base real + listas clicáveis (metodologias/recursos)

Este pacote já deixa o app **100% clicável** em metodologias e recursos, sem digitação.

## Já vem preenchido
- `curriculum_subjects.csv`, `curriculum_units.csv`, `curriculum_topics.csv` (sua base real)
- `curriculum_methodologies.csv` (lista grande)
- `curriculum_resources.csv` (lista grande)
- `curriculum_topic_methodologies.csv` e `curriculum_topic_resources.csv` (sugestões automáticas por tópico)

## Ainda falta para ficar “BNCC completo”
- `curriculum_competencies.csv` e `curriculum_skills.csv` (estão vazios, prontos para importar)
- Para eu entregar **“Português completo: todas as competências + todas as habilidades”** com garantia de ser real,
  preciso que você **envie a planilha/CSV oficial** que você quer usar como referência (BNCC MEC ou currículo do seu estado).

## BNCC completo (competências + habilidades) via API (sem digitação)
Este pacote inclui `tools/fetch_bncc_from_api.py` para baixar e gerar automaticamente:

- `initdb/csv/curriculum_competencies.csv`
- `initdb/csv/curriculum_skills.csv`

Passo-a-passo:
1) `pip install requests pandas`
2) `python tools/fetch_bncc_from_api.py --out initdb/csv`
3) `docker compose down -v`
4) `docker compose up -d`

Observação:
- No Ensino Médio, a API entrega **ano + habilidades**, sem “unidades temáticas/objetos do conhecimento”.
  Por isso, o script **não inventa** vínculo tópico→habilidade: ele cria os CSVs de vínculo vazios (só header).
