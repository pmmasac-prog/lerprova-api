import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface QRScannerProps {
    onClose: () => void;
    onSuccess?: (message: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onClose, onSuccess }) => {
    const [scanResult, setScanResult] = useState<{ message: string, success: boolean } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            /* verbose= */ false
        );

        scanner.render(onScanSuccess, onScanFailure);

        async function onScanSuccess(decodedText: string) {
            if (loading) return;

            try {
                setLoading(true);
                // scanner.pause(); // Pause after scan to process
                const res = await api.scanQrCode(decodedText);
                setScanResult({ message: res.message, success: res.success });
                if (onSuccess && res.success) {
                    onSuccess(res.message);
                }
            } catch (err: any) {
                console.error('Erro ao processar QR:', err);
                setScanResult({ message: err.message || 'Erro ao validar QR Code', success: false });
            } finally {
                setLoading(false);
                // scanner.resume();
            }
        }

        function onScanFailure() {
            // console.warn(`Code scan error`);
        }

        return () => {
            scanner.clear().catch((e: any) => console.error("Falha ao limpar scanner", e));
        };
    }, []);

    return (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
            <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h2 className="modal-title" style={{ margin: 0 }}>Chamada por QR Code</h2>
                    <button className="icon-btn" onClick={onClose}><X size={24} /></button>
                </div>

                <div id="reader" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }}></div>

                {loading && (
                    <div style={{ marginTop: '15px', textAlign: 'center', color: '#60a5fa' }}>
                        Processando presença...
                    </div>
                )}

                {scanResult && (
                    <div style={{
                        marginTop: '15px',
                        padding: '12px',
                        borderRadius: '8px',
                        background: scanResult.success ? '#065f46' : '#7f1d1d',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center'
                    }}>
                        {scanResult.success ? <CheckCircle color="#34d399" /> : <AlertCircle color="#f87171" />}
                        <p style={{ color: '#fff', fontSize: '0.9rem', margin: 0 }}>{scanResult.message}</p>
                    </div>
                )}

                <div style={{ marginTop: '20px', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>
                    Aponte a câmera para o QR Code do aluno. A presença será marcada automaticamente em todas as salas de hoje.
                </div>
            </div>
        </div>
    );
};
