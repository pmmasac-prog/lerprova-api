import React, { useRef, useState, useEffect } from 'react';
import { X, Camera, RefreshCw, CheckCircle, AlertCircle, Info, ArrowLeft } from 'lucide-react';
import { api } from '../../../services/api';
import './ScannerModal.css';

interface ScannerModalProps {
    onClose: () => void;
    gabaritoId?: number;
    numQuestions?: number;
    onSuccess?: (resultado: any) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ onClose, gabaritoId, numQuestions = 10, onSuccess }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pollCanvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // AR Tracking State
    const [anchors, setAnchors] = useState<number[][]>([]);
    const [trackingScore, setTrackingScore] = useState(0);
    const trackingScoreRef = useRef(0);
    const pollingRef = useRef<number | null>(null);

    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsCameraReady(true);
            }
        } catch (err) {
            console.error('Erro ao acessar câmera:', err);
            setError('Não foi possível acessar a câmera. Verifique as permissões.');
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraReady(false);
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    // Fast Polling Loop para Scanner AR
    useEffect(() => {
        if (!isCameraReady || processing || result) {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
            return;
        }

        const pollRadar = async () => {
            if (!videoRef.current || !pollCanvasRef.current || processing) return;

            const video = videoRef.current;
            const canvas = pollCanvasRef.current;

            if (video.videoWidth > 0 && video.videoHeight > 0) {
                // Preservar aspect ratio real da câmera para evitar distorção (que quebra a circularidade no OMR)
                const videoRatio = video.videoWidth / video.videoHeight;
                canvas.width = 480; // Resolução leve pro Radar
                canvas.height = 480 / videoRatio;

                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageData = canvas.toDataURL('image/jpeg', 0.6); // Compressão alta

                    try {
                        const radar = await api.scanAnchors({ image: imageData });
                        if (radar.success && radar.anchors_found === 4) {
                            setAnchors(radar.anchors);
                            setTrackingScore(prev => Math.min(prev + 20, 100)); // Acumula pontuação de instabilidade
                            trackingScoreRef.current = Math.min(trackingScoreRef.current + 20, 100);

                            // ===== Auto-Capture Magic =====
                            if (trackingScoreRef.current >= 100 && !processing) {
                                captureAndProcess();
                            }
                        } else {
                            setAnchors([]);
                            setTrackingScore(prev => Math.max(prev - 40, 0)); // Reseta rápido se perder
                            trackingScoreRef.current = Math.max(trackingScoreRef.current - 40, 0);
                        }
                    } catch (e) {
                        // Ignora erros silenciosos do radar
                    }
                }
            }
        };

        pollingRef.current = window.setInterval(pollRadar, 300);
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [isCameraReady, processing, result]);

    const captureAndProcess = async () => {
        if (!videoRef.current || !canvasRef.current || processing) return;

        setProcessing(true);
        setError(null);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg', 0.85);

            try {
                const response = await api.processarProva({
                    image: imageData,
                    num_questions: numQuestions,
                    gabarito_id: gabaritoId
                });

                if (response.success) {
                    stopCamera(); // Encerrar câmera após uso/sucesso
                    setResult(response);
                    if (onSuccess) onSuccess(response);
                } else {
                    setError(response.error || 'Falha ao processar imagem.');
                }
            } catch (err) {
                console.error('Erro no processamento:', err);
                setError('Erro de conexão com o servidor.');
            } finally {
                setProcessing(false);
            }
        }
    };

    const handleReset = () => {
        setResult(null);
        setError(null);
        startCamera(); // Reiniciar câmera para nova prova
    };

    return (
        <div className="scanner-overlay">
            <div className="scanner-container">
                <div className="scanner-header">
                    <h3>Corrigir Prova</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button className="btn-text-nav" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
                            <ArrowLeft size={14} /> Sair
                        </button>
                        <button className="close-btn" onClick={onClose}><X /></button>
                    </div>
                </div>

                <div className="scanner-body">
                    {!result ? (
                        <div className="camera-view">
                            <video ref={videoRef} autoPlay playsInline muted />

                            {/* Overlay de Enquadramento */}
                            <div className="frame-overlay">
                                <div className="corner tl"></div>
                                <div className="corner tr"></div>
                                <div className="corner bl"></div>
                                <div className="corner br"></div>
                                <div className="scan-line"></div>
                            </div>

                            {/* SVG de Realidade Aumentada (Polígono Verde) */}
                            {anchors.length === 4 && videoRef.current && (
                                <svg className="ar-overlay" style={{
                                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10
                                }}>
                                    <polygon
                                        points={anchors.map(pt => `${pt[0] * videoRef.current!.offsetWidth},${pt[1] * videoRef.current!.offsetHeight}`).join(' ')}
                                        fill="rgba(16, 185, 129, 0.2)"
                                        stroke="#10b981"
                                        strokeWidth="3"
                                        strokeLinejoin="round"
                                    />
                                    {anchors.map((pt, i) => (
                                        <circle
                                            key={i}
                                            cx={pt[0] * videoRef.current!.offsetWidth}
                                            cy={pt[1] * videoRef.current!.offsetHeight}
                                            r="6"
                                            fill="#10b981"
                                        />
                                    ))}
                                </svg>
                            )}

                            {error && (
                                <div className="scanner-error" style={{ zIndex: 20 }}>
                                    <AlertCircle size={20} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="scanner-instructions" style={{ zIndex: 20 }}>
                                <Info size={16} />
                                <span>{anchors.length === 4 ? trackingScore >= 100 ? "Segure Firme..." : "Quase Perfeito!" : "Enquadre as 4 bolinhas pretas nos cantos do visor."}</span>
                            </div>

                            {/* Barra de Progresso Auto-Capture */}
                            {anchors.length === 4 && (
                                <div className="auto-capture-progress" style={{ width: '80%', height: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', margin: '0 auto', marginTop: '10px', zIndex: 20, position: 'relative' }}>
                                    <div style={{ width: `${trackingScore}%`, height: '100%', background: '#10b981', borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
                                </div>
                            )}

                            <button
                                className={`capture-btn ${processing ? 'loading' : ''}`}
                                onClick={captureAndProcess}
                                disabled={!isCameraReady || processing}
                                style={{ zIndex: 20 }}
                            >
                                {processing ? <RefreshCw className="spin" /> : <Camera />}
                                <span>{processing ? 'Analisando OMR...' : 'Captura Manual'}</span>
                            </button>
                        </div>
                    ) : (
                        <div className="result-view">
                            <div className="result-card">
                                <CheckCircle size={48} color="#10b981" />
                                <h2>Nota: {result.nota}</h2>
                                <p className="aluno-name">{result.aluno_nome}</p>
                                <div className="stats-row">
                                    <div className="stat">
                                        <span className="label">Acertos</span>
                                        <span className="value">{result.acertos}</span>
                                    </div>
                                    <div className="stat">
                                        <span className="label">Status</span>
                                        <span className="value success">CONCLUÍDO</span>
                                    </div>
                                </div>

                                {result.audit_map && (
                                    <div className="audit-preview">
                                        <label>Mapa de Auditoria:</label>
                                        <img src={result.audit_map} alt="Audit" />
                                    </div>
                                )}

                                <div className="result-actions">
                                    <button className="next-btn" onClick={handleReset}>
                                        <RefreshCw size={18} />
                                        <span>Próxima Prova</span>
                                    </button>
                                    <button className="finish-btn" onClick={onClose}>
                                        Finalizar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Canvases Hiddens para Foto Real e para Radar (Polling) */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <canvas ref={pollCanvasRef} style={{ display: 'none' }} />
        </div>
    );
};
