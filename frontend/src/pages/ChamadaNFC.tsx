import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Wifi, WifiOff, CheckCircle, AlertCircle, 
    User, Clock, Smartphone, Volume2, VolumeX, Search,
    Link2
} from 'lucide-react';
import { api } from '../services/api';
import './ChamadaNFC.css';

interface AlunoNFC {
    id: number;
    nome: string;
    codigo: string;
    nfc_id?: string;
    turmas: { id: number; nome: string }[];
}

interface PresencaRegistrada {
    id: number;
    aluno_id: number;
    aluno_nome: string;
    aluno_codigo: string;
    turma_nome: string;
    hora_entrada: string;
}

interface Turma {
    id: number;
    nome: string;
}

export const ChamadaNFC: React.FC = () => {
    const navigate = useNavigate();
    
    // NFC State
    const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
    const [nfcActive, setNfcActive] = useState(false);
    const [_nfcReader, setNfcReader] = useState<any>(null);
    const [lastRead, setLastRead] = useState<AlunoNFC | null>(null);
    const [readStatus, setReadStatus] = useState<'idle' | 'reading' | 'success' | 'error' | 'unknown'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    
    // Data State
    const [presencasHoje, setPresencasHoje] = useState<PresencaRegistrada[]>([]);
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [selectedTurma, setSelectedTurma] = useState<number | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    
    // Vinculação State
    const [showVinculacao, setShowVinculacao] = useState(false);
    const [pendingNfcId, setPendingNfcId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    // Check NFC support
    useEffect(() => {
        if ('NDEFReader' in window) {
            setNfcSupported(true);
        } else {
            setNfcSupported(false);
        }
    }, []);

    // Load data
    useEffect(() => {
        loadTurmas();
        loadPresencasHoje();
    }, []);

    const loadTurmas = async () => {
        try {
            const data = await api.getTurmas();
            setTurmas(data);
        } catch (error) {
            console.error('Erro ao carregar turmas:', error);
        }
    };

    const loadPresencasHoje = async () => {
        try {
            const params = selectedTurma ? `?turma_id=${selectedTurma}` : '';
            const data = await api.request(`/admin/frequencia/nfc/hoje${params}`);
            setPresencasHoje(data);
        } catch (error) {
            console.error('Erro ao carregar presenças:', error);
        }
    };

    // Play sound feedback
    const playSound = useCallback((type: 'success' | 'error') => {
        if (!soundEnabled) return;
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        if (type === 'success') {
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
        } else {
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
        }
    }, [soundEnabled]);

    // Register NFC presence
    const registerNFCPresence = async (nfcId: string) => {
        setReadStatus('reading');
        
        try {
            const data = await api.request('/admin/frequencia/nfc', {
                method: 'POST',
                body: JSON.stringify({
                    nfc_id: nfcId,
                    turma_id: selectedTurma
                })
            });
            
            setLastRead({
                id: data.aluno.id,
                nome: data.aluno.nome,
                codigo: data.aluno.codigo,
                turmas: data.turmas.map((t: any) => ({ id: 0, nome: t.turma }))
            });
            setReadStatus('success');
            playSound('success');
            loadPresencasHoje();
            
            // Reset after 3 seconds
            setTimeout(() => {
                setReadStatus('idle');
                setLastRead(null);
            }, 3000);
        } catch (error: any) {
            console.error('Erro:', error);
            if (error.message?.includes('não reconhecido') || error.message?.includes('404')) {
                // Cartão não vinculado
                setReadStatus('unknown');
                setPendingNfcId(nfcId);
                setShowVinculacao(true);
            } else {
                setErrorMessage(error.message || 'Erro ao registrar presença');
                setReadStatus('error');
            }
            playSound('error');
        }
    };

    // Start NFC reading
    const startNFC = async () => {
        if (!nfcSupported) return;
        
        try {
            const reader = new (window as any).NDEFReader();
            await reader.scan();
            
            reader.addEventListener('reading', ({ serialNumber }: any) => {
                console.log('NFC Read:', serialNumber);
                registerNFCPresence(serialNumber);
            });
            
            reader.addEventListener('readingerror', () => {
                setErrorMessage('Erro ao ler cartão NFC');
                setReadStatus('error');
                playSound('error');
            });
            
            setNfcReader(reader);
            setNfcActive(true);
        } catch (error: any) {
            console.error('NFC Error:', error);
            if (error.name === 'NotAllowedError') {
                setErrorMessage('Permissão NFC negada. Habilite nas configurações.');
            } else {
                setErrorMessage('Não foi possível iniciar NFC');
            }
            setNfcActive(false);
        }
    };

    const stopNFC = () => {
        setNfcActive(false);
        setNfcReader(null);
    };

    // Search students for linking
    const searchAlunos = async (term: string) => {
        if (term.length < 2) {
            setSearchResults([]);
            return;
        }
        
        setSearching(true);
        try {
            const data = await api.request(`/admin/alunos/search?q=${encodeURIComponent(term)}`);
            setSearchResults(data.slice(0, 10));
        } catch (error) {
            console.error('Erro na busca:', error);
        } finally {
            setSearching(false);
        }
    };

    // Link NFC to student
    const vincularNFC = async (alunoId: number) => {
        if (!pendingNfcId) return;
        
        try {
            await api.request(`/admin/alunos/${alunoId}/nfc`, {
                method: 'POST',
                body: JSON.stringify({ nfc_id: pendingNfcId })
            });
            
            setShowVinculacao(false);
            const savedNfcId = pendingNfcId;
            setPendingNfcId(null);
            setSearchTerm('');
            setSearchResults([]);
            // Tenta registrar presença novamente
            registerNFCPresence(savedNfcId);
        } catch (error: any) {
            console.error('Erro:', error);
            alert(error.message || 'Erro ao vincular cartão');
        }
    };

    const getStatusColor = () => {
        switch (readStatus) {
            case 'success': return 'var(--nfc-emerald)';
            case 'error': return '#ef4444';
            case 'unknown': return '#f59e0b';
            case 'reading': return '#3b82f6';
            default: return 'rgba(255,255,255,0.1)';
        }
    };

    return (
        <div className="nfc-container">
            {/* Header */}
            <header className="nfc-header">
                <div className="nfc-header-left">
                    <button className="nfc-back-btn" onClick={() => navigate('/admin')}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1>Chamada NFC</h1>
                        <p>Frequência por aproximação</p>
                    </div>
                </div>
                <button 
                    className={`nfc-sound-btn ${soundEnabled ? 'active' : ''}`}
                    onClick={() => setSoundEnabled(!soundEnabled)}
                >
                    {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
            </header>

            <main className="nfc-main">
                {/* NFC Status Card */}
                <section className="nfc-status-section">
                    {nfcSupported === false ? (
                        <div className="nfc-not-supported">
                            <WifiOff size={48} />
                            <h2>NFC não disponível</h2>
                            <p>Este dispositivo ou navegador não suporta Web NFC.</p>
                            <p className="nfc-hint">Use o Chrome no Android para esta funcionalidade.</p>
                        </div>
                    ) : (
                        <>
                            <div 
                                className={`nfc-reader-card ${nfcActive ? 'active' : ''} ${readStatus}`}
                                style={{ '--status-color': getStatusColor() } as React.CSSProperties}
                            >
                                <div className="nfc-reader-icon">
                                    {readStatus === 'success' ? (
                                        <CheckCircle size={64} />
                                    ) : readStatus === 'error' || readStatus === 'unknown' ? (
                                        <AlertCircle size={64} />
                                    ) : (
                                        <Smartphone size={64} />
                                    )}
                                </div>
                                
                                {lastRead && readStatus === 'success' ? (
                                    <div className="nfc-reader-result">
                                        <h2>{lastRead.nome}</h2>
                                        <p>#{lastRead.codigo}</p>
                                        <span className="nfc-success-badge">✓ Presença Registrada</span>
                                    </div>
                                ) : readStatus === 'reading' ? (
                                    <div className="nfc-reader-status">
                                        <h2>Processando...</h2>
                                    </div>
                                ) : readStatus === 'error' ? (
                                    <div className="nfc-reader-status error">
                                        <h2>Erro</h2>
                                        <p>{errorMessage}</p>
                                    </div>
                                ) : nfcActive ? (
                                    <div className="nfc-reader-status">
                                        <h2>Aguardando cartão...</h2>
                                        <p>Aproxime o cartão NFC do celular</p>
                                        <div className="nfc-pulse-ring" />
                                    </div>
                                ) : (
                                    <div className="nfc-reader-status">
                                        <h2>NFC Desativado</h2>
                                        <p>Clique para iniciar leitura</p>
                                    </div>
                                )}
                            </div>

                            <button 
                                className={`nfc-toggle-btn ${nfcActive ? 'active' : ''}`}
                                onClick={nfcActive ? stopNFC : startNFC}
                            >
                                {nfcActive ? (
                                    <>
                                        <WifiOff size={20} />
                                        Parar Leitura
                                    </>
                                ) : (
                                    <>
                                        <Wifi size={20} />
                                        Iniciar Leitura NFC
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </section>

                {/* Turma Filter */}
                <section className="nfc-filter-section">
                    <label>Filtrar por turma:</label>
                    <select 
                        value={selectedTurma || ''} 
                        onChange={(e) => {
                            setSelectedTurma(e.target.value ? Number(e.target.value) : null);
                            setTimeout(loadPresencasHoje, 100);
                        }}
                    >
                        <option value="">Todas as turmas</option>
                        {turmas.map(t => (
                            <option key={t.id} value={t.id}>{t.nome}</option>
                        ))}
                    </select>
                </section>

                {/* Today's Attendance */}
                <section className="nfc-attendance-section">
                    <div className="nfc-section-header">
                        <h3>Presenças Hoje ({presencasHoje.length})</h3>
                        <button onClick={loadPresencasHoje} className="nfc-refresh-btn">
                            Atualizar
                        </button>
                    </div>
                    
                    <div className="nfc-attendance-list">
                        {presencasHoje.length === 0 ? (
                            <div className="nfc-empty">
                                <User size={32} />
                                <p>Nenhuma presença registrada via NFC hoje</p>
                            </div>
                        ) : (
                            presencasHoje.map((p) => (
                                <div key={p.id} className="nfc-attendance-item">
                                    <div className="nfc-attendance-avatar">
                                        <User size={20} />
                                    </div>
                                    <div className="nfc-attendance-info">
                                        <span className="nfc-attendance-name">{p.aluno_nome}</span>
                                        <span className="nfc-attendance-turma">{p.turma_nome}</span>
                                    </div>
                                    <div className="nfc-attendance-time">
                                        <Clock size={14} />
                                        {p.hora_entrada}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </main>

            {/* Modal de Vinculação */}
            {showVinculacao && (
                <div className="nfc-modal-overlay" onClick={() => setShowVinculacao(false)}>
                    <div className="nfc-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="nfc-modal-header">
                            <Link2 size={24} />
                            <h3>Vincular Cartão NFC</h3>
                        </div>
                        <p className="nfc-modal-text">
                            Este cartão não está vinculado a nenhum aluno.
                            <br />
                            <strong>ID: {pendingNfcId}</strong>
                        </p>
                        
                        <div className="nfc-search-box">
                            <Search size={18} />
                            <input 
                                type="text"
                                placeholder="Buscar aluno por nome ou código..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    searchAlunos(e.target.value);
                                }}
                            />
                        </div>
                        
                        <div className="nfc-search-results">
                            {searching ? (
                                <p className="nfc-searching">Buscando...</p>
                            ) : searchResults.length > 0 ? (
                                searchResults.map((aluno) => (
                                    <div 
                                        key={aluno.id} 
                                        className="nfc-search-item"
                                        onClick={() => vincularNFC(aluno.id)}
                                    >
                                        <User size={18} />
                                        <div>
                                            <span className="nfc-search-name">{aluno.nome}</span>
                                            <span className="nfc-search-code">#{aluno.codigo}</span>
                                        </div>
                                        <Link2 size={16} className="nfc-link-icon" />
                                    </div>
                                ))
                            ) : searchTerm.length >= 2 ? (
                                <p className="nfc-no-results">Nenhum aluno encontrado</p>
                            ) : null}
                        </div>
                        
                        <button 
                            className="nfc-modal-cancel"
                            onClick={() => {
                                setShowVinculacao(false);
                                setPendingNfcId(null);
                                setReadStatus('idle');
                            }}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
