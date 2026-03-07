import React from 'react';
import { School } from 'lucide-react';
import QRCode from 'react-qr-code';
import './StudentCard.css';

interface StudentCardProps {
    studentName: string;
    studentCode: string;
    schoolName?: string;
    className?: string;
    academicYear?: string;
    photoUrl?: string;
}

export const StudentCard: React.FC<StudentCardProps> = ({ 
    studentName, 
    studentCode, 
    schoolName = "C.E. ALCIDES CÉSAR MENESES", 
    className = "7º ANO A",
    academicYear = "2026",
    photoUrl
}) => {
    const initials = studentName
        .split(' ')
        .filter(n => n.length > 1)
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    return (
        <div className="student-card-container">
            <div className="student-card">
                {/* Faixa decorativa superior */}
                <div className="card-accent-bar" />

                {/* Header */}
                <div className="card-header">
                    <School size={20} color="#fbbf24" />
                    <div className="header-text">
                        <h3>{schoolName}</h3>
                        <span>IDENTIDADE ESTUDANTIL DIGITAL</span>
                    </div>
                </div>

                {/* Body */}
                <div className="card-body">
                    {/* Foto */}
                    <div className="photo-area">
                        {photoUrl ? (
                            <img src={photoUrl} alt={studentName} className="student-photo" />
                        ) : (
                            <div className="photo-placeholder">
                                <span className="photo-initials">{initials}</span>
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="card-info">
                        <div className="info-item">
                            <label>NOME</label>
                            <p className="student-name">{studentName.toUpperCase()}</p>
                        </div>
                        <div className="info-row">
                            <div className="info-item">
                                <label>MATRÍCULA</label>
                                <p>{studentCode}</p>
                            </div>
                            <div className="info-item">
                                <label>TURMA</label>
                                <p>{className}</p>
                            </div>
                        </div>
                    </div>

                    {/* QR */}
                    <div className="card-qr">
                        <QRCode 
                            value={`lerprova:${studentCode}`} 
                            size={56} 
                            bgColor="#ffffff" 
                            fgColor="#1e3a8a" 
                            level="M"
                        />
                        <span className="qr-label">VERIFICAR</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="card-footer">
                    <span>ANO LETIVO {academicYear}</span>
                    <div className="footer-deco" />
                    <span>LERPROVA GESTÃO</span>
                </div>
            </div>
        </div>
    );
};
