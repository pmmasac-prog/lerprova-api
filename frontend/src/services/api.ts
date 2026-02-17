const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const api = {
    // Autenticação
    async login(email: string, password: string) {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        return response.json();
    },

    // Turmas
    async getTurmas() {
        const response = await fetch(`${API_URL}/turmas`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async addTurma(data: any) {
        const response = await fetch(`${API_URL}/turmas`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return response.json();
    },

    async deleteTurma(id: number) {
        const response = await fetch(`${API_URL}/turmas/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return response.json();
    },

    // Alunos
    async getAlunos() {
        const response = await fetch(`${API_URL}/alunos`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async getAlunosByTurma(turmaId: number) {
        const response = await fetch(`${API_URL}/alunos/turma/${turmaId}`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    // Gabaritos
    async getGabaritos() {
        const response = await fetch(`${API_URL}/gabaritos`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    // Resultados
    async getResultados() {
        const response = await fetch(`${API_URL}/resultados`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async getResultadosByTurma(turmaId: number) {
        const response = await fetch(`${API_URL}/resultados/turma/${turmaId}`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async getResultadosByGabarito(gabaritoId: number) {
        const response = await fetch(`${API_URL}/resultados/gabarito/${gabaritoId}`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async getResultadosAlunoTurma(turmaId: number, alunoId: number) {
        const response = await fetch(`${API_URL}/resultados/turma/${turmaId}/aluno/${alunoId}`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async addResultadoManual(data: { aluno_id: number, gabarito_id: number, respostas_aluno?: string[], nota?: number }) {
        const response = await fetch(`${API_URL}/resultados`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return response.json();
    },

    async updateResultado(id: number, data: { respostas_aluno?: string[], nota?: number }) {
        const response = await fetch(`${API_URL}/resultados/${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return response.json();
    },

    async deleteResultado(id: number) {
        const response = await fetch(`${API_URL}/resultados/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return response.json();
    },

    // Estatísticas
    async getStats() {
        const response = await fetch(`${API_URL}/stats`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async getStatsByTurma(turmaId: number) {
        const response = await fetch(`${API_URL}/stats/turma/${turmaId}`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    // Alunos - adicionar
    async addAluno(data: any) {
        const response = await fetch(`${API_URL}/alunos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return response.json();
    },

    async deleteAluno(id: number) {
        const response = await fetch(`${API_URL}/alunos/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async unlinkAlunoFromTurma(turmaId: number, alunoId: number) {
        const response = await fetch(`${API_URL}/turmas/${turmaId}/alunos/${alunoId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return response.json();
    },

    // Gabaritos - adicionar
    async addGabarito(data: any) {
        const response = await fetch(`${API_URL}/gabaritos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return response.json();
    },

    async deleteGabarito(id: number) {
        const response = await fetch(`${API_URL}/gabaritos/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async updateGabarito(id: number, data: any) {
        const response = await fetch(`${API_URL}/gabaritos/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return response.json();
    },

    async getDisciplinas() {
        const response = await fetch(`${API_URL}/disciplinas`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    // Frequência
    async saveFrequencia(data: any) {
        const response = await fetch(`${API_URL}/frequencia`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return response.json();
    },

    async getFrequenciaTurma(turmaId: number) {
        const response = await fetch(`${API_URL}/frequencia/turma/${turmaId}`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async getFrequenciaAluno(alunoId: number) {
        const response = await fetch(`${API_URL}/frequencia/aluno/${alunoId}`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async getFrequenciaAlunoTurma(turmaId: number, alunoId: number) {
        const response = await fetch(`${API_URL}/frequencia/turma/${turmaId}/aluno/${alunoId}`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async getFrequenciaDates(turmaId: number) {
        const response = await fetch(`${API_URL}/frequencia/turma/${turmaId}/dates`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    // OMR Engine
    async processarProva(data: { image: string, num_questions?: number, gabarito_id?: number, aluno_id?: number }) {
        const response = await fetch(`${API_URL}/provas/processar`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return response.json();
    },
    // Admin Endpoints
    admin: {
        listUsers: async () => {
            const res = await fetch(`${API_URL}/admin/users`, {
                headers: getAuthHeaders()
            });
            return res.json();
        },
        getTurma: async (id: number) => {
            const response = await fetch(`${API_URL}/turmas/${id}`, {
                headers: getAuthHeaders()
            });
            return response.json();
        },
        getAlunosTurma: async (turmaId: number) => {
            const response = await fetch(`${API_URL}/alunos?turma_id=${turmaId}`, {
                headers: getAuthHeaders()
            });
            return response.json();
        },
        createUser: async (userData: any) => {
            const res = await fetch(`${API_URL}/admin/users`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(userData)
            });
            return res.json();
        },
        deleteUser: async (userId: number) => {
            const res = await fetch(`${API_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            return res.json();
        }
    },

    // Planejamento (Sequências Didáticas)
    async getPlanosturma(turmaId: number) {
        if (!turmaId || isNaN(turmaId)) {
            console.warn('api.getPlanosturma: ID inválido', turmaId);
            return [];
        }
        const response = await fetch(`${API_URL}/planos/turma/${turmaId}`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async createPlano(data: { turma_id: number, titulo: string, disciplina?: string, data_inicio: string, aulas: any[], intervalo_dias?: number }) {
        const response = await fetch(`${API_URL}/planos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return response.json();
    },

    async getAulaHoje(planoId: number) {
        if (!planoId || isNaN(planoId)) return { message: 'ID inválido' };
        const response = await fetch(`${API_URL}/planos/${planoId}/hoje`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async concluirAula(aulaId: number, data: { percepcoes?: string[], observacoes?: string | null }) {
        const response = await fetch(`${API_URL}/planos/aulas/${aulaId}/concluir`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return response.json();
    },

    async inserirReforco(aulaId: number) {
        const response = await fetch(`${API_URL}/planos/aulas/${aulaId}/inserir-reforco`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async getHeatmap(turmaId: number) {
        const response = await fetch(`${API_URL}/analytics/turma/${turmaId}/heatmap`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async getPlanoAulas(planoId: number) {
        const response = await fetch(`${API_URL}/planos/${planoId}/aulas`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    // Currículo Base
    async getCurriculoSubjects() {
        const response = await fetch(`${API_URL}/curriculo/subjects`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async getCurriculoUnits(subjectId: number) {
        const response = await fetch(`${API_URL}/curriculo/subjects/${subjectId}/units`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async getCurriculoTopics(unitId: number) {
        const response = await fetch(`${API_URL}/curriculo/units/${unitId}/topics`, {
            headers: getAuthHeaders()
        });
        return response.json();
    }
};
