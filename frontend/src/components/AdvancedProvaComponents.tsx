import React, { useState, useRef } from 'react';
import { api } from '../services/api';

// ============= OMR PREVIEW =============

interface OMRPreviewResponse {
    status: string;
    imagem_anotada_base64: string;
    resultado: {
        respostas_detectadas: (string | null)[];
        acertos: number;
        total_questoes: number;
        nota: number;
        questoes_duvida: Array<{
            numero: number;
            confianca_baixa: boolean;
            mensagem: string;
        }>;
    };
    aviso?: string;
}

export const OMRPreviewComponent: React.FC<{
    gabaritoId: number;
    onConfirm: (resultado: any) => void;
}> = ({ gabaritoId, onConfirm }) => {
    const [preview, setPreview] = useState<OMRPreviewResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageSelect = async (file: File) => {
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = e.target?.result as string;

                // Gerar preview
                setLoading(true);
                setError(null);
                
                const data = await api.omr.preview(base64, gabaritoId, true);
                setPreview(data);
            };
            reader.readAsDataURL(file);
        } catch (err: any) {
            setError(err.message);
            console.error('Error processing image:', err);
        } finally {
            setLoading(false);
        }
    };

    if (preview) {
        return (
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                    <img
                        src={preview.imagem_anotada_base64}
                        alt="Preview OMR"
                        className="w-full border-2 border-blue-400 rounded"
                    />
                </div>

                {preview.aviso && (
                    <div className="p-4 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded">
                        ⚠️ {preview.aviso}
                    </div>
                )}

                <div className="grid md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded">
                    <div>
                        <p className="text-gray-600">Respostas Detectadas</p>
                        <p className="text-2xl font-bold text-blue-600">
                            {preview.resultado.respostas_detectadas.filter(r => r !== null).length}/{preview.resultado.total_questoes}
                        </p>
                    </div>
                    <div>
                        <p className="text-gray-600">Acertos</p>
                        <p className="text-2xl font-bold text-green-600">{preview.resultado.acertos}</p>
                    </div>
                    <div>
                        <p className="text-gray-600">Nota</p>
                        <p className="text-2xl font-bold text-purple-600">{preview.resultado.nota.toFixed(1)}</p>
                    </div>
                    <div>
                        <p className="text-gray-600">Dúvidas Detectadas</p>
                        <p className="text-2xl font-bold text-orange-600">{preview.resultado.questoes_duvida.length}</p>
                    </div>
                </div>

                {preview.resultado.questoes_duvida.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded p-4">
                        <h3 className="font-semibold text-orange-900 mb-2">Questões com Baixa Confiança:</h3>
                        <ul className="space-y-1 text-sm text-orange-800">
                            {preview.resultado.questoes_duvida.map((q) => (
                                <li key={q.numero}>
                                    Questão {q.numero}: {q.mensagem}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="flex gap-4">
                    <button
                        onClick={() => setPreview(null)}
                        className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded font-semibold hover:bg-gray-400"
                    >
                        ← Voltar
                    </button>
                    <button
                        onClick={() => onConfirm(preview.resultado)}
                        className="flex-1 px-6 py-3 bg-green-600 text-white rounded font-semibold hover:bg-green-700"
                    >
                        ✓ Confirmar e Salvar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6">Preview de Processamento OMR</h2>

            {error && (
                <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                </div>
            )}

            <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-400 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageSelect(file);
                    }}
                />
                <p className="text-gray-600 mb-2">📸 Clique ou arraste uma imagem da prova aqui</p>
                <p className="text-sm text-gray-500">Formatos: JPG, PNG ou PDF</p>
            </div>

            {loading && <p className="mt-4 text-center text-blue-600">Processando imagem...</p>}
        </div>
    );
};

// ============= REVISÃO DE PROVAS =============

interface ProvaRevisionProps {
    resultadoId: number;
    resultadoAtual: {
        acertos: number;
        nota: number;
        respostas_aluno: string[];
        total_questoes: number;
    };
    gabaritoCorreto: string[];
    onSaved: () => void;
}

export const ProvaRevisionComponent: React.FC<ProvaRevisionProps> = ({
    resultadoId,
    resultadoAtual,
    gabaritoCorreto,
    onSaved
}) => {
    const [revisoes, setRevisoes] = useState<Array<{
        questao: number;
        resposta_original: string | null;
        resposta_corrigida: string;
        motivo: string;
    }>>([]);
    const [observacoes, setObservacoes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRevision = (questao: number, respostaCorrigida: string, motivo: string) => {
        const existing = revisoes.find(r => r.questao === questao);
        if (existing) {
            setRevisoes(revisoes.map(r =>
                r.questao === questao ? { ...r, resposta_corrigida: respostaCorrigida, motivo } : r
            ));
        } else {
            setRevisoes([...revisoes, {
                questao,
                resposta_original: resultadoAtual.respostas_aluno[questao - 1] || null,
                resposta_corrigida: respostaCorrigida,
                motivo
            }]);
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            setError(null);

            await api.revistarProva(resultadoId, revisoes, observacoes);
            alert('✅ Revisão salva com sucesso!');
            onSaved();
        } catch (err: any) {
            setError(err.message);
            console.error('Error saving revision:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <h2 className="text-2xl font-bold">Revisar Resultado da Prova</h2>

            {error && (
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                </div>
            )}

            <div className="grid md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded">
                <div>
                    <p className="text-gray-600">Nota Original</p>
                    <p className="text-2xl font-bold text-blue-600">{resultadoAtual.nota.toFixed(1)}</p>
                </div>
                <div>
                    <p className="text-gray-600">Acertos Original</p>
                    <p className="text-2xl font-bold text-green-600">{resultadoAtual.acertos}/{resultadoAtual.total_questoes}</p>
                </div>
                <div>
                    <p className="text-gray-600">Revisões Pendentes</p>
                    <p className="text-2xl font-bold text-orange-600">{revisoes.length}</p>
                </div>
            </div>

            <div className="bg-white border rounded-lg divide-y">
                <h3 className="p-4 font-semibold bg-gray-50">Questões</h3>
                {Array.from({ length: resultadoAtual.total_questoes }, (_, i) => i + 1).map((q) => (
                    <div key={q} className="p-4 space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="font-semibold text-lg w-12">Q{q}</div>
                            <div className="flex-1">
                                <p className="text-sm text-gray-600">Resposta do aluno:</p>
                                <p className="font-semibold">
                                    {resultadoAtual.respostas_aluno[q - 1] || '(em branco)'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Gabarito:</p>
                                <p className="font-semibold text-green-600">{gabaritoCorreto[q - 1]}</p>
                            </div>
                        </div>

                        {resultadoAtual.respostas_aluno[q - 1] !== gabaritoCorreto[q - 1] && (
                            <div className="bg-yellow-50 p-3 rounded border border-yellow-200 space-y-2">
                                <p className="text-sm font-semibold text-yellow-900">Corrigir esta questão?</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Resposta corrigida"
                                        className="flex-1 px-2 py-1 border rounded"
                                        onChange={(e) => {
                                            const existing = revisoes.find(r => r.questao === q);
                                            if (e.target.value) {
                                                handleRevision(q, e.target.value, existing?.motivo || '');
                                            }
                                        }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Motivo"
                                        className="flex-1 px-2 py-1 border rounded"
                                        onChange={(e) => {
                                            const existing = revisoes.find(r => r.questao === q);
                                            if (existing) {
                                                handleRevision(q, existing.resposta_corrigida, e.target.value);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div>
                <label className="block text-sm font-semibold mb-2">Observações Gerais</label>
                <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg h-24"
                    placeholder="Adicione observações sobre as revisões (opcional)..."
                />
            </div>

            <div className="flex gap-4">
                <button
                    onClick={() => setRevisoes([])}
                    className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded font-semibold hover:bg-gray-400"
                >
                    Limpar Revisões
                </button>
                <button
                    onClick={handleSave}
                    disabled={loading || revisoes.length === 0}
                    className={`flex-1 px-6 py-3 rounded font-semibold text-white transition-colors ${
                        loading || revisoes.length === 0
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700'
                    }`}
                >
                    {loading ? 'Salvando...' : `✓ Salvar ${revisoes.length} Revisões`}
                </button>
            </div>
        </div>
    );
};

// ============= TRANSFERÊNCIA DE TURMA =============

export const TransferirTurmaComponent: React.FC<{
    turmaId: number;
    turmaNome: string;
    professorAtualNome: string;
    onSuccess: () => void;
}> = ({ turmaId, turmaNome, professorAtualNome, onSuccess }) => {
    const [newProfessorId, setNewProfessorId] = useState<string>('');
    const [notifyTeacher, setNotifyTeacher] = useState(true);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTransfer = async () => {
        if (!newProfessorId) {
            setError('Selecione um professor');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await api.transferirTurma(turmaId, parseInt(newProfessorId), notifyTeacher, reason || undefined);
            alert(`✅ Turma transferida com sucesso!`);
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md space-y-6">
            <h2 className="text-2xl font-bold">Transferir Turma</h2>

            {error && (
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                </div>
            )}

            <div className="bg-blue-50 p-4 rounded">
                <p className="text-sm text-gray-600">Turma</p>
                <p className="font-semibold text-lg">{turmaNome}</p>
            </div>

            <div className="bg-blue-50 p-4 rounded">
                <p className="text-sm text-gray-600">Professor Atual</p>
                <p className="font-semibold text-lg">{professorAtualNome}</p>
            </div>

            <div>
                <label className="block text-sm font-semibold mb-2">Novo Professor</label>
                <select
                    value={newProfessorId}
                    onChange={(e) => setNewProfessorId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                >
                    <option value="">-- Selecione um professor --</option>
                    {/* Aqui você preencheria com lista de professores da API */}
                    <option value="1">Prof. João Silva</option>
                    <option value="2">Prof. Maria Santos</option>
                </select>
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="notifyTeacher"
                    checked={notifyTeacher}
                    onChange={(e) => setNotifyTeacher(e.target.checked)}
                />
                <label htmlFor="notifyTeacher" className="text-sm">
                    Notificar novo professor por email
                </label>
            </div>

            <div>
                <label className="block text-sm font-semibold mb-2">Motivo (opcional)</label>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg h-24"
                    placeholder="Ex: Remoção de professor inativo"
                />
            </div>

            <button
                onClick={handleTransfer}
                disabled={loading}
                className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                    loading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
                {loading ? 'Transferindo...' : '🔄 Transferir Turma'}
            </button>
        </div>
    );
};

export default OMRPreviewComponent;
