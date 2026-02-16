export interface Turma {
    id: number;
    nome: string;
}

export interface Resultado {
    id: number;
    aluno_id: number;
    turma_id?: number;
    aluno_codigo?: string;
    nome: string;
    gabarito_id: number;
    assunto: string;
    nota: number;
    acertos: number;
    data: string;
    respostas_aluno?: string;
}

export interface Gabarito {
    id: number;
    titulo: string;
    assunto: string;
    respostas_corretas: string;
    num_questoes: number;
}
