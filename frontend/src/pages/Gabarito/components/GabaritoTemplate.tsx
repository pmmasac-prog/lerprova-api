import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './GabaritoTemplate.css';

interface GabaritoTemplateProps {
    gabarito: {
        id: number;
        assunto: string;
        disciplina?: string;
        data: string;
        num_questoes: number;
    };
    turmaNome: string;
    aluno?: {
        id: number;
        nome: string;
        codigo: string;
    };
}

export const GabaritoTemplate: React.FC<GabaritoTemplateProps> = ({ gabarito, turmaNome, aluno }) => {
    const qrData = JSON.stringify({
        aid: aluno?.id || 0,
        gid: gabarito.id
    });

    return (
        <div className="printable-page">
            {/* Marcadores de Canto (Fiducial Markers) */}
            <div className="fiducial tl"></div>
            <div className="fiducial tr"></div>
            <div className="fiducial bl"></div>
            <div className="fiducial br"></div>

            <header className="template-header">
                <div className="header-text">
                    <h1 className="template-title">FOLHA DE RESPOSTAS - LERPROVA</h1>
                    <div className="exam-info">
                        <p><strong>Prova:</strong> {gabarito.assunto}</p>
                        <p><strong>Disciplina:</strong> {gabarito.disciplina || 'Geral'}</p>
                        <p><strong>Turma:</strong> {turmaNome}</p>
                        <p><strong>Data:</strong> {gabarito.data}</p>
                    </div>
                </div>
                <div className="qr-container">
                    <QRCodeSVG value={qrData} size={80} level="M" />
                </div>
            </header>

            <section className="student-area">
                <div className="student-field">
                    <label>NOME DO ALUNO:</label>
                    <div className="name-box">{aluno?.nome || ''}</div>
                </div>
                <div className="code-field">
                    <label>CÓDIGO:</label>
                    <div className="code-box">{aluno?.codigo || ''}</div>
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
};
