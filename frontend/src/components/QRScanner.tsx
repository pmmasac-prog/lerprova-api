import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface QRScannerProps {
    onClose: () => void;
    onSuccess?: (message: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onClose, onSuccess }) => {
    const [scanResult, setScanResult] = useState<{ message: string, success: boolean } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const isProcessingRef = useRef(false);

    const normalizeQrToken = (rawValue: string): string => {
        // Remove espaços e converte para uppercase
        let token = rawValue.trim().toUpperCase();
        
        // Se já está no formato ALUNO_XXX, retorna direto
        if (token.startsWith('ALUNO_')) {
            return token;
        }
        
        // Se está no formato lerprova:XXX (antigo), extrai o código
        if (token.startsWith('LERPROVA:')) {
            const codigo = token.replace('LERPROVA:', '');
            return `ALUNO_${codigo}`;
        }
        
        // Se é apenas um código, adiciona o prefixo
        if (/^[A-Z0-9]+$/.test(token)) {
            return `ALUNO_${token}`;
        }
        
        // Retorna o valor original se não reconhecer o formato
        return rawValue;
    };

    const processQrCode = useCallback(async (decodedText: string) => {
        if (isProcessingRef.current || loading) return;
        isProcessingRef.current = true;

        try {
            setLoading(true);
            setScanResult(null);
            setError(null);
            
            // Normaliza o token para o formato correto
            const qrToken = normalizeQrToken(decodedText);
            console.log('QR escaneado:', decodedText, '-> normalizado:', qrToken);
            
            const res = await api.scanQrCode(qrToken);
            setScanResult({ message: res.message, success: res.success });
            
            if (onSuccess && res.success) {
                onSuccess(res.message);
            }
            
            // Se sucesso, pause por 3 segundos antes de permitir novo scan
            if (res.success) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        } catch (err: any) {
            console.error('Erro ao processar QR:', err);
            setScanResult({ message: err.message || 'Erro ao validar QR Code', success: false });
        } finally {
            setLoading(false);
            isProcessingRef.current = false;
        }
    }, [loading, onSuccess]);

    const startScanner = useCallback(async () => {
        try {
            setError(null);
            
            if (scannerRef.current) {
                try {
                    await scannerRef.current.stop();
                } catch {}
            }
            
            scannerRef.current = new Html5Qrcode("reader");
            
            await scannerRef.current.start(
                { facingMode: "environment" },
                {
                    fps: 15,
                    qrbox: { width: 280, height: 280 },
                    aspectRatio: 1.0,
                    disableFlip: false
                },
                (decodedText) => processQrCode(decodedText),
                () => {} // Ignore scan failures
            );
        } catch (err: any) {
            console.error('Erro ao iniciar câmera:', err);
            setError(err.message || 'Não foi possível acessar a câmera. Verifique as permissões.');
        }
    }, [processQrCode]);

    useEffect(() => {
        startScanner();

        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
            }
        };
    }, [startScanner]);

    return (
        <div className="modal-overlay" style={{ 
            zIndex: 2000,
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(8px)'
        }}>
            <div className="modal-content" style={{ 
                maxWidth: '500px', 
                width: '95%',
                background: 'linear-gradient(180deg, #0f1117 0%, #0a0d12 100%)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '24px',
                padding: '24px'
            }}>
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: '20px' 
                }}>
                    <h2 style={{ 
                        margin: 0,
                        background: 'linear-gradient(135deg, #fff 0%, #10b981 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontSize: '1.3rem',
                        fontWeight: 800
                    }}>Chamada por QR Code</h2>
                    <button 
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            padding: '10px',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            transition: 'all 0.2s'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {error ? (
                    <div style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: '16px',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                    }}>
                        <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
                        <p style={{ color: '#fca5a5', marginBottom: '16px' }}>{error}</p>
                        <button 
                            onClick={startScanner}
                            style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                border: 'none',
                                borderRadius: '12px',
                                padding: '12px 24px',
                                color: '#fff',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <RefreshCw size={18} />
                            Tentar Novamente
                        </button>
                    </div>
                ) : (
                    <div 
                        id="reader" 
                        style={{ 
                            width: '100%', 
                            borderRadius: '16px', 
                            overflow: 'hidden',
                            background: '#000',
                            minHeight: '300px'
                        }}
                    />
                )}

                {loading && (
                    <div style={{ 
                        marginTop: '16px', 
                        textAlign: 'center', 
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px'
                    }}>
                        <RefreshCw size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                        Processando presença...
                    </div>
                )}

                {scanResult && (
                    <div style={{
                        marginTop: '16px',
                        padding: '16px',
                        borderRadius: '14px',
                        background: scanResult.success 
                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)'
                            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.1) 100%)',
                        border: `1px solid ${scanResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center'
                    }}>
                        {scanResult.success ? <CheckCircle color="#10b981" size={24} /> : <AlertCircle color="#ef4444" size={24} />}
                        <p style={{ color: '#fff', fontSize: '0.95rem', margin: 0, fontWeight: 600 }}>{scanResult.message}</p>
                    </div>
                )}

                <div style={{ 
                    marginTop: '20px', 
                    color: '#64748b', 
                    fontSize: '0.85rem', 
                    textAlign: 'center',
                    lineHeight: '1.5'
                }}>
                    Aponte a câmera para o QR Code do cartão do aluno. A presença será marcada automaticamente em todas as turmas de hoje.
                </div>
            </div>
            
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
