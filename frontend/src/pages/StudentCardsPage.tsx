import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CreditCard, Printer, Search, CheckCircle, FileDown, X, Filter, ChevronLeft, ChevronRight, Users, CheckSquare, Square } from 'lucide-react';
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

const PAGE_SIZE = 15;

export const StudentCardsPage: React.FC = () => {
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [selectedTurmas, setSelectedTurmas] = useState<Set<string>>(new Set());
    const [selectedTurnos, setSelectedTurnos] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(0);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [toast, setToast] = useState<string | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        api.getAllStudents()
            .then(data => {
                const studentsWithTurno = (data || []).map((s: Student) => ({
                    ...s,
                    turno: extrairTurno(s.turma)
                }));
                setStudents(studentsWithTurno);
            })
            .catch(err => console.error("Erro ao carregar alunos:", err))
            .finally(() => setLoading(false));
    }, []);

    const extrairTurno = (turmaName: string): string => {
        if (!turmaName) return "Matutino";
        const lower = turmaName.toLowerCase();
        if (lower.includes('noite')) return "Noturno";
        if (lower.includes('tarde') || lower.includes('vespertino')) return "Vespertino";
        return "Matutino";
    };

    const uniqueTurmas = useMemo(() => {
        const turmas = new Set(students.map(s => s.turma).filter(Boolean));
        return Array.from(turmas).sort();
    }, [students]);

    const uniqueTurnos = useMemo(() => {
        const turnos = new Set(students.map(s => extrairTurno(s.turma)).filter(Boolean));
        return Array.from(turnos).sort();
    }, [students]);

    const toggleSet = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
        const newSet = new Set(set);
        newSet.has(value) ? newSet.delete(value) : newSet.add(value);
        setter(newSet);
        setPage(0);
    };

    const clearFilters = () => {
        setSelectedTurmas(new Set());
        setSelectedTurnos(new Set());
        setSearchTerm('');
        setPage(0);
    };

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            const matchesSearch = !searchTerm || s.nome.toLowerCase().includes(searchTerm.toLowerCase()) || s.codigo.includes(searchTerm);
            const matchesTurma = selectedTurmas.size === 0 || selectedTurmas.has(s.turma);
            const studentTurno = extrairTurno(s.turma);
            const matchesTurno = selectedTurnos.size === 0 || selectedTurnos.has(studentTurno);
            return matchesSearch && matchesTurma && matchesTurno;
        });
    }, [students, searchTerm, selectedTurmas, selectedTurnos]);

    const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
    const pagedStudents = filteredStudents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    // Reset page when filters change
    useEffect(() => { setPage(0); }, [searchTerm]);

    const showToast = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    }, []);

    const toggleStudentSelection = (id: number) => {
        const newSet = new Set(selectedIds);
        newSet.has(id) ? newSet.delete(id) : newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAllPage = () => {
        const pageIds = pagedStudents.map(s => s.id);
        const allSelected = pageIds.every(id => selectedIds.has(id));
        const newSet = new Set(selectedIds);
        if (allSelected) {
            pageIds.forEach(id => newSet.delete(id));
        } else {
            pageIds.forEach(id => newSet.add(id));
        }
        setSelectedIds(newSet);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async (student?: Student) => {
        const target = student || selectedStudent;
        if (!cardRef.current || !target) return;
        // If a different student was passed, we need to wait for re-render
        if (student && student.id !== selectedStudent?.id) {
            setSelectedStudent(student);
            await new Promise(r => setTimeout(r, 300));
        }
        try {
            setExporting(true);
            const canvas = await html2canvas(cardRef.current, {
                scale: 3,
                useCORS: true,
                backgroundColor: null
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: [100, 63]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, 100, 63);
            pdf.save(`Carteirinha_${target.codigo}_${target.nome.replace(/\s+/g, '_')}.pdf`);
            showToast(`PDF gerado: ${target.nome}`);
        } catch (err) {
            console.error("Erro ao gerar PDF:", err);
            showToast("Erro ao gerar PDF. Tente novamente.");
        } finally {
            setExporting(false);
        }
    };

    const handleBatchPDF = async () => {
        const targets = selectedIds.size > 0
            ? students.filter(s => selectedIds.has(s.id))
            : filteredStudents;

        if (targets.length === 0) return;

        setExporting(true);
        showToast(`Gerando ${targets.length} carteirinhas...`);

        try {
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: [100, 63]
            });

            for (let i = 0; i < targets.length; i++) {
                setSelectedStudent(targets[i]);
                await new Promise(r => setTimeout(r, 200));

                if (!cardRef.current) continue;
                const canvas = await html2canvas(cardRef.current, {
                    scale: 3,
                    useCORS: true,
                    backgroundColor: null
                });
                const imgData = canvas.toDataURL('image/png');

                if (i > 0) pdf.addPage([100, 63], 'landscape');
                pdf.addImage(imgData, 'PNG', 0, 0, 100, 63);
            }

            pdf.save(`Carteirinhas_Lote_${targets.length}_alunos.pdf`);
            showToast(`Lote de ${targets.length} carteirinhas exportado!`);
        } catch (err) {
            console.error("Erro batch PDF:", err);
            showToast("Erro ao gerar lote PDF.");
        } finally {
            setExporting(false);
        }
    };

    const activeFilters = selectedTurmas.size + selectedTurnos.size;

    if (loading) {
        return (
            <div className="admin-container">
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                    <CreditCard size={40} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p>Carregando alunos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-container">
            {/* TOAST */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
                    background: '#10b981', color: 'white', padding: '12px 20px',
                    borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600',
                    boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
                    animation: 'fadeIn 0.3s ease',
                }}>
                    <CheckCircle size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
                    {toast}
                </div>
            )}

            {/* HEADER */}
            <header className="admin-header no-print">
                <div>
                    <h1 className="admin-title" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <CreditCard size={26} color="var(--admin-gold)" />
                        Carteirinhas Estudantis
                    </h1>
                    <p className="admin-subtitle">
                        {students.length} alunos cadastrados
                        {selectedIds.size > 0 && <> · <strong style={{ color: '#3b82f6' }}>{selectedIds.size} selecionados</strong></>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        className="btn-emerald"
                        style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                        onClick={handlePrint}
                        disabled={students.length === 0}
                    >
                        <Printer size={16} />
                        {selectedIds.size > 0
                            ? `Imprimir ${selectedIds.size} Carteirinhas`
                            : `Imprimir Todos (${filteredStudents.length})`
                        }
                    </button>
                    <button
                        className="btn-emerald"
                        style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#1e40af' }}
                        onClick={handleBatchPDF}
                        disabled={exporting || students.length === 0}
                    >
                        <FileDown size={16} />
                        {exporting
                            ? 'Gerando...'
                            : selectedIds.size > 0
                                ? `Exportar ${selectedIds.size} PDF`
                                : `Exportar Todos (${filteredStudents.length})`
                        }
                    </button>
                </div>
            </header>

            {/* STATS BAR */}
            <div className="no-print" style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '12px', marginTop: '16px',
            }}>
                {[
                    { label: 'Total Alunos', value: students.length, color: '#3b82f6' },
                    { label: 'Turmas', value: uniqueTurmas.length, color: '#10b981' },
                    { label: 'Filtrados', value: filteredStudents.length, color: '#f59e0b' },
                    { label: 'Selecionados', value: selectedIds.size, color: '#8b5cf6' },
                ].map((s, i) => (
                    <div key={i} style={{
                        background: '#0f172a', border: `1px solid ${s.color}33`, borderRadius: '10px',
                        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                        <Users size={18} color={s.color} />
                        <div>
                            <p style={{ color: '#f1f5f9', fontSize: '1.3rem', fontWeight: 'bold', margin: 0 }}>{s.value}</p>
                            <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* MAIN GRID */}
            <div className="no-print" style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 420px',
                gap: '24px',
                marginTop: '20px',
            }}>
                {/* COLUNA ESQUERDA — PESQUISA + TABELA */}
                <div>
                    {/* BARRA DE PESQUISA + FILTROS */}
                    <div className="admin-card" style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#64748b' }} />
                                <input
                                    type="text"
                                    placeholder="Pesquisar nome ou matrícula..."
                                    className="admin-input"
                                    style={{ paddingLeft: '36px', width: '100%' }}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                style={{
                                    padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                                    background: showFilters ? '#1e40af' : '#1e293b',
                                    border: showFilters ? '2px solid #3b82f6' : '1px solid #374151',
                                    color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '6px',
                                    fontSize: '0.85rem', whiteSpace: 'nowrap',
                                }}
                            >
                                <Filter size={15} />
                                Filtros {activeFilters > 0 && <span style={{ background: '#3b82f6', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>{activeFilters}</span>}
                            </button>
                        </div>

                        {showFilters && (
                            <div style={{ marginTop: '12px', padding: '14px', background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}>
                                {/* Turnos */}
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Turno
                                    </label>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {uniqueTurnos.map(turno => (
                                            <button
                                                key={turno}
                                                onClick={() => toggleSet(selectedTurnos, turno, setSelectedTurnos)}
                                                style={{
                                                    padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer',
                                                    border: selectedTurnos.has(turno) ? '2px solid #3b82f6' : '1px solid #374151',
                                                    background: selectedTurnos.has(turno) ? '#1e40af' : 'transparent',
                                                    color: '#e2e8f0',
                                                }}
                                            >
                                                {turno}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* Turmas */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Turma
                                    </label>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '100px', overflowY: 'auto' }}>
                                        {uniqueTurmas.map(turma => (
                                            <button
                                                key={turma}
                                                onClick={() => toggleSet(selectedTurmas, turma, setSelectedTurmas)}
                                                title={turma}
                                                style={{
                                                    padding: '5px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer',
                                                    border: selectedTurmas.has(turma) ? '2px solid #10b981' : '1px solid #374151',
                                                    background: selectedTurmas.has(turma) ? '#064e3b' : 'transparent',
                                                    color: '#e2e8f0', maxWidth: '180px',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {turma}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {activeFilters > 0 && (
                                    <button
                                        onClick={clearFilters}
                                        style={{
                                            marginTop: '10px', width: '100%', padding: '6px',
                                            background: '#7f1d1d', color: '#fca5a5',
                                            border: '1px solid #dc2626', borderRadius: '6px',
                                            cursor: 'pointer', fontSize: '0.8rem',
                                            display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center',
                                        }}
                                    >
                                        <X size={14} /> Limpar Filtros
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* TABELA DE ALUNOS */}
                    <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                        {filteredStudents.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4b5563' }}>
                                <Users size={36} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                <p style={{ fontSize: '0.95rem' }}>Nenhum aluno encontrado</p>
                                {activeFilters > 0 && (
                                    <button onClick={clearFilters} style={{ marginTop: '8px', color: '#3b82f6', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>
                                        Limpar filtros
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #1e293b' }}>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', color: '#64748b', fontWeight: '600', width: '40px' }}>
                                                <button onClick={toggleSelectAllPage} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}>
                                                    {pagedStudents.every(s => selectedIds.has(s.id)) && pagedStudents.length > 0
                                                        ? <CheckSquare size={16} color="#3b82f6" />
                                                        : <Square size={16} />
                                                    }
                                                </button>
                                            </th>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Aluno</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Matrícula</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Turma</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedStudents.map(student => {
                                            const isSelected = selectedStudent?.id === student.id;
                                            const isChecked = selectedIds.has(student.id);
                                            const initials = student.nome.split(' ').filter(n => n.length > 1).map(n => n[0]).join('').substring(0, 2);
                                            return (
                                                <tr
                                                    key={student.id}
                                                    style={{
                                                        cursor: 'pointer',
                                                        background: isSelected ? '#1e293b' : 'transparent',
                                                        borderBottom: '1px solid #0f172a',
                                                        transition: 'background 0.15s',
                                                    }}
                                                    onClick={() => setSelectedStudent(student)}
                                                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#111827'; }}
                                                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <td style={{ padding: '10px 14px' }}>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleStudentSelection(student.id); }}
                                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}
                                                        >
                                                            {isChecked ? <CheckSquare size={16} color="#3b82f6" /> : <Square size={16} />}
                                                        </button>
                                                    </td>
                                                    <td style={{ padding: '10px 14px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{
                                                                background: isSelected ? '#3b82f6' : '#1e293b',
                                                                color: isSelected ? '#fff' : '#94a3b8',
                                                                width: '32px', height: '32px', borderRadius: '50%',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '10px', fontWeight: 'bold', flexShrink: 0,
                                                                transition: 'all 0.15s',
                                                            }}>
                                                                {initials}
                                                            </div>
                                                            <span style={{ color: '#f1f5f9', fontSize: '0.9rem', fontWeight: '500' }}>{student.nome}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '0.85rem', fontFamily: 'monospace' }}>{student.codigo}</td>
                                                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '0.85rem' }}>{student.turma}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* PAGINAÇÃO */}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '10px 14px', borderTop: '1px solid #1e293b',
                                }}>
                                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                        {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredStudents.length)} de {filteredStudents.length}
                                    </span>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            onClick={() => setPage(p => Math.max(0, p - 1))}
                                            disabled={page === 0}
                                            style={{
                                                padding: '6px 10px', borderRadius: '6px', cursor: page === 0 ? 'default' : 'pointer',
                                                background: 'transparent', border: '1px solid #374151',
                                                color: page === 0 ? '#374151' : '#94a3b8',
                                            }}
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <span style={{ padding: '6px 12px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                            {page + 1}/{totalPages}
                                        </span>
                                        <button
                                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                            disabled={page >= totalPages - 1}
                                            style={{
                                                padding: '6px 10px', borderRadius: '6px', cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                                                background: 'transparent', border: '1px solid #374151',
                                                color: page >= totalPages - 1 ? '#374151' : '#94a3b8',
                                            }}
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* COLUNA DIREITA — PREVIEW DA CARTEIRINHA */}
                <div style={{ position: 'sticky', top: '20px', alignSelf: 'start' }}>
                    <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ color: 'var(--admin-gold)', fontSize: '0.95rem', fontWeight: '700', margin: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <CreditCard size={16} /> Pré-visualização
                            </h3>
                            {selectedStudent && (
                                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                    {selectedStudent.codigo}
                                </span>
                            )}
                        </div>

                        {selectedStudent ? (
                            <>
                                <div ref={cardRef} style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
                                    <StudentCard
                                        studentName={selectedStudent.nome}
                                        studentCode={selectedStudent.codigo}
                                        schoolName={selectedStudent.unidade}
                                        className={selectedStudent.turma}
                                        academicYear="2026"
                                    />
                                </div>

                                <div style={{ padding: '0 20px 20px', display: 'flex', gap: '10px' }}>
                                    <button
                                        className="btn-emerald"
                                        style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}
                                        onClick={() => handleDownloadPDF()}
                                        disabled={exporting}
                                    >
                                        <FileDown size={15} /> {exporting ? 'Gerando...' : 'Salvar PDF'}
                                    </button>
                                    <button
                                        style={{
                                            padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                                            background: '#1e293b', border: '1px solid #374151', color: '#94a3b8',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                        }}
                                        onClick={handlePrint}
                                    >
                                        <Printer size={15} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px 24px', color: '#4b5563' }}>
                                <CreditCard size={48} style={{ opacity: 0.15, marginBottom: '16px' }} />
                                <p style={{ fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>
                                    Clique em um aluno na lista para visualizar a carteirinha
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* PRINT AREA — hidden on screen, visible during print (8 per page) */}
            <div className="print-area">
                {(selectedIds.size > 0
                    ? students.filter(s => selectedIds.has(s.id))
                    : filteredStudents
                ).map(student => (
                    <StudentCard
                        key={student.id}
                        studentName={student.nome}
                        studentCode={student.codigo}
                        schoolName={student.unidade}
                        className={student.turma}
                        academicYear="2026"
                    />
                ))}
            </div>
        </div>
    );
};
