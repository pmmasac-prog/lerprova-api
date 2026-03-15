import os

file_path = r'c:\projetos\LERPROVA\frontend\src\pages\TurmaDetail.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Insert handleWipeTurma
function_marker = 'const handleUpdateTurma = async () => {'
if function_marker in content and 'const handleWipeTurma' not in content:
    # Find the end of handleUpdateTurma
    start_pos = content.find(function_marker)
    # Track braces to find the end
    brace_count = 0
    end_pos = -1
    for i in range(start_pos, len(content)):
        if content[i] == '{':
            brace_count += 1
        elif content[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                end_pos = i + 1
                break
    
    if end_pos != -1:
        new_func = """

    const handleWipeTurma = async () => {
        if (!id) return;
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const isAdmin = currentUser.role === 'admin';
        if (!isAdmin) {
            alert('Apenas administradores podem realizar esta ação.');
            return;
        }
        const confirm1 = confirm(`AVISO CRÍTICO: Você está prestes a excluir a turma "${turma?.nome}" E TODOS OS SEUS ${alunos.length} ALUNOS permanentemente.`);
        if (!confirm1) return;
        const confirm2 = confirm("ESTA AÇÃO NÃO PODE SER DESFEITA. Todos os resultados de provas, frequências e dados dos alunos serão APAGADOS PARA SEMPRE. Tem certeza absoluta?");
        if (!confirm2) return;
        try {
            setLoading(true);
            await api.wipeTurma(parseInt(id));
            alert('Turma e alunos excluídos com sucesso.');
            navigate('/dashboard/turmas');
        } catch (error) {
            console.error('Erro ao realizar WIPE:', error);
            alert('Erro ao excluir turma e alunos.');
        } finally {
            setLoading(false);
        }
    };"""
        content = content[:end_pos] + new_func + content[end_pos:]
        print("Inserted handleWipeTurma")

# 2. Insert Button
button_marker = '<span>Aluno+</span>'
if button_marker in content and 'Apagar Tudo' not in content:
    pos = content.find(button_marker)
    # Find the closing tag of the button
    end_button_pos = content.find('</button>', pos) + 9
    
    new_button = """
                    {JSON.parse(localStorage.getItem('user') || '{}').role === 'admin' && (
                        <button className="action-btn danger" onClick={handleWipeTurma} title="Apagar Turma e Alunos de uma vez">
                            <Trash2 size={16} />
                            <span>Apagar Tudo</span>
                        </button>
                    )}"""
    content = content[:end_button_pos] + new_button + content[end_button_pos:]
    print("Inserted Wipe Button")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
