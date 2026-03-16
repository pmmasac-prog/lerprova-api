import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, CheckCircle, AlertCircle, Info, Camera, ZoomIn, Zap, ZapOff } from 'lucide-react';
import { api } from '../../../services/api';
import './ScannerModal.css';

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface ScannerModalProps {
    onClose: () => void;
    gabaritoId?: number;
    numQuestions?: number;
    onSuccess?: (resultado: any) => void;
}

type Phase = 'camera' | 'preview' | 'result';
type FlashMode = 'off' | 'auto' | 'on';
type Anchor = [number, number]; // [x_rel, y_rel] 0..1

// ─── Componente ──────────────────────────────────────────────────────────────
export const ScannerModal: React.FC<ScannerModalProps> = ({
    onClose,
    gabaritoId,
    numQuestions = 10,
    onSuccess,
}) => {
    // Refs
    const videoRef       = useRef<HTMLVideoElement>(null);
    const captureCanRef  = useRef<HTMLCanvasElement>(null);
    const pollCanRef     = useRef<HTMLCanvasElement>(null);
    const streamRef      = useRef<MediaStream | null>(null);
    const pollingRef     = useRef<number | null>(null);
    const isMountedRef   = useRef(true);
    const trackScoreRef  = useRef(0);

    // Estado da fase
    const [phase, setPhase]             = useState<Phase>('camera');
    const [isCamReady, setIsCamReady]   = useState(false);
    const [error, setError]             = useState<string | null>(null);

    // Ancoragem
    const [anchors, setAnchors]             = useState<Anchor[]>([]);
    const [trackScore, setTrackScore]       = useState(0);

    // Prévia
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    // Resultado
    const [result, setResult]               = useState<any>(null);
    const [processing, setProcessing]       = useState(false);
    const [activeTab, setActiveTab]         = useState<'original' | 'processed' | 'audit'>('audit');

    // Flash e Câmera
    const [flashMode, setFlashMode]         = useState<FlashMode>('off');
    const [hasFlash, setHasFlash]           = useState(false);

    // ─── Câmera ──────────────────────────────────────────────────────────────
    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            window.clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    }, []);

    const stopCamera = useCallback(() => {
        stopPolling();
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        const v = videoRef.current;
        if (v) {
            try { v.pause(); } catch {}
            // @ts-ignore
            v.srcObject = null;
            v.src = '';
        }
        setIsCamReady(false);
        setHasFlash(false);
    }, [stopPolling]);

    const startCamera = useCallback(async () => {
        try {
            setError(null);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width:  { ideal: 1920 },
                    height: { ideal: 1080 },
                    aspectRatio: { ideal: 1.7777777778 }, // Forçar proporção paisagem (16:9)
                    // Tenta configurar foco manual para documentos OMR
                    // @ts-ignore
                    advanced: [{ 
                        focusMode: 'continuous',
                        // @ts-ignore
                        torch: flashMode === 'on'
                    }],
                },
                audio: false,
            });

            const track = stream.getVideoTracks()[0];
            const caps = track.getCapabilities?.() || {};
            // @ts-ignore
            if (caps.torch) {
                setHasFlash(true);
            }

            streamRef.current = stream;
            const v = videoRef.current;
            if (!v) return;

            // @ts-ignore
            v.srcObject = stream;

            const onLoaded = async () => {
                try { await v.play(); } catch {}
                v.removeEventListener('loadedmetadata', onLoaded);
            };
            v.addEventListener('loadedmetadata', onLoaded);
            setIsCamReady(true);
        } catch (err) {
            console.error('Erro ao iniciar câmera:', err);
            setError('Não foi possível acessar a câmera. Verifique as permissões.');
        }
    }, [flashMode]);
    // ─── Controle de Flash ───────────────────────────────────────────────────
    const applyTorch = useCallback(async (on: boolean) => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track || !hasFlash) return;
        try {
            await track.applyConstraints({
                // @ts-ignore
                advanced: [{ torch: on }]
            });
        } catch (e) {
            console.warn('Falha ao acionar flash:', e);
        }
    }, [hasFlash]);

    const toggleFlash = useCallback(() => {
        setFlashMode(prev => {
            if (prev === 'off') return 'auto';
            if (prev === 'auto') return 'on';
            return 'off';
        });
    }, []);

    useEffect(() => {
        if (isCamReady && phase === 'camera') {
            applyTorch(flashMode === 'on');
        }
    }, [flashMode, isCamReady, phase, applyTorch]);

    // Cleanup na desmontagem
    useEffect(() => {
        isMountedRef.current = true;
        startCamera();
        return () => {
            isMountedRef.current = false;
            stopCamera();
        };
    }, [startCamera, stopCamera]);

    // ─── Reset de ancoragem ───────────────────────────────────────────────────
    const resetAnchors = useCallback(() => {
        setAnchors([]);
        setTrackScore(0);
        trackScoreRef.current = 0;
    }, []);

    // ─── Captura do frame para processamento ──────────────────────────────────
    const captureFrame = useCallback((): string | null => {
        const video  = videoRef.current;
        const canvas = captureCanRef.current;
        if (!video || !canvas) return null;
        if (video.videoWidth <= 0 || video.videoHeight <= 0) return null;

        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: false });
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.9);
    }, []);

    // ─── Ao capturar foto: para câmera, vai para pré-visualização ────────────
    const handleCapture = useCallback(async () => {
        if (flashMode === 'auto') {
            await applyTorch(true);
            // Pequeno delay para o flash estabilizar
            await new Promise(r => setTimeout(r, 300));
        }

        const img = captureFrame();
        
        if (flashMode === 'auto') {
            await applyTorch(false);
        }

        if (!img) {
            setError('Câmera não está pronta. Aguarde e tente novamente.');
            return;
        }
        stopCamera();

        // Salvar foto em background (fire-and-forget)
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        api.salvarFotoScanner({ image: img, timestamp: ts }).catch(() => {});

        setCapturedImage(img);
        setPhase('preview');
    }, [captureFrame, stopCamera, flashMode, applyTorch]);

    // ─── Processar imagem capturada ───────────────────────────────────────────
    const processCapture = useCallback(async () => {
        if (!capturedImage || processing) return;
        setProcessing(true);
        setError(null);

        try {
            const resp = await api.processarProva({
                image: capturedImage,
                num_questions: numQuestions,
                gabarito_id: gabaritoId,
            });

            if (resp && resp.success !== false) {
                setResult(resp);
                setPhase('result');
                onSuccess?.(resp);
            } else {
                setError(resp?.error || 'Falha ao processar imagem. Tente novamente.');
            }
        } catch (err: any) {
            setError(err.message || 'Erro de conexão com o servidor.');
        } finally {
            if (isMountedRef.current) setProcessing(false);
        }
    }, [capturedImage, gabaritoId, numQuestions, onSuccess, processing]);

    // ─── Retornar para câmera ─────────────────────────────────────────────────
    const handleRetake = useCallback(() => {
        setCapturedImage(null);
        setResult(null);
        setError(null);
        resetAnchors();
        setPhase('camera');
        startCamera();
    }, [resetAnchors, startCamera]);

    const handleClose = useCallback(() => {
        stopCamera();
        onClose();
    }, [onClose, stopCamera]);

    // ─── Polling de âncoras (só na fase câmera) ───────────────────────────────
    useEffect(() => {
        if (phase !== 'camera' || !isCamReady || processing) {
            stopPolling();
            return;
        }

        const pollRadar = async () => {
            const video  = videoRef.current;
            const canvas = pollCanRef.current;
            if (!video || !canvas) return;
            if (video.videoWidth <= 0) return;

            // Frame pequeno para o radar (mais rápido)
            const ratio = video.videoWidth / video.videoHeight;
            canvas.width  = 480;
            canvas.height = Math.round(480 / ratio);

            const ctx = canvas.getContext('2d', { willReadFrequently: false });
            if (!ctx) return;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = canvas.toDataURL('image/jpeg', 0.6);

            try {
                const radar = await api.scanAnchors({ image: imgData });

                if (radar?.success && radar?.anchors_found === 4 && Array.isArray(radar.anchors)) {
                    setAnchors(radar.anchors as Anchor[]);
                    const next = Math.min(trackScoreRef.current + 20, 100);
                    trackScoreRef.current = next;
                    setTrackScore(next);

                    if (next >= 100) {
                        // Auto-captura!
                        handleCapture();
                    }
                } else {
                    resetAnchors();
                }
            } catch {
                resetAnchors();
            }
        };

        pollingRef.current = window.setInterval(pollRadar, 400);
        return () => stopPolling();
    }, [phase, isCamReady, processing, handleCapture, resetAnchors, stopPolling]);

    // ─── Dimensões do vídeo para SVG overlay ─────────────────────────────────
    const videoEl = videoRef.current;
    const vW = videoEl?.offsetWidth  ?? 0;
    const vH = videoEl?.offsetHeight ?? 0;

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="sm-overlay" role="dialog" aria-modal="true" aria-label="Scanner OMR">
            <div className="sm-container">

                {/* ── HEADER ── */}
                <div className="sm-header">
                    <button className="sm-close-btn" onClick={handleClose} aria-label="Fechar">
                        <X size={20} />
                    </button>

                    <h3 className="sm-title">
                        {phase === 'camera'  && 'Scanner OMR'}
                        {phase === 'preview' && 'Confirmar Foto'}
                        {phase === 'result'  && 'Resultado'}
                    </h3>

                    {/* Indicador de fase */}
                    <div className="sm-phase-dots">
                        <span className={`sm-dot ${phase === 'camera' ? 'active' : 'done'}`} />
                        <span className={`sm-dot ${phase === 'preview' ? 'active' : phase === 'result' ? 'done' : ''}`} />
                        <span className={`sm-dot ${phase === 'result' ? 'active' : ''}`} />
                    </div>
                </div>

                {/* ── FASE 1: CÂMERA ── */}
                {phase === 'camera' && (
                    <div className="sm-camera-view">
                        <video ref={videoRef} autoPlay playsInline muted className="sm-video" />

                        {/* Frame guia com cantos */}
                        <div className={`sm-frame ${anchors.length === 4 ? 'locked' : ''}`}>
                            <div className="sm-corner sm-tl" />
                            <div className="sm-corner sm-tr" />
                            <div className="sm-corner sm-bl" />
                            <div className="sm-corner sm-br" />
                            {anchors.length < 4 && <div className="sm-scan-line" />}
                        </div>

                        {/* Controles da câmera (Flash) */}
                        <div className="sm-camera-controls">
                            {hasFlash && (
                                <button 
                                    className={`sm-control-btn ${flashMode !== 'off' ? 'active' : ''}`}
                                    onClick={toggleFlash}
                                    title={`Flash: ${flashMode === 'off' ? 'Desligado' : flashMode === 'auto' ? 'Disparo Único' : 'Lanterna'}`}
                                >
                                    {flashMode === 'off' && <ZapOff size={22} />}
                                    {flashMode === 'auto' && (
                                        <div className="relative">
                                            <Zap size={22} />
                                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full border border-black"></span>
                                        </div>
                                    )}
                                    {flashMode === 'on' && <Zap size={22} className="text-yellow-400 fill-yellow-400" />}
                                </button>
                            )}
                        </div>

                        {/* Overlay SVG das âncoras detectadas */}
                        {anchors.length === 4 && vW > 0 && vH > 0 && (
                            <svg
                                className="sm-ar-svg"
                                viewBox={`0 0 ${vW} ${vH}`}
                                preserveAspectRatio="none"
                            >
                                <polygon
                                    points={anchors.map(p => `${p[0] * vW},${p[1] * vH}`).join(' ')}
                                    fill="rgba(56, 189, 248, 0.15)"
                                    stroke="rgba(56, 189, 248, 1)"
                                    strokeWidth="2.5"
                                    strokeLinejoin="round"
                                />
                                {anchors.map((p, i) => (
                                    <circle
                                        key={i}
                                        cx={p[0] * vW}
                                        cy={p[1] * vH}
                                        r={7}
                                        fill="rgba(56, 189, 248, 1)"
                                    />
                                ))}
                            </svg>
                        )}

                        {/* Mensagem de instrução */}
                        <div className="sm-instruction" aria-live="polite">
                            <Info size={15} />
                            <span>
                                {anchors.length === 4
                                    ? trackScore >= 100
                                        ? 'Processando...'
                                        : 'Segure firme...'
                                    : 'Enquadre os 4 cantos do gabarito'}
                            </span>
                        </div>

                        {/* Erro */}
                        {error && (
                            <div className="sm-error" role="alert">
                                <AlertCircle size={16} /> <span>{error}</span>
                            </div>
                        )}

                        {/* Barra de progresso (só quando ancoragem detectada) */}
                        {anchors.length === 4 && (
                            <div className="sm-progress-bar">
                                <div className="sm-progress-fill" style={{ width: `${trackScore}%` }} />
                            </div>
                        )}

                        {/* Botão de captura manual */}
                        <button
                            className="sm-capture-btn"
                            onClick={handleCapture}
                            disabled={!isCamReady}
                            aria-label="Capturar foto"
                        >
                            <Camera size={26} />
                        </button>
                    </div>
                )}

                {/* ── FASE 2: PRÉ-VISUALIZAÇÃO ── */}
                {phase === 'preview' && (
                    <div className="sm-preview-view">
                        <div className="sm-preview-img-wrap">
                            <img src={capturedImage!} alt="Foto capturada" className="sm-preview-img" />
                            <div className="sm-preview-badge">
                                <ZoomIn size={14} /> Prévia
                            </div>
                        </div>

                        {error && (
                            <div className="sm-error sm-error--preview" role="alert">
                                <AlertCircle size={16} /> <span>{error}</span>
                            </div>
                        )}

                        <div className="sm-preview-actions">
                            <button
                                className="sm-btn-secondary"
                                onClick={handleRetake}
                                disabled={processing}
                            >
                                <RefreshCw size={18} /> Tirar Novamente
                            </button>
                            <button
                                className={`sm-btn-primary ${processing ? 'loading' : ''}`}
                                onClick={processCapture}
                                disabled={processing}
                            >
                                {processing
                                    ? <><RefreshCw size={18} className="spin" /> Processando...</>
                                    : <><CheckCircle size={18} /> Processar</>
                                }
                            </button>
                        </div>
                    </div>
                )}

                {/* ── FASE 3: RESULTADO ── */}
                {phase === 'result' && result && (
                    <div className="sm-result-view">
                        <div className="sm-result-header">
                            <div className={`sm-result-badge ${result.needs_review ? 'review' : 'ok'}`}>
                                {result.needs_review ? 'REVISÃO NECESSÁRIA' : 'CONCLUÍDO'}
                            </div>
                            <div className="sm-result-nota">{result.nota}</div>
                            <div className="sm-result-aluno">{result.aluno_nome}</div>
                        </div>

                        {/* Stats */}
                        <div className="sm-stats">
                            <div className="sm-stat">
                                <span className="sm-stat-label">Acertos</span>
                                <span className="sm-stat-value">{result.acertos}</span>
                            </div>
                            <div className="sm-stat">
                                <span className="sm-stat-label">Questões</span>
                                <span className="sm-stat-value">{numQuestions}</span>
                            </div>
                            <div className="sm-stat">
                                <span className="sm-stat-label">Gabarito</span>
                                <span className="sm-stat-value">#{result.gabarito_id}</span>
                            </div>
                        </div>

                        {/* Alertas de revisão */}
                        {result.needs_review && result.review_reasons?.length > 0 && (
                            <div className="sm-review-alert">
                                <AlertCircle size={15} />
                                <div>
                                    {result.review_reasons.map((r: string, i: number) => (
                                        <span key={i} className="sm-reason-tag">
                                            {r === 'low_confidence'       && 'Baixa Confiança'}
                                            {r === 'invalid_marks'        && 'Marcação Múltipla'}
                                            {r === 'too_many_ambiguous'   && 'Ambiguidade'}
                                            {r === 'perspective_warning'  && 'Ângulo da Câmera'}
                                            {!['low_confidence','invalid_marks','too_many_ambiguous','perspective_warning'].includes(r) && r}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Galeria de imagens com abas */}
                        {(result.audit_map || result.processed_image || result.original_image || capturedImage) && (
                            <div className="sm-gallery">
                                <div className="sm-tabs">
                                    {result.audit_map && (
                                        <button
                                            className={`sm-tab ${activeTab === 'audit' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('audit')}
                                        >Auditoria</button>
                                    )}
                                    {result.processed_image && (
                                        <button
                                            className={`sm-tab ${activeTab === 'processed' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('processed')}
                                        >Retificada</button>
                                    )}
                                    <button
                                        className={`sm-tab ${activeTab === 'original' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('original')}
                                    >Original</button>
                                </div>
                                <div className="sm-gallery-img-wrap">
                                    <img
                                        src={
                                            activeTab === 'audit'     ? result.audit_map :
                                            activeTab === 'processed' ? result.processed_image :
                                                                        (result.original_image || capturedImage!)
                                        }
                                        alt={
                                            activeTab === 'audit'     ? 'Mapa de auditoria com respostas marcadas' :
                                            activeTab === 'processed' ? 'Imagem retificada' :
                                                                        'Foto original'
                                        }
                                        className="sm-gallery-img"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Ações */}
                        <div className="sm-result-actions">
                            <button className="sm-btn-primary" onClick={handleRetake}>
                                <RefreshCw size={18} /> Próxima Prova
                            </button>
                            <button className="sm-btn-secondary" onClick={handleClose}>
                                Finalizar
                            </button>
                        </div>
                    </div>
                )}

                {/* Canvases ocultos */}
                <canvas ref={captureCanRef} style={{ display: 'none' }} />
                <canvas ref={pollCanRef}    style={{ display: 'none' }} />
            </div>
        </div>
    );
};