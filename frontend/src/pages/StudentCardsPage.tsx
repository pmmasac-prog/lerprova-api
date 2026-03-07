import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CreditCard, Printer, Search, Download, FileText, CheckCircle, FileDown, X, Filter } from 'lucide-react';
import { StudentCard } from '../components/StudentCard';
import { api } from '../services/api';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Student {
    id: number;
    nome: string;
    codigo: string;
    turma: string;
    unidade: string;
    turno?: string;
}

export const StudentCardsPage: React.FC = () => {
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [selectedTurmas, setSelectedTurmas] = useState<Set<string>>(new Set());
    const [selectedTurnos, setSelectedTurnos] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Busca real de alunos via API
        api.getAllStudents()
            .then(data => {
                const studentsWithTurno = (data || []).map(s => ({
                    ...s,
                    turno: extrairTurno(s.turma) // Extrai turno do nome da turma
                }));
                setStudents(studentsWithTurno);
            })
            .catch(err => console.error("Erro ao carregar alunos:", err))
            .finally(() => setLoading(false));
    }, []);

    // Extrai turno do nome da turma (ex: "1EM-A Português" → "Matutino")
    const extrairTurno = (turmaName: string): string => {
        if (!turmaName) return "Matutino";
        const lower = turmaName.toLowerCase();
        if (lower.includes('noite')) return "Noturno";
        if (lower.includes('tarde') || lower.includes('vespertino')) return "Vespertino";
        return "Matutino";
    };

    // Get unique turmas and turnos for filters
    const uniqueTurmas = useMemo(() => {
        const turmas = new Set(students.map(s => s.turma).filter(Boolean));
        return Array.from(turmas).sort();
    }, [students]);

    const uniqueTurnos = useMemo(() => {
        const turnos = new Set(students.map(s => extrairTurno(s.turma)).filter(Boolean));
        return Array.from(turnos).sort();
    }, [students]);

    // Toggle filters
    const toggleTurma = (turma: string) => {
        const newSet = new Set(selectedTurmas);
        if (newSet.has(turma)) {
            newSet.delete(turma);
        } else {
            newSet.add(turma);
        }
        setSelectedTurmas(newSet);
    };

    const toggleTurno = (turno: string) => {
        const newSet = new Set(selectedTurnos);
        if (newSet.has(turno)) {
            newSet.delete(turno);
        } else {
            newSet.add(turno);
        }
        setSelectedTurnos(newSet);
    };

    const clearFilters = () => {
        setSelectedTurmas(new Set());
        setSelectedTurnos(new Set());
        setSearchTerm('');
    };

    const handlePrint = () => {
        if (!selectedStudent) return;
        window.print();
    };

    const handleDownloadPDF = async () => {
        if (!cardRef.current || !selectedStudent) return;

        try {
            setExporting(true);
            const canvas = await html2canvas(cardRef.current, {
                scale: 3, // Alta qualidade
                useCORS: true,
                backgroundColor: null
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: [85.6, 54] // Tamanho padrão de cartão de crédito
            });

            pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 54);
            pdf.save(`Carteirinha_${selectedStudent.codigo}_${selectedStudent.nome.replace(/\s+/g, '_')}.pdf`);
        } catch (err) {
            console.error("Erro ao gerar PDF:", err);
            alert("Erro ao gerar o arquivo PDF. Tente novamente.");
        } finally {
            setExporting(false);
        }
    };

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            // Filtro por texto
            const matchesSearch = s.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.codigo.includes(searchTerm);
            
            // Filtro por turma
            const matchesTurma = selectedTurmas.size === 0 || selectedTurmas.has(s.turma);
            
            // Filtro por turno
            const studentTurno = extrairTurno(s.turma);
            const matchesTurno = selectedTurnos.size === 0 || selectedTurnos.has(studentTurno);
            
            return matchesSearch && matchesTurma && matchesTurno;
        });
    }, [students, searchTerm, selectedTurmas, selectedTurnos]);

    return (
        <div className="admin-container">
            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Carregando dados...</div>
            ) : null}
            <header className="admin-header no-print">
                <div>
                    <h1 className="admin-title">Emissão de Carteirinhas</h1>
                    <p className="admin-subtitle">Identificação digital e física de todos os alunos da rede.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-secondary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Download size={18} /> Lote Completo (PDF)
                    </button>
                    <button
                        className="btn-emerald"
                        style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                        onClick={handleDownloadPDF}
                        disabled={!selectedStudent || exporting}
                    >
                        <FileDown size={18} /> {exporting ? 'Gerando...' : 'Salvar PDF'}
                    </button>
                    <button className="btn-primary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onClick={handlePrint} disabled={!selectedStudent}>
                        <Printer size={18} /> Imprimir Agora
                    </button>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 500px', gap: '30px', marginTop: '30px' }} className="no-print">
                {/* COLUNA ESQUERDA - LISTA COM FILTROS */}
                <div>
                    {/* BARRA DE PESQUISA */}
                    <div className="admin-card" style={{ marginBottom: '20px' }}>
                        <div style={{ marginBottom: '15px', position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Pesquisar por nome ou matrícula..."
                                className="admin-input"
                                style={{ paddingLeft: '40px' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* BOTÃO FILTROS */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            style={{
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'center',
                                background: showFilters ? '#3b82f6' : '#1e293b',
                                color: '#f3f4f6',
                                border: '1px solid #374151',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                width: '100%',
                                justifyContent: 'center',
                                fontSize: '0.9rem'
                            }}
                        >
                            <Filter size={16} /> Filtros {(selectedTurmas.size > 0 || selectedTurnos.size > 0) && `(${selectedTurmas.size + selectedTurnos.size})`}
                        </button>

                        {/* PAINÉL DE FILTROS */}
                        {showFilters && (
                            <div style={{ marginTop: '15px', padding: '15px', background: '#111827', borderRadius: '8px', border: '1px solid #1e293b' }}>
                                {/* FILTRO TURNOS */}
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase' }}>
                                        ⏰ Turno
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {uniqueTurnos.map(turno => (
                                            <button
                                                key={turno}
                                                onClick={() => toggleTurno(turno)}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    border: selectedTurnos.has(turno) ? '2px solid #3b82f6' : '1px solid #374151',
                                                    background: selectedTurnos.has(turno) ? '#1e40af' : '#0f172a',
                                                    color: '#f3f4f6',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem',
                                                    fontWeight: selectedTurnos.has(turno) ? 'bold' : 'normal'
                                                }}
                                            >
                                                {turno}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* FILTRO TURMAS */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase' }}>
                                        📚 Turma
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '150px', overflow: 'auto' }}>
                                        {uniqueTurmas.map(turma => (
                                            <button
                                                key={turma}
                                                onClick={() => toggleTurma(turma)}
                                                style={{
                                                    padding: '6px 10px',
                                                    borderRadius: '6px',
                                                    border: selectedTurmas.has(turma) ? '2px solid #34d399' : '1px solid #374151',
                                                    background: selectedTurmas.has(turma) ? '#064e3b' : '#0f172a',
                                                    color: '#f3f4f6',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                    fontWeight: selectedTurmas.has(turma) ? 'bold' : 'normal',
                                                    textAlign: 'left',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}
                                                title={turma}
                                            >
                                                {turma}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* BOTÃO LIMPAR FILTROS */}
                                {(selectedTurmas.size > 0 || selectedTurnos.size > 0) && (
                                    <button
                                        onClick={clearFilters}
                                        style={{
                                            marginTop: '10px',
                                            width: '100%',
                                            padding: '6px',
                                            background: '#7f1d1d',
                                            color: '#fca5a5',
                                            border: '1px solid #dc2626',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            gap: '6px',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <X size={14} /> Limpar Filtros
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* TABELA DE ALUNOS */}
                    <div className="admin-card">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Aluno</th>
                                    <th>Matrícula</th>
                                    <th>Turma</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                                            Nenhum aluno encontrado
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map(student => (
                                        <tr
                                            key={student.id}
                                            style={{ cursor: 'pointer', background: selectedStudent?.id === student.id ? '#1e293b' : '', transition: 'background 0.2s' }}
                                            onClick={() => setSelectedStudent(student)}
                                        >
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ background: '#3b82f6', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                                                        {student.nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                    </div>
                                                    {student.nome}
                                                </div>
                                            </td>
                                            <td style={{ color: '#94a3b8' }}>{student.codigo}</td>
                                            <td style={{ fontSize: '0.9rem' }}>{student.turma}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#34d399', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                    <CheckCircle size={14} /> Ativo
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        <div style={{ marginTop: '10px', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>
                            {filteredStudents.length} de {students.length} alunos
                        </div>
                    </div>
                </div>

                {/* COLUNA DIREITA - CARTEIRINHA */}
                <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', position: 'sticky', top: '20px', height: 'fit-content', padding: '0' }}>
                    <h3 className="admin-card-title" style={{ marginBottom: '15px', display: 'flex', gap: '8px', alignItems: 'center', width: '100%', padding: '20px', paddingBottom: '10px' }}>
                        <CreditCard size={18} color="var(--admin-gold)" /> Pré-visualização
                    </h3>

                    {selectedStudent ? (
                        <div ref={cardRef} style={{ padding: '20px', width: '100%', display: 'flex', justifyContent: 'center', overflow: 'auto', maxHeight: '450px' }}>
                            <StudentCard
                                studentName={selectedStudent.nome}
                                studentCode={selectedStudent.codigo}
                                schoolName={selectedStudent.unidade}
                                className={selectedStudent.turma}
                                academicYear="2026"
                                photoUrl=""
                            />
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4b5563', border: '1px dashed #374151', borderRadius: '12px', width: 'calc(100% - 40px)', margin: '20px', marginTop: '0' }}>
                            <CreditCard size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                            <p>Selecione um aluno para visualizar sua carteirinha</p>
                        </div>
                    )}

                    {selectedStudent && (
                        <div style={{ width: '100%', padding: '20px', paddingTop: '10px' }}>
                            <button
                                className="btn-emerald"
                                style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                                onClick={handleDownloadPDF}
                                disabled={!selectedStudent || exporting}
                            >
                                <FileDown size={16} /> {exporting ? 'Gerando...' : 'Salvar PDF'}
                            </button>
                            <button
                                className="btn-primary"
                                style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '10px' }}
                                onClick={handlePrint}
                                disabled={!selectedStudent}
                            >
                                <Printer size={16} /> Imprimir
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Versão para Impressão - Apenas o cartão */}
            <div className="print-only">
                {selectedStudent && (
                    <StudentCard
                        studentName={selectedStudent.nome}
                        studentCode={selectedStudent.codigo}
                        schoolName={selectedStudent.unidade}
                        className={selectedStudent.turma}
                        academicYear="2026"
                    />
                )}
            </div>

            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-only, .print-only * { visibility: visible; }
                    .print-only { position: absolute; left: 0; top: 0; width: 100%; display: flex; justify-content: center; align-items: center; height: 100vh; }
                    .no-print { display: none !important; }
                }
                .print-only { display: none; }
            `}</style>
        </div>
    );
};
