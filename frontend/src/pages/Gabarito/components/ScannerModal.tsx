// ScannerModal.tsx
import React from 'react';
import './ScannerModal.css';

interface ScannerModalProps {
    onClose: () => void;
    gabaritoId?: number;
    numQuestions?: number;
    onSuccess?: (resultado: any) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ onClose }) => {
    return (
        <div className="scanner-overlay">
            <div className="scanner-container">
                <button className="close-btn" onClick={onClose}>✕</button>
            </div>
        </div>
    );
};