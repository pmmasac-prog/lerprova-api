import React, { useState } from 'react';
import { Crown, Check, ArrowRight, Zap } from 'lucide-react';
import './Assinatura.css';

export const Assinatura: React.FC = () => {
    const [isPro, setIsPro] = useState(false);
    const correctionsUsed = 12;
    const [isUpgrading, setIsUpgrading] = useState(false);

    const handleUpgrade = () => {
        setIsUpgrading(true);
        setTimeout(() => {
            alert('Upgrade realizado com sucesso!');
            setIsPro(true);
            setIsUpgrading(false);
        }, 1500);
    };

    return (
        <div className="assinatura-container">
            <div className="assinatura-header">
                <div className="plan-badge">
                    <Crown size={20} color={isPro ? '#f59e0b' : '#94a3b8'} />
                    <span className={`plan-text ${isPro ? 'pro' : ''}`}>
                        {isPro ? 'PLANO PRO ATIVO' : 'PLANO GRÁTIS'}
                    </span>
                </div>
                <h1 className="assinatura-title">
                    {isPro ? 'Sua experiência é Premium' : 'Desbloqueie todo o potencial'}
                </h1>
            </div>

            {!isPro && (
                <div className="promo-card">
                    <h2 className="promo-title">Assine o LERPROVA PRO</h2>
                    <p className="promo-subtitle">
                        Correções ilimitadas e relatórios avançados por apenas R$ 19,90/mês
                    </p>

                    <div className="features-list">
                        <div className="feature-item">
                            <Check size={20} color="#22c55e" />
                            <span>Correções de provas ILIMITADAS</span>
                        </div>
                        <div className="feature-item">
                            <Check size={20} color="#22c55e" />
                            <span>Exportação completa para Excel e PDF</span>
                        </div>
                        <div className="feature-item">
                            <Check size={20} color="#22c55e" />
                            <span>Suporte prioritário via WhatsApp</span>
                        </div>
                        <div className="feature-item">
                            <Check size={20} color="#22c55e" />
                            <span>Sincronização em nuvem 24/7</span>
                        </div>
                    </div>

                    <button
                        className="upgrade-btn"
                        onClick={handleUpgrade}
                        disabled={isUpgrading}
                    >
                        {isUpgrading ? (
                            <span>Processando...</span>
                        ) : (
                            <>
                                <span>Começar Agora</span>
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </div>
            )}

            <div className="usage-section">
                <h3 className="section-title">Seu Uso Atual</h3>
                <div className="stat-card">
                    <div className="stat-item">
                        <Zap size={24} color="#3b82f6" />
                        <div>
                            <div className="stat-label">Provas Corrigidas</div>
                            <div className="stat-value">
                                {correctionsUsed} {isPro ? '' : '/ 50'}
                            </div>
                        </div>
                    </div>

                    {!isPro && (
                        <div className="progress-bar">
                            <div
                                className="progress-indicator"
                                style={{ width: `${Math.min(100, correctionsUsed * 2)}%` }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {isPro && (
                <div className="success-card">
                    <p className="success-text">
                        Obrigado por apoiar o LERPROVA! Seu acesso PRO está garantido.
                    </p>
                </div>
            )}
        </div>
    );
};
