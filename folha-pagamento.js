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

// Função auxiliar para mostrar mensagens
function showMessage(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  // Removendo alerts - apenas logs no console
}

function init() {
  console.log('Inicializando folha de pagamento...');
  
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
    
    console.log('Elementos encontrados:', {
      fLoja: !!fLoja,
      fTipo: !!fTipo,
      fNome: !!fNome,
      btnLimparFiltros: !!btnLimparFiltros,
      btnAdicionarFuncionario: !!btnAdicionarFuncionario,
      btnAdicionarEncargo: !!btnAdicionarEncargo,
      btnAdicionarOutro: !!btnAdicionarOutro
    });
    
    // Event listeners para os filtros
    if (fLoja) fLoja.addEventListener('change', aplicarFiltros);
    if (fTipo) fTipo.addEventListener('change', aplicarFiltros);
    if (fNome) fNome.addEventListener('input', aplicarFiltros);
    
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
    
    firstRun = false;
  }
  
  // Sempre busca os dados atualizados
  render();
}

function limparFiltros() {
  if (fLoja) fLoja.value = 'all';
  if (fTipo) fTipo.value = 'all';
  if (fNome) fNome.value = '';
  aplicarFiltros();
}

function aplicarFiltros() {
  const filtroLoja = fLoja ? fLoja.value : 'all';
  const filtroTipo = fTipo ? fTipo.value : 'all';
  const filtroNome = fNome ? fNome.value.toLowerCase() : '';
  
  // Filtrar funcionários
  let funcionariosFiltrados = allFuncionarios.filter(funcionario => {
    const passaLoja = filtroLoja === 'all' || funcionario.loja === filtroLoja;
    const passaNome = !filtroNome || funcionario.nome.toLowerCase().includes(filtroNome);
    return passaLoja && passaNome;
  });
  
  // Ordenar por loja primeiro, depois por nome
  funcionariosFiltrados.sort((a, b) => {
    if (a.loja !== b.loja) {
      return a.loja.localeCompare(b.loja);
    }
    return a.nome.localeCompare(b.nome);
  });
  
  // Filtrar encargos
  let encargosFiltrados = allEncargos.filter(encargo => {
    const passaLoja = filtroLoja === 'all' || encargo.loja === filtroLoja;
    const passaNome = !filtroNome || encargo.tipo.toLowerCase().includes(filtroNome);
    return passaLoja && passaNome;
  });
  
  // Filtrar outros
  let outrosFiltrados = allOutros.filter(outro => {
    const passaLoja = filtroLoja === 'all' || outro.loja === filtroLoja;
    const passaNome = !filtroNome || outro.descricao.toLowerCase().includes(filtroNome) || outro.tipo.toLowerCase().includes(filtroNome);
    return passaLoja && passaNome;
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
  
  // Renderizar as listas
  if (showFuncionarios) renderFuncionarios(funcionariosFiltrados);
  if (showEncargos) renderEncargos(encargosFiltrados);
  if (showOutros) renderOutros(outrosFiltrados);
  
  atualizarResumo();
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
  const confirmDeleteBtn = document.getElementById('confirmDelete');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', confirmarExclusaoFuncionario);
  }
  
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
  console.log('Abrindo modal para funcionário:', funcionario);
  
  const modal = document.getElementById('funcionarioModal');
  const title = document.getElementById('funcionarioModalTitle');
  const nomeInput = document.getElementById('funcionarioNome');
  const salarioInput = document.getElementById('funcionarioSalario');
  const lojaSelect = document.getElementById('funcionarioLoja');
  
  if (!modal || !title || !nomeInput || !salarioInput || !lojaSelect) {
    console.error('Elementos do modal de funcionário não encontrados!');
    return;
  }
  
  if (funcionario) {
    title.textContent = 'Editar Funcionário';
    nomeInput.value = funcionario.nome;
    salarioInput.value = funcionario.salario;
    lojaSelect.value = funcionario.loja;
    currentItemId = funcionario.id;
    currentItemType = 'funcionario';
  } else {
    title.textContent = 'Adicionar Funcionário';
    nomeInput.value = '';
    salarioInput.value = '';
    lojaSelect.value = '';
    currentItemId = null;
    currentItemType = 'funcionario';
  }
  
  modal.classList.add('active');
  nomeInput.focus();
}

async function salvarFuncionario() {
  console.log('Salvando funcionário...');
  
  const nome = document.getElementById('funcionarioNome').value.trim();
  const salario = parseFloat(document.getElementById('funcionarioSalario').value);
  const loja = document.getElementById('funcionarioLoja').value;
  
  if (!nome || !salario || !loja) {
    showMessage('Por favor, preencha todos os campos', 'error');
    return;
  }
  
  const funcionarioData = { nome, salario, loja };
  
  try {
    let response;
    if (currentItemId) {
      response = await utils.fetchWithRetry(`${API}/api/funcionarios/${currentItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(funcionarioData)
      });
    } else {
      response = await utils.fetchWithRetry(`${API}/api/funcionarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(funcionarioData)
      });
    }
    
    if (response.ok) {
      showMessage(currentItemId ? 'Funcionário atualizado!' : 'Funcionário adicionado!', 'success');
      document.getElementById('funcionarioModal').classList.remove('active');
      currentItemId = null;
      currentItemType = '';
      render();
    }
  } catch (error) {
    console.error('Erro ao salvar funcionário:', error);
    showMessage('Erro ao salvar funcionário', 'error');
  }
}

function editarFuncionario(id) {
  const funcionario = allFuncionarios.find(f => f.id === id);
  if (funcionario) {
    abrirModalFuncionario(funcionario);
  }
}

function excluirFuncionario(id) {
  currentItemId = id;
  currentItemType = 'funcionario';
  const deleteModal = document.getElementById('deleteModal');
  if (deleteModal) {
    deleteModal.classList.add('active');
  }
}

async function confirmarExclusaoFuncionario() {
  try {
    const response = await utils.fetchWithRetry(`${API}/api/funcionarios/${currentItemId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showMessage('Funcionário excluído!', 'success');
      document.getElementById('deleteModal').classList.remove('active');
      currentItemId = null;
      currentItemType = '';
      render();
    }
  } catch (error) {
    console.error('Erro ao excluir funcionário:', error);
    showMessage('Erro ao excluir funcionário', 'error');
  }
}

function renderFuncionarios(funcionarios) {
  const list = document.getElementById('funcionarios-list');
  const count = document.getElementById('funcionarios-count');
  
  if (!list || !count) return;
  
  count.textContent = funcionarios.length;
  
  if (funcionarios.length === 0) {
    list.innerHTML = '<div class="payroll-list empty"></div>';
    return;
  }
  
  list.innerHTML = funcionarios.map(funcionario => `
    <div class="payroll-item">
      <div class="item-header">
        <div class="item-title">${funcionario.nome}</div>
        <div class="item-actions">
          <button class="btn-edit" onclick="window.editarFuncionario(${funcionario.id})" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-delete" onclick="window.excluirFuncionario(${funcionario.id})" title="Excluir">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="item-value">R$ ${funcionario.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
      <div class="item-details">${funcionario.loja === 'UN1' ? 'Marumbi I' : 'Marumbi II'}</div>
    </div>
  `).join('');
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
  
  list.innerHTML = encargos.map(encargo => `
    <div class="payroll-item">
      <div class="item-header">
        <div class="item-title">${getTipoEncargoLabel(encargo.tipo)}</div>
        <div class="item-actions">
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
  `).join('');
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
    
    return `
      <div class="payroll-item">
        <div class="item-header">
          <div class="item-title">${outro.descricao}</div>
          <div class="item-actions">
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

function atualizarResumo() {
  const totalUN1 = allFuncionarios.filter(f => f.loja === 'UN1').reduce((sum, f) => sum + f.salario, 0);
  const totalUN2 = allFuncionarios.filter(f => f.loja === 'UN2').reduce((sum, f) => sum + f.salario, 0);
  const totalGeral = totalUN1 + totalUN2;
  
  if (salarioUN1) {
    salarioUN1.textContent = `R$ ${totalUN1.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }
  
  if (salarioUN2) {
    salarioUN2.textContent = `R$ ${totalUN2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }
  
  if (salarioTotal) {
    salarioTotal.textContent = `R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
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
    
    aplicarFiltros();
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    showMessage('Erro ao carregar dados', 'error');
  }
}

// Funções globais para os botões das listas
window.editarFuncionario = editarFuncionario;
window.excluirFuncionario = excluirFuncionario;
window.editarEncargo = editarEncargo;
window.excluirEncargo = excluirEncargo;
window.editarOutro = editarOutro;
window.excluirOutro = excluirOutro;

// Exportar funções para uso global
window.folhaPagamento = {
  init,
  editarFuncionario,
  excluirFuncionario,
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