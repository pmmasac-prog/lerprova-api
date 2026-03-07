import React from 'react';
import { User, School } from 'lucide-react';
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
    return (
        <div className="student-card-container">
            <div className="student-card shadow-xl">
                {/* Header do Cartão */}
                <div className="card-header bg-blue-900 text-white p-4">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <School size={24} color="#fbbf24" />
                        <div className="header-text">
                            <h3 style={{ fontSize: '14px', fontWeight: 'bold' }}>{schoolName}</h3>
                            <span style={{ fontSize: '10px', opacity: 0.8 }}>IDENTIDADE ESTUDANTIL DIGITAL</span>
                        </div>
                    </div>
                </div>

                {/* Body do Cartão */}
                <div className="card-body p-4 flex gap-4">
                    <div className="photo-container">
                        {photoUrl ? (
                            <img src={photoUrl} alt={studentName} className="student-photo" />
                        ) : (
                            <div className="photo-placeholder active:scale-95 transition-all">
                                <User size={48} color="#94a3b8" />
                            </div>
                        )}
                    </div>
                    
                    <div className="card-info flex-1">
                        <div className="info-item mb-2">
                            <label className="text-gray-400 text-xs block font-bold mb-1">NOME DO ESTUDANTE</label>
                            <p className="student-name text-blue-900 font-bold truncate text-lg" style={{ maxWidth: '200px' }}>{studentName.toUpperCase()}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <div className="info-item">
                                <label className="text-gray-400 text-xs block font-bold mb-1">MATRÍCULA</label>
                                <p className="text-sm font-semibold">{studentCode}</p>
                            </div>
                            <div className="info-item">
                                <label className="text-gray-400 text-xs block font-bold mb-1">TURMA</label>
                                <p className="text-sm font-semibold">{className}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-qr flex flex-col items-center justify-center p-2 bg-gray-50 rounded-lg">
                        <QRCode 
                            value={`https://lerprova.com/v/${studentCode}`} 
                            size={64} 
                            bgColor="transparent" 
                            fgColor="#1e3a8a" 
                        />
                        <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#1e3a8a', marginTop: '4px' }}>VERIFICAR</span>
                    </div>
                </div>

                {/* Footer do Cartão */}
                <div className="card-footer bg-gray-100 flex items-center justify-between px-4 py-2">
                    <span className="text-xs font-bold text-gray-500">ANO LETIVO {academicYear}</span>
                    <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#3b82f6' }}>LERPROVA GESTÃO</p>
                </div>
            </div>
        </div>
    );
};
