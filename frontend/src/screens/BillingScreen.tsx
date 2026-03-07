import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface BillingStatus {
    plan_type: string;
    subscription_expires_at: string;
    is_active: boolean;
    corrections_remaining: number;
    corrections_used: number;
    max_turmas: number;
    turmas_created: number;
    upgrade_available: boolean;
}

interface UpgradeOptions {
    label: string;
    value: string;
    price: number;
    features: string[];
}

const PLAN_OPTIONS: UpgradeOptions[] = [
    {
        label: 'Starter',
        value: 'starter',
        price: 29.90,
        features: ['Até 5 turmas', 'Até 100 correções/mês', 'Suporte por email']
    },
    {
        label: 'Pro',
        value: 'pro',
        price: 79.90,
        features: ['Até 20 turmas', 'Até 500 correções/mês', 'Suporte prioritário', 'Relatórios avançados']
    },
    {
        label: 'School',
        value: 'school',
        price: 199.90,
        features: ['Turmas ilimitadas', 'Correções ilimitadas', 'Suporte 24/7', 'Admin panel', 'API access']
    }
];

export const BillingScreen: React.FC = () => {
    const [status, setStatus] = useState<BillingStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedDuration, setSelectedDuration] = useState<number>(12);

    useEffect(() => {
        fetchBillingStatus();
    }, []);

    const fetchBillingStatus = async () => {
        try {
            setLoading(true);
            const data = await api.billing.getStatus();
            setStatus(data);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar status de faturamento');
            console.error('Billing error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async (planType: string) => {
        try {
            setUpgrading(true);
            setError(null);
            
            await api.billing.upgrade(planType, 'credit_card', selectedDuration);
            
            alert(`✅ Upgrade para ${planType.toUpperCase()} realizado com sucesso!`);
            await fetchBillingStatus();
        } catch (err: any) {
            setError(err.message || 'Erro ao fazer upgrade');
            console.error('Upgrade error:', err);
        } finally {
            setUpgrading(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Carregando informações de faturamento...</div>;
    }

    if (!status) {
        return <div className="p-8 text-center text-red-600">Erro ao carregar informações</div>;
    }

    const expiresDate = new Date(status.subscription_expires_at);
    const daysLeft = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Gerenciar Assinatura</h1>

            {error && (
                <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                </div>
            )}

            {/* Status Atual */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Plano Atual: <span className="text-blue-600 uppercase">{status.plan_type}</span></h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-gray-600 text-sm">Status</p>
                        <p className="font-semibold">{status.is_active ? '✅ Ativo' : '❌ Inativo'}</p>
                    </div>
                    <div>
                        <p className="text-gray-600 text-sm">Vence em</p>
                        <p className="font-semibold">{expiresDate.toLocaleDateString('pt-BR')}</p>
                        <p className="text-xs text-gray-500">{daysLeft} dias</p>
                    </div>
                    <div>
                        <p className="text-gray-600 text-sm">Turmas Usadas</p>
                        <p className="font-semibold">{status.turmas_created} / {status.max_turmas}</p>
                    </div>
                    <div>
                        <p className="text-gray-600 text-sm">Correções Usadas</p>
                        <p className="font-semibold">{status.corrections_used} / {status.corrections_remaining + status.corrections_used}</p>
                    </div>
                </div>

                {status.turmas_created >= status.max_turmas && (
                    <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded">
                        ⚠️ Você atingiu o limite de turmas do seu plano. Faça upgrade para continuar.
                    </div>
                )}
            </div>

            {/* Seleção de Duração */}
            <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Duração da Assinatura</h3>
                <div className="flex gap-4">
                    {[1, 3, 6, 12].map((months) => (
                        <button
                            key={months}
                            onClick={() => setSelectedDuration(months)}
                            className={`px-4 py-2 rounded border transition-colors ${
                                selectedDuration === months
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-600'
                            }`}
                        >
                            {months === 12 ? '1 ano' : `${months} mês${months > 1 ? 'es' : ''}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Planos Disponíveis */}
            <div className="grid md:grid-cols-3 gap-6">
                {PLAN_OPTIONS.map((plan) => (
                    <div
                        key={plan.value}
                        className="border rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow"
                    >
                        <h3 className="text-xl font-bold mb-2">{plan.label}</h3>
                        <p className="text-3xl font-bold text-blue-600 mb-4">
                            R$ {plan.price.toFixed(2)}/mês
                        </p>

                        <ul className="space-y-2 mb-6">
                            {plan.features.map((feature, idx) => (
                                <li key={idx} className="flex items-start text-sm text-gray-700">
                                    <span className="text-green-600 mr-2">✓</span>
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        {status.plan_type !== plan.value && (
                            <button
                                onClick={() => handleUpgrade(plan.value)}
                                disabled={upgrading || !status.upgrade_available}
                                className={`w-full py-2 px-4 rounded font-semibold transition-colors ${
                                    upgrading || !status.upgrade_available
                                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                            >
                                {upgrading ? 'Processando...' : `Escolher ${plan.label}`}
                            </button>
                        )}
                        {status.plan_type === plan.value && (
                            <button className="w-full py-2 px-4 rounded font-semibold bg-green-600 text-white">
                                ✓ Plano Atual
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="mt-12 p-6 bg-gray-50 rounded-lg text-center text-gray-600">
                <p>Dúvidas sobre os planos? Entre em contato conosco em <strong>suporte@lerprova.com.br</strong></p>
                <p className="text-sm mt-2">Todos os planos incluem período de teste de 7 dias. Cancele a qualquer momento.</p>
            </div>
        </div>
    );
};

export default BillingScreen;
