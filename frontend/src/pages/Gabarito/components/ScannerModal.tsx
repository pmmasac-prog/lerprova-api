// ScannerModal.tsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { api } from '../../../services/api';
import './ScannerModal.css';

interface ScannerModalProps {
    onClose: () => void;
    gabaritoId?: number;
    numQuestions?: number;
    onSuccess?: (resultado: any) => void;
}

type AnchorPoint = [number, number];

export const ScannerModal: React.FC<ScannerModalProps> = ({
    onClose,
    gabaritoId,
    numQuestions = 10,
    onSuccess
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const captureCanvasRef = useRef<HTMLCanvasElement>(null);
    const pollCanvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [isCameraReady, setIsCameraReady] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const [anchors, setAnchors] = useState<AnchorPoint[]>([]);
    const [trackingScore, setTrackingScore] = useState(0);

    const trackingScoreRef = useRef(0);
    const pollingRef = useRef<number | null>(null);
    const isMountedRef = useRef(true);

    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            window.clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    }, []);

    const stopCamera = useCallback(() => {
        stopPolling();

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }

        const v = videoRef.current;
        if (v) {
            try {
                v.pause();
            } catch { }
            // @ts-ignore
            v.srcObject = null;
            v.src = '';
        }

        setIsCameraReady(false);
    }, [stopPolling]);

    const startCamera = useCallback(async () => {
        try {
            setError(null);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });

            streamRef.current = stream;

            const v = videoRef.current;
            if (!v) return;

            // @ts-ignore
            v.srcObject = stream;

            // iOS/Safari: garantir que o play ocorra após metadata
            const onLoaded = async () => {
                try {
                    await v.play();
                } catch {
                    // se falhar, o usuário pode tocar no botão de captura e a tela continua funcional
                } finally {
                    v.removeEventListener('loadedmetadata', onLoaded);
                }
            };

            v.addEventListener('loadedmetadata', onLoaded);

            setIsCameraReady(true);
        } catch (err) {
            console.error('Erro ao acessar câmera:', err);
            setError('Não foi possível acessar a câmera. Verifique as permissões.');
            setIsCameraReady(false);
        }
    }, []);

    const resetTracking = useCallback(() => {
        setAnchors([]);
        setTrackingScore(0);
        trackingScoreRef.current = 0;
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        startCamera();

        return () => {
            isMountedRef.current = false;
            stopCamera();
        };
    }, [startCamera, stopCamera]);

    const captureAndProcess = useCallback(async () => {
        const video = videoRef.current;
        const canvas = captureCanvasRef.current;

        if (!video || !canvas || processing) return;
        if (video.videoWidth <= 0 || video.videoHeight <= 0) {
            setError('Câmera ainda não está pronta. Aguarde 1 segundo e tente novamente.');
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d', { willReadFrequently: false });
            if (!ctx) throw new Error('Canvas indisponível');

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = canvas.toDataURL('image/jpeg', 0.85);

            const response = await api.processarProva({
                image: imageData,
                num_questions: numQuestions,
                gabarito_id: gabaritoId
            });

            if (response && response.success !== false) {
                stopCamera();
                if (!isMountedRef.current) return;

                setResult(response);
                onSuccess?.(response);
            } else {
                setError(response?.error || 'Falha ao processar imagem.');
            }
        } catch (err: any) {
            console.error('Erro no processamento:', err);
            setError(err.message || 'Erro de conexão com o servidor.');
        } finally {
            if (isMountedRef.current) setProcessing(false);
        }
    }, [gabaritoId, numQuestions, onSuccess, processing, stopCamera]);

    useEffect(() => {
        // Se não pode ou não deve rodar o radar, para tudo
        if (!isCameraReady || processing || result) {
            stopPolling();
            return;
        }

        const pollRadar = async () => {
            const video = videoRef.current;
            const canvas = pollCanvasRef.current;

            if (!video || !canvas) return;
            if (processing) return;
            if (video.videoWidth <= 0 || video.videoHeight <= 0) return;

            const videoRatio = video.videoWidth / video.videoHeight;

            // Radar leve sem distorcer aspecto
            const targetW = 480;
            const targetH = Math.max(1, Math.round(targetW / videoRatio));
            canvas.width = targetW;
            canvas.height = targetH;

            const ctx = canvas.getContext('2d', { willReadFrequently: false });
            if (!ctx) return;

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = canvas.toDataURL('image/jpeg', 0.6);

            try {
                const radar = await api.scanAnchors({ image: imageData });

                if (radar?.success && radar?.anchors_found === 4 && Array.isArray(radar.anchors)) {
                    const nextAnchors: AnchorPoint[] = radar.anchors;
                    setAnchors(nextAnchors);

                    const nextScore = Math.min(trackingScoreRef.current + 20, 100);
                    trackingScoreRef.current = nextScore;
                    setTrackingScore(nextScore);

                    if (nextScore >= 100 && !processing) {
                        captureAndProcess();
                    }
                } else {
                    resetTracking();
                }
            } catch {
                // radar pode falhar silenciosamente; não derruba o scanner
                resetTracking();
            }
        };

        pollingRef.current = window.setInterval(pollRadar, 300);

        return () => stopPolling();
    }, [isCameraReady, processing, result, captureAndProcess, resetTracking, stopPolling]);

    const handleReset = useCallback(() => {
        setResult(null);
        setError(null);
        resetTracking();
        startCamera();
    }, [resetTracking, startCamera]);

    const handleClose = useCallback(() => {
        stopCamera();
        onClose();
    }, [onClose, stopCamera]);

    const v = videoRef.current;
    const videoW = v?.offsetWidth ?? 0;
    const videoH = v?.offsetHeight ?? 0;

    return (
        <div className="scanner-overlay">
            <div className="scanner-container">
                <div className="scanner-header">
                    <button className="close-btn" onClick={handleClose} aria-label="Fechar">
                        <X size={20} />
                    </button>

                    <h3>Scanner AR</h3>

                    <div className="header-spacer" aria-hidden="true" />
                </div>

                <div className="scanner-body">
                    {!result ? (
                        <div className="camera-view">
                            <video ref={videoRef} autoPlay playsInline muted />

                            <div className={`frame-overlay ${anchors.length === 4 ? 'active' : ''}`}>
                                <div className="frame-box">
                                    <div className="corner tl" />
                                    <div className="corner tr" />
                                    <div className="corner bl" />
                                    <div className="corner br" />
                                    {anchors.length < 4 && <div className="scan-line" />}
                                </div>
                            </div>

                            {anchors.length === 4 && videoW > 0 && videoH > 0 && (
                                <svg className="ar-overlay" viewBox={`0 0 ${videoW} ${videoH}`} preserveAspectRatio="none">
                                    <polygon
                                        points={anchors.map((pt) => `${pt[0] * videoW},${pt[1] * videoH}`).join(' ')}
                                        fill="rgba(16, 185, 129, 0.18)"
                                        stroke="rgba(16, 185, 129, 1)"
                                        strokeWidth="3"
                                        strokeLinejoin="round"
                                    />
                                    {anchors.map((pt, i) => (
                                        <circle
                                            key={i}
                                            cx={pt[0] * videoW}
                                            cy={pt[1] * videoH}
                                            r="6"
                                            fill="rgba(16, 185, 129, 1)"
                                        />
                                    ))}
                                </svg>
                            )}

                            {error && (
                                <div className="scanner-error" role="alert">
                                    <AlertCircle size={18} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="scanner-instructions" aria-live="polite">
                                <Info size={16} />
                                <span>
                                    {anchors.length === 4
                                        ? trackingScore >= 100
                                            ? 'Processando...'
                                            : 'Segure firme...'
                                        : 'Enquadre os 4 cantos na área'}
                                </span>
                            </div>

                            <button
                                className={`capture-btn ${processing ? 'loading' : ''}`}
                                onClick={captureAndProcess}
                                disabled={!isCameraReady || processing}
                                aria-label="Capturar Imagem"
                            >
                                {processing && <RefreshCw className="spin" size={24} />}
                            </button>

                            {anchors.length === 4 && (
                                <div className="auto-capture-progress" aria-hidden="true">
                                    <div className="auto-capture-bar" style={{ width: `${trackingScore}%` }} />
                                </div>
                            )}
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
                                        <span className={`value ${result.needs_review ? 'warning' : 'success'}`}>
                                            {result.needs_review ? 'REVISÃO NECESSÁRIA' : 'CONCLUÍDO'}
                                        </span>
                                    </div>
                                </div>

                                {result.needs_review && result.review_reasons && (
                                    <div className="review-alert">
                                        <Info size={16} />
                                        <div className="reasons">
                                            {result.review_reasons.map((r: string, idx: number) => (
                                                <span key={idx} className="reason-tag">
                                                    {r === 'low_confidence' && 'Baixa Confiança'}
                                                    {r === 'invalid_marks' && 'Marcação Múltipla'}
                                                    {r === 'too_many_ambiguous' && 'Ambiguidade'}
                                                    {!['low_confidence', 'invalid_marks', 'too_many_ambiguous'].includes(r) && r}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {result.audit_map && (
                                    <div className="audit-preview">
                                        <label>Mapa de Auditoria:</label>
                                        <img src={result.audit_map} alt="Mapa de auditoria" />
                                    </div>
                                )}

                                <div className="result-actions">
                                    <button className="next-btn" onClick={handleReset}>
                                        <RefreshCw size={18} />
                                        <span>Próxima Prova</span>
                                    </button>
                                    <button className="finish-btn" onClick={handleClose}>
                                        Finalizar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <canvas ref={captureCanvasRef} style={{ display: 'none' }} />
                <canvas ref={pollCanvasRef} style={{ display: 'none' }} />
            </div>
        </div>
    );
};