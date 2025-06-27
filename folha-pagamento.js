/* folha-pagamento.js – gerenciamento de funcionários, encargos e outros */

const { API_URL } = require('./env-config');
const utils = require('./utils');

let firstRun = true;
let fLoja, fTipo, fNome, btnLimparFiltros;
let btnAdicionarFuncionario, btnAdicionarEncargo, btnAdicionarOutro;
let salarioUN1, salarioUN2, salarioTotal;
let currentItemId = null;
let currentItemType = '';
let allFuncionarios = [];
let allEncargos = [];
let allOutros = [];

const API = API_URL;

// Sistema de Pró-labore
let prolaboreData = {
  totalDisponivel: 30000, // Valor padrão de R$ 30.000
  valorUsado: 0,
  retiradas: [],
  mes: null // Será definido como mês atual
};

// Configurações de distribuição (serão movidas para settings depois)
const DISTRIBUICAO_PADRAO = {
  'UN1': 55, // 55%
  'UN2': 45  // 45%
};

// Função para obter configurações de distribuição (placeholder para futuras settings)
function getDistribuicaoConfig() {
  // TODO: Buscar do backend/settings
  return DISTRIBUICAO_PADRAO;
}

/* ===== SISTEMA DE PRÓ-LABORE SIMPLES ===== */

// Função para obter dados do pró-labore do localStorage
function getProlaboreData() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const key = `prolabore_${ano}_${mes}`;
  
  const saved = localStorage.getItem(key);
  if (saved) {
    return JSON.parse(saved);
  }
  
  // Valores padrão
  return {
    UN1: { total: 16500, usado: 0 }, // 55% de 30.000
    UN2: { total: 13500, usado: 0 }  // 45% de 30.000
  };
}

// Função para salvar dados do pró-labore
function saveProlaboreData(data) {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const key = `prolabore_${ano}_${mes}`;
  
  localStorage.setItem(key, JSON.stringify(data));
}

// Função para abrir modal de edição do valor total
function abrirModalEditarProlabore() {
  const modal = document.getElementById('prolaboreModal');
  const title = document.getElementById('prolaboreModalTitle');
  const valorInput = document.getElementById('valorProlabore');
  const lojaSelect = document.getElementById('lojaProlabore');
  const descricaoInput = document.getElementById('descricaoProlabore');
  const btnSalvar = document.getElementById('salvarProlabore');
  
  if (modal) {
    // Configurar modal para edição do total
    title.textContent = 'Editar Valor Total Mensal';
    
    const prolaboreData = getProlaboreData();
    const totalAtual = prolaboreData.UN1.total + prolaboreData.UN2.total;
    
    valorInput.value = totalAtual;
    lojaSelect.style.display = 'none'; // Esconder seleção de loja
    lojaSelect.parentElement.style.display = 'none';
    descricaoInput.style.display = 'none'; // Esconder descrição
    descricaoInput.parentElement.style.display = 'none';
    
    // Mostrar botão de zerar retiradas
    const btnZerar = document.getElementById('zerarProlabore');
    if (btnZerar) btnZerar.style.display = 'inline-block';
    
    btnSalvar.textContent = 'Salvar Total';
    btnSalvar.setAttribute('data-mode', 'edit-total');
    
    modal.classList.add('active');
    setTimeout(() => valorInput.focus(), 100);
  }
}

// Função para abrir modal de retirada de pró-labore
function abrirModalProlabore() {
  const modal = document.getElementById('prolaboreModal');
  const title = document.getElementById('prolaboreModalTitle');
  const valorInput = document.getElementById('valorProlabore');
  const lojaSelect = document.getElementById('lojaProlabore');
  const descricaoInput = document.getElementById('descricaoProlabore');
  const btnSalvar = document.getElementById('salvarProlabore');
  
  if (modal) {
    // Configurar modal para retirada
    title.textContent = 'Retirar Pró-labore';
    
    // Limpar e mostrar todos os campos
    valorInput.value = '';
    lojaSelect.value = '';
    descricaoInput.value = '';
    
    lojaSelect.style.display = '';
    lojaSelect.parentElement.style.display = '';
    descricaoInput.style.display = '';
    descricaoInput.parentElement.style.display = '';
    
    // Esconder botão de zerar retiradas
    const btnZerar = document.getElementById('zerarProlabore');
    if (btnZerar) btnZerar.style.display = 'none';
    
    btnSalvar.textContent = 'Retirar';
    btnSalvar.setAttribute('data-mode', 'retirada');
    
    modal.classList.add('active');
    setTimeout(() => valorInput.focus(), 100);
  }
}

// Função para salvar pró-labore (retirada ou edição de total)
async function salvarRetiradaProlabore() {
  const btnSalvar = document.getElementById('salvarProlabore');
  const mode = btnSalvar.getAttribute('data-mode');
  
  if (mode === 'edit-total') {
    await salvarNovoTotalProlabore();
  } else {
    await salvarRetirada();
  }
}

// Função para salvar novo valor total
async function salvarNovoTotalProlabore() {
  const valor = parseFloat(document.getElementById('valorProlabore').value);
  
  if (isNaN(valor) || valor <= 0) {
    utils.showAlert('Erro', 'Insira um valor válido');
    return;
  }
  
  // Calcular nova distribuição (55% UN1, 45% UN2)
  const novoTotalUN1 = valor * 0.55;
  const novoTotalUN2 = valor * 0.45;
  
  const novoProlaboreData = {
    UN1: { total: novoTotalUN1, usado: 0 },
    UN2: { total: novoTotalUN2, usado: 0 }
  };
  
  // Salvar no localStorage
  saveProlaboreData(novoProlaboreData);
  
  showMessage(`Valor total atualizado para R$ ${valor.toFixed(2)}!`, 'success');
  document.getElementById('prolaboreModal').classList.remove('active');
  render(); // Recarregar para mostrar novos valores
  
  setTimeout(() => {
    atualizarResumos();
  }, 100);
}

// Função para salvar retirada
async function salvarRetirada() {
  const valor = parseFloat(document.getElementById('valorProlabore').value);
  const loja = document.getElementById('lojaProlabore').value;
  let descricao = document.getElementById('descricaoProlabore').value.trim();
  
  if (isNaN(valor) || valor <= 0) {
    utils.showAlert('Erro', 'Insira um valor válido');
    return;
  }
  
  if (!loja) {
    utils.showAlert('Erro', 'Selecione uma loja');
    return;
  }
  
  // Descrição é opcional agora
  if (!descricao.trim()) {
    descricao = 'Retirada sem descrição';
  }
  
  // Calcular valor já usado diretamente dos funcionários salvos
  const prolaboreUsado = allFuncionarios
    .filter(f => f.loja === loja && f.nome.startsWith('Pró-labore'))
    .reduce((sum, f) => sum + (f.salario || 0), 0);
  
  const prolaboreData = getProlaboreData();
  const restante = prolaboreData[loja].total - prolaboreUsado;
  
  if (valor > restante) {
    utils.showAlert('Erro', `Valor insuficiente na ${loja}. Disponível: R$ ${restante.toFixed(2)}`);
    return;
  }
  
  // Criar "funcionário" pró-labore como entrada no sistema (incluindo data para filtro)
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const funcionarioProlabore = {
    nome: `Pró-labore-${ano}-${mes} - ${descricao}`,
    salario: valor,
    loja: loja
  };
  
  try {
    const response = await utils.fetchWithRetry(`${API}/api/funcionarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(funcionarioProlabore)
    });
    
    if (response.ok) {
      showMessage('Pró-labore retirado com sucesso!', 'success');
      document.getElementById('prolaboreModal').classList.remove('active');
      render(); // Recarregar lista
      
      // Garantir que o resumo seja atualizado
      setTimeout(() => {
        atualizarResumos();
      }, 100);
    } else {
      throw new Error('Erro ao salvar');
    }
  } catch (error) {
    console.error('Erro ao salvar pró-labore:', error);
    showMessage('Erro ao salvar retirada', 'error');
  }
}

// Função para zerar todas as retiradas de pró-labore
async function zerarRetiradas() {
  utils.showConfirm(
    'Confirmar Ação',
    'Tem certeza que deseja zerar todas as retiradas de pró-labore? Esta ação irá excluir todos os registros de pró-labore e não pode ser desfeita.',
    async () => await executarZerarRetiradas()
  );
}

async function executarZerarRetiradas() {
  
  try {
    // Buscar todos os funcionários de pró-labore
    const funcionariosProlabore = allFuncionarios.filter(f => f.nome.startsWith('Pró-labore'));
    
    if (funcionariosProlabore.length === 0) {
      showMessage('Nenhuma retirada encontrada para zerar.', 'info');
      return;
    }
    
    let sucessos = 0;
    let erros = 0;
    
    showMessage('Zerando retiradas...', 'info');
    
    // Deletar cada funcionário de pró-labore
    for (const funcionario of funcionariosProlabore) {
      try {
        const response = await utils.fetchWithRetry(`${API}/api/funcionarios/${funcionario.id}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          sucessos++;
        } else {
          erros++;
          console.error('Erro ao deletar funcionário pró-labore:', funcionario.id);
        }
      } catch (error) {
        erros++;
        console.error('Erro ao deletar funcionário pró-labore:', error);
      }
    }
    
    if (sucessos > 0) {
      showMessage(`${sucessos} retiradas zeradas com sucesso!`, 'success');
      document.getElementById('prolaboreModal').classList.remove('active');
      render(); // Recarregar lista
      
      setTimeout(() => {
        atualizarResumos();
      }, 100);
    }
    
    if (erros > 0) {
      showMessage(`${erros} retiradas falharam ao ser zeradas.`, 'error');
    }
    
  } catch (error) {
    console.error('Erro ao zerar retiradas:', error);
    showMessage('Erro ao zerar retiradas', 'error');
  }
}

// Função simples para configurar modal do pró-labore
function setupModalProlabore() {
  const btnSalvarProlabore = document.getElementById('salvarProlabore');
  const btnZerarProlabore = document.getElementById('zerarProlabore');
  
  if (btnSalvarProlabore) {
    btnSalvarProlabore.addEventListener('click', salvarRetiradaProlabore);
  }
  
  if (btnZerarProlabore) {
    btnZerarProlabore.addEventListener('click', zerarRetiradas);
  }
  
  // Configurar fechar modal
  const modal = document.getElementById('prolaboreModal');
  if (modal) {
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.btn-cancel');
    
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }
}

// Função auxiliar para mostrar mensagens
function showMessage(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // Usar showAlert do utils para mostrar mensagens importantes
  if (type === 'error') {
    utils.showAlert('Erro', message);
  } else if (type === 'success') {
    utils.showAlert('Sucesso', message);
  } else if (type === 'info' && message.includes('criados') || message.includes('zeradas') || message.includes('atualizado')) {
    utils.showAlert('Informação', message);
  }
}

function init() {
  console.log('Inicializando folha de pagamento...');
  
  // Garantir que os modais do utils estejam disponíveis
  utils.initModals();
  
  if (firstRun) {
    // Elementos de filtro
    fLoja = document.getElementById('f-loja');
    fTipo = document.getElementById('f-tipo');
    fNome = document.getElementById('f-nome');
    btnLimparFiltros = document.getElementById('btn-limpar-filtros');
    
    // Botões de ação
    btnAdicionarFuncionario = document.getElementById('btn-adicionar-funcionario');
    btnAdicionarEncargo = document.getElementById('btn-adicionar-encargo');
    btnAdicionarOutro = document.getElementById('btn-adicionar-outro');
    
    // Elementos de resumo
    salarioUN1 = document.getElementById('salario-un1');
    salarioUN2 = document.getElementById('salario-un2');
    salarioTotal = document.getElementById('salario-total');
    
    // Configurar pró-labore
    setupModalProlabore();
    
    console.log('Elementos encontrados:', {
      fLoja: !!fLoja,
      fTipo: !!fTipo,
      fNome: !!fNome,
      btnLimparFiltros: !!btnLimparFiltros,
      btnAdicionarFuncionario: !!btnAdicionarFuncionario,
      btnAdicionarEncargo: !!btnAdicionarEncargo,
      btnAdicionarOutro: !!btnAdicionarOutro,
      salarioUN1: !!salarioUN1,
      salarioUN2: !!salarioUN2,
      salarioTotal: !!salarioTotal
    });
    
    // Event listeners para os filtros
    if (fLoja) fLoja.addEventListener('change', aplicarFiltros);
    if (fTipo) fTipo.addEventListener('change', aplicarFiltros);
    if (fNome) fNome.addEventListener('input', aplicarFiltros);
    
    // Configurar placeholder inicial
    atualizarPlaceholderBusca('all', 'all');
    
    // Botão para limpar filtros
    if (btnLimparFiltros) {
      btnLimparFiltros.addEventListener('click', limparFiltros);
    }
    
    // Botões para adicionar itens
    if (btnAdicionarFuncionario) {
      btnAdicionarFuncionario.addEventListener('click', () => abrirModalFuncionario());
    }
    
    if (btnAdicionarEncargo) {
      btnAdicionarEncargo.addEventListener('click', () => abrirModalEncargo());
    }
    
    if (btnAdicionarOutro) {
      btnAdicionarOutro.addEventListener('click', () => abrirModalOutro());
    }
    
    // Event listeners para os modais
    setupModalEvents();
    
    // Adicionar filtro de período após DOM estar pronto
    setTimeout(() => {
      adicionarFiltroPeriodo();
    }, 100);
    
    firstRun = false;
  }
  
  // Sempre busca os dados atualizados
  render();
  
  // Garantir que o resumo seja atualizado após inicialização
  setTimeout(() => {
    atualizarResumos();
  }, 200);
}

function limparFiltros() {
  if (fLoja) fLoja.value = 'all';
  if (fTipo) fTipo.value = 'all';
  if (fNome) fNome.value = '';
  
  // Resetar filtro de período para mês atual
  const fPeriodo = document.getElementById('f-periodo');
  if (fPeriodo) fPeriodo.value = 'atual';
  
  aplicarFiltros();
}

function atualizarPlaceholderBusca(filtroTipo, filtroLoja) {
  if (!fNome) return;
  
  let placeholder = 'Buscar...';
  
  // Definir o que está sendo buscado baseado nos filtros
  if (filtroTipo === 'funcionarios') {
    placeholder = 'Buscar funcionários (nome, loja, salário)';
  } else if (filtroTipo === 'encargos') {
    placeholder = 'Buscar encargos (tipo, valor, observações)';
  } else if (filtroTipo === 'outros') {
    placeholder = 'Buscar outros (tipo, descrição, valor)';
  } else {
    // Tipo = 'all'
    placeholder = 'Buscar em tudo (nomes, valores, tipos, etc.)';
  }
  
  // Adicionar informação da loja se específica
  if (filtroLoja !== 'all') {
    const nomeLojaFormatado = filtroLoja === 'UN1' ? 'Marumbi I' : 'Marumbi II';
    placeholder += ` - apenas ${nomeLojaFormatado}`;
  }
  
  fNome.placeholder = placeholder;
}

function aplicarFiltros() {
  const filtroLoja = fLoja ? fLoja.value : 'all';
  const filtroTipo = fTipo ? fTipo.value : 'all';
  const filtroNome = fNome ? fNome.value.toLowerCase().trim() : '';
  
  // Novo filtro de período
  const filtroPeriodo = document.getElementById('f-periodo') ? document.getElementById('f-periodo').value : 'atual';
  const mesAtual = getMesAtual();
  
  console.log('Aplicando filtros:', { filtroLoja, filtroTipo, filtroNome, filtroPeriodo });
  
  // Atualizar placeholder da busca baseado no contexto
  atualizarPlaceholderBusca(filtroTipo, filtroLoja);
  
  // BUSCA CONTEXTUAL INTELIGENTE
  function buscaContextual(item, tipo) {
    if (!filtroNome) return true; // Se não há busca, passa
    
    const termoBusca = filtroNome;
    let camposBusca = [];
    
         // Definir campos de busca baseado no tipo do item
     switch (tipo) {
       case 'funcionario':
         camposBusca = [
           item.nome?.toLowerCase() || '',
           item.loja?.toLowerCase() || '',
           // Formatos de valor para busca
           `r$ ${item.salario}`.toLowerCase(),
           item.salario?.toString() || '',
           item.salario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).toLowerCase() || '',
           // Busca por lojas formatadas
           item.loja === 'UN1' ? 'marumbi i' : item.loja === 'UN2' ? 'marumbi ii' : ''
         ];
         break;
        
             case 'encargo':
         camposBusca = [
           item.tipo?.toLowerCase() || '',
           item.loja?.toLowerCase() || '',
           // Formatos de valor para busca
           `r$ ${item.valor}`.toLowerCase(),
           item.valor?.toString() || '',
           item.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).toLowerCase() || '',
           item.observacoes?.toLowerCase() || '',
           formatMesAno(item.mesAno)?.toLowerCase() || '',
           // Busca por lojas formatadas
           item.loja === 'UN1' ? 'marumbi i' : item.loja === 'UN2' ? 'marumbi ii' : ''
         ];
         break;
        
             case 'outro':
         camposBusca = [
           item.tipo?.toLowerCase() || '',
           item.descricao?.toLowerCase() || '',
           item.loja?.toLowerCase() || '',
           // Formatos de valor para busca
           `r$ ${item.valor}`.toLowerCase(),
           item.valor?.toString() || '',
           item.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).toLowerCase() || '',
           item.observacoes?.toLowerCase() || '',
           formatMesAno(item.mesAno)?.toLowerCase() || '',
           // Busca por lojas formatadas
           item.loja === 'UN1' ? 'marumbi i' : item.loja === 'UN2' ? 'marumbi ii' : ''
         ];
         break;
    }
    
    // Verificar se o termo de busca está em qualquer campo
    return camposBusca.some(campo => campo.includes(termoBusca));
  }
  
  // Filtrar funcionários com busca contextual (excluindo pró-labore)
  let funcionariosFiltrados = allFuncionarios.filter(funcionario => {
    const passaLoja = filtroLoja === 'all' || funcionario.loja === filtroLoja;
    const passaBusca = buscaContextual(funcionario, 'funcionario');
    const naoProlabore = !funcionario.nome.startsWith('Pró-labore');
    return passaLoja && passaBusca && naoProlabore;
  });
  
  // Ordenar por loja primeiro, depois por nome
  funcionariosFiltrados.sort((a, b) => {
    if (a.loja !== b.loja) {
      return a.loja.localeCompare(b.loja);
    }
    return a.nome.localeCompare(b.nome);
  });
  
  // Filtrar encargos com busca contextual e período
  let encargosFiltrados = allEncargos.filter(encargo => {
    const passaLoja = filtroLoja === 'all' || encargo.loja === filtroLoja;
    const passaBusca = buscaContextual(encargo, 'encargo');
    
    // Filtro de período
    let passaPeriodo = true;
    if (filtroPeriodo === 'atual') {
      passaPeriodo = encargo.mesAno === mesAtual;
    }
    
    return passaLoja && passaBusca && passaPeriodo;
  });
  
  // Filtrar outros com busca contextual e período
  let outrosFiltrados = allOutros.filter(outro => {
    const passaLoja = filtroLoja === 'all' || outro.loja === filtroLoja;
    const passaBusca = buscaContextual(outro, 'outro');
    
    // Filtro de período
    let passaPeriodo = true;
    if (filtroPeriodo === 'atual') {
      passaPeriodo = outro.mesAno === mesAtual;
    }
    
    return passaLoja && passaBusca && passaPeriodo;
  });
  
  // Aplicar filtro por tipo e layout
  const showFuncionarios = filtroTipo === 'all' || filtroTipo === 'funcionarios';
  const showEncargos = filtroTipo === 'all' || filtroTipo === 'encargos';
  const showOutros = filtroTipo === 'all' || filtroTipo === 'outros';
  
  // Elementos das colunas
  const funcionariosColumn = document.getElementById('funcionarios-column');
  const encargosColumn = document.getElementById('encargos-column');
  const outrosColumn = document.getElementById('outros-column');
  const payrollGrid = document.querySelector('.payroll-grid');
  
  // Aplicar layout expansivo ou padrão
  if (filtroTipo === 'all') {
    // Layout padrão: 3 colunas
    if (payrollGrid) {
      payrollGrid.className = 'payroll-grid layout-all';
    }
    if (funcionariosColumn) funcionariosColumn.style.display = 'block';
    if (encargosColumn) encargosColumn.style.display = 'block';
    if (outrosColumn) outrosColumn.style.display = 'block';
  } else {
    // Layout expansivo: 1 coluna grande
    if (payrollGrid) {
      payrollGrid.className = 'payroll-grid layout-single';
    }
    if (funcionariosColumn) funcionariosColumn.style.display = showFuncionarios ? 'block' : 'none';
    if (encargosColumn) encargosColumn.style.display = showEncargos ? 'block' : 'none';
    if (outrosColumn) outrosColumn.style.display = showOutros ? 'block' : 'none';
  }
  
  // Renderizar as listas (apenas dos tipos selecionados)
  if (showFuncionarios) {
    renderFuncionarios(funcionariosFiltrados);
  }
  if (showEncargos) {
    renderEncargos(encargosFiltrados);
  }
  if (showOutros) {
    renderOutros(outrosFiltrados);
  }
  
  // Log para debug da busca
  if (filtroNome) {
    console.log('Resultados da busca:', {
      termo: filtroNome,
      funcionarios: showFuncionarios ? funcionariosFiltrados.length : 'não mostrado',
      encargos: showEncargos ? encargosFiltrados.length : 'não mostrado',
      outros: showOutros ? outrosFiltrados.length : 'não mostrado'
    });
  }
  
  atualizarResumos();
}

function setupModalEvents() {
  const funcionarioModal = document.getElementById('funcionarioModal');
  const encargoModal = document.getElementById('encargoModal');
  const outroModal = document.getElementById('outroModal');
  const deleteModal = document.getElementById('deleteModal');
  const deleteEncargoModal = document.getElementById('deleteEncargoModal');
  const deleteOutroModal = document.getElementById('deleteOutroModal');
  
  const modals = [funcionarioModal, encargoModal, outroModal, deleteModal, deleteEncargoModal, deleteOutroModal].filter(m => m);
  
  // Event listeners para fechar modais
  modals.forEach(modal => {
    const closeButtons = modal.querySelectorAll('.modal-close, .btn-cancel');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modal.classList.remove('active');
        currentItemId = null;
        currentItemType = '';
      });
    });
    
    // Fechar modal clicando fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        currentItemId = null;
        currentItemType = '';
      }
    });
  });
  
  // Event listeners para salvar
  const salvarFuncionarioBtn = document.getElementById('salvarFuncionario');
  if (salvarFuncionarioBtn) {
    salvarFuncionarioBtn.addEventListener('click', salvarFuncionario);
  }
  
  const salvarEncargoBtn = document.getElementById('salvarEncargo');
  if (salvarEncargoBtn) {
    salvarEncargoBtn.addEventListener('click', salvarEncargo);
  }
  
  const salvarOutroBtn = document.getElementById('salvarOutro');
  if (salvarOutroBtn) {
    salvarOutroBtn.addEventListener('click', salvarOutro);
  }
  
  // Event listeners para confirmar exclusão
  // Nota: A confirmação de exclusão de funcionários agora é feita dentro da função deletarFuncionario
  
  const confirmDeleteEncargoBtn = document.getElementById('confirmDeleteEncargo');
  if (confirmDeleteEncargoBtn) {
    confirmDeleteEncargoBtn.addEventListener('click', confirmarExclusaoEncargo);
  }
  
  const confirmDeleteOutroBtn = document.getElementById('confirmDeleteOutro');
  if (confirmDeleteOutroBtn) {
    confirmDeleteOutroBtn.addEventListener('click', confirmarExclusaoOutro);
  }
}

// === FUNCIONÁRIOS ===

function abrirModalFuncionario(funcionario = null) {
  const modal = document.getElementById('funcionarioModal');
  const title = document.getElementById('funcionarioModalTitle');
  const nomeInput = document.getElementById('funcionarioNome');
  const salarioInput = document.getElementById('funcionarioSalario');
  
  if (!modal || !title || !nomeInput || !salarioInput) return;
  
  // Reset dos checkboxes
  const checkboxUN1 = document.getElementById('loja-UN1');
  const checkboxUN2 = document.getElementById('loja-UN2');
  
  if (funcionario) {
    title.textContent = 'Editar Funcionário';
    nomeInput.value = funcionario.nome;
    
    // Se está editando, buscar todos os funcionários com mesmo nome para ver distribuição
    const funcionariosComMesmoNome = allFuncionarios.filter(f => f.nome === funcionario.nome);
    const salarioTotal = funcionariosComMesmoNome.reduce((sum, f) => sum + f.salario, 0);
    
    salarioInput.value = salarioTotal;
    
    // Marcar as lojas onde o funcionário está
    const lojasDoFuncionario = funcionariosComMesmoNome.map(f => f.loja);
    if (checkboxUN1) checkboxUN1.checked = lojasDoFuncionario.includes('UN1');
    if (checkboxUN2) checkboxUN2.checked = lojasDoFuncionario.includes('UN2');
    
    currentItemId = funcionario.id;
  } else {
    title.textContent = 'Adicionar Funcionário';
    nomeInput.value = '';
    salarioInput.value = '';
    
    // Padrão: apenas UN1 marcada
    if (checkboxUN1) checkboxUN1.checked = true;
    if (checkboxUN2) checkboxUN2.checked = false;
    
    currentItemId = null;
  }
  
  // Configurar event listeners para atualizar preview
  setupDistribuicaoPreview();
  
  modal.classList.add('active');
}

function setupDistribuicaoPreview() {
  const salarioInput = document.getElementById('funcionarioSalario');
  const checkboxUN1 = document.getElementById('loja-UN1');
  const checkboxUN2 = document.getElementById('loja-UN2');
  
  function atualizarPreview() {
    const salarioTotal = parseFloat(salarioInput.value) || 0;
    const config = getDistribuicaoConfig();
    
    const percentUN1 = document.getElementById('percent-UN1');
    const percentUN2 = document.getElementById('percent-UN2');
    const valueUN1 = document.getElementById('value-UN1');
    const valueUN2 = document.getElementById('value-UN2');
    const warning = document.getElementById('distribution-warning');
    
    // Atualizar classes dos itens baseado na seleção
    const lojaItem1 = checkboxUN1?.closest('.loja-item');
    const lojaItem2 = checkboxUN2?.closest('.loja-item');
    
    if (lojaItem1) {
      lojaItem1.classList.toggle('selected', checkboxUN1.checked);
    }
    if (lojaItem2) {
      lojaItem2.classList.toggle('selected', checkboxUN2.checked);
    }
    
    // Atualizar porcentagens
    if (percentUN1) percentUN1.textContent = `${config.UN1}%`;
    if (percentUN2) percentUN2.textContent = `${config.UN2}%`;
    
    // Calcular valores baseado na seleção
    const lojasSelected = [];
    if (checkboxUN1 && checkboxUN1.checked) lojasSelected.push('UN1');
    if (checkboxUN2 && checkboxUN2.checked) lojasSelected.push('UN2');
    
    if (lojasSelected.length === 0) {
      // Nenhuma loja selecionada
      if (warning) warning.style.display = 'block';
      if (valueUN1) valueUN1.textContent = 'R$ 0,00';
      if (valueUN2) valueUN2.textContent = 'R$ 0,00';
    } else {
      if (warning) warning.style.display = 'none';
      
      if (lojasSelected.length === 1) {
        // Apenas uma loja: recebe 100%
        const loja = lojasSelected[0];
        if (loja === 'UN1') {
          if (valueUN1) valueUN1.textContent = `R$ ${salarioTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
          if (valueUN2) valueUN2.textContent = 'R$ 0,00';
          if (percentUN1) percentUN1.textContent = '100%';
          if (percentUN2) percentUN2.textContent = '0%';
        } else {
          if (valueUN1) valueUN1.textContent = 'R$ 0,00';
          if (valueUN2) valueUN2.textContent = `R$ ${salarioTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
          if (percentUN1) percentUN1.textContent = '0%';
          if (percentUN2) percentUN2.textContent = '100%';
        }
      } else {
        // Múltiplas lojas: usar porcentagens configuradas
        const valorUN1 = (salarioTotal * config.UN1) / 100;
        const valorUN2 = (salarioTotal * config.UN2) / 100;
        
        if (valueUN1) valueUN1.textContent = checkboxUN1.checked ? `R$ ${valorUN1.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00';
        if (valueUN2) valueUN2.textContent = checkboxUN2.checked ? `R$ ${valorUN2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00';
      }
    }
  }
  
  // Event listeners
  if (salarioInput) {
    salarioInput.removeEventListener('input', atualizarPreview);
    salarioInput.addEventListener('input', atualizarPreview);
  }
  
  if (checkboxUN1) {
    checkboxUN1.removeEventListener('change', atualizarPreview);
    checkboxUN1.addEventListener('change', atualizarPreview);
  }
  
  if (checkboxUN2) {
    checkboxUN2.removeEventListener('change', atualizarPreview);
    checkboxUN2.addEventListener('change', atualizarPreview);
  }
  
  // Atualizar preview inicial
  atualizarPreview();
}

async function salvarFuncionario() {
  const nome = document.getElementById('funcionarioNome').value.trim();
  const salarioTotal = parseFloat(document.getElementById('funcionarioSalario').value);
  const checkboxUN1 = document.getElementById('loja-UN1');
  const checkboxUN2 = document.getElementById('loja-UN2');
  
  if (!nome || !salarioTotal || salarioTotal <= 0) {
    showMessage('Preencha todos os campos obrigatórios', 'error');
    return;
  }
  
  // Verificar quais lojas estão selecionadas
  const lojasSelected = [];
  if (checkboxUN1 && checkboxUN1.checked) lojasSelected.push('UN1');
  if (checkboxUN2 && checkboxUN2.checked) lojasSelected.push('UN2');
  
  if (lojasSelected.length === 0) {
    showMessage('Selecione pelo menos uma loja', 'error');
    return;
  }
  
  try {
    const config = getDistribuicaoConfig();
    
    // Se está editando, primeiro excluir todas as entradas do funcionário
    if (currentItemId) {
      const funcionariosComMesmoNome = allFuncionarios.filter(f => f.nome === nome);
      for (const func of funcionariosComMesmoNome) {
        await utils.fetchWithRetry(`${API}/api/funcionarios/${func.id}`, {
          method: 'DELETE'
        });
      }
    }
    
    // Criar novas entradas para cada loja selecionada
    const funcionariosCriados = [];
    
    for (const loja of lojasSelected) {
      let salarioLoja;
      
      if (lojasSelected.length === 1) {
        // Apenas uma loja: recebe 100%
        salarioLoja = salarioTotal;
      } else {
        // Múltiplas lojas: usar porcentagens
        salarioLoja = (salarioTotal * config[loja]) / 100;
      }
      
      const funcionarioData = {
        nome: nome,
        salario: salarioLoja,
        loja: loja
      };
      
      const response = await utils.fetchWithRetry(`${API}/api/funcionarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(funcionarioData)
      });
      
      if (response.ok) {
        const funcionarioCriado = await response.json();
        funcionariosCriados.push(funcionarioCriado);
      } else {
        throw new Error(`Erro ao criar funcionário para loja ${loja}`);
      }
    }
    
    if (funcionariosCriados.length > 0) {
      const acao = currentItemId ? 'atualizado' : 'criado';
      const detalhes = lojasSelected.length > 1 ? ` (distribuído em ${lojasSelected.length} lojas)` : '';
      showMessage(`Funcionário ${acao}${detalhes}!`, 'success');
      
      document.getElementById('funcionarioModal').classList.remove('active');
      currentItemId = null;
      render();
      
      // Garantir que o resumo seja atualizado
      setTimeout(() => {
        atualizarResumos();
      }, 100);
    }
  } catch (error) {
    console.error('Erro ao salvar funcionário:', error);
    showMessage('Erro ao salvar funcionário', 'error');
  }
}

function editarFuncionario(id) {
  console.log('Editando funcionário com ID:', id);
  const funcionario = allFuncionarios.find(f => f.id === id);
  if (funcionario) {
    console.log('Funcionário encontrado:', funcionario);
    abrirModalFuncionario(funcionario);
  } else {
    console.error('Funcionário não encontrado com ID:', id);
  }
}

async function deletarFuncionario(funcionarioId, nomeFuncionario) {
  console.log('Deletando funcionário:', { funcionarioId, nomeFuncionario });
  // Encontrar todos os funcionários com o mesmo nome
  const funcionariosComMesmoNome = allFuncionarios.filter(f => f.nome === nomeFuncionario);
  console.log('Funcionários com mesmo nome encontrados:', funcionariosComMesmoNome.length);
  
  const modal = document.getElementById('deleteModal');
  const messageElement = modal.querySelector('.modal-body p');
  
  if (funcionariosComMesmoNome.length > 1) {
    messageElement.textContent = `Tem certeza que deseja excluir o funcionário "${nomeFuncionario}" de todas as lojas?`;
  } else {
    messageElement.textContent = `Tem certeza que deseja excluir o funcionário "${nomeFuncionario}"?`;
  }
  
  modal.classList.add('active');
  
  // Configurar o botão de confirmação
  const confirmButton = document.getElementById('confirmDelete');
  confirmButton.onclick = async () => {
    try {
      // Excluir todas as entradas do funcionário
      for (const funcionario of funcionariosComMesmoNome) {
        const response = await utils.fetchWithRetry(`${API}/api/funcionarios/${funcionario.id}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          throw new Error(`Erro ao excluir funcionário da loja ${funcionario.loja}`);
        }
      }
      
      showMessage(`Funcionário "${nomeFuncionario}" excluído com sucesso!`, 'success');
      modal.classList.remove('active');
      render();
      
      // Garantir que o resumo seja atualizado
      setTimeout(() => {
        atualizarResumos();
      }, 100);
    } catch (error) {
      console.error('Erro ao excluir funcionário:', error);
      showMessage('Erro ao excluir funcionário', 'error');
    }
  };
}

// Renderizar funcionários
function renderFuncionarios(funcionariosFiltrados = null) {
  const container = document.getElementById('funcionarios-list');
  if (!container) return;
  
  // Usar lista filtrada se fornecida, senão usar todos
  const funcionariosParaRender = funcionariosFiltrados || allFuncionarios;
  
  const funcionariosPorNome = {};
  
  // Agrupar funcionários por nome (excluindo pró-labore da lista visual)
  funcionariosParaRender
    .filter(funcionario => !funcionario.nome.startsWith('Pró-labore'))
    .forEach(funcionario => {
      if (!funcionariosPorNome[funcionario.nome]) {
        funcionariosPorNome[funcionario.nome] = [];
      }
      funcionariosPorNome[funcionario.nome].push(funcionario);
    });
  
  container.innerHTML = '';
  
  // Adicionar card do Pró-labore no topo
  const prolaboreData = getProlaboreData();
  
  // Calcular valores usados dos funcionários de pró-labore salvos
  const prolaboreUsadoUN1 = allFuncionarios
    .filter(f => f.loja === 'UN1' && f.nome.startsWith('Pró-labore'))
    .reduce((sum, f) => sum + (f.salario || 0), 0);
  
  const prolaboreUsadoUN2 = allFuncionarios
    .filter(f => f.loja === 'UN2' && f.nome.startsWith('Pró-labore'))
    .reduce((sum, f) => sum + (f.salario || 0), 0);
  
  // Calcular valores restantes
  const restanteUN1 = prolaboreData.UN1.total - prolaboreUsadoUN1;
  const restanteUN2 = prolaboreData.UN2.total - prolaboreUsadoUN2;
  
  const prolaboreCard = document.createElement('div');
  prolaboreCard.className = 'item-card prolabore-card';
  prolaboreCard.innerHTML = `
    <div class="item-header">
      <h4><i class="fas fa-briefcase"></i> Pró-labore</h4>
      <div class="item-actions">
        <button class="btn-edit" data-action="prolabore-edit" title="Editar valor total">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn-edit" data-action="prolabore-add" title="Fazer retirada" style="background: #28a745;">
          <i class="fas fa-plus"></i>
        </button>
      </div>
    </div>
    <div class="item-details">
      <p><strong>Total UN1:</strong> R$ ${prolaboreData.UN1.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Restante: R$ ${restanteUN1.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
      <p><strong>Total UN2:</strong> R$ ${prolaboreData.UN2.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Restante: R$ ${restanteUN2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
    </div>
  `;
  
  // Event listeners para os botões do pró-labore
  const editBtn = prolaboreCard.querySelector('[data-action="prolabore-edit"]');
  const addBtn = prolaboreCard.querySelector('[data-action="prolabore-add"]');
  
  if (editBtn) {
    editBtn.addEventListener('click', abrirModalEditarProlabore);
  }
  
  if (addBtn) {
    addBtn.addEventListener('click', abrirModalProlabore);
  }
  
  container.appendChild(prolaboreCard);
  
  if (Object.keys(funcionariosPorNome).length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <p>Nenhum funcionário cadastrado</p>
      <small>Clique em "Adicionar" para começar</small>
    `;
    container.appendChild(emptyState);
    return;
  }
  
  Object.entries(funcionariosPorNome).forEach(([nome, funcionarios]) => {
    const salarioTotal = funcionarios.reduce((sum, f) => sum + f.salario, 0);
    const lojas = funcionarios.map(f => f.loja).join(', ');
    const distribuicao = funcionarios.map(f => `${f.loja}: R$ ${f.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join('<br>');
    
    const isPago = funcionarios.every(f => f.pago === true);
    const isPartiallyPago = funcionarios.some(f => f.pago === true) && !isPago;
    
    const funcionarioCard = document.createElement('div');
    funcionarioCard.className = `item-card ${isPago ? 'pago' : ''} ${isPartiallyPago ? 'parcialmente-pago' : ''}`;
    funcionarioCard.innerHTML = `
      <div class="item-header">
        <div class="item-title-section">
          <h4>${nome}</h4>
          ${isPago ? '<span class="status-tag pago-tag">PAGO</span>' : isPartiallyPago ? '<span class="status-tag parcial-tag">PARCIAL</span>' : ''}
        </div>
        <div class="item-actions">
          <label class="checkbox-pago" title="Marcar como pago">
            <input type="checkbox" data-funcionario-ids="${funcionarios.map(f => f.id).join(',')}" ${isPago ? 'checked' : ''} ${isPartiallyPago ? 'indeterminate' : ''}>
            <span class="checkmark-pago"></span>
          </label>
          <button class="btn-edit" data-id="${funcionarios[0].id}" data-action="edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-delete" data-id="${funcionarios[0].id}" data-nome="${nome}" data-action="delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="item-details">
        <p><strong>Salário Total:</strong> R$ ${salarioTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        ${funcionarios.length > 1 ? `
          <p><strong>Distribuição:</strong></p>
          <div class="distribuicao-info">
            ${distribuicao}
          </div>
        ` : `
          <p><strong>Loja:</strong> ${lojas}</p>
        `}
      </div>
    `;
    
    // Adicionar event listeners aos botões
    const editBtn = funcionarioCard.querySelector('.btn-edit');
    const deleteBtn = funcionarioCard.querySelector('.btn-delete');
    const checkboxPago = funcionarioCard.querySelector('.checkbox-pago input');
    
    console.log('Botões encontrados para', nome, ':', { editBtn: !!editBtn, deleteBtn: !!deleteBtn });
    
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        console.log('Botão editar clicado para funcionário ID:', funcionarios[0].id);
        editarFuncionario(funcionarios[0].id);
      });
    } else {
      console.error('Botão editar não encontrado para', nome);
    }
    
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        console.log('Botão deletar clicado para funcionário:', nome);
        deletarFuncionario(funcionarios[0].id, nome);
      });
    } else {
      console.error('Botão deletar não encontrado para', nome);
    }
    
    if (checkboxPago) {
      // Configurar indeterminate state se parcialmente pago
      if (isPartiallyPago) {
        checkboxPago.indeterminate = true;
      }
      
      checkboxPago.addEventListener('change', async () => {
        const funcionarioIds = checkboxPago.dataset.funcionarioIds.split(',');
        const novoPago = checkboxPago.checked;
        
        // Feedback visual imediato
        const card = checkboxPago.closest('.item-card');
        card.style.opacity = '0.7';
        
        try {
          await marcarFuncionarioComoPago(funcionarioIds, novoPago);
          
          // Atualizar status visual do card
          if (novoPago) {
            card.classList.add('pago');
            card.classList.remove('parcialmente-pago');
            
            // Adicionar tag se não existe
            const titleSection = card.querySelector('.item-title-section');
            let statusTag = titleSection.querySelector('.status-tag');
            if (!statusTag) {
              statusTag = document.createElement('span');
              statusTag.className = 'status-tag pago-tag';
              titleSection.appendChild(statusTag);
            }
            statusTag.textContent = 'PAGO';
            statusTag.className = 'status-tag pago-tag';
          } else {
            card.classList.remove('pago', 'parcialmente-pago');
            
            // Remover tag
            const statusTag = card.querySelector('.status-tag');
            if (statusTag) {
              statusTag.remove();
            }
          }
          
          card.style.opacity = '1';
          
          // Atualizar resumos sem recarregar tudo
          setTimeout(() => {
            atualizarResumos();
          }, 100);
          
        } catch (error) {
          showMessage('Erro ao atualizar status de pagamento', 'error');
          checkboxPago.checked = !novoPago; // Reverter checkbox
          card.style.opacity = '1';
          console.error('Erro ao marcar como pago:', error);
        }
      });
    }
    
    container.appendChild(funcionarioCard);
  });
}

// === ENCARGOS ===

function abrirModalEncargo(encargo = null) {
  const modal = document.getElementById('encargoModal');
  const title = document.getElementById('encargoModalTitle');
  
  if (!modal || !title) {
    console.error('Modal de encargo não encontrado!');
    return;
  }
  
  if (encargo) {
    title.textContent = 'Editar Encargo';
    document.getElementById('encargoTipo').value = encargo.tipo;
    document.getElementById('encargoValor').value = encargo.valor;
    document.getElementById('encargoLoja').value = encargo.loja;
    document.getElementById('encargoMesAno').value = encargo.mesAno;
    document.getElementById('encargoObservacoes').value = encargo.observacoes || '';
    currentItemId = encargo.id;
    currentItemType = 'encargo';
  } else {
    title.textContent = 'Adicionar Encargo';
    document.getElementById('encargoTipo').value = '';
    document.getElementById('encargoValor').value = '';
    document.getElementById('encargoLoja').value = '';
    document.getElementById('encargoMesAno').value = '';
    document.getElementById('encargoObservacoes').value = '';
    currentItemId = null;
    currentItemType = 'encargo';
  }
  
  modal.classList.add('active');
}

async function salvarEncargo() {
  const tipo = document.getElementById('encargoTipo').value;
  const valor = parseFloat(document.getElementById('encargoValor').value);
  const loja = document.getElementById('encargoLoja').value;
  const mesAno = document.getElementById('encargoMesAno').value;
  const observacoes = document.getElementById('encargoObservacoes').value;
  
  if (!tipo || !valor || !loja || !mesAno) {
    showMessage('Por favor, preencha todos os campos obrigatórios', 'error');
    return;
  }
  
  const encargoData = { tipo, valor, loja, mesAno, observacoes };
  
  try {
    let response;
    if (currentItemId) {
      response = await utils.fetchWithRetry(`${API}/api/encargos/${currentItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(encargoData)
      });
    } else {
      response = await utils.fetchWithRetry(`${API}/api/encargos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(encargoData)
      });
    }
    
    if (response.ok) {
      showMessage(currentItemId ? 'Encargo atualizado!' : 'Encargo adicionado!', 'success');
      document.getElementById('encargoModal').classList.remove('active');
      currentItemId = null;
      currentItemType = '';
      render();
    }
  } catch (error) {
    console.error('Erro ao salvar encargo:', error);
    showMessage('Erro ao salvar encargo', 'error');
  }
}

function editarEncargo(id) {
  const encargo = allEncargos.find(e => e.id === id);
  if (encargo) {
    abrirModalEncargo(encargo);
  }
}

function excluirEncargo(id) {
  currentItemId = id;
  currentItemType = 'encargo';
  const deleteModal = document.getElementById('deleteEncargoModal');
  if (deleteModal) {
    deleteModal.classList.add('active');
  }
}

async function confirmarExclusaoEncargo() {
  try {
    const response = await utils.fetchWithRetry(`${API}/api/encargos/${currentItemId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showMessage('Encargo excluído!', 'success');
      document.getElementById('deleteEncargoModal').classList.remove('active');
      currentItemId = null;
      currentItemType = '';
      render();
    }
  } catch (error) {
    console.error('Erro ao excluir encargo:', error);
    showMessage('Erro ao excluir encargo', 'error');
  }
}

function renderEncargos(encargos) {
  const list = document.getElementById('encargos-list');
  const count = document.getElementById('encargos-count');
  
  if (!list || !count) return;
  
  count.textContent = encargos.length;
  
  if (encargos.length === 0) {
    list.innerHTML = '<div class="payroll-list empty"></div>';
    return;
  }
  
  list.innerHTML = encargos.map(encargo => {
    const isPago = encargo.pago === true;
    const isParcial = encargo.pago === null;
    
    return `
      <div class="payroll-item ${isPago ? 'pago' : ''} ${isParcial ? 'parcialmente-pago' : ''}">
        <div class="item-header">
          <div class="item-title-section">
            <div class="item-title">${getTipoEncargoLabel(encargo.tipo)}</div>
            ${isPago ? '<span class="status-tag pago-tag">PAGO</span>' : isParcial ? '<span class="status-tag parcial-tag">PARCIAL</span>' : ''}
          </div>
          <div class="item-actions">
            <label class="checkbox-pago">
              <input type="checkbox" 
                     ${isPago ? 'checked' : ''} 
                     ${isParcial ? 'data-indeterminate="true"' : ''}
                     onchange="window.marcarEncargoComoPago([${encargo.id}], this.checked)"
                     data-encargo-id="${encargo.id}">
              <span class="checkmark-pago"></span>
            </label>
            <button class="btn-edit" onclick="window.editarEncargo(${encargo.id})" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-delete" onclick="window.excluirEncargo(${encargo.id})" title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="item-value">R$ ${encargo.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div class="item-details">${encargo.loja === 'UN1' ? 'Marumbi I' : 'Marumbi II'}</div>
        <div class="item-meta">
          <span>${formatMesAno(encargo.mesAno)}</span>
          ${encargo.observacoes ? `<span class="item-tag">${encargo.observacoes}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// === OUTROS ===

function abrirModalOutro(outro = null) {
  const modal = document.getElementById('outroModal');
  const title = document.getElementById('outroModalTitle');
  
  if (!modal || !title) {
    console.error('Modal de outros não encontrado!');
    return;
  }
  
  // Preencher select de funcionários
  const funcionarioSelect = document.getElementById('outroFuncionario');
  if (funcionarioSelect) {
    funcionarioSelect.innerHTML = '<option value="">Geral</option>' + 
      allFuncionarios.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
  }
  
  if (outro) {
    title.textContent = 'Editar Outros';
    document.getElementById('outroTipo').value = outro.tipo;
    document.getElementById('outroDescricao').value = outro.descricao;
    document.getElementById('outroValor').value = outro.valor;
    document.getElementById('outroFuncionario').value = outro.funcionarioId || '';
    document.getElementById('outroLoja').value = outro.loja;
    document.getElementById('outroMesAno').value = outro.mesAno;
    document.getElementById('outroObservacoes').value = outro.observacoes || '';
    currentItemId = outro.id;
    currentItemType = 'outro';
  } else {
    title.textContent = 'Adicionar Outros';
    document.getElementById('outroTipo').value = '';
    document.getElementById('outroDescricao').value = '';
    document.getElementById('outroValor').value = '';
    document.getElementById('outroFuncionario').value = '';
    document.getElementById('outroLoja').value = '';
    document.getElementById('outroMesAno').value = '';
    document.getElementById('outroObservacoes').value = '';
    currentItemId = null;
    currentItemType = 'outro';
  }
  
  modal.classList.add('active');
}

async function salvarOutro() {
  const tipo = document.getElementById('outroTipo').value;
  const descricao = document.getElementById('outroDescricao').value.trim();
  const valor = parseFloat(document.getElementById('outroValor').value);
  const funcionarioId = document.getElementById('outroFuncionario').value || null;
  const loja = document.getElementById('outroLoja').value;
  const mesAno = document.getElementById('outroMesAno').value;
  const observacoes = document.getElementById('outroObservacoes').value;
  
  if (!tipo || !descricao || !valor || !loja || !mesAno) {
    showMessage('Por favor, preencha todos os campos obrigatórios', 'error');
    return;
  }
  
  const outroData = { tipo, descricao, valor, funcionarioId, loja, mesAno, observacoes };
  
  try {
    let response;
    if (currentItemId) {
      response = await utils.fetchWithRetry(`${API}/api/outros/${currentItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outroData)
      });
    } else {
      response = await utils.fetchWithRetry(`${API}/api/outros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outroData)
      });
    }
    
    if (response.ok) {
      showMessage(currentItemId ? 'Item atualizado!' : 'Item adicionado!', 'success');
      document.getElementById('outroModal').classList.remove('active');
      currentItemId = null;
      currentItemType = '';
      render();
    }
  } catch (error) {
    console.error('Erro ao salvar item:', error);
    showMessage('Erro ao salvar item', 'error');
  }
}

function editarOutro(id) {
  const outro = allOutros.find(o => o.id === id);
  if (outro) {
    abrirModalOutro(outro);
  }
}

function excluirOutro(id) {
  currentItemId = id;
  currentItemType = 'outro';
  const deleteModal = document.getElementById('deleteOutroModal');
  if (deleteModal) {
    deleteModal.classList.add('active');
  }
}

async function confirmarExclusaoOutro() {
  try {
    const response = await utils.fetchWithRetry(`${API}/api/outros/${currentItemId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showMessage('Item excluído!', 'success');
      document.getElementById('deleteOutroModal').classList.remove('active');
      currentItemId = null;
      currentItemType = '';
      render();
    }
  } catch (error) {
    console.error('Erro ao excluir item:', error);
    showMessage('Erro ao excluir item', 'error');
  }
}

function renderOutros(outros) {
  const list = document.getElementById('outros-list');
  const count = document.getElementById('outros-count');
  
  if (!list || !count) return;
  
  count.textContent = outros.length;
  
  if (outros.length === 0) {
    list.innerHTML = '<div class="payroll-list empty"></div>';
    return;
  }
  
  list.innerHTML = outros.map(outro => {
    const funcionario = outro.funcionarioId ? 
      allFuncionarios.find(f => f.id === outro.funcionarioId) : null;
    const isPago = outro.pago === true;
    const isParcial = outro.pago === null;
    
    return `
      <div class="payroll-item ${isPago ? 'pago' : ''} ${isParcial ? 'parcialmente-pago' : ''}">
        <div class="item-header">
          <div class="item-title-section">
            <div class="item-title">${outro.descricao}</div>
            ${isPago ? '<span class="status-tag pago-tag">PAGO</span>' : isParcial ? '<span class="status-tag parcial-tag">PARCIAL</span>' : ''}
          </div>
          <div class="item-actions">
            <label class="checkbox-pago">
              <input type="checkbox" 
                     ${isPago ? 'checked' : ''} 
                     ${isParcial ? 'data-indeterminate="true"' : ''}
                     onchange="window.marcarOutroComoPago([${outro.id}], this.checked)"
                     data-outro-id="${outro.id}">
              <span class="checkmark-pago"></span>
            </label>
            <button class="btn-edit" onclick="window.editarOutro(${outro.id})" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-delete" onclick="window.excluirOutro(${outro.id})" title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="item-value">R$ ${outro.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div class="item-details">
          ${getTipoOutroLabel(outro.tipo)} - ${outro.loja === 'UN1' ? 'Marumbi I' : 'Marumbi II'}
          ${funcionario ? ` - ${funcionario.nome}` : ' - Geral'}
        </div>
        <div class="item-meta">
          <span>${formatMesAno(outro.mesAno)}</span>
          ${outro.observacoes ? `<span class="item-tag">${outro.observacoes}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// === UTILITÁRIOS ===

function getTipoEncargoLabel(tipo) {
  const labels = {
    'INSS': 'INSS',
    'FGTS': 'FGTS',
    'VALE_TRANSPORTE': 'Vale Transporte'
  };
  return labels[tipo] || tipo;
}

function getTipoOutroLabel(tipo) {
  const labels = {
    'BONUS': 'Bônus',
    'FERIAS': 'Férias',
    'DESTAQUE': 'Destaque do Mês',
    'ABONO': 'Abono',
    'AJUDA_CUSTO': 'Ajuda de Custo',
    'OUTROS': 'Outros'
  };
  return labels[tipo] || tipo;
}

function formatMesAno(mesAno) {
  if (!mesAno) return '';
  const [ano, mes] = mesAno.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[parseInt(mes) - 1]}/${ano}`;
}

function atualizarResumos() {
  // Verificar se estamos na página correta
  if (!window.location.pathname.includes('folha-pagamento.html')) {
    return;
  }
  
  // Elementos do resumo no topo
  const salarioUN1 = document.getElementById('salario-un1');
  const salarioUN2 = document.getElementById('salario-un2');
  const salarioTotal = document.getElementById('salario-total');
  
  // Contadores das colunas
  const funcionariosCount = document.getElementById('funcionarios-count');
  const encargosCount = document.getElementById('encargos-count');
  const outrosCount = document.getElementById('outros-count');
  
  // Calcular totais dos funcionários por loja (excluindo pró-labore que será somado separadamente)
  const salarioFuncionariosUN1 = allFuncionarios
    .filter(f => f.loja === 'UN1' && !f.nome.startsWith('Pró-labore'))
    .reduce((sum, f) => sum + (f.salario || 0), 0);
    
  const salarioFuncionariosUN2 = allFuncionarios
    .filter(f => f.loja === 'UN2' && !f.nome.startsWith('Pró-labore'))
    .reduce((sum, f) => sum + (f.salario || 0), 0);
  
  // Calcular totais dos encargos por loja
  const encargosUN1 = allEncargos
    .filter(e => e.loja === 'UN1')
    .reduce((sum, e) => sum + (e.valor || 0), 0);
    
  const encargosUN2 = allEncargos
    .filter(e => e.loja === 'UN2')
    .reduce((sum, e) => sum + (e.valor || 0), 0);
  
  // Calcular totais dos outros por loja
  const outrosUN1 = allOutros
    .filter(o => o.loja === 'UN1')
    .reduce((sum, o) => sum + (o.valor || 0), 0);
    
  const outrosUN2 = allOutros
    .filter(o => o.loja === 'UN2')
    .reduce((sum, o) => sum + (o.valor || 0), 0);
  
  // Adicionar o valor TOTAL do pró-labore (não apenas o retirado)
  const prolaboreData = getProlaboreData();
  
  // Calcular total geral por loja (funcionários + encargos + outros + pró-labore)
  const totalUN1 = salarioFuncionariosUN1 + encargosUN1 + outrosUN1 + prolaboreData.UN1.total;
  const totalUN2 = salarioFuncionariosUN2 + encargosUN2 + outrosUN2 + prolaboreData.UN2.total;
  const totalGeral = totalUN1 + totalUN2;
  
  // Contar funcionários únicos (por nome, excluindo pró-labore)
  const nomesUnicos = [...new Set(allFuncionarios
    .filter(f => !f.nome.startsWith('Pró-labore'))
    .map(f => f.nome))];
  
  // Atualizar resumo no topo
  if (salarioUN1) {
    salarioUN1.textContent = `R$ ${totalUN1.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  } else {
    console.warn('Elemento salario-un1 não encontrado!');
  }
  
  if (salarioUN2) {
    salarioUN2.textContent = `R$ ${totalUN2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  } else {
    console.warn('Elemento salario-un2 não encontrado!');
  }
  
  if (salarioTotal) {
    salarioTotal.textContent = `R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  } else {
    console.warn('Elemento salario-total não encontrado!');
  }
  
  // Atualizar contadores das colunas
  if (funcionariosCount) funcionariosCount.textContent = nomesUnicos.length;
  if (encargosCount) encargosCount.textContent = allEncargos.length;
  if (outrosCount) outrosCount.textContent = allOutros.length;
  
  console.log('Resumo atualizado:', {
    UN1: {
      funcionarios: `R$ ${salarioFuncionariosUN1.toFixed(2)}`,
      encargos: `R$ ${encargosUN1.toFixed(2)}`,
      outros: `R$ ${outrosUN1.toFixed(2)}`,
      prolabore: `R$ ${prolaboreData.UN1.total.toFixed(2)}`,
      total: `R$ ${totalUN1.toFixed(2)}`
    },
    UN2: {
      funcionarios: `R$ ${salarioFuncionariosUN2.toFixed(2)}`,
      encargos: `R$ ${encargosUN2.toFixed(2)}`,
      outros: `R$ ${outrosUN2.toFixed(2)}`,
      prolabore: `R$ ${prolaboreData.UN2.total.toFixed(2)}`,
      total: `R$ ${totalUN2.toFixed(2)}`
    },
    totalGeral: `R$ ${totalGeral.toFixed(2)}`,
    contadores: {
      funcionarios: nomesUnicos.length,
      encargos: allEncargos.length,
      outros: allOutros.length
    }
  });
}

// ===== SISTEMA DE AUTO-INCREMENTO MENSAL =====

function getMesAtual() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

function getMesAnterior() {
  const agora = new Date();
  agora.setMonth(agora.getMonth() - 1);
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

async function verificarAutoIncrementoMensal() {
  const mesAtual = getMesAtual();
  const mesAnterior = getMesAnterior();
  
  console.log('Verificando auto-incremento para:', mesAtual);
  
  // Verifica se já existem encargos para o mês atual
  const encargosDoMes = allEncargos.filter(encargo => encargo.mesAno === mesAtual);
  
  if (encargosDoMes.length === 0) {
    // Busca encargos do mês anterior
    const encargosDoMesAnterior = allEncargos.filter(encargo => encargo.mesAno === mesAnterior);
    
    if (encargosDoMesAnterior.length > 0) {
      console.log(`Encontrados ${encargosDoMesAnterior.length} encargos do mês anterior. Oferecendo auto-incremento...`);
      await oferecerAutoIncremento(encargosDoMesAnterior, mesAtual);
    }
  }
}

async function oferecerAutoIncremento(encargosAnteriores, mesAtual) {
  utils.showConfirm(
    'Auto-incremento Mensal',
    `Detectei que você tinha ${encargosAnteriores.length} encargos no mês anterior. Deseja copiar automaticamente para ${formatMesAno(mesAtual)}? Você ainda poderá editar ou remover depois.`,
    async () => await criarEncargosDoNovoMes(encargosAnteriores, mesAtual)
  );
}

async function criarEncargosDoNovoMes(encargosAnteriores, mesAtual) {
  let sucessos = 0;
  let erros = 0;
  
  showMessage('Criando encargos do novo mês...', 'info');
  
  for (const encargoAntigo of encargosAnteriores) {
    try {
      const novoEncargo = {
        tipo: encargoAntigo.tipo,
        valor: encargoAntigo.valor,
        loja: encargoAntigo.loja,
        mesAno: mesAtual,
        observacoes: encargoAntigo.observacoes || ''
      };
      
      const response = await utils.fetchWithRetry(`${API}/api/encargos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(novoEncargo)
      });
      
      if (response.ok) {
        sucessos++;
      } else {
        erros++;
        console.error('Erro ao criar encargo:', await response.text());
      }
    } catch (error) {
      erros++;
      console.error('Erro ao criar encargo:', error);
    }
  }
  
  if (sucessos > 0) {
    showMessage(`${sucessos} encargos criados para ${formatMesAno(mesAtual)}!`, 'success');
    // Recarrega os dados
    render();
  }
  
  if (erros > 0) {
    showMessage(`${erros} encargos falharam ao ser criados.`, 'error');
  }
}

// Função para criar automaticamente no início do mês (pode ser chamada manualmente)
async function gerarEncargosDoMes() {
  const mesAtual = getMesAtual();
  const mesAnterior = getMesAnterior();
  
  // Busca encargos do mês anterior
  const encargosDoMesAnterior = allEncargos.filter(encargo => encargo.mesAno === mesAnterior);
  
  if (encargosDoMesAnterior.length === 0) {
    showMessage('Nenhum encargo encontrado no mês anterior para copiar.', 'info');
    return;
  }
  
  await criarEncargosDoNovoMes(encargosDoMesAnterior, mesAtual);
}

// Adiciona botão para gerar encargos manualmente
function adicionarBotaoGerarEncargos() {
  const actionButtons = document.querySelector('.action-buttons');
  if (actionButtons && !document.getElementById('btn-gerar-encargos')) {
    const btnGerar = document.createElement('button');
    btnGerar.id = 'btn-gerar-encargos';
    btnGerar.className = 'btn-tertiary';
    btnGerar.innerHTML = '<i class="fas fa-sync-alt"></i> Copiar Mês Anterior';
    btnGerar.title = 'Copia encargos do mês anterior para o mês atual';
    btnGerar.addEventListener('click', gerarEncargosDoMes);
    
    actionButtons.appendChild(btnGerar);
  }
}

// Função para marcar funcionário como pago/não pago
async function marcarFuncionarioComoPago(funcionarioIds, pago) {
  for (const id of funcionarioIds) {
    try {
      const response = await utils.fetchWithRetry(`${API}/api/funcionarios/${id}/pago?pago=${pago}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erro HTTP ${response.status} para funcionário ${id}:`, errorText);
        
        // Se for erro 500, pode ser que o campo não existe ainda no banco
        if (response.status === 500 && errorText.includes('pago')) {
          throw new Error(`Campo 'pago' não existe no banco. Aguarde o redeploy do backend.`);
        }
        
        throw new Error(`Erro ${response.status}: ${errorText || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error(`Erro ao marcar funcionário ${id} como pago:`, error);
      throw error;
    }
  }
}

// Função para marcar encargo como pago/não pago
async function marcarEncargoComoPago(encargoIds, pago) {
  for (const id of encargoIds) {
    try {
      const checkbox = document.querySelector(`input[data-encargo-id="${id}"]`);
      if (checkbox) {
        checkbox.style.opacity = '0.5';
        checkbox.disabled = true;
      }
      
      const response = await utils.fetchWithRetry(`${API}/api/encargos/${id}/pago?pago=${pago}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erro HTTP ${response.status} para encargo ${id}:`, errorText);
        
        if (response.status === 500 && errorText.includes('pago')) {
          throw new Error(`Campo 'pago' não existe no banco. Aguarde o redeploy do backend.`);
        }
        
        throw new Error(`Erro ${response.status}: ${errorText || 'Erro desconhecido'}`);
      }
      
      // Atualizar localmente
      const encargo = allEncargos.find(e => e.id === id);
      if (encargo) {
        encargo.pago = pago;
      }
      
    } catch (error) {
      console.error(`Erro ao marcar encargo ${id} como pago:`, error);
      
      // Reverter o estado do checkbox em caso de erro
      const checkbox = document.querySelector(`input[data-encargo-id="${id}"]`);
      if (checkbox) {
        checkbox.checked = !pago;
      }
      
      throw error;
    } finally {
      // Restaurar estado do checkbox
      const checkbox = document.querySelector(`input[data-encargo-id="${id}"]`);
      if (checkbox) {
        checkbox.style.opacity = '1';
        checkbox.disabled = false;
      }
    }
  }
  
  // Re-renderizar apenas a lista de encargos
  const encargosFilter = document.getElementById('f-tipo')?.value;
  if (encargosFilter === 'all' || encargosFilter === 'encargos') {
    renderEncargos(allEncargos);
  }
}

// Função para marcar outros como pago/não pago
async function marcarOutroComoPago(outroIds, pago) {
  for (const id of outroIds) {
    try {
      const checkbox = document.querySelector(`input[data-outro-id="${id}"]`);
      if (checkbox) {
        checkbox.style.opacity = '0.5';
        checkbox.disabled = true;
      }
      
      const response = await utils.fetchWithRetry(`${API}/api/outros/${id}/pago?pago=${pago}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erro HTTP ${response.status} para outro ${id}:`, errorText);
        
        if (response.status === 500 && errorText.includes('pago')) {
          throw new Error(`Campo 'pago' não existe no banco. Aguarde o redeploy do backend.`);
        }
        
        throw new Error(`Erro ${response.status}: ${errorText || 'Erro desconhecido'}`);
      }
      
      // Atualizar localmente
      const outro = allOutros.find(o => o.id === id);
      if (outro) {
        outro.pago = pago;
      }
      
    } catch (error) {
      console.error(`Erro ao marcar outro ${id} como pago:`, error);
      
      // Reverter o estado do checkbox em caso de erro
      const checkbox = document.querySelector(`input[data-outro-id="${id}"]`);
      if (checkbox) {
        checkbox.checked = !pago;
      }
      
      throw error;
    } finally {
      // Restaurar estado do checkbox
      const checkbox = document.querySelector(`input[data-outro-id="${id}"]`);
      if (checkbox) {
        checkbox.style.opacity = '1';
        checkbox.disabled = false;
      }
    }
  }
  
  // Re-renderizar apenas a lista de outros
  const outrosFilter = document.getElementById('f-tipo')?.value;
  if (outrosFilter === 'all' || outrosFilter === 'outros') {
    renderOutros(allOutros);
  }
}

async function render() {
  console.log('Carregando dados...');
  
  try {
    // Carregar funcionários
    const funcionariosResponse = await utils.fetchWithRetry(`${API}/api/funcionarios`);
    allFuncionarios = await funcionariosResponse.json();
    
    // Carregar encargos
    try {
      const encargosResponse = await utils.fetchWithRetry(`${API}/api/encargos`);
      allEncargos = await encargosResponse.json();
    } catch (error) {
      console.log('Encargos não disponíveis ainda, usando array vazio');
      allEncargos = [];
    }
    
    // Carregar outros
    try {
      const outrosResponse = await utils.fetchWithRetry(`${API}/api/outros`);
      allOutros = await outrosResponse.json();
    } catch (error) {
      console.log('Outros não disponíveis ainda, usando array vazio');
      allOutros = [];
    }
    
    console.log('Dados carregados:', {
      funcionarios: allFuncionarios.length,
      encargos: allEncargos.length,
      outros: allOutros.length
    });
    
    // Adiciona botão para gerar encargos
    adicionarBotaoGerarEncargos();
    
    // Verifica auto-incremento mensal (apenas na primeira carga)
    if (firstRun) {
      setTimeout(() => verificarAutoIncrementoMensal(), 1000);
    }
    
    aplicarFiltros();
    
    // Garantir que o resumo seja atualizado após carregar dados
    setTimeout(() => {
      atualizarResumos();
    }, 100);
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    showMessage('Erro ao carregar dados', 'error');
  }
}

// Funções globais para os botões das listas
window.abrirModalFuncionario = abrirModalFuncionario;
window.editarFuncionario = editarFuncionario;
window.deletarFuncionario = deletarFuncionario;
window.editarEncargo = editarEncargo;
window.excluirEncargo = excluirEncargo;
window.editarOutro = editarOutro;
window.excluirOutro = excluirOutro;
window.marcarFuncionarioComoPago = marcarFuncionarioComoPago;
window.marcarEncargoComoPago = marcarEncargoComoPago;
window.marcarOutroComoPago = marcarOutroComoPago;

// Exportar funções para uso global
window.folhaPagamento = {
  init,
  abrirModalFuncionario,
  editarFuncionario,
  deletarFuncionario,
  editarEncargo,
  excluirEncargo,
  editarOutro,
  excluirOutro
};

// Auto-inicialização se estiver na página correta
if (typeof window !== 'undefined' && window.location.pathname.includes('folha-pagamento.html')) {
  document.addEventListener('DOMContentLoaded', init);
}

module.exports = { init };

// Função para adicionar o filtro de período ao HTML
function adicionarFiltroPeriodo() {
  const toolbar = document.querySelector('.toolbar');
  if (toolbar && !document.getElementById('f-periodo')) {
    const mesAtual = getMesAtual();
    const mesAtualFormatado = formatMesAno(mesAtual);
    
    // Criar o elemento do filtro
    const labelPeriodo = document.createElement('label');
    labelPeriodo.innerHTML = `Período
      <select id="f-periodo">
        <option value="atual">Apenas ${mesAtualFormatado}</option>
        <option value="todos">Todos os Meses</option>
      </select>
    `;
    
    // Adicionar o filtro na toolbar (antes do botão limpar)
    const btnLimpar = document.getElementById('btn-limpar-filtros');
    if (btnLimpar) {
      toolbar.insertBefore(labelPeriodo, btnLimpar);
    } else {
      toolbar.appendChild(labelPeriodo);
    }
    
    // Adicionar event listener
    const selectPeriodo = document.getElementById('f-periodo');
    if (selectPeriodo) {
      selectPeriodo.addEventListener('change', aplicarFiltros);
    }
  }
} 