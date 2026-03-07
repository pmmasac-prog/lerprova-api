import React from 'react';
import { Card, User, Calendar, MapPin, School } from 'lucide-react';
import QRCode from 'react-qr-code';
import './StudentCard.css';

interface StudentCardProps {
    aluno: {
        nome: string;
        codigo: string;
        qr_token: string;
    };
    escola?: string;
    anoLetivo?: string;
}

export const StudentCard: React.FC<StudentCardProps> = ({ 
    aluno, 
    escola = "C.E. ALCIDES CÉSAR MENESES", 
    anoLetivo = "2026" 
}) => {
    return (
        <div className="student-card-container">
            <div className="student-card">
                {/* Header do Cartão */}
                <div className="card-header">
                    <School size={20} color="#fff" />
                    <div className="header-text">
                        <h3>{escola}</h3>
                        <span>IDENTIDADE ESTUDANTIL {anoLetivo}</span>
                    </div>
                </div>

                {/* Body do Cartão */}
                <div className="card-body">
                    <div className="photo-placeholder">
                        <User size={64} color="#ccc" />
                    </div>
                    
                    <div className="card-info">
                        <div className="info-item">
                            <label>ESTUDANTE</label>
                            <p className="student-name">{aluno.nome.toUpperCase()}</p>
                        </div>
                        
                        <div className="info-row">
                            <div className="info-item">
                                <label>MATRÍCULA</label>
                                <p>{aluno.codigo}</p>
                            </div>
                            <div className="info-item">
                                <label>VALIDADE</label>
                                <p>31/12/{anoLetivo}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-qr">
                        <QRCode value={aluno.qr_token} size={80} bgColor="#fff" fgColor="#1e3a8a" />
                        <span className="qr-label">ACESSO DIGITAL</span>
                    </div>
                </div>

                {/* Footer do Cartão */}
                <div className="card-footer">
                    <div className="footer-deco" />
                    <p>LERPROVA - GESTÃO ESCOLAR INTELIGENTE</p>
                </div>
            </div>
        </div>
    );
};
