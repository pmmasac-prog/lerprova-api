import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, Printer, Search, School, User, Download, FileText, CheckCircle } from 'lucide-react';
import { StudentCard } from '../components/StudentCard';
import { api } from '../services/api';

interface Student {
  id: number;
  nome: string;
  codigo: string;
  turma: string;
  unidade: string;
}

export const StudentCardsPage: React.FC = () => {
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Simulando busca de alunos - No futuro buscará via api.admin.getStudents()
        setStudents([
            { id: 1, nome: "ALEXANDRE DE JESUS LIMA", codigo: "2026001", turma: "7 A", unidade: "C.E. ALCIDES CESAR MENESES" },
            { id: 2, nome: "AMANDA DOS SANTOS SILVA", codigo: "2026002", turma: "7 A", unidade: "C.E. ALCIDES CESAR MENESES" },
            { id: 3, nome: "BRUNO HENRIQUE GARCIA", codigo: "2026003", turma: "7 B", unidade: "C.E. ALCIDES CESAR MENESES" },
            { id: 4, nome: "CAIO MARTINS DE OLIVEIRA", codigo: "2026004", turma: "7 B", unidade: "C.E. ALCIDES CESAR MENESES" },
        ]);
    }, []);

    const handlePrint = () => {
        if (!selectedStudent) return;
        window.print();
    };

    const filteredStudents = students.filter(s => 
        s.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.codigo.includes(searchTerm)
    );

    return (
        <div className="admin-container">
            <header className="admin-header no-print">
                <div>
                    <h1 className="admin-title">Emissão de Carteirinhas</h1>
                    <p className="admin-subtitle">Identificação digital e física de todos os alunos da rede.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-secondary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Download size={18} /> Lote Completo (PDF)
                    </button>
                    <button className="btn-primary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onClick={handlePrint} disabled={!selectedStudent}>
                        <Printer size={18} /> Imprimir Selecionada
                    </button>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: '30px', marginTop: '30px' }} className="no-print">
                <div className="admin-card">
                    <div style={{ marginBottom: '20px', position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                        <input 
                            type="text" 
                            placeholder="Pesquisar aluno por nome ou matrícula..." 
                            className="admin-input" 
                            style={{ paddingLeft: '40px' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

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
                            {filteredStudents.map(student => (
                                <tr 
                                    key={student.id} 
                                    style={{ cursor: 'pointer', background: selectedStudent?.id === student.id ? '#1e293b' : '' }}
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
                                    <td>{student.turma}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#34d399', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                            <CheckCircle size={14} /> Ativo
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <h3 className="admin-card-title" style={{ marginBottom: '25px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <CreditCard size={18} color="var(--admin-gold)" /> Pré-visualização Real
                    </h3>
                    
                    {selectedStudent ? (
                        <div ref={cardRef}>
                            <StudentCard 
                                studentName={selectedStudent.nome}
                                studentCode={selectedStudent.codigo}
                                schoolName={selectedStudent.unidade}
                                className={selectedStudent.turma}
                                academicYear="2026"
                                photoUrl="" // Pode adicionar URL de foto se houver
                            />
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#4b5563', border: '1px dashed #374151', borderRadius: '12px', width: '100%' }}>
                            <p>Selecione um aluno da lista para visualizar a carteirinha.</p>
                        </div>
                    )}

                    <div style={{ marginTop: '30px', width: '100%', padding: '15px', background: '#111827', borderRadius: '12px', border: '1px solid #1e293b' }}>
                        <h4 style={{ color: '#f3f4f6', fontSize: '0.85rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={16} /> Especificações de Impressão
                        </h4>
                        <ul style={{ color: '#94a3b8', fontSize: '0.75rem', paddingLeft: '15px', lineHeight: '1.8' }}>
                            <li>Tamanho: 85.60mm × 53.98mm (Padrão CR80)</li>
                            <li>Papel recomendado: PVC 0.76mm ou Papel Fotográfico 230g</li>
                            <li>QR Code inclui: Validação Web e Matrícula</li>
                        </ul>
                    </div>
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
