import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, CheckCircle, AlertCircle, RefreshCw, Clock, XCircle } from 'lucide-react';
import { api } from '../services/api';

interface QRScannerProps {
    onClose: () => void;
    onSuccess?: (message: string) => void;
}

type ToastType = 'success' | 'warning' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
    aluno?: string;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const isProcessingRef = useRef(false);
    const toastIdRef = useRef(0);

    // Som de feedback
    const playSound = useCallback((type: 'success' | 'warning' | 'error') => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            if (type === 'success') {
                // Som alegre - 2 beeps ascendentes
                oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.25);
            } else if (type === 'warning') {
                // Som neutro - 1 beep médio
                oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.2);
            } else {
                // Som de erro - beep grave
                oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.4);
            }
        } catch (e) {
            console.log('Áudio não suportado');
        }
    }, []);

    // Adicionar toast
    const addToast = useCallback((message: string, type: ToastType, aluno?: string) => {
        const id = ++toastIdRef.current;
        setToasts(prev => [...prev, { id, message, type, aluno }]);
        
        // Remove após 4 segundos
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const normalizeQrToken = (rawValue: string): string => {
        let token = rawValue.trim().toUpperCase();
        if (token.startsWith('ALUNO_')) return token;
        if (token.startsWith('LERPROVA:')) {
            return `ALUNO_${token.replace('LERPROVA:', '')}`;
        }
        if (/^[A-Z0-9]+$/.test(token)) return `ALUNO_${token}`;
        return rawValue;
    };

    const processQrCode = useCallback(async (decodedText: string) => {
        if (isProcessingRef.current || loading) return;
        isProcessingRef.current = true;

        try {
            setLoading(true);
            
            const qrToken = normalizeQrToken(decodedText);
            console.log('QR escaneado:', decodedText, '-> normalizado:', qrToken);
            
            const res = await api.scanQrCode(qrToken);
            
            // Determina o tipo de toast baseado no status
            if (res.status === 'registered') {
                playSound('success');
                addToast(res.message, 'success', res.aluno);
                if (onSuccess) onSuccess(res.message);
            } else if (res.status === 'already_present') {
                playSound('warning');
                addToast(res.message, 'warning', res.aluno);
            } else if (res.status === 'no_class') {
                playSound('warning');
                addToast(res.message, 'info', res.aluno);
            } else if (res.success) {
                playSound('success');
                addToast(res.message, 'success', res.aluno);
                if (onSuccess) onSuccess(res.message);
            }
            
            // Pausa curta antes de permitir novo scan
            await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (err: any) {
            console.error('Erro ao processar QR:', err);
            playSound('error');
            addToast(err.message || '❌ Aluno não encontrado', 'error');
        } finally {
            setLoading(false);
            isProcessingRef.current = false;
        }
    }, [loading, onSuccess, playSound, addToast]);

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
                    qrbox: { width: 350, height: 350 },
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
                maxWidth: '600px', 
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
                            minHeight: '400px'
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
                        Processando...
                    </div>
                )}

                <div style={{ 
                    marginTop: '20px', 
                    color: '#64748b', 
                    fontSize: '0.85rem', 
                    textAlign: 'center',
                    lineHeight: '1.5'
                }}>
                    Aponte a câmera para o QR Code do cartão do aluno.
                </div>
            </div>
            
            {/* Toast Container */}
            <div style={{
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 3000,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                width: '90%',
                maxWidth: '400px'
            }}>
                {toasts.map(toast => (
                    <div 
                        key={toast.id}
                        style={{
                            padding: '16px 20px',
                            borderRadius: '16px',
                            background: toast.type === 'success' 
                                ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                                : toast.type === 'warning'
                                ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                                : toast.type === 'info'
                                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                                : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            animation: 'slideIn 0.3s ease-out'
                        }}
                    >
                        {toast.type === 'success' && <CheckCircle size={24} color="#fff" />}
                        {toast.type === 'warning' && <Clock size={24} color="#fff" />}
                        {toast.type === 'info' && <AlertCircle size={24} color="#fff" />}
                        {toast.type === 'error' && <XCircle size={24} color="#fff" />}
                        <div style={{ flex: 1 }}>
                            {toast.aluno && (
                                <div style={{ 
                                    fontSize: '0.75rem', 
                                    opacity: 0.9, 
                                    marginBottom: '2px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    color: '#fff'
                                }}>
                                    {toast.type === 'success' ? 'PRESENÇA REGISTRADA' :
                                     toast.type === 'warning' ? 'JÁ PRESENTE' :
                                     toast.type === 'info' ? 'SEM AULA HOJE' : 'ERRO'}
                                </div>
                            )}
                            <div style={{ 
                                color: '#fff', 
                                fontWeight: 700, 
                                fontSize: toast.aluno ? '1.1rem' : '0.95rem'
                            }}>
                                {toast.aluno || toast.message}
                            </div>
                            {toast.aluno && (
                                <div style={{ 
                                    fontSize: '0.8rem', 
                                    opacity: 0.85, 
                                    marginTop: '2px',
                                    color: '#fff'
                                }}>
                                    {toast.message.replace(/^[✓⚠️❌]\s*/, '').replace(toast.aluno, '').trim()}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes slideIn {
                    from { 
                        opacity: 0; 
                        transform: translateY(-20px);
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
};
