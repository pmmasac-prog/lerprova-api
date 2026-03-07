"""
Seed de Dados Demonstrativos para LERPROVA
Cria alunos, gabaritos, resultados e frequência realistas
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import (
    User, Turma, Aluno, Gabarito, Resultado, Frequencia,
    aluno_turma, gabarito_turma, pwd_context
)
import random
import uuid
from datetime import datetime, timedelta

DEMO_ALUNOS = [
    {"nome": "Ana Beatriz Silva", "codigo": "2026001"},
    {"nome": "Carlos Eduardo Santos", "codigo": "2026002"},
    {"nome": "Daniela Ferreira Lima", "codigo": "2026003"},
    {"nome": "Felipe Augusto Rocha", "codigo": "2026004"},
    {"nome": "Gabriela Martins Costa", "codigo": "2026005"},
    {"nome": "Hugo Leonardo Alves", "codigo": "2026006"},
    {"nome": "Isabela Rodrigues Souza", "codigo": "2026007"},
    {"nome": "João Pedro Oliveira", "codigo": "2026008"},
    {"nome": "Larissa Campos Nunes", "codigo": "2026009"},
    {"nome": "Matheus Henrique Dias", "codigo": "2026010"},
]

DEMO_GABARITOS = [
    {
        "titulo": "Diagnóstica Inicial - Matemática",
        "assunto": "Números e Operações",
        "disciplina": "Matemática",
        "data_prova": "2026-03-10",
        "num_questoes": 10,
        "respostas_corretas": ["A", "C", "B", "D", "A", "B", "C", "A", "D", "B"],
        "periodo": 1,
    },
    {
        "titulo": "Avaliação Bimestral 1 - Português",
        "assunto": "Interpretação de Texto",
        "disciplina": "Português",
        "data_prova": "2026-04-15",
        "num_questoes": 10,
        "respostas_corretas": ["B", "A", "D", "C", "B", "A", "C", "D", "A", "B"],
        "periodo": 1,
    },
    {
        "titulo": "Avaliação Bimestral 2 - Matemática",
        "assunto": "Geometria e Medidas",
        "disciplina": "Matemática",
        "data_prova": "2026-07-01",
        "num_questoes": 10,
        "respostas_corretas": ["C", "B", "A", "D", "C", "B", "A", "D", "C", "A"],
        "periodo": 2,
    },
]

OPTIONS = ["A", "B", "C", "D"]


def generate_student_answers(correct: list[str], skill_level: float) -> list[str]:
    """Gera respostas de aluno baseado em nível de habilidade (0.0-1.0)"""
    answers = []
    for c in correct:
        if random.random() < skill_level:
            answers.append(c)
        else:
            wrong = [o for o in OPTIONS if o != c]
            answers.append(random.choice(wrong))
    return answers


def seed_demo():
    db = SessionLocal()
    try:
        # Verificar se já existe dados demo
        existing = db.query(Aluno).filter(Aluno.codigo == "2026001").first()
        if existing:
            print("✅ Dados demo já existem. Pulando seed.")
            return

        # Buscar professor/user existente
        user = db.query(User).first()
        if not user:
            print("❌ Nenhum usuário encontrado. Execute init_complete_system primeiro.")
            return

        # Buscar ou criar turma
        turma = db.query(Turma).filter(Turma.user_id == user.id).first()
        if not turma:
            turma = Turma(
                nome="5º Ano A - Manhã",
                disciplina="Multidisciplinar",
                user_id=user.id,
                dias_semana=[1, 2, 3, 4, 5],
                quantidade_aulas=5,
            )
            db.add(turma)
            db.flush()
            print(f"  📚 Turma criada: {turma.nome} (id={turma.id})")
        else:
            print(f"  📚 Turma existente: {turma.nome} (id={turma.id})")

        # Criar alunos
        alunos = []
        for a_data in DEMO_ALUNOS:
            aluno = Aluno(
                nome=a_data["nome"],
                codigo=a_data["codigo"],
                qr_token=str(uuid.uuid4()),
                hashed_password=pwd_context.hash("aluno123"),
            )
            db.add(aluno)
            db.flush()
            # Vincular aluno à turma via M2M
            db.execute(aluno_turma.insert().values(aluno_id=aluno.id, turma_id=turma.id))
            alunos.append(aluno)

        print(f"  👥 {len(alunos)} alunos criados e vinculados à turma")

        # Criar gabaritos
        gabaritos = []
        for g_data in DEMO_GABARITOS:
            gab = Gabarito(**g_data)
            db.add(gab)
            db.flush()
            # Vincular gabarito à turma via M2M
            db.execute(gabarito_turma.insert().values(gabarito_id=gab.id, turma_id=turma.id))
            gabaritos.append(gab)

        print(f"  📝 {len(gabaritos)} gabaritos criados e vinculados")

        # Criar resultados (cada aluno fez cada prova)
        skill_levels = [random.uniform(0.4, 0.95) for _ in alunos]
        total_resultados = 0
        for gab in gabaritos:
            for i, aluno in enumerate(alunos):
                respostas = generate_student_answers(gab.respostas_corretas, skill_levels[i])
                acertos = sum(1 for r, c in zip(respostas, gab.respostas_corretas) if r == c)
                nota = round((acertos / gab.num_questoes) * 10, 1)

                resultado = Resultado(
                    aluno_id=aluno.id,
                    gabarito_id=gab.id,
                    acertos=acertos,
                    nota=nota,
                    respostas_aluno=respostas,
                    data_correcao=datetime.strptime(gab.data_prova, "%Y-%m-%d"),
                    avg_confidence=round(random.uniform(0.85, 0.99), 2),
                    layout_version="v1.1",
                    anchors_found=4,
                    review_status="confirmed",
                )
                db.add(resultado)
                total_resultados += 1

        print(f"  📊 {total_resultados} resultados gerados")

        # Criar frequência (dias letivos de fevereiro a julho 2026)
        total_freq = 0
        start = datetime(2026, 2, 9)
        end = datetime(2026, 7, 31)
        current = start
        while current <= end:
            # Pular fins de semana
            if current.weekday() < 5:
                for i, aluno in enumerate(alunos):
                    # Taxa de presença varia por aluno (75-98%)
                    presence_rate = 0.75 + skill_levels[i] * 0.23
                    presente = random.random() < presence_rate
                    freq = Frequencia(
                        turma_id=turma.id,
                        aluno_id=aluno.id,
                        data=current.strftime("%Y-%m-%d"),
                        presente=presente,
                    )
                    db.add(freq)
                    total_freq += 1
            current += timedelta(days=1)

        print(f"  📅 {total_freq} registros de frequência gerados")

        db.commit()
        print("\n✅ SEED DEMO COMPLETO!")
        print(f"   Turma: {turma.nome}")
        print(f"   Alunos: {len(alunos)}")
        print(f"   Gabaritos: {len(gabaritos)}")
        print(f"   Resultados: {total_resultados}")
        print(f"   Frequência: {total_freq}")

    except Exception as e:
        db.rollback()
        print(f"❌ Erro no seed demo: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
