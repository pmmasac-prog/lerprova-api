const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = {
    // Autenticação
    async login(email: string, password: string) {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha: password }),
        });
        return response.json();
    },

    // Turmas
    async getTurmas() {
        const response = await fetch(`${API_URL}/turmas`);
        return response.json();
    },

    async addTurma(data: any) {
        const response = await fetch(`${API_URL}/turmas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return response.json();
    },

    async deleteTurma(id: number) {
        const response = await fetch(`${API_URL}/turmas/${id}`, {
            method: 'DELETE',
        });
        return response.json();
    },

    // Alunos
    async getAlunos() {
        const response = await fetch(`${API_URL}/alunos`);
        return response.json();
    },

    async getAlunosByTurma(turmaId: number) {
        const response = await fetch(`${API_URL}/alunos/turma/${turmaId}`);
        return response.json();
    },

    // Gabaritos
    async getGabaritos() {
        const response = await fetch(`${API_URL}/gabaritos`);
        return response.json();
    },

    // Resultados
    async getResultados() {
        const response = await fetch(`${API_URL}/resultados`);
        return response.json();
    },

    async getResultadosByTurma(turmaId: number) {
        const response = await fetch(`${API_URL}/resultados/turma/${turmaId}`);
        return response.json();
    },

    async getResultadosByGabarito(gabaritoId: number) {
        const response = await fetch(`${API_URL}/resultados/gabarito/${gabaritoId}`);
        return response.json();
    },

    // Estatísticas
    async getStats() {
        const response = await fetch(`${API_URL}/stats`);
        return response.json();
    },

    async getStatsByTurma(turmaId: number) {
        const response = await fetch(`${API_URL}/stats/turma/${turmaId}`);
        return response.json();
    },

    // Alunos - adicionar
    async addAluno(data: any) {
        const response = await fetch(`${API_URL}/alunos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return response.json();
    },

    async deleteAluno(id: number) {
        const response = await fetch(`${API_URL}/alunos/${id}`, {
            method: 'DELETE',
        });
        return response.json();
    },

    // Gabaritos - adicionar
    async addGabarito(data: any) {
        const response = await fetch(`${API_URL}/gabaritos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return response.json();
    },

    async deleteGabarito(id: number) {
        const response = await fetch(`${API_URL}/gabaritos/${id}`, {
            method: 'DELETE',
        });
        return response.json();
    },

    async updateGabarito(id: number, data: any) {
        const response = await fetch(`${API_URL}/gabaritos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return response.json();
    },

    async getDisciplinas() {
        const response = await fetch(`${API_URL}/disciplinas`);
        return response.json();
    },

    // Frequência
    async saveFrequencia(data: any) {
        const response = await fetch(`${API_URL}/frequencia`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return response.json();
    },

    async getFrequenciaTurma(turmaId: number) {
        const response = await fetch(`${API_URL}/frequencia/turma/${turmaId}`);
        return response.json();
    },

    async getFrequenciaAluno(alunoId: number) {
        const response = await fetch(`${API_URL}/frequencia/aluno/${alunoId}`);
        return response.json();
    },

    async getFrequenciaDates(turmaId: number) {
        const response = await fetch(`${API_URL}/frequencia/turma/${turmaId}/dates`);
        return response.json();
    },

    // OMR Engine
    async processarProva(data: { image: string, num_questions?: number, gabarito_id?: number, aluno_id?: number }) {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/provas/processar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data),
        });
        return response.json();
    },
};
