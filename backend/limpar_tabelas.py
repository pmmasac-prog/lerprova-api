from database import SessionLocal
from sqlalchemy import text

def limpar_todas_tabelas():
    db = SessionLocal()
    try:
        tabelas = [
            'frequencia',
            'acompanhamento_aluno',
            'resultados',
            'gabaritos',
            'registros_aula',
            'planos',
            'aulas_planejadas',
            # Adicione outras tabelas que deseja limpar
        ]
        for tabela in tabelas:
            try:
                db.execute(text(f'DELETE FROM {tabela}'))
            except Exception as e:
                print(f"Erro ao limpar {tabela}: {e}")
        db.commit()
        print('Todas as tabelas principais foram limpas.')
    finally:
        db.close()

if __name__ == "__main__":
    limpar_todas_tabelas()
