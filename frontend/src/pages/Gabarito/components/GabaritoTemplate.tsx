import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './GabaritoTemplate.css';

interface StudentItem {
    student: {
        id: number;
        nome: string;
        codigo: string;
    };
    turmaNome: string;
}

interface GabaritoTemplateProps {
    gabarito: {
        id: number;
        assunto: string;
        disciplina?: string;
        data: string;
        num_questoes: number;
        sala?: string;
    };
    students: StudentItem[];
}

export const GabaritoTemplate = forwardRef<HTMLDivElement, GabaritoTemplateProps>(({ gabarito, students }, ref) => {
    return (
        <div ref={ref}>
            {students.map(({ student, turmaNome }, index) => {
                const qrData = JSON.stringify({
                    aid: student.id,
                    gid: gabarito.id
                });

                return (
                    <div key={student.id} className="printable-page" style={{ pageBreakAfter: 'always' }}>
                        {/* Marcadores de Canto (Fiducial Markers) */}
                        <div className="fiducial tl"></div>
                        <div className="fiducial tr"></div>
                        <div className="fiducial bl"></div>
                        <div className="fiducial br"></div>

                        <header className="template-header">
                            <div className="header-text">
                                <h1 className="template-title">FOLHA DE RESPOSTAS - LERPROVA</h1>
                                <div className="exam-info">
                                    <div className="info-row">
                                        <p><strong>Prova:</strong> {gabarito.assunto}</p>
                                        {gabarito.sala && <p><strong>Sala:</strong> {gabarito.sala}</p>}
                                    </div>
                                    <div className="info-row">
                                        <p><strong>Disciplina:</strong> {gabarito.disciplina || 'Geral'}</p>
                                        <p><strong>Turma:</strong> {turmaNome}</p>
                                        <p><strong>Data:</strong> {gabarito.data}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="qr-container">
                                <QRCodeSVG value={qrData} size={80} level="M" />
                            </div>
                        </header>

                        <section className="student-area">
                            <div className="student-field">
                                <label>NOME DO ALUNO:</label>
                                <div className="name-box">{student.nome}</div>
                            </div>
                            <div className="code-field">
                                <label>CÓDIGO:</label>
                                <div className="code-box">{student.codigo}</div>
                            </div>
                        </section>

                        <div className="instructions">
                            Preencha completamente o círculo da resposta correta com caneta preta ou azul.
                        </div>

                        <main className="questions-grid-printable">
                            {Array.from({ length: gabarito.num_questoes }).map((_, i) => (
                                <div key={i} className="template-question-row">
                                    <span className="q-num">{String(i + 1).padStart(2, '0')}</span>
                                    <div className="q-options">
                                        {['A', 'B', 'C', 'D', 'E'].map(opt => (
                                            <div key={opt} className="option-container">
                                                <div className="option-circle"></div>
                                                <span className="option-label">{opt}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </main>

                        <footer className="template-footer">
                            Desenvolvido por LERPROVA - Sistema OMR Profissional
                        </footer>
                    </div>
                );
            })}
        </div>
    );
});

GabaritoTemplate.displayName = 'GabaritoTemplate';
