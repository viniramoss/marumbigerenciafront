/* dashboard.js – gera cards e gráfico a partir da API */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Chart, registerables } = require('chart.js');
const { API_URL } = require('./env-config');
const config = require('./config');

// Inicializa Chart.js
Chart.register(...registerables);

// Variável para o gráfico
let chart = null;

/* ----- Funções auxiliares (helpers) ----- */

// Remove acentos e formata string para comparação
const slug = s => String(s ?? '').trim().toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

// Converte valor para número, lidando com formatação brasileira
function parseMoney(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  
  // Limpa a string mantendo apenas números, vírgulas, pontos e sinal negativo
  let s = String(v).replace(/[^0-9,.\-]/g, '');
  if (!s) return 0;
  
  // Identifica o separador decimal (último ponto ou vírgula)
  const d = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  
  // Formata para padrão americano (ponto como separador decimal)
  s = d !== -1 
    ? s.slice(0, d).replace(/[.,]/g, '') + '.' + s.slice(d + 1).replace(/[.,]/g, '')
    : s.replace(/[.,]/g, '');
  
  return parseFloat(s) || 0;
}

// Converte diversas representações para objeto Date
function parseDate(v) {
  // Se já é um Date, retorna ele mesmo
  if (v instanceof Date) return v;
  
  // Se é um número (código de data do Excel)
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return new Date(d.y, d.m - 1, d.d);
  }
  
  // Meses em português
  const pt = {jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11};
  
  // Tenta formatos como "dd/mmm" (ex: 10/jan)
  let m = String(v).match(/(\d{1,2})[\/\-]([a-z]{3})/i);
  if (m) {
    return new Date(new Date().getFullYear(), pt[m[2].toLowerCase()], +m[1]);
  }
  
  // Tenta formatos como "dd/mm/yyyy" (ex: 31/12/2023)
  m = String(v).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m.map(Number);
    if (y < 100) y += 2000;
    return new Date(y, mo - 1, d);
  }
  
  // Retorna data inválida se não conseguir converter
  return new Date(NaN);
}

// Determina a semana do mês para uma data
const weekOfMonth = d => Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);

// Tenta encontrar uma planilha Excel na área de trabalho
function findXlsx() {
  const desks = [
    path.join(os.homedir(), 'OneDrive', 'Área de Trabalho'),
    path.join(os.homedir(), 'Desktop')
  ];
  
  for (const d of desks) {
    if (!fs.existsSync(d)) continue;
    
    const f = fs.readdirSync(d).find(f => 
      f.toLowerCase().startsWith('planilha') && 
      f.toLowerCase().endsWith('.xlsx'));
    
    if (f) return path.join(d, f);
  }
  
  return null;
}

/* ----- Funções para buscar dados da API com retry ----- */

// Helper function to retry API calls
async function fetchWithRetry(url, options = {}, retries = 3, delay = 500) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response;
  } catch (error) {
    if (retries <= 1) throw error;
    console.warn(`Retrying fetch to ${url}. Attempts left: ${retries-1}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(url, options, retries - 1, delay * 1.5);
  }
}

// Função para buscar todas as despesas do mês atual (total)
async function getMonthlyExpenses() {
  try {
    // Busca todas as despesas
    const response = await fetchWithRetry(`${API_URL}/api/despesas`);
    const despesas = await response.json();
    
    // Filtra pelo mês atual
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyDespesas = despesas.filter(despesa => {
      if (!despesa || !despesa.data) return false;
      
      const despesaDate = new Date(despesa.data + 'T00:00');
      return despesaDate.getMonth() === currentMonth && 
             despesaDate.getFullYear() === currentYear;
    });
    
    // Soma todos os valores
    return monthlyDespesas.reduce((total, despesa) => {
      return total + Number(despesa.valor || 0);
    }, 0);
    
  } catch (error) {
    console.error('Erro ao buscar despesas mensais:', error);
    return 0;
  }
}

// Função para buscar despesas do mês atual filtradas por unidade
async function getMonthlyExpensesByUnit() {
  try {
    // Busca todas as despesas
    const response = await fetchWithRetry(`${API_URL}/api/despesas`);
    
    const despesas = await response.json();
    
    // Filtra pelo mês atual
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyDespesas = despesas.filter(despesa => {
      if (!despesa || !despesa.data) return false;
      
      const despesaDate = new Date(despesa.data + 'T00:00');
      return despesaDate.getMonth() === currentMonth && 
             despesaDate.getFullYear() === currentYear;
    });
    
    // Agrupa por unidade
    const result = { UN1: 0, UN2: 0 };
    
    monthlyDespesas.forEach(despesa => {
      if (despesa.unidade === 'UN1') {
        result.UN1 += Number(despesa.valor || 0);
      } else if (despesa.unidade === 'UN2') {
        result.UN2 += Number(despesa.valor || 0);
      }
    });
    
    return result;
    
  } catch (error) {
    console.error('Erro ao buscar despesas mensais por unidade:', error);
    return { UN1: 0, UN2: 0 };
  }
}

// Função para buscar apenas as despesas pagas do mês atual
async function getMonthlyPaidExpenses() {
  try {
    // Busca todas as despesas
    const response = await fetchWithRetry(`${API_URL}/api/despesas`);
    const despesas = await response.json();
    
    // Filtra pelo mês atual e pelas despesas pagas (campo pago = true)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Filtra em uma única passagem para melhor performance
    const monthlyPaidDespesas = despesas.reduce((total, despesa) => {
      if (!despesa || !despesa.data) return total;
      
      // Verifica a data
      const despesaDate = new Date(despesa.data + 'T00:00');
      const isCurrentMonth = despesaDate.getMonth() === currentMonth && 
                           despesaDate.getFullYear() === currentYear;
      
      // Verifica se a despesa está paga (campo pago = true)
      const isPaid = despesa.pago === true || despesa.pago === "true";
      
      // Se é do mês atual e está paga, soma ao total
      if (isCurrentMonth && isPaid) {
        return total + Number(despesa.valor || 0);
      }
      
      return total;
    }, 0);
    
    return monthlyPaidDespesas;
    
  } catch (error) {
    console.error('Erro ao buscar despesas mensais pagas:', error);
    return 0;
  }
}

// Função para buscar estatísticas de entrada do mês atual
async function getMonthlyRevenue() {
  try {
    const response = await fetchWithRetry(`${API_URL}/api/entradas/estatisticas/mes-atual`);
    const stats = await response.json();
    return Number(stats.totalGeral || 0);
  } catch (error) {
    console.error('Erro ao buscar estatísticas de entradas:', error);
    // Se não conseguir buscar da API, tenta outro método
    return getMonthlyRevenueAlternative();
  }
}

// Função para buscar entradas do mês atual filtradas por unidade
async function getMonthlyRevenueByUnit() {
  try {
    // Obtém o primeiro e último dia do mês atual
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const firstDayStr = firstDay.toISOString().split('T')[0];
    const lastDayStr = lastDay.toISOString().split('T')[0];
    
    // Busca todas as entradas do mês atual diretamente com filtro de data
    const response = await fetchWithRetry(
      `${API_URL}/api/entradas?dataInicio=${firstDayStr}&dataFim=${lastDayStr}`
    );
    const entradas = await response.json();
    
    console.log(`Entradas encontradas para faturamento por unidade: ${entradas.length}`);
    
    // Agrupa por unidade
    const result = { UN1: 0, UN2: 0 };
    
    entradas.forEach(entrada => {
      if (entrada.unidade === 'UN1') {
        result.UN1 += Number(entrada.total || 0);
      } else if (entrada.unidade === 'UN2') {
        result.UN2 += Number(entrada.total || 0);
      }
    });
    
    console.log('Faturamento por unidade calculado:', result);
    return result;
    
  } catch (error) {
    console.error('Erro ao buscar faturamento mensal por unidade:', error);
    return { UN1: 0, UN2: 0 };
  }
}

// Método alternativo para obter faturamento mensal
async function getMonthlyRevenueAlternative() {
  try {
    // Obtém o primeiro e último dia do mês atual
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Busca todas as entradas
    const response = await fetchWithRetry(`${API_URL}/api/entradas`);
    const entradas = await response.json();
    
    // Filtra por mês atual e soma
    const monthlyEntradas = entradas.filter(entrada => {
      if (!entrada || !entrada.data) return false;
      
      const entradaDate = new Date(entrada.data + 'T00:00');
      return entradaDate >= firstDay && entradaDate <= lastDay;
    });
    
    return monthlyEntradas.reduce((total, entrada) => {
      return total + Number(entrada.total || 0);
    }, 0);
    
  } catch (error) {
    console.error('Erro ao buscar faturamento mensal (método alternativo):', error);
    // Se tudo falhar, tenta usar Excel se disponível
    return getFaturamentoFromExcel();
  }
}

// Função para buscar entradas por semana do mês atual
async function getWeeklyRevenue() {
  try {
    // Obtém o primeiro e último dia do mês atual
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const firstDayStr = firstDay.toISOString().split('T')[0];
    const lastDayStr = lastDay.toISOString().split('T')[0];
    
    console.log('Buscando dados semanais do período:', firstDayStr, 'até', lastDayStr);
    
    // Busca as entradas do mês atual
    const response = await fetchWithRetry(`${API_URL}/api/entradas?dataInicio=${firstDayStr}&dataFim=${lastDayStr}`);
    const entradas = await response.json();
    console.log('Entradas retornadas da API:', entradas.length);
    
    // Agrupa por semana
    const weeklyData = {};
    
    entradas.forEach(entrada => {
      const entradaDate = new Date(entrada.data + 'T00:00');
      const week = weekOfMonth(entradaDate);
      
      weeklyData[week] = (weeklyData[week] || 0) + Number(entrada.total || 0);
    });
    
    console.log('Dados semanais processados:', weeklyData);
    return weeklyData;
  } catch (error) {
    console.error('Erro ao buscar dados semanais:', error);
    return {}; // Retorna objeto vazio em caso de erro
  }
}

// Função para tentar obter faturamento do Excel (fallback)
function getFaturamentoFromExcel() {
  try {
    const file = findXlsx();
    if (!file) return 0;

    const wb = XLSX.readFile(file, {cellDates: true});
    const fatSheets = wb.SheetNames.filter(n => slug(n).startsWith('fatmarumbi'));
    
    let totalFat = 0;

    // Filtrar pelo mês atual
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    for (const s of fatSheets) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[s], {header: 1, defval: ''});
      const h = rows.findIndex(r => r.map(slug).includes('dinheiro')); 
      if (h === -1) continue;
      
      const head = rows[h].map(slug);
      const idx = x => head.indexOf(x);
      const col = {
        d: idx('data'),
        t: idx('total'),
        din: idx('dinheiro'),
        deb: idx('debito'),
        cre: idx('credito'),
        pix: idx('pix'),
        vou: idx('voucher')
      };
      
      const hasTotal = col.t !== -1;
      for (let i = h + 1; i < rows.length; i++) {
        const r = rows[i]; 
        if (!r || r.every(c => c === '')) continue;
        
        const dt = parseDate(r[col.d]); 
        if (isNaN(dt)) continue;
        
        // Filtrar apenas entradas do mês atual
        if (dt.getMonth() !== currentMonth || dt.getFullYear() !== currentYear) {
          continue;
        }
        
        const v = hasTotal 
          ? parseMoney(r[col.t]) 
          : ['din', 'deb', 'cre', 'pix', 'vou'].reduce((s, k) => s + parseMoney(r[col[k]]), 0);
        
        totalFat += v;
      }
    }
    
    return totalFat;
  } catch (error) {
    console.error('Erro ao ler Excel:', error);
    return 0;
  }
}

/* ----- Funções de renderização ----- */

// Renderiza o card de fluxo de caixa
async function renderFluxoCard(faturamentoMensal, despesasPagas, capitalGiro) {
  try {
    // Usa o capitalGiro passado como parâmetro ou busca se não foi fornecido
    const giro = capitalGiro !== undefined ? capitalGiro : await config.getCapitalGiro();
    const dinheiroTotal = faturamentoMensal + giro;
    const fluxoCaixa = dinheiroTotal - despesasPagas;
    
    document.getElementById('card-fluxo').innerHTML = `
      <h3>FLUXO DE CAIXA</h3>
      <div class="card-value-row">
        <div class="card-label">Dinheiro Total:</div>
        <div class="card-value">R$ ${dinheiroTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
      </div>
      <div class="card-value-row">
        <div class="card-label">Despesas Pagas:</div>
        <div class="card-value">R$ ${despesasPagas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
      </div>
      <div class="card-value-row total">
        <div class="card-label">Fluxo de Caixa:</div>
        <div class="card-value">R$ ${fluxoCaixa.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
      </div>`;
  } catch (error) {
    console.error('Erro ao renderizar card de fluxo:', error);
    document.getElementById('card-fluxo').innerHTML = `
      <h3>FLUXO DE CAIXA</h3>
      <div class="error-message">Erro ao carregar dados</div>`;
  }
}

// Renderiza o card de faturamento e despesas
function renderFaturamentoCard(faturamentoMensal, despesasMensais, faturamentoPorUnidade, despesasPorUnidade) {
  // Garante que os objetos existam
  const fatPorUnidade = faturamentoPorUnidade || { UN1: 0, UN2: 0 };
  const despPorUnidade = despesasPorUnidade || { UN1: 0, UN2: 0 };

  // Calcula os totais
  const faturamentoUN1 = Number(fatPorUnidade.UN1 || 0);
  const faturamentoUN2 = Number(fatPorUnidade.UN2 || 0);
  const despesasUN1 = Number(despPorUnidade.UN1 || 0);
  const despesasUN2 = Number(despPorUnidade.UN2 || 0);
  
  // Se os valores por unidade não somam o total, usa o faturamento total dividido
  const totalFaturamentoPorUnidade = faturamentoUN1 + faturamentoUN2;
  let fatUN1 = faturamentoUN1;
  let fatUN2 = faturamentoUN2;
  
  // Se não temos valores por unidade mas temos o total, divide igualmente
  if (totalFaturamentoPorUnidade === 0 && faturamentoMensal > 0) {
    fatUN1 = faturamentoMensal / 2;
    fatUN2 = faturamentoMensal / 2;
    console.log('Faturamento dividido igualmente entre as unidades:', fatUN1, fatUN2);
  }
  
  const totalFaturamento = fatUN1 + fatUN2;
  const totalDespesas = despesasUN1 + despesasUN2;
  const diferenca = totalFaturamento - totalDespesas;
  
  document.getElementById('card-faturamento').innerHTML = `
    <h3>RESUMO MENSAL</h3>
    <div class="card-value-row">
      <div class="card-label">Faturamento Mensal M1:</div>
      <div class="card-value">R$ ${fatUN1.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
    </div>
    <div class="card-value-row">
      <div class="card-label">Faturamento Mensal M2:</div>
      <div class="card-value">R$ ${fatUN2.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
    </div>
    <div class="card-value-row">
      <div class="card-label">Despesa Mensal M1:</div>
      <div class="card-value">R$ ${despesasUN1.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
    </div>
    <div class="card-value-row">
      <div class="card-label">Despesa Mensal M2:</div>
      <div class="card-value">R$ ${despesasUN2.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
    </div>
    <div class="card-value-row total">
      <div class="card-label">Total:</div>
      <div class="card-value">R$ ${diferenca.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
    </div>`;
}

// Renderiza o gráfico na página de gráficos
function renderWeeklyChart(weekly) {
  // Verifica se estamos na página de gráficos
  const chartCanvas = document.getElementById('weekly-revenue-chart');
  if (!chartCanvas) {
    return;
  }

  // Prepara os dados para o gráfico
  const weeks = Object.keys(weekly).map(Number).sort((a, b) => a - b);
  const values = weeks.map(w => weekly[w]);
  
  // Verifica se o gráfico já existe
  if (chart) {
    // Atualiza os dados do gráfico existente em vez de recriar
    chart.data.labels = weeks.map(w => 'Semana ' + w);
    chart.data.datasets[0].data = values;
    chart.update();
    return;
  }
  
  // Se o gráfico não existe, criamos um novo
  const ctx = chartCanvas.getContext('2d');
  
  try {
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: weeks.map(w => 'Semana ' + w),
        datasets: [{
          data: values,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 4,
          backgroundColor: 'rgba(0, 112, 243, 0.1)',
          borderColor: 'rgba(0, 112, 243, 0.8)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {mode: 'nearest', intersect: false},
        plugins: {
          legend: {display: false},
          tooltip: {
            callbacks: {
              label: c => 'R$ ' + c.parsed.y.toLocaleString('pt-BR', {minimumFractionDigits: 2})
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {callback: v => 'R$ ' + v.toLocaleString('pt-BR')}
          }
        }
      }
    });
  } catch (error) {
    console.error('Erro ao renderizar o gráfico:', error);
  }
}

/* ----- Função principal ----- */

// Criar um cache para dados da API
const apiCache = {
  data: {},
  timestamp: {},
  ttl: 60000, // 1 minuto de TTL (tempo de vida) para o cache

  // Verifica se um dado no cache ainda é válido
  isValid(key) {
    return (
      this.data[key] !== undefined &&
      this.timestamp[key] !== undefined &&
      Date.now() - this.timestamp[key] < this.ttl
    );
  },

  // Armazena um dado no cache
  set(key, data) {
    this.data[key] = data;
    this.timestamp[key] = Date.now();
    return data;
  },

  // Recupera um dado do cache
  get(key) {
    return this.isValid(key) ? this.data[key] : null;
  }
};

// Inicializa a página
async function init() {
  // Verifica qual página está sendo exibida
  const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
  
  if (currentPage === 'dashboard') {
    // Estamos na dashboard - mostrar cards
    
    // Mostra um indicador de carregamento
    document.getElementById('card-fluxo').innerHTML = `
      <h3>FLUXO DE CAIXA</h3>
      <div class="loading-indicator">Carregando dados...</div>`;
    
    document.getElementById('card-faturamento').innerHTML = `
      <h3>RESUMO MENSAL</h3>
      <div class="loading-indicator">Carregando dados...</div>`;
    
    try {
      // Usa um único endpoint para buscar todas as despesas
      let despesas = apiCache.get('despesas');
      let faturamentoStats = apiCache.get('faturamento');
      let faturamentoPorUnidade = apiCache.get('faturamento_por_unidade');
      let capitalGiro = apiCache.get('capital_giro');

      // Busca os dados em paralelo com cache
      const fetchPromises = [];
      
      if (!despesas) {
        fetchPromises.push(
          fetchWithRetry(`${API_URL}/api/despesas`)
            .then(response => response.json())
            .then(data => apiCache.set('despesas', data))
        );
      }
      
      if (!faturamentoStats) {
        fetchPromises.push(
          fetchWithRetry(`${API_URL}/api/entradas/estatisticas/mes-atual`)
            .then(response => response.json())
            .then(data => apiCache.set('faturamento', data))
            .catch(() => apiCache.set('faturamento', { totalGeral: 0 }))
        );
      }
      
      if (!faturamentoPorUnidade) {
        fetchPromises.push(
          getMonthlyRevenueByUnit()
            .then(data => apiCache.set('faturamento_por_unidade', data))
        );
      }
      
      if (!capitalGiro) {
        fetchPromises.push(
          config.getCapitalGiro().then(data => apiCache.set('capital_giro', data))
        );
      }
      
      // Aguarda todas as requisições terminarem
      if (fetchPromises.length > 0) {
        await Promise.all(fetchPromises);
      }
      
      // Recupera os dados do cache
      despesas = apiCache.get('despesas') || [];
      faturamentoStats = apiCache.get('faturamento') || { totalGeral: 0 };
      faturamentoPorUnidade = apiCache.get('faturamento_por_unidade') || { UN1: 0, UN2: 0 };
      capitalGiro = apiCache.get('capital_giro') || 0;
      
      // Processa os dados em memória - filtra pelo mês atual
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const monthlyDespesas = despesas.filter(despesa => {
        if (!despesa || !despesa.data) return false;
        const despesaDate = new Date(despesa.data + 'T00:00');
        return despesaDate.getMonth() === currentMonth && 
               despesaDate.getFullYear() === currentYear;
      });
      
      // Calcula os valores necessários em memória
      const despesasMensais = monthlyDespesas.reduce((total, despesa) => {
        return total + Number(despesa.valor || 0);
      }, 0);
      
      const despesasPagas = monthlyDespesas
        .filter(despesa => despesa.pago === true || despesa.pago === "true")
        .reduce((total, despesa) => total + Number(despesa.valor || 0), 0);
      
      // Agrupa por unidade
      const despesasPorUnidade = { UN1: 0, UN2: 0 };
      monthlyDespesas.forEach(despesa => {
        if (despesa.unidade === 'UN1') {
          despesasPorUnidade.UN1 += Number(despesa.valor || 0);
        } else if (despesa.unidade === 'UN2') {
          despesasPorUnidade.UN2 += Number(despesa.valor || 0);
        }
      });
      
      // Recupera dados de faturamento
      const faturamentoMensal = Number(faturamentoStats.totalGeral || 0);
      
      // Debug - verifica os valores por unidade antes da renderização
      console.log('Faturamento por unidade:', faturamentoPorUnidade);
      
      // Renderiza os cards
      await renderFluxoCard(faturamentoMensal, despesasPagas, capitalGiro);
      renderFaturamentoCard(faturamentoMensal, despesasMensais, faturamentoPorUnidade, despesasPorUnidade);
      
    } catch (error) {
      console.error('Erro ao carregar dados para dashboard:', error);
      await renderFluxoCard(0, 0);
      renderFaturamentoCard(0, 0, { UN1: 0, UN2: 0 }, { UN1: 0, UN2: 0 });
    }
  } 
  else if (currentPage === 'graficos') {
    // Estamos na página de gráficos
    try {
      // Busca os dados semanais
      let weeklyData = apiCache.get('weekly_data');
      
      if (!weeklyData) {
        weeklyData = await getWeeklyRevenue();
        apiCache.set('weekly_data', weeklyData);
      }
      
      // Renderiza o gráfico
      renderWeeklyChart(weeklyData);
      
    } catch (error) {
      console.error('Erro ao carregar dados para gráficos:', error);
    }
  }
}

// Exporta as funções necessárias
module.exports.init = init;
module.exports.initTheme = () => {};