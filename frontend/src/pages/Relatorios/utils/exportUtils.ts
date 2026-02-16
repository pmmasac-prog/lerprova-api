import { api } from '../../../services/api';
import type { Resultado } from '../types';

export const handleExportCSV = async (
    activeTab: string,
    data: {
        filteredResults: Resultado[];
        resultados: Resultado[];
        selectedTurmaNome: string;
        searchQuery: string;
        minNota: number | null;
        sortOrder: 'asc' | 'desc';
        selectedGabarito: number | null;
        gabaritos: any[];
        getQuestaoAnalysis: () => any[];
        selectedTurma: number | null;
    }
) => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = `relatorio_${activeTab.toLowerCase()}_${new Date().toISOString().split('T')[0]}`;

    if (activeTab === 'Turma') {
        if (data.filteredResults.length === 0) { alert('Nenhum dado para exportar'); return; }
        headers = ['Posição', 'Nome', 'Acertos', 'Nota'];
        rows = data.filteredResults.map((r, idx) => [idx + 1, r.nome, r.acertos, r.nota.toFixed(1)]);
        filename = `ranking_turma_${data.selectedTurmaNome}`;
    } else if (activeTab === 'Aluno') {
        const list = data.resultados
            .filter((r) => !data.searchQuery || r.nome.toLowerCase().includes(data.searchQuery.toLowerCase()))
            .filter((r) => data.minNota === null || r.nota >= data.minNota)
            .sort((a, b) => data.sortOrder === 'desc' ? b.nota - a.nota : a.nota - b.nota);
        if (list.length === 0) { alert('Nenhum dado para exportar'); return; }
        headers = ['Nome', 'Código', 'Assunto', 'Data', 'Nota'];
        rows = list.map(r => [r.nome, r.aluno_codigo || 'N/A', r.assunto, r.data, r.nota.toFixed(1)]);
        filename = `ranking_global_alunos`;
    } else if (activeTab === 'Questão') {
        const stats = data.getQuestaoAnalysis();
        if (stats.length === 0) { alert('Nenhum dado para exportar'); return; }
        headers = ['Questão', 'Gabarito', 'Acertos', 'Erros', '% Acerto'];
        rows = stats.map(s => [s.questao, s.correta, s.acertos, s.erros, `${s.perc}%`]);
        filename = `analise_questoes_${data.gabaritos.find(g => g.id === data.selectedGabarito)?.titulo || 'gabarito'}`;
    } else if (activeTab === 'Presença') {
        if (!data.selectedTurma) { alert('Selecione uma turma'); return; }
        try {
            const [fetchedDates, fetchedAlunos, fetchedFreqs] = await Promise.all([
                api.getFrequenciaDates(data.selectedTurma),
                api.getAlunosByTurma(data.selectedTurma),
                api.getFrequenciaTurma(data.selectedTurma)
            ]);
            const dates = (fetchedDates as string[]).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            const freqsMap: { [key: string]: boolean } = {};
            fetchedFreqs.forEach((f: any) => { freqsMap[`${f.aluno_id}-${f.data}`] = f.presente; });

            headers = ['Aluno', '% Presença', ...dates];
            rows = fetchedAlunos.sort((a: any, b: any) => a.nome.localeCompare(b.nome)).map((aluno: any) => {
                let pCount = 0;
                dates.forEach(d => { if (freqsMap[`${aluno.id}-${d}`]) pCount++; });
                const pPerc = dates.length ? Math.round((pCount / dates.length) * 100) : 0;
                return [aluno.nome, `${pPerc}%`, ...dates.map(d => freqsMap[`${aluno.id}-${d}`] ? 'P' : 'F')];
            });
            filename = `frequencia_${data.selectedTurmaNome}`;
        } catch (e) {
            console.error(e);
            alert('Erro ao buscar dados');
            return;
        }
    }

    const csvContent = [
        headers.map(h => `"${h}"`).join(','),
        ...rows.map(row => row.map(cell => typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
};

export const handleExportPDF = async (
    activeTab: string,
    data: {
        selectedTurma: number | null;
        selectedTurmaNome: string;
        resultados: Resultado[];
        searchQuery: string;
        minNota: number | null;
        sortOrder: 'asc' | 'desc';
        getFilteredRanking: () => Resultado[];
        calculateStatsForExport: () => { media: number; aprovacao: number; total: number };
        setLoading: (l: boolean) => void;
    }
) => {
    let printContent = '';
    const dateStr = new Date().toLocaleString('pt-BR');

    if (activeTab === 'Presença') {
        if (!data.selectedTurma) {
            alert('Selecione uma turma para exportar');
            return;
        }

        try {
            data.setLoading(true);
            const [fetchedDates, fetchedAlunos, fetchedFreqs] = await Promise.all([
                api.getFrequenciaDates(data.selectedTurma),
                api.getAlunosByTurma(data.selectedTurma),
                api.getFrequenciaTurma(data.selectedTurma)
            ]);

            const dates = (fetchedDates as string[]).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            const freqsMap: { [key: string]: boolean } = {};
            fetchedFreqs.forEach((f: any) => {
                freqsMap[`${f.aluno_id}-${f.data}`] = f.presente;
            });

            printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Frequência - ${data.selectedTurmaNome}</title>
          <style>
            @media print { @page { size: landscape; margin: 1cm; } }
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #ccc; padding: 4px; text-align: center; }
            th { background: #f1f5f9; }
            .name-col { text-align: left; font-weight: bold; min-width: 150px; }
            .present { color: green; font-weight: bold; }
            .absent { color: red; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Frequência - ${data.selectedTurmaNome}</h1>
          <table>
            <thead>
              <tr>
                <th class="name-col">Aluno</th>
                <th>%</th>
                ${dates.map(d => `<th>${new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${fetchedAlunos.sort((a: any, b: any) => a.nome.localeCompare(b.nome)).map((aluno: any) => {
                let presentCount = 0;
                dates.forEach(d => { if (freqsMap[`${aluno.id}-${d}`]) presentCount++; });
                const percent = dates.length ? Math.round((presentCount / dates.length) * 100) : 0;

                return `
                  <tr>
                    <td class="name-col">${aluno.nome}</td>
                    <td>${percent}%</td>
                    ${dates.map(d => {
                    const isPresent = freqsMap[`${aluno.id}-${d}`];
                    return `<td class="${isPresent ? 'present' : 'absent'}">${isPresent ? 'P' : 'F'}</td>`;
                }).join('')}
                  </tr>
                `;
            }).join('')}
            </tbody>
          </table>
          <div style="margin-top: 20px; font-size: 10px; color: #666;">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
        </body>
        </html>
      `;

        } catch (error) {
            console.error('Erro ao exportar frequência:', error);
            alert('Erro ao exportar dados.');
            return;
        } finally {
            data.setLoading(false);
        }
    } else {
        const list = activeTab === 'Turma' ? data.getFilteredRanking() : data.resultados
            .filter((r) => !data.searchQuery || r.nome.toLowerCase().includes(data.searchQuery.toLowerCase()))
            .filter((r) => data.minNota === null || r.nota >= data.minNota)
            .sort((a: Resultado, b: Resultado) => data.sortOrder === 'desc' ? b.nota - a.nota : a.nota - b.nota);

        if (list.length === 0) { alert('Nenhum dado para exportar'); return; }
        const stats = activeTab === 'Turma' ? data.calculateStatsForExport() : {
            media: list.length ? list.reduce((a, b) => a + b.nota, 0) / list.length : 0,
            aprovacao: list.length ? Math.round((list.filter(r => r.nota >= 7).length / list.length) * 100) : 0,
            total: list.length
        };

        printContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Relatório - ${activeTab}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
              h1 { color: #0f172a; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
              .stats { display: flex; gap: 20px; margin: 20px 0; }
              .stat-box { flex: 1; padding: 15px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6; }
              .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
              .stat-value { font-size: 22px; font-weight: bold; color: #0f172a; margin-top: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { background: #0f172a; color: white; padding: 12px; text-align: left; font-size: 13px; }
              td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
              .nota { font-weight: bold; }
              .nota-alta { color: #16a34a; }
              .nota-media { color: #ca8a04; }
              .nota-baixa { color: #dc2626; }
              .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; }
            </style>
          </head>
          <body>
            <h1>${activeTab === 'Turma' ? `Desempenho da Turma - ${data.selectedTurmaNome}` : 'Ranking Global de Alunos'}</h1>
            <div class="stats">
              <div class="stat-box"><div class="stat-label">Média Geral</div><div class="stat-value">${stats.media.toFixed(1)}</div></div>
              <div class="stat-box"><div class="stat-label">Taxa de Aprovação</div><div class="stat-value">${stats.aprovacao}%</div></div>
              <div class="stat-box"><div class="stat-label">Total de Avaliações</div><div class="stat-value">${stats.total}</div></div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 50px;">Pos.</th>
                  <th>Nome</th>
                  ${activeTab === 'Aluno' ? '<th>Assunto/Gabarito</th>' : ''}
                  <th style="width: 80px;">Acertos</th>
                  <th style="width: 60px;">Nota</th>
                </tr>
              </thead>
              <tbody>
                ${list.map((r, idx) => `
                  <tr>
                    <td>${idx + 1}º</td>
                    <td style="font-weight: bold;">${r.nome}</td>
                    ${activeTab === 'Aluno' ? `<td>${r.assunto}</td>` : ''}
                    <td>${r.acertos}</td>
                    <td class="nota ${r.nota >= 7 ? 'nota-alta' : r.nota >= 5 ? 'nota-media' : 'nota-baixa'}">${r.nota.toFixed(1)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="footer">Gerado em ${dateStr} - LERPROVA</div>
          </body>
          </html>
        `;
    }

    if (printContent) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.onload = () => setTimeout(() => printWindow.print(), 250);
        } else {
            alert('Bloqueador de pop-ups detectado. Por favor, permita pop-ups para exportar PDF.');
        }
    }
};
