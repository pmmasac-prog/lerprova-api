const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

const request = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, options);

    // Tenta ler o JSON, mas lida com corpo vazio
    let data;
    const text = await response.text();
    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        data = { error: 'Invalid JSON response' };
    }

    if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
        }
        throw new Error('Sessão expirada. Redirecionando...');
    }

    if (!response.ok) {
        const errorMsg = data.detail || data.error || 'Erro na requisição';
        throw new Error(errorMsg);
    }

    return data;
};

export const api = {
    // Método genérico para requisições customizadas
    async request(endpoint: string, options: RequestInit = {}) {
        const defaultOptions: RequestInit = {
            headers: getAuthHeaders()
        };
        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };
        return request(`${API_URL}${endpoint}`, mergedOptions);
    },

    // Autenticação
    async login(email: string, password: string) {
        return request(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
    },

    // Turmas
    async getTurmas() {
        return request(`${API_URL}/turmas`, {
            headers: getAuthHeaders()
        });
    },

    async addTurma(data: any) {
        return request(`${API_URL}/turmas`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
    },

    async updateTurma(id: number, data: any) {
        return request(`${API_URL}/turmas/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
    },

    async deleteTurma(id: number) {
        return request(`${API_URL}/turmas/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
    },

    async wipeTurma(id: number) {
        return request(`${API_URL}/turmas/${id}/wipe`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
    },

    async getMasterTurmas() {
        return request(`${API_URL}/turmas/master`, {
            headers: getAuthHeaders()
        });
    },

    async incorporateTurma(data: { master_turma_id: number, disciplina: string }) {
        return request(`${API_URL}/turmas/incorporate`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
    },

    // Alunos
    async getAlunos() {
        return request(`${API_URL}/alunos`, {
            headers: getAuthHeaders()
        });
    },

    async getAlunosByTurma(turmaId: number) {
        return request(`${API_URL}/alunos/turma/${turmaId}`, {
            headers: getAuthHeaders()
        });
    },

    // Gabaritos
    async getGabaritos() {
        return request(`${API_URL}/gabaritos`, {
            headers: getAuthHeaders()
        });
    },

    // Resultados
    async getResultados() {
        return request(`${API_URL}/resultados`, {
            headers: getAuthHeaders()
        });
    },

    async getResultadosByTurma(turmaId: number) {
        return request(`${API_URL}/resultados/turma/${turmaId}`, {
            headers: getAuthHeaders()
        });
    },

    async getResultadosByGabarito(gabaritoId: number) {
        return request(`${API_URL}/resultados/gabarito/${gabaritoId}`, {
            headers: getAuthHeaders()
        });
    },

    async getResultadosAlunoTurma(turmaId: number, alunoId: number) {
        return request(`${API_URL}/resultados/turma/${turmaId}/aluno/${alunoId}`, {
            headers: getAuthHeaders()
        });
    },

    async addResultadoManual(data: { aluno_id: number, gabarito_id: number, respostas_aluno?: string[], nota?: number, registrar_presenca?: boolean }) {
        return request(`${API_URL}/resultados`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
    },

    async updateResultado(id: number, data: { respostas_aluno?: string[], nota?: number }) {
        return request(`${API_URL}/resultados/${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
    },

    async deleteResultado(id: number) {
        return request(`${API_URL}/resultados/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
    },

    // Estatísticas
    async getStats() {
        return request(`${API_URL}/stats`, {
            headers: getAuthHeaders()
        });
    },

    async getDashboardOperacional() {
        return request(`${API_URL}/dashboard/operacional`, {
            headers: getAuthHeaders()
        });
    },

    async getStatsByTurma(turmaId: number) {
        return request(`${API_URL}/stats/turma/${turmaId}`, {
            headers: getAuthHeaders()
        });
    },

    // Portal do Aluno
    student: {
        async login(codigo: string, password: string) {
            return request(`${API_URL}/alunos-portal/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo, password }),
            });
        },
        async getMe() {
            return request(`${API_URL}/alunos-portal/me`, {
                headers: getAuthHeaders()
            });
        },
        async getResultados() {
            return request(`${API_URL}/alunos-portal/me/resultados`, {
                headers: getAuthHeaders()
            });
        },
        async getFrequencia() {
            return request(`${API_URL}/alunos-portal/me/frequencia`, {
                headers: getAuthHeaders()
            });
        },
        async changePassword(newPassword: string) {
            return request(`${API_URL}/alunos-portal/me/password`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ new_password: newPassword }),
            });
        }
    },

    // Alunos - adicionar
    async addAluno(data: any) {
        return request(`${API_URL}/alunos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
    },

    async updateAluno(id: number, data: any) {
        return request(`${API_URL}/alunos/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
    },

    async getAluno(id: number) {
        return request(`${API_URL}/alunos/${id}`, {
            headers: getAuthHeaders()
        });
    },

    async deleteAluno(id: number) {
        return request(`${API_URL}/alunos/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
    },

    async unlinkAlunoFromTurma(turmaId: number, alunoId: number) {
        return request(`${API_URL}/turmas/${turmaId}/alunos/${alunoId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
    },

    // Gabaritos - adicionar
    async addGabarito(data: any) {
        return request(`${API_URL}/gabaritos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
    },

    async getGabaritoById(id: number) {
        return request(`${API_URL}/gabaritos/${id}`, {
            headers: getAuthHeaders()
        });
    },

    async deleteGabarito(id: number) {
        return request(`${API_URL}/gabaritos/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
    },

    async updateGabarito(id: number, data: any) {
        return request(`${API_URL}/gabaritos/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
    },

    async getDisciplinas() {
        return request(`${API_URL}/disciplinas`, {
            headers: getAuthHeaders()
        });
    },

    // Frequência
    async saveFrequencia(data: any) {
        return request(`${API_URL}/frequencia`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
    },

    async scanQrCode(qr_token: string) {
        return request(`${API_URL}/qr-scan`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ qr_token }),
        });
    },

    async getFrequenciaTurma(turmaId: number) {
        return request(`${API_URL}/frequencia/turma/${turmaId}`, {
            headers: getAuthHeaders()
        });
    },

    async getFrequenciaAluno(alunoId: number) {
        return request(`${API_URL}/frequencia/aluno/${alunoId}`, {
            headers: getAuthHeaders()
        });
    },

    async getFrequenciaAlunoTurma(turmaId: number, alunoId: number) {
        return request(`${API_URL}/frequencia/turma/${turmaId}/aluno/${alunoId}`, {
            headers: getAuthHeaders()
        });
    },

    async getFrequenciaDates(turmaId: number) {
        return request(`${API_URL}/frequencia/turma/${turmaId}/dates`, {
            headers: getAuthHeaders()
        });
    },

    // OMR Engine
    async processarProva(data: { image: string, num_questions?: number, gabarito_id?: number, aluno_id?: number }) {
        return request(`${API_URL}/provas/processar`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
    },

    async scanAnchors(data: { image: string }) {
        return request(`${API_URL}/provas/scan-anchors`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
    },

    // Admin Endpoints
    admin: {
        listUsers: async () => {
            return request(`${API_URL}/admin/users`, {
                headers: getAuthHeaders()
            });
        },
        getTurma: async (id: number) => {
            return request(`${API_URL}/turmas/${id}`, {
                headers: getAuthHeaders()
            });
        },
        getAlunosTurma: async (turmaId: number) => {
            return request(`${API_URL}/alunos?turma_id=${turmaId}`, {
                headers: getAuthHeaders()
            });
        },
        createUser: async (userData: any) => {
            return request(`${API_URL}/admin/users`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(userData)
            });
        },
        async deleteUser(userId: number) {
            return request(`${API_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
        },
        async listPendencias() {
            return request(`${API_URL}/admin/pendencias`, {
                headers: getAuthHeaders()
            });
        },
        async notificarProfessor(professorId: number) {
            return request(`${API_URL}/admin/notificar`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ professor_id: professorId })
            });
        },
        async importMasterData(data: any[]) {
            return request(`${API_URL}/admin/import-master`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data)
            });
        },
        async importUsers(users: any[]) {
            return request(`${API_URL}/admin/users/import`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(users)
            });
        },
        async getSystemOverview() {
            return request(`${API_URL}/admin/system-overview`, {
                headers: getAuthHeaders()
            });
        }
    },

    // Planejamento (Sequências Didáticas)
    async getPlanosturma(turmaId: number) {
        if (!turmaId || isNaN(turmaId)) {
            console.warn('api.getPlanosturma: ID inválido', turmaId);
            return [];
        }
        return request(`${API_URL}/planos/turma/${turmaId}`, {
            headers: getAuthHeaders()
        });
    },

    async getPlano(id: number) {
        return request(`${API_URL}/planos/${id}`, {
            headers: getAuthHeaders()
        });
    },

    async createPlano(data: { turma_id: number, titulo: string, disciplina?: string, data_inicio: string, aulas: any[], intervalo_dias?: number, dias_semana?: number[] }) {
        return request(`${API_URL}/planos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
    },

    async updatePlano(id: number, data: { titulo?: string, disciplina?: string, aulas?: any[], dias_semana?: number[] }) {
        return request(`${API_URL}/planos/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
    },

    async vincularPlano(planoId: number, turmaDestinoId: number, dataInicio: string) {
        return request(`${API_URL}/planos/${planoId}/vincular`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ turma_destino_id: turmaDestinoId, data_inicio: dataInicio })
        });
    },

    async getAulaHoje(planoId: number) {
        if (!planoId || isNaN(planoId)) return { message: 'ID inválido' };
        return request(`${API_URL}/planos/${planoId}/hoje`, {
            headers: getAuthHeaders()
        });
    },

    async concluirAula(aulaId: number, data: { percepcoes?: string[], observacoes?: string | null }) {
        return request(`${API_URL}/planos/aulas/${aulaId}/concluir`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
    },

    async inserirReforco(aulaId: number) {
        return request(`${API_URL}/planos/aulas/${aulaId}/inserir-reforco`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
    },

    async getHeatmap(turmaId: number) {
        return request(`${API_URL}/analytics/turma/${turmaId}/heatmap`, {
            headers: getAuthHeaders()
        });
    },

    async getPlanoAulas(planoId: number) {
        return request(`${API_URL}/planos/${planoId}/aulas`, {
            headers: getAuthHeaders()
        });
    },

    // Currículo Base
    async getCurriculoSubjects() {
        return request(`${API_URL}/curriculo/subjects`, {
            headers: getAuthHeaders()
        });
    },

    async getCurriculoUnits(subjectId: number) {
        return request(`${API_URL}/curriculo/subjects/${subjectId}/units`, {
            headers: getAuthHeaders()
        });
    },

    async getCurriculoTopics(unitId: number) {
        return request(`${API_URL}/curriculo/units/${unitId}/topics`, {
            headers: getAuthHeaders()
        });
    },

    async getCurriculoMethodologies() {
        return request(`${API_URL}/curriculo/methodologies`, {
            headers: getAuthHeaders()
        });
    },

    async getCurriculoResources() {
        return request(`${API_URL}/curriculo/resources`, {
            headers: getAuthHeaders()
        });
    },

    async getCurriculoSuggestions(topicId: number) {
        return request(`${API_URL}/curriculo/topics/${topicId}/suggestions`, {
            headers: getAuthHeaders()
        });
    },

    async searchBNCCSkills(q?: string, subjectId?: number, grade?: string) {
        const params = new URLSearchParams();
        if (q) params.append('q', q);
        if (subjectId) params.append('subject_id', subjectId.toString());
        if (grade) params.append('grade', grade);

        const url = `${API_URL}/curriculo/bncc/skills?${params.toString()}`;

        return request(url, {
            headers: getAuthHeaders()
        }).catch(e => {
            console.error("Erro ao buscar BNCC:", e);
            return [];
        });
    },

    async getBNCCCompetencies() {
        return request(`${API_URL}/curriculo/bncc/competencies`, {
            headers: getAuthHeaders()
        });
    },

    async getCoberturaPedagogica(planoId: number) {
        return request(`${API_URL}/planos/${planoId}/cobertura-pedagogica`, {
            headers: getAuthHeaders()
        });
    },

    // --- GESTÃO ESCOLAR MASTER (2026) ---
    async importMasterData(payload: any) {
        return request(`${API_URL}/admin/import-master`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
    },

    async getSchoolData() {
        return request(`${API_URL}/admin/schools`, {
            headers: getAuthHeaders()
        });
    },

    async getMasterCalendar() {
        return request(`${API_URL}/admin/calendar`, {
            headers: getAuthHeaders()
        });
    },

    async getAllStudents() {
        return request(`${API_URL}/admin/students`, {
            headers: getAuthHeaders()
        });
    },

    async generateStudentCard(alunoId: number) {
        return request(`${API_URL}/admin/generate-carteirinha?aluno_id=${alunoId}`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
    },

    // ============ ENDPOINTS NÃO UTILIZADOS (24) ============

    // --- MONETIZAÇÃO (2 endpoints) ---
    billing: {
        async getStatus() {
            return request(`${API_URL}/billing/status`, {
                headers: getAuthHeaders()
            });
        },
        async upgrade(planType: string, paymentMethod: string = 'credit_card', durationMonths: number = 12) {
            return request(`${API_URL}/billing/upgrade`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    plan_type: planType,
                    payment_method: paymentMethod,
                    duration_months: durationMonths
                })
            });
        }
    },

    // --- NOTIFICAÇÕES (3 endpoints) ---
    notifications: {
        async getAll(skip: number = 0, limit: number = 20, type?: string, isRead?: boolean) {
            let url = `${API_URL}/notifications?skip=${skip}&limit=${limit}`;
            if (type) url += `&type=${type}`;
            if (isRead !== undefined) url += `&is_read=${isRead}`;

            return request(url, {
                headers: getAuthHeaders()
            });
        },
        async markAsRead(notificationId: number) {
            return request(`${API_URL}/notifications/${notificationId}/read`, {
                method: 'PATCH',
                headers: getAuthHeaders()
            });
        },
        async getUnreadCount() {
            return request(`${API_URL}/notifications/unread/count`, {
                headers: getAuthHeaders()
            });
        }
    },

    // --- RELATÓRIOS (2 endpoints) ---
    async generateTurmaReport(turmaId: number, format: string = 'json', includePeriod?: string) {
        let url = `${API_URL}/relatorios/${turmaId}?format=${format}`;
        if (includePeriod) url += `&period=${includePeriod}`;

        return request(url, {
            headers: getAuthHeaders()
        });
    },

    // --- PROCESSAMENTO OMR AVANÇADO (3 endpoints) ---
    omr: {
        async process(imageBase64: string, gabaritoId?: number, alunoId?: number, turmaId?: number) {
            return request(`${API_URL}/omr/process`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    imagem_base64: imageBase64,
                    gabarito_id: gabaritoId,
                    aluno_id: alunoId,
                    turma_id: turmaId
                })
            });
        },
        async preview(imageBase64: string, gabaritoId: number, showDetectedMarks: boolean = true) {
            return request(`${API_URL}/omr/preview`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    imagem_base64: imageBase64,
                    gabarito_id: gabaritoId,
                    show_detected_marks: showDetectedMarks
                })
            });
        }
    },

    // --- REVISÃO DE PROVAS (1 endpoint) ---
    async revistarProva(resultadoId: number, revisoes: any[], observacoes?: string) {
        return request(`${API_URL}/provas/revisar`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                resultado_id: resultadoId,
                revisoes: revisoes,
                observacoes: observacoes
            })
        });
    },

    // --- ADMINISTRAÇÃO (1 endpoint) ---
    async transferirTurma(turmaId: number, newProfessorId: number, notifyTeacher: boolean = true, reason?: string) {
        return request(`${API_URL}/admin/turmas/${turmaId}/transfer/${newProfessorId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                notify_teacher: notifyTeacher,
                reason: reason
            })
        });
    },

    // --- SINCRONIZAÇÃO EM LOTE (1 endpoint) ---
    async batchSync(action: string, data: any[], options?: { upsert?: boolean, validate_only?: boolean }) {
        const apiKey = localStorage.getItem('api_key') || '';
        return request(`${API_URL}/batch/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify({
                action: action,
                data: data,
                options: options || { upsert: true, validate_only: false }
            })
        });
    },

    // --- ROTA PLANEJAMENTO CORRIGIDA ---
    async getPlanosAll() {
        // GET /planos sem ID - se existir no backend
        return request(`${API_URL}/planos`, {
            headers: getAuthHeaders()
        }).catch(() => {
            console.warn('GET /planos sem parâmetros não disponível');
            return [];
        });
    },

    // --- CALENDÁRIO PÚBLICO (endpoints /calendar/*) ---
    calendar: {
        async getEvents() {
            return request(`${API_URL}/calendar/events`, {
                headers: getAuthHeaders()
            });
        },
        async getEventsByType(eventType: string) {
            return request(`${API_URL}/calendar/events/${eventType}`, {
                headers: getAuthHeaders()
            });
        },
        async getPeriods() {
            return request(`${API_URL}/calendar/periods`, {
                headers: getAuthHeaders()
            });
        },
        async getAcademicYears() {
            return request(`${API_URL}/calendar/academic-years`, {
                headers: getAuthHeaders()
            });
        },
        async getSchools() {
            return request(`${API_URL}/calendar/schools`, {
                headers: getAuthHeaders()
            });
        },
        async getFullCalendar() {
            return request(`${API_URL}/calendar/full-calendar`, {
                headers: getAuthHeaders()
            });
        },
        async createEvent(data: { title: string; event_type_id: string; start_date: string; end_date: string; description?: string; is_school_day?: boolean }) {
            return request(`${API_URL}/calendar/events`, {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        },
        async updateEvent(eventId: number, data: { title?: string; event_type_id?: string; start_date?: string; end_date?: string; description?: string; is_school_day?: boolean }) {
            return request(`${API_URL}/calendar/events/${eventId}`, {
                method: 'PUT',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        },
        async deleteEvent(eventId: number) {
            return request(`${API_URL}/calendar/events/${eventId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
        }
    }
};
