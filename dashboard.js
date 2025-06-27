/* dashboard.js – gera cards e gráfico a partir da API */

const { Chart, registerables } = require('chart.js');
const { API_URL } = require('./env-config');
const config = require('./config');
const utils = require('./utils');

// Inicializa Chart.js
Chart.register(...registerables);

// Variável para o gráfico
let chart = null;

// Variáveis para controle do mês selecionado
let selectedMonth = new Date().getMonth();
let selectedYear = new Date().getFullYear();

/* ----- Funções auxiliares (helpers) ----- */

// Atualiza o display do mês atual
function updateMonthDisplay() {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  const monthDisplay = document.getElementById('current-month-display');
  if (monthDisplay) {
    const monthText = `${monthNames[selectedMonth]} ${selectedYear}`;
    monthDisplay.textContent = monthText;
  }
}

// Navega para o mês anterior
function goToPreviousMonth() {
  selectedMonth--;
  if (selectedMonth < 0) {
    selectedMonth = 11;
    selectedYear--;
  }
  updateMonthDisplay();
  // Limpar cache quando mês muda
  apiCache.data = {};
  apiCache.timestamp = {};
  loadDashboardData();
}

// Navega para o próximo mês
function goToNextMonth() {
  selectedMonth++;
  if (selectedMonth > 11) {
    selectedMonth = 0;
    selectedYear++;
  }
  updateMonthDisplay();
  // Limpar cache quando mês muda
  apiCache.data = {};
  apiCache.timestamp = {};
  loadDashboardData();
}

// Determina a semana do mês para uma data
const weekOfMonth = d => Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);

// Converte diversas representações para objeto Date
function parseDate(v) {
  // Se já é um Date, retorna ele mesmo
  if (v instanceof Date) return v;
  
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

/* ----- Funções para buscar dados da API ----- */

// Função para buscar todas as despesas do mês selecionado (total)
async function getMonthlyExpenses() {
  try {
    // Busca todas as despesas
    const response = await utils.fetchWithRetry(`${API_URL}/api/despesas`);
    const despesas = await response.json();
    
    // Filtra pelo mês selecionado
    const monthlyDespesas = despesas.filter(despesa => {
      if (!despesa || !despesa.data) return false;
      
      const despesaDate = new Date(despesa.data + 'T00:00');
      return despesaDate.getMonth() === selectedMonth && 
             despesaDate.getFullYear() === selectedYear;
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

// Função para buscar despesas do mês selecionado filtradas por unidade
async function getMonthlyExpensesByUnit() {
  try {
    // Busca todas as despesas
    const response = await utils.fetchWithRetry(`${API_URL}/api/despesas`);
    
    const despesas = await response.json();
    
    // Filtra pelo mês selecionado
    const monthlyDespesas = despesas.filter(despesa => {
      if (!despesa || !despesa.data) return false;
      
      const despesaDate = new Date(despesa.data + 'T00:00');
      return despesaDate.getMonth() === selectedMonth && 
             despesaDate.getFullYear() === selectedYear;
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
    const response = await utils.fetchWithRetry(`${API_URL}/api/despesas`);
    const despesas = await response.json();
    
    // Filtra pelo mês selecionado e pelas despesas pagas (campo pago = true)
    // Filtra em uma única passagem para melhor performance
    const monthlyPaidDespesas = despesas.reduce((total, despesa) => {
      if (!despesa || !despesa.data) return total;
      
      // Verifica a data
      const despesaDate = new Date(despesa.data + 'T00:00');
      const isCurrentMonth = despesaDate.getMonth() === selectedMonth && 
                           despesaDate.getFullYear() === selectedYear;
      
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
    const response = await utils.fetchWithRetry(`${API_URL}/api/entradas/estatisticas/mes-atual`);
    const stats = await response.json();
    return Number(stats.totalGeral || 0);
  } catch (error) {
    console.error('Erro ao buscar estatísticas de entradas:', error);
    // Se não conseguir buscar da API, tenta outro método
    return getMonthlyRevenueAlternative();
  }
}

// Função para buscar salários pagos do mês selecionado
async function getMonthlySalariosPagos() {
  try {
    const response = await utils.fetchWithRetry(`${API_URL}/api/funcionarios`);
    const funcionarios = await response.json();
    
    // Criar padrão para filtrar pró-labore do mês selecionado
    const anoMes = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const padraoProLabore = `Pró-labore-${anoMes}`;
    
    // Filtrar funcionários de pró-labore
    const prolaboreFuncionarios = funcionarios.filter(f => f.nome.startsWith('Pró-labore'));
    
    // Filtrar funcionários de pró-labore do mês selecionado (novo formato e formato antigo)
    const prolaboreDoMes = prolaboreFuncionarios.filter(f => {
      // Novo formato: Pró-labore-2024-01 - descrição
      if (f.nome.includes(padraoProLabore)) return true;
      
      // Formato antigo: Pró-labore - descrição (considera como do mês atual apenas)
      if (f.nome.startsWith('Pró-labore - ') && selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear()) {
        return true;
      }
      
      return false;
    });
    
    // Filtra pelos funcionários pagos do mês selecionado
    // Inclui funcionários regulares pagos + pró-labore do mês selecionado (que são sempre pagos)
    const funcionariosPagos = funcionarios.filter(funcionario => {
      // Se é funcionário regular, verifica se está pago
      if (!funcionario.nome.startsWith('Pró-labore')) {
        return funcionario.pago === true;
      }
      // Se é pró-labore, só inclui os do mês selecionado
      if (funcionario.nome.includes(padraoProLabore)) return true;
      
      // Formato antigo: considera apenas se for o mês atual
      if (funcionario.nome.startsWith('Pró-labore - ') && selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear()) {
        return true;
      }
      
      return false;
    });
    
    const salariosPagos = funcionariosPagos
      .reduce((total, funcionario) => total + Number(funcionario.salario || 0), 0);
    
    return salariosPagos;
    
  } catch (error) {
    console.error('Erro ao buscar salários pagos:', error);
    return 0;
  }
}

// Função para buscar encargos pagos do mês selecionado
async function getMonthlyEncargosPagos() {
  try {
    const response = await utils.fetchWithRetry(`${API_URL}/api/encargos`);
    const encargos = await response.json();
    
    // Filtra pelos encargos pagos do mês selecionado
    const encargosPagos = encargos
      .filter(encargo => encargo.pago === true)
      .reduce((total, encargo) => total + Number(encargo.valor || 0), 0);
    
    return encargosPagos;
    
  } catch (error) {
    console.error('Erro ao buscar encargos pagos:', error);
    return 0;
  }
}

// Função para buscar outros pagos do mês selecionado
async function getMonthlyOutrosPagos() {
  try {
    const response = await utils.fetchWithRetry(`${API_URL}/api/outros`);
    const outros = await response.json();
    
    // Filtra pelos outros pagos do mês selecionado
    const outrosPagos = outros
      .filter(outro => outro.pago === true)
      .reduce((total, outro) => total + Number(outro.valor || 0), 0);
    
    return outrosPagos;
    
  } catch (error) {
    console.error('Erro ao buscar outros pagos:', error);
    return 0;
  }
}

// Função para buscar valor TOTAL das despesas fixas do mês selecionado (para resumo mensal)
async function getMonthlyDespesasFixasTotal() {
  try {
    // Criar formato do mês: YYYY-MM
    const anoMes = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    
    const response = await utils.fetchWithRetry(`${API_URL}/api/despesas-fixas?mesAno=${anoMes}`);
    const despesasFixas = await response.json();
    
    // Soma o valor TOTAL de todas as despesas fixas (restante + retirado)
    const totalDespesasFixas = despesasFixas.reduce((total, df) => {
      const valorTotal = Number(df.valorTotal || 0);
      return total + valorTotal;
    }, 0);
    
    return totalDespesasFixas;
    
  } catch (error) {
    console.error('Erro ao buscar despesas fixas:', error);
    return 0;
  }
}

// Função para buscar valor RETIRADO das despesas fixas do mês selecionado (para fluxo de caixa)
async function getMonthlyDespesasFixasRetirado() {
  try {
    // Abordagem alternativa: buscar diretamente as despesas com padrão DF-
    // e filtrar pelo mês selecionado
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    
    const response = await utils.fetchWithRetry(`${API_URL}/api/despesas`);
    const todasDespesas = await response.json();
    
    // Filtrar despesas que são retiradas de despesas fixas no mês selecionado E QUE ESTÃO PAGAS
    const retiradasDespesasFixas = todasDespesas.filter(despesa => {
      // Deve começar com o padrão DF- (identificador de retirada de despesa fixa)
      if (!despesa.fornecedor || !despesa.fornecedor.startsWith('DF-')) {
        return false;
      }
      
      // Considera apenas as despesas marcadas como pagas
      const estaPaga = despesa.pago === true || despesa.pago === "true";
      if (!estaPaga) return false;
      
      // Verificar se a data está no mês selecionado
      if (!despesa.data) return false;
      
      const dataDespesa = new Date(despesa.data);
      const noMesSelecionado = dataDespesa >= firstDay && dataDespesa <= lastDay;
      
      return noMesSelecionado;
    });
    
    const totalRetirado = retiradasDespesasFixas.reduce((total, despesa) => {
      const valor = Number(despesa.valor || 0);
      return total + valor;
    }, 0);
    
    return totalRetirado;
    
  } catch (error) {
    console.error('Erro ao buscar valor retirado das despesas fixas:', error);
    return 0;
  }
}

// Função para buscar detalhes das despesas fixas do mês selecionado (para distribuir por unidade)
async function getMonthlyDespesasFixasDetalhes() {
  try {
    // Criar formato do mês: YYYY-MM
    const anoMes = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    
    const response = await utils.fetchWithRetry(`${API_URL}/api/despesas-fixas?mesAno=${anoMes}`);
    const despesasFixas = await response.json();
    
    return despesasFixas;
    
  } catch (error) {
    console.error('Erro ao buscar detalhes das despesas fixas:', error);
    return [];
  }
}

// Função para buscar entradas do mês selecionado filtradas por unidade
async function getMonthlyRevenueByUnit() {
  try {
    // Obtém o primeiro e último dia do mês selecionado
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    
    const firstDayStr = firstDay.toISOString().split('T')[0];
    const lastDayStr = lastDay.toISOString().split('T')[0];
    
    // Busca todas as entradas do mês atual diretamente com filtro de data
    const response = await utils.fetchWithRetry(
      `${API_URL}/api/entradas?dataInicio=${firstDayStr}&dataFim=${lastDayStr}`
    );
    const entradas = await response.json();
    
    // Agrupa por unidade
    const result = { UN1: 0, UN2: 0 };
    
    entradas.forEach(entrada => {
      if (entrada.unidade === 'UN1') {
        result.UN1 += Number(entrada.total || 0);
      } else if (entrada.unidade === 'UN2') {
        result.UN2 += Number(entrada.total || 0);
      }
    });
    
    return result;
    
  } catch (error) {
    console.error('Erro ao buscar faturamento mensal por unidade:', error);
    return { UN1: 0, UN2: 0 };
  }
}

// Função para buscar folha de pagamento do mês atual (funcionários + encargos + outros + pró-labore)
async function getMonthlyPayroll() {
  try {
    // Buscar funcionários
    const funcionariosResponse = await utils.fetchWithRetry(`${API_URL}/api/funcionarios`);
    const funcionarios = await funcionariosResponse.json();
    
    // Buscar encargos
    let encargos = [];
    try {
      const encargosResponse = await utils.fetchWithRetry(`${API_URL}/api/encargos`);
      encargos = await encargosResponse.json();
    } catch (error) {
      // Encargos não disponíveis
    }
    
    // Buscar outros
    let outros = [];
    try {
      const outrosResponse = await utils.fetchWithRetry(`${API_URL}/api/outros`);
      outros = await outrosResponse.json();
    } catch (error) {
      // Outros não disponíveis
    }
    
    // Somar funcionários (excluindo pró-labore)
    const totalFuncionarios = funcionarios
      .filter(f => !f.nome.startsWith('Pró-labore'))
      .reduce((total, funcionario) => total + Number(funcionario.salario || 0), 0);
    
    // Somar encargos
    const totalEncargos = encargos.reduce((total, encargo) => total + Number(encargo.valor || 0), 0);
    
    // Somar outros
    const totalOutros = outros.reduce((total, outro) => total + Number(outro.valor || 0), 0);
    
    // Adicionar pró-labore total
    const prolaboreData = getProlaboreFromStorage();
    const totalProlabore = prolaboreData ? 
      (prolaboreData.UN1.total + prolaboreData.UN2.total) : 30000; // Valor padrão
    
    return totalFuncionarios + totalEncargos + totalOutros + totalProlabore;
    
  } catch (error) {
    console.error('Erro ao buscar folha de pagamento:', error);
    return 0;
  }
}

// Função para buscar folha de pagamento filtrada por unidade (funcionários + encargos + outros + pró-labore)
async function getMonthlyPayrollByUnit() {
  try {
    // Buscar funcionários
    const funcionariosResponse = await utils.fetchWithRetry(`${API_URL}/api/funcionarios`);
    const funcionarios = await funcionariosResponse.json();
    
    // Buscar encargos
    let encargos = [];
    try {
      const encargosResponse = await utils.fetchWithRetry(`${API_URL}/api/encargos`);
      encargos = await encargosResponse.json();
    } catch (error) {
      // Encargos não disponíveis
    }
    
    // Buscar outros
    let outros = [];
    try {
      const outrosResponse = await utils.fetchWithRetry(`${API_URL}/api/outros`);
      outros = await outrosResponse.json();
    } catch (error) {
      // Outros não disponíveis
    }
    
    // Agrupa por loja
    const result = { UN1: 0, UN2: 0 };
    
    // Somar funcionários (excluindo pró-labore)
    funcionarios.forEach(funcionario => {
      if (!funcionario.nome.startsWith('Pró-labore')) {
        if (funcionario.loja === 'UN1') {
          result.UN1 += Number(funcionario.salario || 0);
        } else if (funcionario.loja === 'UN2') {
          result.UN2 += Number(funcionario.salario || 0);
        }
      }
    });
    
    // Somar encargos por loja
    encargos.forEach(encargo => {
      if (encargo.loja === 'UN1') {
        result.UN1 += Number(encargo.valor || 0);
      } else if (encargo.loja === 'UN2') {
        result.UN2 += Number(encargo.valor || 0);
      }
    });
    
    // Somar outros por loja
    outros.forEach(outro => {
      if (outro.loja === 'UN1') {
        result.UN1 += Number(outro.valor || 0);
      } else if (outro.loja === 'UN2') {
        result.UN2 += Number(outro.valor || 0);
      }
    });
    
    // Adicionar valor TOTAL do pró-labore (não apenas retirado)
    const prolaboreData = getProlaboreFromStorage();
    if (prolaboreData) {
      result.UN1 += prolaboreData.UN1.total;
      result.UN2 += prolaboreData.UN2.total;
    } else {
      // Valores padrão se não encontrar no localStorage
      result.UN1 += 16500; // 55% de 30.000
      result.UN2 += 13500; // 45% de 30.000
    }
    
    return result;
    
  } catch (error) {
    console.error('Erro ao buscar folha de pagamento por unidade:', error);
    return { UN1: 0, UN2: 0 };
  }
}

// Função auxiliar para obter dados do pró-labore do localStorage
function getProlaboreFromStorage() {
  try {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const key = `prolabore_${ano}_${mes}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Erro ao carregar pró-labore do localStorage:', error);
    return null;
  }
}

// Função auxiliar para calcular distribuição do pró-labore
function calcularDistribuicaoProlabore(valor) {
  const DISTRIBUICAO_PADRAO = { 'UN1': 55, 'UN2': 45 };
  const valorUN1 = valor * (DISTRIBUICAO_PADRAO.UN1 / 100);
  const valorUN2 = valor * (DISTRIBUICAO_PADRAO.UN2 / 100);
  
  return {
    UN1: valorUN1,
    UN2: valorUN2,
    total: valorUN1 + valorUN2
  };
}

// Método alternativo para obter faturamento mensal
async function getMonthlyRevenueAlternative() {
  try {
    // Obtém o primeiro e último dia do mês atual
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Busca todas as entradas
    const response = await utils.fetchWithRetry(`${API_URL}/api/entradas`);
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
    return 0;
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
    
    // Busca as entradas do mês atual
    const response = await utils.fetchWithRetry(`${API_URL}/api/entradas?dataInicio=${firstDayStr}&dataFim=${lastDayStr}`);
    const entradas = await response.json();
    
    // Agrupa por semana
    const weeklyData = {};
    
    entradas.forEach(entrada => {
      const entradaDate = new Date(entrada.data + 'T00:00');
      const week = weekOfMonth(entradaDate);
      
      weeklyData[week] = (weeklyData[week] || 0) + Number(entrada.total || 0);
    });
    
    return weeklyData;
  } catch (error) {
    console.error('Erro ao buscar dados semanais:', error);
    return {}; // Retorna objeto vazio em caso de erro
  }
}

/* ----- Funções de renderização ----- */

// Renderiza o card de fluxo de caixa
async function renderFluxoCard(faturamentoMensal, despesasPagas, capitalGiro, salariosPagos = 0, encargosPagos = 0, outrosPagos = 0, despesasFixasRetirado = 0) {
  try {
    // Usa o capitalGiro passado como parâmetro ou busca se não foi fornecido
    const giro = capitalGiro !== undefined ? capitalGiro : await config.getCapitalGiro();
    const dinheiroTotal = faturamentoMensal + giro;
    const folhaPaga = salariosPagos + encargosPagos + outrosPagos;
    // No fluxo, soma apenas o valor RETIRADO das despesas fixas
    const totalDespesasPagas = despesasPagas + despesasFixasRetirado;
    const totalGastos = totalDespesasPagas + folhaPaga;
    const fluxoCaixa = dinheiroTotal - totalGastos;
    
    // LOG CONSOLIDADO DO FLUXO DE CAIXA
    console.log('💰 FLUXO DE CAIXA - CÁLCULO DOS VALORES:');
    console.log('═══════════════════════════════════════');
    console.log('💵 ENTRADA DE DINHEIRO:');
    console.log(`   Faturamento Mensal: R$ ${faturamentoMensal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   Capital de Giro: R$ ${giro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   TOTAL ENTRADA: R$ ${dinheiroTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log('');
    console.log('💸 SAÍDA DE DINHEIRO:');
    console.log(`   Despesas Pagas (normais, excluindo retiradas DF-*): R$ ${despesasPagas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   Despesas Fixas Retiradas: R$ ${despesasFixasRetirado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   Total Despesas Pagas: R$ ${totalDespesasPagas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   Salários Pagos: R$ ${salariosPagos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   Encargos Pagos: R$ ${encargosPagos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   Outros Pagos: R$ ${outrosPagos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   Total Folha Paga: R$ ${folhaPaga.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   TOTAL SAÍDA: R$ ${totalGastos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log('');
    console.log('🧮 RESULTADO FINAL:');
    console.log(`   Fluxo de Caixa = R$ ${dinheiroTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})} - R$ ${totalGastos.toLocaleString('pt-BR', {minimumFractionDigits: 2})} = R$ ${fluxoCaixa.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log('═══════════════════════════════════════');
    
    document.getElementById('card-fluxo').innerHTML = `
      <h3>FLUXO DE CAIXA</h3>
      <div class="card-value-row">
        <div class="card-label">Dinheiro Total:</div>
        <div class="card-value">R$ ${dinheiroTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
      </div>
      <div class="card-value-row">
        <div class="card-label">Despesas Pagas:</div>
        <div class="card-value">R$ ${totalDespesasPagas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
      </div>
      <div class="card-value-row">
        <div class="card-label">Folha Paga:</div>
        <div class="card-value">R$ ${folhaPaga.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
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
function renderFaturamentoCard(faturamentoMensal, despesasMensais, faturamentoPorUnidade, despesasPorUnidade, folhaPagamentoPorUnidade, despesasFixasTotal = 0) {
  // Garante que os objetos existam
  const fatPorUnidade = faturamentoPorUnidade || { UN1: 0, UN2: 0 };
  const despPorUnidade = despesasPorUnidade || { UN1: 0, UN2: 0 };
  const folhaPorUnidade = folhaPagamentoPorUnidade || { UN1: 0, UN2: 0 };

  // Calcula os totais
  const faturamentoUN1 = Number(fatPorUnidade.UN1 || 0);
  const faturamentoUN2 = Number(fatPorUnidade.UN2 || 0);
  const despesasUN1 = Number(despPorUnidade.UN1 || 0);
  const despesasUN2 = Number(despPorUnidade.UN2 || 0);
  const folhaUN1 = Number(folhaPorUnidade.UN1 || 0);
  const folhaUN2 = Number(folhaPorUnidade.UN2 || 0);
  
  // Se os valores por unidade não somam o total, usa o faturamento total dividido
  const totalFaturamentoPorUnidade = faturamentoUN1 + faturamentoUN2;
  let fatUN1 = faturamentoUN1;
  let fatUN2 = faturamentoUN2;
  
  // Se não temos valores por unidade mas temos o total, divide igualmente
  if (totalFaturamentoPorUnidade === 0 && faturamentoMensal > 0) {
    fatUN1 = faturamentoMensal / 2;
    fatUN2 = faturamentoMensal / 2;
  }
  
  // BUSCAR E DISTRIBUIR DESPESAS FIXAS POR UNIDADE
  let despesasFixasUN1 = 0;
  let despesasFixasUN2 = 0;
  
  // Buscar despesas fixas do cache ou chamar a API
  const despesasFixasCache = apiCache.get('despesas_fixas_detalhes');
  if (despesasFixasCache) {
    despesasFixasCache.forEach(df => {
      if (df.unidade === 'UN1') {
        despesasFixasUN1 += Number(df.valorTotal || 0);
      } else if (df.unidade === 'UN2') {
        despesasFixasUN2 += Number(df.valorTotal || 0);
      }
    });
  }
  
  const totalFaturamento = fatUN1 + fatUN2;
  const totalDespesas = despesasUN1 + despesasUN2 + despesasFixasUN1 + despesasFixasUN2;
  const totalFolhaPagamento = folhaUN1 + folhaUN2;
  const diferenca = totalFaturamento - totalDespesas - totalFolhaPagamento;
  
  // LOG CONSOLIDADO COM TODAS AS OPERAÇÕES E VALORES DISCRIMINADOS
  console.log('📊 DASHBOARD - CÁLCULO DOS VALORES:');
  console.log('════════════════════════════════════');
  console.log('🏪 FATURAMENTO:');
  console.log(`   UN1: R$ ${fatUN1.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   UN2: R$ ${fatUN2.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   TOTAL: R$ ${totalFaturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log('');
  console.log('💳 DESPESAS NORMAIS (excluindo retiradas DF-*):');
  console.log(`   UN1: R$ ${despesasUN1.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   UN2: R$ ${despesasUN2.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   SUBTOTAL: R$ ${(despesasUN1 + despesasUN2).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log('');
  console.log('🏦 DESPESAS FIXAS:');
  console.log(`   UN1: R$ ${despesasFixasUN1.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   UN2: R$ ${despesasFixasUN2.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   SUBTOTAL: R$ ${(despesasFixasUN1 + despesasFixasUN2).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log('');
  console.log('👥 FOLHA DE PAGAMENTO:');
  console.log(`   UN1: R$ ${folhaUN1.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   UN2: R$ ${folhaUN2.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   TOTAL: R$ ${totalFolhaPagamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log('');
  console.log('🧮 OPERAÇÕES FINAIS:');
  console.log(`   Despesa Mensal M1 = R$ ${despesasUN1.toLocaleString('pt-BR', {minimumFractionDigits: 2})} + R$ ${despesasFixasUN1.toLocaleString('pt-BR', {minimumFractionDigits: 2})} = R$ ${(despesasUN1 + despesasFixasUN1).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Despesa Mensal M2 = R$ ${despesasUN2.toLocaleString('pt-BR', {minimumFractionDigits: 2})} + R$ ${despesasFixasUN2.toLocaleString('pt-BR', {minimumFractionDigits: 2})} = R$ ${(despesasUN2 + despesasFixasUN2).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Total de Despesas = R$ ${totalDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Resultado Final = R$ ${totalFaturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})} - R$ ${totalDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})} - R$ ${totalFolhaPagamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})} = R$ ${diferenca.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log('════════════════════════════════════');
  
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
      <div class="card-value">R$ ${(despesasUN1 + despesasFixasUN1).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
    </div>
    <div class="card-value-row">
      <div class="card-label">Despesa Mensal M2:</div>
      <div class="card-value">R$ ${(despesasUN2 + despesasFixasUN2).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
    </div>
    <div class="card-value-row">
      <div class="card-label">Folha Pagamento M1:</div>
      <div class="card-value">R$ ${folhaUN1.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
    </div>
    <div class="card-value-row">
      <div class="card-label">Folha Pagamento M2:</div>
      <div class="card-value">R$ ${folhaUN2.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
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

// Função para limpar cache e recarregar dados (para debug)
function forceReload() {
  console.log('🔄 FORÇANDO LIMPEZA COMPLETA DO CACHE');
  apiCache.data = {};
  apiCache.timestamp = {};
  loadDashboardData();
}

// Adiciona função global para debug
window.forceReload = forceReload;

// Carrega os dados da dashboard para o mês selecionado
async function loadDashboardData() {
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
      let folhaPagamentoPorUnidade = apiCache.get('folha_pagamento_por_unidade');
      let capitalGiro = apiCache.get('capital_giro');

      // Busca os dados em paralelo com cache
      const fetchPromises = [];
      
      if (!despesas) {
        fetchPromises.push(
          utils.fetchWithRetry(`${API_URL}/api/despesas`)
            .then(response => response.json())
            .then(data => apiCache.set('despesas', data))
        );
      }
      
      if (!faturamentoStats) {
        fetchPromises.push(
          utils.fetchWithRetry(`${API_URL}/api/entradas/estatisticas/mes-atual`)
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
      
      if (!folhaPagamentoPorUnidade) {
        fetchPromises.push(
          getMonthlyPayrollByUnit()
            .then(data => apiCache.set('folha_pagamento_por_unidade', data))
        );
      }
      
      if (!capitalGiro) {
        fetchPromises.push(
          config.getCapitalGiro().then(data => apiCache.set('capital_giro', data))
        );
      }
      
      // Buscar salários, encargos e outros pagos
      fetchPromises.push(
        getMonthlySalariosPagos()
          .then(data => apiCache.set('salarios_pagos', data))
      );
      
      fetchPromises.push(
        getMonthlyEncargosPagos()
          .then(data => apiCache.set('encargos_pagos', data))
      );
      
      fetchPromises.push(
        getMonthlyOutrosPagos()
          .then(data => apiCache.set('outros_pagos', data))
      );
      
      fetchPromises.push(
        getMonthlyDespesasFixasTotal()
          .then(data => apiCache.set('despesas_fixas_total', data))
      );
      
      fetchPromises.push(
        getMonthlyDespesasFixasRetirado()
          .then(data => apiCache.set('despesas_fixas_retirado', data))
      );
      
      fetchPromises.push(
        getMonthlyDespesasFixasDetalhes()
          .then(data => apiCache.set('despesas_fixas_detalhes', data))
      );
      
      // Aguarda todas as requisições terminarem
      if (fetchPromises.length > 0) {
        await Promise.all(fetchPromises);
      }
      
      // Recupera os dados do cache
      despesas = apiCache.get('despesas') || [];
      faturamentoStats = apiCache.get('faturamento') || { totalGeral: 0 };
      faturamentoPorUnidade = apiCache.get('faturamento_por_unidade') || { UN1: 0, UN2: 0 };
      folhaPagamentoPorUnidade = apiCache.get('folha_pagamento_por_unidade') || { UN1: 0, UN2: 0 };
      capitalGiro = apiCache.get('capital_giro') || 0;
      const salariosPagos = apiCache.get('salarios_pagos') || 0;
      const encargosPagos = apiCache.get('encargos_pagos') || 0;
      const outrosPagos = apiCache.get('outros_pagos') || 0;
      const despesasFixasTotal = apiCache.get('despesas_fixas_total') || 0;
      const despesasFixasRetirado = apiCache.get('despesas_fixas_retirado') || 0;
      
      // Processa os dados em memória - filtra pelo mês selecionado
      const monthlyDespesas = despesas.filter(despesa => {
        if (!despesa || !despesa.data) return false;
        const despesaDate = new Date(despesa.data + 'T00:00');
        return despesaDate.getMonth() === selectedMonth && 
               despesaDate.getFullYear() === selectedYear;
      });
      
      // Log de despesas de retirada encontradas
      const despesasRetirada = monthlyDespesas.filter(d => d.fornecedor && d.fornecedor.startsWith('DF-'));
      if (despesasRetirada.length > 0) {
        console.log('🚫 DESPESAS DE RETIRADA FILTRADAS:');
        despesasRetirada.forEach(d => {
          console.log(`- ${d.fornecedor}: R$ ${Number(d.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})} (${d.unidade}) - Pago: ${d.pago}`);
        });
      }
      
      // Calcula os valores necessários em memória (exclui despesas de retirada)
      const despesasMensais = monthlyDespesas.reduce((total, despesa) => {
        // Exclui despesas que são retiradas de despesas fixas (formato: DF-{id}-Retirada)
        if (despesa.fornecedor && despesa.fornecedor.startsWith('DF-')) {
          return total; // Pula esta despesa pois é uma retirada, não uma despesa real
        }
        return total + Number(despesa.valor || 0);
      }, 0);
      
      const despesasPagasFiltradas = monthlyDespesas
        .filter(despesa => {
          // Exclui despesas de retirada E filtra apenas as pagas
          if (despesa.fornecedor && despesa.fornecedor.startsWith('DF-')) {
            return false; // Pula esta despesa pois é uma retirada, não uma despesa real
          }
          return despesa.pago === true || despesa.pago === "true";
        });
      
      // Log detalhado das despesas pagas
      console.log('🔍 DEBUG DESPESAS PAGAS:');
      console.log('Mês selecionado:', selectedMonth + 1, selectedYear);
      console.log('Total de despesas do mês:', monthlyDespesas.length);
      console.log('Despesas pagas (após filtros):', despesasPagasFiltradas.length);
      
      if (despesasPagasFiltradas.length > 0) {
        console.log('LISTA DE DESPESAS PAGAS:');
        despesasPagasFiltradas.forEach((despesa, index) => {
          console.log(`${index + 1}. ${despesa.fornecedor} - R$ ${Number(despesa.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})} - ${despesa.unidade} - Pago: ${despesa.pago} - Data: ${despesa.data}`);
        });
      } else {
        console.log('✅ Nenhuma despesa paga encontrada (correto se não há despesas pagas)');
      }
      
      const despesasPagas = despesasPagasFiltradas.reduce((total, despesa) => total + Number(despesa.valor || 0), 0);
      
      // Agrupa por unidade (exclui despesas de retirada de despesas fixas)
      const despesasPorUnidade = { UN1: 0, UN2: 0 };
      monthlyDespesas.forEach(despesa => {
        // Exclui despesas que são retiradas de despesas fixas (formato: DF-{id}-Retirada)
        if (despesa.fornecedor && despesa.fornecedor.startsWith('DF-')) {
          return; // Pula esta despesa pois é uma retirada, não uma despesa real
        }
        
        if (despesa.unidade === 'UN1') {
          despesasPorUnidade.UN1 += Number(despesa.valor || 0);
        } else if (despesa.unidade === 'UN2') {
          despesasPorUnidade.UN2 += Number(despesa.valor || 0);
        }
      });
      
      // Recupera dados de faturamento
      const faturamentoMensal = Number(faturamentoStats.totalGeral || 0);
      
      // Renderiza os cards
      await renderFluxoCard(faturamentoMensal, despesasPagas, capitalGiro, salariosPagos, encargosPagos, outrosPagos, despesasFixasRetirado);
      renderFaturamentoCard(faturamentoMensal, despesasMensais, faturamentoPorUnidade, despesasPorUnidade, folhaPagamentoPorUnidade, despesasFixasTotal);
      
    } catch (error) {
      console.error('Erro ao carregar dados para dashboard:', error);
      await renderFluxoCard(0, 0, 0, 0, 0, 0, 0);
      renderFaturamentoCard(0, 0, { UN1: 0, UN2: 0 }, { UN1: 0, UN2: 0 }, { UN1: 0, UN2: 0 }, 0);
    }
}

// Inicializa a página
async function init() {
  // Verifica qual página está sendo exibida
  const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
  
  if (currentPage === 'dashboard') {
    // Configura os event listeners do seletor de mês
    document.getElementById('prev-month').addEventListener('click', goToPreviousMonth);
    document.getElementById('next-month').addEventListener('click', goToNextMonth);
    
    // Atualiza o display inicial do mês
    updateMonthDisplay();
    
    // Carrega os dados iniciais
    await loadDashboardData();
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