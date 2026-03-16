import { forwardRef } from 'react';
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
            {students.map(({ student, turmaNome }) => {
                const qrData = JSON.stringify({
                    aid: student.id,
                    gid: gabarito.id
                });

                return (
                    <div key={student.id} className="printable-page">
                        <header className="template-header">
                            <div className="qr-float">
                                <QRCodeSVG value={qrData} size={110} level="M" />
                            </div>
                            <div className="header-text">
                                <h1 className="template-title">FOLHA DE RESPOSTAS - LERPROVA</h1>
                                <div className="exam-info">
                                    <p><strong>Prova:</strong> {gabarito.assunto} | <strong>Turma:</strong> {turmaNome}</p>
                                    <p><strong>Disciplina:</strong> {gabarito.disciplina || 'Geral'} | <strong>Data:</strong> {gabarito.data}</p>
                                </div>
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
                            Preencha completamente o círculo com caneta preta. Não amasse esta folha.
                        </div>

                        <div className="omr-anchor-wrapper">
                            {/* Marcadores de Canto Industriais */}
                            <div className="fiducial tl"></div>
                            <div className="fiducial tr"></div>
                            <div className="fiducial bl"></div>
                            <div className="fiducial br"></div>

                            {/* Marcador Central de Alinhamento */}
                            <div className="fiducial center-marker"></div>

                            {/* Barra de Calibração (Lado Esquerdo) */}
                            <div className="calibration-bar"></div>

                            <main className="questions-grid-printable-industrial two-columns">
                                {[
                                    { start: 0, end: Math.ceil(gabarito.num_questoes / 2) },
                                    { start: Math.ceil(gabarito.num_questoes / 2), end: gabarito.num_questoes }
                                ].map((block, bIdx) => {
                                    const questionsInBlock = Array.from({ length: gabarito.num_questoes })
                                        .slice(block.start, block.end);
                                    
                                    if (questionsInBlock.length === 0) return null;

                                    return (
                                        <div key={bIdx} className="question-block">
                                            {questionsInBlock.map((_, i) => {
                                                const qIdx = block.start + i;
                                                return (
                                                    <div key={qIdx} className="template-question-row">
                                                        <span className="q-num">{String(qIdx + 1).padStart(2, '0')}</span>
                                                        <div className="q-options">
                                                            {['A', 'B', 'C', 'D', 'E'].map(opt => (
                                                                <div key={opt} className="option-container">
                                                                    <div className="option-circle"></div>
                                                                </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </main>
                        </div>

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
