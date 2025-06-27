/* relatorio.js – lista, filtros e marcação pago */

const { API_URL } = require('./env-config');
const utils = require('./utils');
let firstRun = true;
let tblBody, fUnid, fTipo, fStat, fFornecedor, fValor, fDataInicio, fDataFim;
let btnLimparFiltros;
let resumoTotal, resumoPago, resumoAPagar;
let currentDespesaId = null;
let selectedBank = null;
let selectedMethod = null;

// Armazenar o último banco e método selecionados para futuras operações
let lastSelectedBank = localStorage.getItem('lastSelectedBank');
let lastSelectedMethod = localStorage.getItem('lastSelectedMethod');

let allDespesas = []; // Armazenar todas as despesas para filtrar no cliente
let allDespesasFixas = []; // Armazenar todas as despesas fixas
let currentDespesaFixaId = null; // ID da despesa fixa atual para retiradas

const API = API_URL;

// Configuração dinâmica das opções de bancos e métodos
let BANK_OPTIONS = [
  { id: 'itau', label: 'Itaú' },
  { id: 'caixa', label: 'Caixa' },
  { id: 'santander', label: 'Santander' },
  { id: 'bradesco', label: 'Bradesco' }
];

let PAYMENT_METHODS = [
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'pix', label: 'PIX' },
  { id: 'transferencia', label: 'Transferência' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'cartao', label: 'Cartão' }
];

function init() {
  if (firstRun) {
    // Reset dos elementos da UI para evitar referências antigas
    tblBody = document.querySelector('#tblPag tbody');
    fUnid = document.getElementById('f-unidade');
    fTipo = document.getElementById('f-tipo');
    fStat = document.getElementById('f-status');
    fFornecedor = document.getElementById('f-fornecedor');
    fValor = document.getElementById('f-valor');
    fDataInicio = document.getElementById('f-data-inicio');
    fDataFim = document.getElementById('f-data-fim');
    btnLimparFiltros = document.getElementById('btn-limpar-filtros');
    
    // Elementos de resumo
    resumoTotal = document.getElementById('resumo-total');
    resumoPago = document.getElementById('resumo-pago');
    resumoAPagar = document.getElementById('resumo-a-pagar');
    
    const bankModal = document.getElementById('bankModal');
    const methodModal = document.getElementById('methodModal');
    const deleteModal = document.getElementById('deleteModal');
    const addOptionModal = document.getElementById('addOptionModal');
    const cardsContainer = document.querySelector('.cards-container');

    // Limpa event listeners antigos clonando e substituindo elementos
    ['fUnid', 'fTipo', 'fStat', 'fFornecedor', 'fValor', 'fDataInicio', 'fDataFim', 'btnLimparFiltros'].forEach(el => {
      if (window[el]) {
        const newEl = window[el].cloneNode(true);
        window[el].parentNode.replaceChild(newEl, window[el]);
        window[el] = newEl;
      }
    });

    // Event listeners para os filtros
    [fUnid, fTipo, fStat].forEach(sel => {
      if (sel) sel.addEventListener('change', aplicarFiltros);
    });
    
    // Event listeners para os novos filtros
    if (fFornecedor) fFornecedor.addEventListener('input', aplicarFiltros);
    if (fValor) fValor.addEventListener('input', aplicarFiltros);
    
    if (fDataInicio) {
      fDataInicio.addEventListener('change', function() {
        if (fDataInicio.value && cardsContainer) {
          cardsContainer.classList.remove('hidden');
        }
        aplicarFiltros();
      });
    }
    
    if (fDataFim) {
      fDataFim.addEventListener('change', function() {
        if ((fDataFim.value || (fDataInicio && fDataInicio.value)) && cardsContainer) {
          cardsContainer.classList.remove('hidden');
        }
        aplicarFiltros();
      });
    }
    
    // Botão para limpar filtros
    if (btnLimparFiltros) {
      btnLimparFiltros.addEventListener('click', limparFiltros);
    }
    
    // Inicialmente, oculta os cards de resumo até que a data seja definida
    if (cardsContainer) {
      cardsContainer.classList.add('hidden');
    }
    
    // Carregar opções de bancos e métodos do backend
    loadOptionsFromBackend();
    
    // Event listeners para os modais
    setupModalEvents();
    
    // Configurar eventos de teclado para os modais
    setupKeyboardEvents();
    
    // Configurar eventos de despesas fixas
    setupDespesasFixasEvents();
    
    firstRun = false;
  }
  
  // Sempre busca os dados atualizados
  render();
}

// Função para carregar opções do backend
async function loadOptionsFromBackend() {
  try {
    // Mostrar indicador de carregamento
    generatePaymentOptions('bankModal', [{ id: 'loading', label: 'Carregando...' }]);
    generatePaymentOptions('methodModal', [{ id: 'loading', label: 'Carregando...' }]);
    
    const resp = await utils.fetchWithRetry(`${API}/api/opcoes`);
    const options = await resp.json();
    if (options.bancos && Array.isArray(options.bancos)) {
      BANK_OPTIONS = options.bancos;
    }
    if (options.metodos && Array.isArray(options.metodos)) {
      PAYMENT_METHODS = options.metodos;
    }
  } catch (err) {
    console.warn('Não foi possível carregar opções personalizadas:', err);
  }
  
  // Gerar opções de bancos e métodos dinamicamente
  generatePaymentOptions('bankModal', BANK_OPTIONS);
  generatePaymentOptions('methodModal', PAYMENT_METHODS);
}

// Função para gerar opções de pagamento dinamicamente
function generatePaymentOptions(modalId, options) {
  const container = document.querySelector(`#${modalId} .payment-options`);
  if (!container) return;
  
  container.innerHTML = ''; // Limpa o conteúdo atual
  
  // Adiciona as opções existentes
  options.forEach(option => {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'payment-option';
    optionDiv.setAttribute('data-value', option.id);
    optionDiv.setAttribute('data-label', option.label);
    
    optionDiv.innerHTML = `
      <span class="option-label">${option.label}</span>
      <button class="btn-remove" title="Remover"><i class="fas fa-times"></i></button>
    `;
    
    // Adiciona event listener para remover
    optionDiv.querySelector('.btn-remove').addEventListener('click', e => {
      e.stopPropagation(); // Evita que o clique seja interpretado como seleção da opção
      
      const isBank = modalId === 'bankModal';
      utils.showConfirm(
        'Confirmar exclusão', 
        `Tem certeza que deseja remover "${option.label}"?`, 
        () => {
          // Remove da lista de opções
          const optionsList = isBank ? BANK_OPTIONS : PAYMENT_METHODS;
          const index = optionsList.findIndex(o => o.id === option.id);
          if (index !== -1) {
            optionsList.splice(index, 1);
            // Regenera as opções
            generatePaymentOptions(modalId, optionsList);
          }
        }
      );
    });
    
    container.appendChild(optionDiv);
  });
  
  // Adiciona botão para adicionar nova opção
  const addButton = document.createElement('div');
  addButton.className = 'payment-option add-option';
  addButton.innerHTML = '<i class="fas fa-plus"></i> Adicionar Novo';
  addButton.addEventListener('click', () => {
    const isBank = modalId === 'bankModal';
    const addOptionTitle = document.getElementById('addOptionTitle');
    if (addOptionTitle) {
      addOptionTitle.textContent = `Adicionar Novo ${isBank ? 'Banco' : 'Método de Pagamento'}`;
    }
    
    const inputField = document.getElementById('newOptionName');
    if (inputField) {
      inputField.value = '';
      inputField.focus();
    }
    
    // Armazenar qual tipo está sendo adicionado
    const addOptionModal = document.getElementById('addOptionModal');
    if (addOptionModal) {
      addOptionModal.setAttribute('data-type', isBank ? 'bank' : 'method');
      addOptionModal.classList.add('active');
    }
  });
  
  container.appendChild(addButton);
}

// Função para salvar opções no backend
async function saveOptionsToBackend() {
  try {
    // Salvar no backend
    const resp = await utils.fetchWithRetry(`${API}/api/opcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bancos: BANK_OPTIONS,
        metodos: PAYMENT_METHODS
      })
    });
    
    if (!resp.ok) {
      console.warn('Erro ao salvar opções no backend:', resp.status);
      throw new Error('Falha ao salvar opções no backend');
    }
  } catch (err) {
    console.error('Falha ao salvar opções:', err);
    utils.showAlert('Erro', 'Erro ao salvar opções. Verifique a conexão.');
  }
}

// Função para limpar todos os filtros
function limparFiltros() {
  if (fUnid) fUnid.value = 'all';
  if (fTipo) fTipo.value = 'all';
  if (fStat) fStat.value = 'all';
  if (fFornecedor) fFornecedor.value = '';
  if (fValor) fValor.value = '';
  if (fDataInicio) fDataInicio.value = '';
  if (fDataFim) fDataFim.value = '';
  
  // Oculta os cards de resumo quando limpa os filtros de data
  const cardsContainer = document.querySelector('.cards-container');
  if (cardsContainer) {
    cardsContainer.classList.add('hidden');
  }
  
  aplicarFiltros();
}

// Função para converter texto em slug para comparação (normaliza texto)
function slugify(text) {
  if (!text) return '';
  return text.toString().toLowerCase()
    .normalize('NFD') // decompõe acentos
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^\w\s-]/g, '') // remove caracteres especiais
    .trim();
}

// Função para aplicar filtros nas despesas
function aplicarFiltros() {
  // Verificar se é filtro específico para despesas fixas
  if (fTipo && fTipo.value === 'despesas-fixas') {
    // Mostrar apenas despesas fixas
    renderDespesasFixasOnly();
    return;
  }
  
  if (allDespesas.length > 0) {
    // Filtrar despesas excluindo as de retirada (DF-{id}-Retirada)
    let filteredDespesas = allDespesas.filter(d => {
      if (d.fornecedor && d.fornecedor.startsWith('DF-')) {
        return false; // Exclui despesas de retirada da visualização
      }
      return true;
    });
    
    // Filtro por unidade
    if (fUnid && fUnid.value !== 'all') {
      filteredDespesas = filteredDespesas.filter(d => d.unidade === fUnid.value);
    }
    
    // Filtro por tipo
    if (fTipo && fTipo.value !== 'all') {
      filteredDespesas = filteredDespesas.filter(d => {
        // Se filtro é 'boleto', excluir retiradas de despesas fixas
        if (fTipo.value === 'boleto') {
          return d.tipo === fTipo.value && !d.fornecedor.startsWith('DF-');
        }
        return d.tipo === fTipo.value;
      });
    }
    
    // Filtro por status
    if (fStat && fStat.value !== 'all') {
      filteredDespesas = filteredDespesas.filter(d => 
        (fStat.value === 'p' && d.pago) || (fStat.value === 'np' && !d.pago)
      );
    }
    
    // Filtro por fornecedor (busca parcial)
    if (fFornecedor && fFornecedor.value.trim()) {
      const searchTerm = slugify(fFornecedor.value.trim());
      
      // Ordenamos para priorizar correspondências no início do texto
      filteredDespesas = filteredDespesas
        .filter(d => slugify(d.fornecedor).includes(searchTerm))
        .sort((a, b) => {
          const aStartsWith = slugify(a.fornecedor).startsWith(searchTerm) ? 0 : 1;
          const bStartsWith = slugify(b.fornecedor).startsWith(searchTerm) ? 0 : 1;
          
          // Ordena primeiro por correspondência no início, depois alfabeticamente
          if (aStartsWith !== bStartsWith) return aStartsWith - bStartsWith;
          return slugify(a.fornecedor).localeCompare(slugify(b.fornecedor));
        });
    }
    
    // Filtro por valor (busca parcial)
    if (fValor && fValor.value.trim()) {
      const searchTerm = fValor.value.trim().replace(/\D/g, ''); // Remove não-dígitos
      
      if (searchTerm) {
        filteredDespesas = filteredDespesas.filter(d => {
          // Converte o valor para string sem formatação
          const valor = d.valor.toString().replace('.', '');
          return valor.includes(searchTerm);
        });
      }
    }
    
    // Filtro por data
    if (fDataInicio && fDataInicio.value) {
      const dataInicio = new Date(fDataInicio.value);
      dataInicio.setHours(0, 0, 0, 0); // Define para início do dia
      
      if (fDataFim && fDataFim.value) {
        // Se tiver data final, filtra o período
        const dataFim = new Date(fDataFim.value);
        dataFim.setHours(23, 59, 59, 999); // Define para fim do dia
        
        filteredDespesas = filteredDespesas.filter(d => {
          const dataDespesa = new Date(d.data);
          return dataDespesa >= dataInicio && dataDespesa <= dataFim;
        });
      } else {
        // Se tiver apenas data inicial, filtra por dia específico (DD/MM/AAAA)
        filteredDespesas = filteredDespesas.filter(d => {
          const dataDespesa = new Date(d.data);
          return dataDespesa.getFullYear() === dataInicio.getFullYear() &&
                dataDespesa.getMonth() === dataInicio.getMonth() &&
                dataDespesa.getDate() === dataInicio.getDate();
        });
      }
    }
    else if (fDataFim && fDataFim.value) {
      // Se tiver apenas data final
      const dataFim = new Date(fDataFim.value);
      dataFim.setHours(23, 59, 59, 999); // Define para fim do dia
      
      filteredDespesas = filteredDespesas.filter(d => {
        const dataDespesa = new Date(d.data);
        return dataDespesa <= dataFim;
      });
    }
    
    // Renderiza as despesas filtradas
    renderDespesas(filteredDespesas);
    
    // Atualiza o resumo
    atualizarResumo(filteredDespesas);
  }
}

/* monta ?unidade=II&tipo=boleto&status=np  */
function buildQuery() {
  const p = new URLSearchParams();
  if (fUnid && fUnid.value !== 'all') p.append('unidade', fUnid.value);
  if (fTipo && fTipo.value !== 'all') p.append('tipo',    fTipo.value);
  if (fStat && fStat.value !== 'all') p.append('status',  fStat.value);   // p | np
  return p.toString();
}

function setupModalEvents() {
  // Fechar todos os modais (exceto o modal de exclusão que tratamos separadamente)
  document.querySelectorAll('.modal-overlay:not(#deleteModal) .modal-close, .modal-overlay:not(#deleteModal) .btn-cancel').forEach(btn => {
    // Clone para remover event listeners antigos
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', () => {
      // Verifica qual modal está sendo fechado
      const modal = newBtn.closest('.modal-overlay');
      if (!modal) return;
      
      // Verificamos se estamos no fluxo de pagamento
      const modalId = modal.id;
      const isPaymentFlow = modalId === 'bankModal' || modalId === 'methodModal';
      
      // Fecha o modal 
      modal.classList.remove('active');
      
      // Só resetamos o currentDespesaId se não estivermos no fluxo de pagamento
      if (!isPaymentFlow) {
        currentDespesaId = null;
      }
      
      // Se for o fluxo de pagamento e estiver clicando em Cancelar ou X, resetamos tudo
      if (isPaymentFlow && (newBtn.classList.contains('btn-cancel') || newBtn.classList.contains('modal-close'))) {
        currentDespesaId = null;
        selectedBank = null;
        selectedMethod = null;
        
        // Limpar seleções nos modais
        document.querySelectorAll('.payment-option').forEach(opt => {
          opt.classList.remove('selected');
        });
      }
    });
  });
  
  // Tratamento específico para fechar o modal de exclusão (sem executar a exclusão)
  const deleteModalCloseBtn = document.querySelector('#deleteModal .modal-close');
  const deleteModalCancelBtn = document.querySelector('#deleteModal .btn-cancel');
  
  if (deleteModalCloseBtn) {
    const newCloseBtn = deleteModalCloseBtn.cloneNode(true);
    deleteModalCloseBtn.parentNode.replaceChild(newCloseBtn, deleteModalCloseBtn);
    
    newCloseBtn.addEventListener('click', () => {
      const deleteModal = document.getElementById('deleteModal');
      if (deleteModal) {
        deleteModal.classList.remove('active');
      }
      // Apenas limpa o ID da despesa para evitar exclusões acidentais
      currentDespesaId = null;
    });
  }
  
  if (deleteModalCancelBtn) {
    const newCancelBtn = deleteModalCancelBtn.cloneNode(true);
    deleteModalCancelBtn.parentNode.replaceChild(newCancelBtn, deleteModalCancelBtn);
    
    newCancelBtn.addEventListener('click', () => {
      const deleteModal = document.getElementById('deleteModal');
      if (deleteModal) {
        deleteModal.classList.remove('active');
      }
      // Apenas limpa o ID da despesa para evitar exclusões acidentais
      currentDespesaId = null;
    });
  }
  
  // Confirmação de exclusão
  const confirmDelete = document.getElementById('confirmDelete');
  if (confirmDelete) {
    const newBtn = confirmDelete.cloneNode(true);
    confirmDelete.parentNode.replaceChild(newBtn, confirmDelete);
    
    newBtn.addEventListener('click', async () => {
      if (!currentDespesaId) return;
      
      try {
        const resp = await utils.fetchWithRetry(`${API}/api/despesas/${currentDespesaId}`, {
          method: 'DELETE'
        });
        
        if (!resp.ok) throw new Error(`Erro ${resp.status}`);
        
        const deleteModal = document.getElementById('deleteModal');
        if (deleteModal) deleteModal.classList.remove('active');
        
        currentDespesaId = null;
        
        // Atualizar tabela
        render();
        
      } catch (err) {
        console.error(err);
        utils.showAlert('Erro', 'Falha ao excluir despesa – veja o console');
      }
    });
  }
  
  // Função para adicionar nova opção
  function addNewOption() {
    const addOptionModal = document.getElementById('addOptionModal');
    if (!addOptionModal) return;
    
    const modalType = addOptionModal.getAttribute('data-type');
    const newOptionName = document.getElementById('newOptionName');
    if (!newOptionName) return;
    
    const newName = newOptionName.value.trim();
    
    if (!newName) {
      utils.showAlert('Atenção', 'Por favor, digite um nome válido');
      return;
    }
    
    // Cria nova opção com ID baseado no nome (sem espaços, minúsculas)
    const newId = newName.toLowerCase().replace(/\s+/g, '_');
    
    // Adiciona à lista de opções
    if (modalType === 'bank') {
      BANK_OPTIONS.push({ id: newId, label: newName });
      generatePaymentOptions('bankModal', BANK_OPTIONS);
    } else {
      PAYMENT_METHODS.push({ id: newId, label: newName });
      generatePaymentOptions('methodModal', PAYMENT_METHODS);
    }
    
    // Salva no backend
    saveOptionsToBackend();
    
    // Fecha o modal
    addOptionModal.classList.remove('active');
  }
  
  // Handler para salvar nova opção
  const saveNewOption = document.getElementById('saveNewOption');
  if (saveNewOption) {
    const newBtn = saveNewOption.cloneNode(true);
    saveNewOption.parentNode.replaceChild(newBtn, saveNewOption);
    newBtn.addEventListener('click', addNewOption);
  }
  
  // Permitir pressionar Enter no campo para salvar
  const newOptionName = document.getElementById('newOptionName');
  if (newOptionName) {
    const newInput = newOptionName.cloneNode(true);
    newOptionName.parentNode.replaceChild(newInput, newOptionName);
    newInput.addEventListener('keyup', e => {
      if (e.key === 'Enter') {
        addNewOption();
      }
    });
  }
  
  // Delegação de eventos para seleção de banco
  const bankOptions = document.querySelector('#bankModal .payment-options');
  if (bankOptions) {
    bankOptions.addEventListener('click', e => {
      const clickedOption = e.target.closest('.payment-option:not(.add-option)');
      if (clickedOption && !e.target.closest('.btn-remove')) {
        document.querySelectorAll('#bankModal .payment-option').forEach(o => {
          o.classList.remove('selected');
        });
        clickedOption.classList.add('selected');
        // Usamos o atributo data-label para pegar o texto exato do banco
        selectedBank = clickedOption.getAttribute('data-label');
      }
    });
  }
  
  // Delegação de eventos para seleção de método
  const methodOptions = document.querySelector('#methodModal .payment-options');
  if (methodOptions) {
    methodOptions.addEventListener('click', e => {
      const clickedOption = e.target.closest('.payment-option:not(.add-option)');
      if (clickedOption && !e.target.closest('.btn-remove')) {
        document.querySelectorAll('#methodModal .payment-option').forEach(o => {
          o.classList.remove('selected');
        });
        clickedOption.classList.add('selected');
        // Usamos o atributo data-label para pegar o texto exato do método
        selectedMethod = clickedOption.getAttribute('data-label');
      }
    });
  }
  
  // Confirmação de banco - passa para próximo modal
  const confirmBank = document.getElementById('confirmBank');
  if (confirmBank) {
    const newBtn = confirmBank.cloneNode(true);
    confirmBank.parentNode.replaceChild(newBtn, confirmBank);
    
    newBtn.addEventListener('click', () => {
      if (!selectedBank) {
        utils.showAlert('Atenção', 'Por favor, selecione um banco');
        return;
      }
      
      const bankModal = document.getElementById('bankModal');
      const methodModal = document.getElementById('methodModal');
      
      if (bankModal) bankModal.classList.remove('active');
      
      // Pre-selecionar o último método utilizado, se existir
      if (methodModal && lastSelectedMethod) {
        const methodOptions = methodModal.querySelectorAll('.payment-option');
        methodOptions.forEach(option => {
          if (option.getAttribute('data-label') === lastSelectedMethod) {
            option.classList.add('selected');
            selectedMethod = lastSelectedMethod;
          }
        });
      }
      
      if (methodModal) {
        methodModal.classList.add('active');
        
        // Focus no modal para permitir navegação por teclado
        setTimeout(() => {
          const confirmBtn = document.getElementById('confirmMethod');
          if (confirmBtn && selectedMethod) confirmBtn.focus();
        }, 100);
      }
    });
  }
  
  // Confirmação de método - finaliza processo de pagamento
  const confirmMethod = document.getElementById('confirmMethod');
  if (confirmMethod) {
    const newBtn = confirmMethod.cloneNode(true);
    confirmMethod.parentNode.replaceChild(newBtn, confirmMethod);
    
    newBtn.addEventListener('click', async () => {
      if (!selectedMethod) {
        utils.showAlert('Atenção', 'Por favor, selecione um método de pagamento');
        return;
      }
      
      if (!currentDespesaId) {
        utils.showAlert('Erro', 'Erro ao identificar despesa');
        return;
      }
      
      try {
        const paymentData = {
          banco: selectedBank,
          metodo: selectedMethod
        };
        
        const resp = await utils.fetchWithRetry(`${API}/api/despesas/${currentDespesaId}/pago?valor=true`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentData)
        });
        
        if (!resp.ok) throw new Error(`Erro ${resp.status}`);
        
        const methodModal = document.getElementById('methodModal');
        if (methodModal) methodModal.classList.remove('active');
        
        // Salvar o banco e método selecionados para uso futuro
        if (selectedBank && selectedMethod) {
          localStorage.setItem('lastSelectedBank', selectedBank);
          localStorage.setItem('lastSelectedMethod', selectedMethod);
          lastSelectedBank = selectedBank;
          lastSelectedMethod = selectedMethod;
        }
        
        // Limpar seleções
        currentDespesaId = null;
        selectedBank = null;
        selectedMethod = null;
        
        // Atualizar tabela
        render();
        
      } catch (err) {
        console.error('Falha ao processar pagamento:', err);
        utils.showAlert('Erro', 'Falha ao processar pagamento – veja o console');
      }
    });
  }
}

// Função para renderizar as despesas filtradas
async function renderDespesas(despesas) {
  if (!tblBody) return;
  
  tblBody.innerHTML = '';
  
  if (!despesas.length) {
    tblBody.innerHTML = '<tr><td colspan="9">Nenhuma despesa encontrada</td></tr>';
    return;
  }
  
  // Separar variáveis de boletos (excluindo retiradas de despesas fixas)
  const variaveisOriginais = despesas.filter(d => d.tipo === 'variavel');
  const boletos = despesas.filter(d => {
    // Exclui variáveis e despesas de retirada (formato DF-*)
    if (d.tipo === 'variavel') return false;
    if (d.fornecedor && d.fornecedor.startsWith('DF-')) return false;
    return true;
  });
  
  console.log('Debug renderDespesas:');
  console.log('Total despesas:', despesas.length);
  console.log('Variáveis originais:', variaveisOriginais.length);
  console.log('Boletos:', boletos.length);
  console.log('Tipos encontrados:', [...new Set(despesas.map(d => d.tipo))]);
  
  // Ordenar por data (mais recente primeiro)
  boletos.sort((a, b) => new Date(a.data) - new Date(b.data));
  
  // Se houver variáveis, buscar dados agrupados
  let variaveisAgrupadas = [];
  if (variaveisOriginais.length > 0) {
    try {
      variaveisAgrupadas = await buscarVariaveisAgrupadas();
      console.log('Variáveis agrupadas encontradas:', variaveisAgrupadas);
    } catch (error) {
      console.error('Erro ao buscar variáveis agrupadas:', error);
    }
  }
  
  renderTodoOConteudo();
  
  function renderTodoOConteudo() {
    tblBody.innerHTML = '';
    
    // Renderizar seção de boletos
    if (boletos.length > 0) {
      const headerBoletos = document.createElement('tr');
      headerBoletos.className = 'section-header';
      headerBoletos.innerHTML = `
        <td colspan="9" style="background: var(--primary); color: white; font-weight: bold; text-align: center; padding: 12px;">
          📄 BOLETOS E DESPESAS (${boletos.length} itens)
        </td>`;
      tblBody.appendChild(headerBoletos);
      
      boletos.forEach(d => renderLinha(d, false));
    }
    
    // Renderizar seção de despesas fixas
    if (allDespesasFixas.length > 0) {
      const headerDespesasFixas = document.createElement('tr');
      headerDespesasFixas.className = 'section-header despesas-fixas-header';
      headerDespesasFixas.innerHTML = `
        <td colspan="9" style="background: #17a2b8; color: white; font-weight: bold; text-align: center; padding: 12px;">
          💳 DESPESAS FIXAS (${allDespesasFixas.length} itens)
        </td>`;
      tblBody.appendChild(headerDespesasFixas);
      
      const despesasFixasRow = document.createElement('tr');
      despesasFixasRow.innerHTML = `
        <td colspan="9" style="padding: 0; border: none;">
          ${renderDespesasFixas()}
        </td>`;
      tblBody.appendChild(despesasFixasRow);
    }
    
    // Renderizar seção de variáveis agrupadas
    if (variaveisAgrupadas.length > 0) {
      const headerVariaveis = document.createElement('tr');
      headerVariaveis.className = 'section-header';
      headerVariaveis.innerHTML = `
        <td colspan="9" style="background: #28a745; color: white; font-weight: bold; text-align: center; padding: 12px;">
          💰 DESPESAS VARIÁVEIS AGRUPADAS (${variaveisAgrupadas.length} grupos)
        </td>`;
      tblBody.appendChild(headerVariaveis);
      
      variaveisAgrupadas.forEach(d => renderLinha(d, true));
    }
    
    // Se não há nenhuma despesa
    if (boletos.length === 0 && variaveisAgrupadas.length === 0) {
      tblBody.innerHTML = '<tr><td colspan="9">Nenhuma despesa encontrada</td></tr>';
    }
  }
  
  // Função auxiliar para renderizar uma linha
  function renderLinha(d, isVariavelAgrupada = false) {
    const tr = document.createElement('tr');
    tr.className = d.pago ? 'pago' : 'nao-pago';
    if (isVariavelAgrupada) {
      tr.classList.add('variavel-agrupada');
    }
    tr.setAttribute('data-id', d.id);

    const dataFmt = new Date(d.data + 'T00:00').toLocaleDateString('pt-BR');
    const valorFmt = Number(d.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2});
    
    // Verifica se há termos de pesquisa para destacar
    let fornecedorHtml = d.fornecedor;
    if (fFornecedor && fFornecedor.value.trim()) {
      const searchTerm = slugify(fFornecedor.value.trim());
      const fornecedorSlug = slugify(d.fornecedor);
      const indexStart = fornecedorSlug.indexOf(searchTerm);
      
      if (indexStart !== -1) {
        const indexEnd = indexStart + searchTerm.length;
        const highlightText = d.fornecedor.substring(indexStart, indexEnd);
        fornecedorHtml = d.fornecedor.replace(
          highlightText, 
          `<span class="highlight-match">${highlightText}</span>`
        );
      }
    }

    // Para variáveis agrupadas, mostrar informação adicional
    const tipoDisplay = isVariavelAgrupada ? 
      `${d.tipo} (${d.quantidade || 1}x)` : 
      d.tipo;

    tr.innerHTML = `
      <td>${dataFmt}</td>
      <td>${fornecedorHtml}</td>
      <td class="tipoPagamento">${tipoDisplay}</td>
      <td>${d.unidade}</td>
      <td class="valor">R$ ${valorFmt}</td>
      <td>${d.banco || '-'}</td>
      <td>${d.metodo || '-'}</td>
      <td><input type="checkbox" ${d.pago ? 'checked' : ''} ${isVariavelAgrupada ? 'disabled title="Variáveis são automaticamente pagas"' : ''}></td>
      <td>
        ${isVariavelAgrupada ? 
          '<button class="btn-delete-variavel" title="Excluir todas as variáveis deste fornecedor"><i class="fas fa-trash-alt"></i></button>' : 
          '<button class="btn-delete" title="Excluir"><i class="fas fa-trash-alt"></i></button>'
        }
      </td>`;

    // Eventos para variáveis agrupadas
    if (isVariavelAgrupada) {
      const deleteBtn = tr.querySelector('.btn-delete-variavel');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          const fornecedor = d.fornecedor;
          const quantidade = d.quantidade || 1;
          
          utils.showConfirm(
            'Confirmar exclusão', 
            `Tem certeza que deseja excluir TODAS as ${quantidade} despesas variáveis de "${fornecedor}"?`, 
            async () => {
              try {
                // Buscar todas as despesas variáveis deste fornecedor
                const response = await utils.fetchWithRetry(`${API}/api/despesas`);
                const todasDespesas = await response.json();
                
                const variaveisParaExcluir = todasDespesas.filter(despesa => 
                  despesa.tipo === 'variavel' && 
                  despesa.fornecedor === fornecedor
                );
                
                // Excluir uma por uma
                const exclusoes = variaveisParaExcluir.map(despesa => 
                  utils.fetchWithRetry(`${API}/api/despesas/${despesa.id}`, {
                    method: 'DELETE'
                  })
                );
                
                await Promise.all(exclusoes);
                
                // Recarregar a página
                render();
                
                utils.showAlert('Sucesso', `${variaveisParaExcluir.length} despesas variáveis de "${fornecedor}" foram excluídas.`);
                
              } catch (error) {
                console.error('Erro ao excluir variáveis:', error);
                utils.showAlert('Erro', 'Falha ao excluir despesas variáveis - veja o console');
              }
            }
          );
        });
      }
    }
    // Eventos apenas para despesas não agrupadas
    else {
      /* alterna pago / não pago com modal */
      tr.querySelector('input').addEventListener('change', e => {
        if (e.target.checked) {
          // Se estiver marcando como pago, mostra modal de seleção de banco
          currentDespesaId = d.id;
          const bankModal = document.getElementById('bankModal');
          
          if (bankModal) {
            const previousSelected = bankModal.querySelector('.payment-option.selected');
            if (previousSelected) {
              previousSelected.classList.remove('selected');
            }
            
            if (lastSelectedBank) {
              const targetOption = bankModal.querySelector(`[data-label="${lastSelectedBank}"]`);
              if (targetOption) {
                targetOption.classList.add('selected');
                selectedBank = lastSelectedBank;
              }
            }
            
            bankModal.classList.add('active');
          }
        } else {
          // Se estiver desmarcando, apenas atualiza o status
          utils.fetchWithRetry(`${API}/api/despesas/${d.id}/pago?valor=false`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          })
          .then(response => {
            if (!response.ok) {
              throw new Error(`Erro ${response.status}`);
            }
            return response.json();
          })
          .then(() => render())
          .catch(error => {
            console.error('Erro ao desmarcar como pago:', error);
            utils.showAlert('Erro', 'Falha ao desmarcar pagamento - veja o console');
            render();
          });
        }
      });
      
      // Evento para o botão de exclusão
      const deleteBtn = tr.querySelector('.btn-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          currentDespesaId = d.id;
          const deleteModal = document.getElementById('deleteModal');
          if (deleteModal) deleteModal.classList.add('active');
        });
      }
    }

    tblBody.appendChild(tr);
  }

  // Função para buscar variáveis agrupadas
  async function buscarVariaveisAgrupadas() {
    try {
      const params = new URLSearchParams();
      
      // Adicionar filtros de unidade e data se aplicáveis
      if (fUnid && fUnid.value && fUnid.value !== 'all') {
        params.append('unidade', fUnid.value);
      }
      
      if (fDataInicio && fDataInicio.value) {
        params.append('dataInicio', fDataInicio.value);
      }
      
      if (fDataFim && fDataFim.value) {
        params.append('dataFim', fDataFim.value);
      }
      
      const url = `${API}/api/despesas/variaveis/agrupadas?${params.toString()}`;
      const response = await utils.fetchWithRetry(url);
      const variaveisAgrupadasRaw = await response.json();
      
      // Filtrar despesas de retirada (formato DF-*)
      variaveisAgrupadas = variaveisAgrupadasRaw.filter(d => {
        if (d.fornecedor && d.fornecedor.startsWith('DF-')) {
          return false; // Exclui despesas de retirada
        }
        return true;
      });
      
      return variaveisAgrupadas;
    } catch (error) {
      console.error('Erro ao buscar variáveis agrupadas:', error);
      return [];
    }
  }
}

// Função para atualizar o resumo de valores
async function atualizarResumo(despesas) {
  const cardsContainer = document.querySelector('.cards-container');
  
  if (!despesas || !despesas.length) {
    // Se não houver despesas, mostra zeros
    if (resumoTotal) resumoTotal.textContent = 'R$ 0,00';
    if (resumoPago) resumoPago.textContent = 'R$ 0,00';
    if (resumoAPagar) resumoAPagar.textContent = 'R$ 0,00';
    
    // Adiciona classe disabled aos cards
    if (cardsContainer) cardsContainer.classList.add('disabled');
    return;
  }
  
  // Remove classe disabled se houver despesas
  if (cardsContainer) cardsContainer.classList.remove('disabled');
  
  // Separar variáveis de boletos (excluindo retiradas de despesas fixas)
  const variaveisOriginais = despesas.filter(d => d.tipo === 'variavel');
  const boletos = despesas.filter(d => {
    // Exclui variáveis e despesas de retirada (formato DF-*)
    if (d.tipo === 'variavel') return false;
    if (d.fornecedor && d.fornecedor.startsWith('DF-')) return false;
    return true;
  });
  
  // Buscar variáveis agrupadas se necessário
  let variaveisAgrupadas = [];
  if (variaveisOriginais.length > 0) {
    try {
      const params = new URLSearchParams();
      
      if (fUnid && fUnid.value && fUnid.value !== 'all') {
        params.append('unidade', fUnid.value);
      }
      
      if (fDataInicio && fDataInicio.value) {
        params.append('dataInicio', fDataInicio.value);
      }
      
      if (fDataFim && fDataFim.value) {
        params.append('dataFim', fDataFim.value);
      }
      
      const url = `${API}/api/despesas/variaveis/agrupadas?${params.toString()}`;
      const response = await utils.fetchWithRetry(url);
      const variaveisAgrupadasRaw = await response.json();
      
      // Filtrar despesas de retirada (formato DF-*)
      variaveisAgrupadas = variaveisAgrupadasRaw.filter(d => {
        if (d.fornecedor && d.fornecedor.startsWith('DF-')) {
          return false; // Exclui despesas de retirada
        }
        return true;
      });
    } catch (error) {
      console.error('Erro ao buscar variáveis para resumo:', error);
    }
  }
  
  // Combinar boletos e variáveis agrupadas para cálculo
  const todasDespesas = [...boletos, ...variaveisAgrupadas];
  
  // Calcula os valores
  const total = todasDespesas.reduce((sum, d) => sum + Number(d.valor), 0);
  const pago = todasDespesas
    .filter(d => d.pago)
    .reduce((sum, d) => sum + Number(d.valor), 0);
  const aPagar = total - pago;
  
  // Atualiza os elementos na interface
  if (resumoTotal) resumoTotal.textContent = `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
  if (resumoPago) resumoPago.textContent = `R$ ${pago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
  if (resumoAPagar) resumoAPagar.textContent = `R$ ${aPagar.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
  
  // Adiciona classe para destacar os cards se houver valores
  const cardTotal = document.getElementById('card-total');
  const cardPago = document.getElementById('card-pago');
  const cardAPagar = document.getElementById('card-a-pagar');
  
  // Limpa classes existentes
  [cardTotal, cardPago, cardAPagar].forEach(card => {
    if (card) card.classList.remove('has-value');
  });
  
  // Adiciona classes imediatamente - SEM DELAY
  if (total > 0 && cardTotal) cardTotal.classList.add('has-value');
  if (pago > 0 && cardPago) cardPago.classList.add('has-value');
  if (aPagar > 0 && cardAPagar) cardAPagar.classList.add('has-value');
  
  // Atualiza a classe com base na data selecionada
  if (fDataInicio && fDataInicio.value && (!fDataFim || !fDataFim.value)) {
    // Se tiver apenas data inicial (um dia específico)
    const data = new Date(fDataInicio.value);
    const dataFormatada = data.toLocaleDateString('pt-BR');
    const cardTotalHeading = cardTotal ? cardTotal.querySelector('h3') : null;
    if (cardTotalHeading) cardTotalHeading.textContent = `Total do Dia (${dataFormatada})`;
  } else {
    // Se for um período ou sem data específica
    const cardTotalHeading = cardTotal ? cardTotal.querySelector('h3') : null;
    if (cardTotalHeading) cardTotalHeading.textContent = 'Total do Período';
  }
}

// Função principal para carregar os pagamentos e renderizar a tabela
async function render() {
  const statusEl = document.getElementById('loading-status');
  if (statusEl) statusEl.textContent = 'Carregando dados...';
  
  try {
    // Tenta buscar dados do backend
    const [despesasResponse] = await Promise.all([
      utils.fetchWithRetry(`${API}/api/despesas`),
      buscarDespesasFixas() // Buscar despesas fixas em paralelo
    ]);
    
    const data = await despesasResponse.json();
    
    // Atualiza a lista completa
    allDespesas = data;
    
    // Aplica filtros iniciais e renderiza
    aplicarFiltros();
    
    if (statusEl) statusEl.textContent = '';
  } catch (error) {
    console.error('Erro ao carregar despesas:', error);
    if (statusEl) statusEl.textContent = 'Erro ao carregar dados. Tente novamente mais tarde.';
    
    if (tblBody) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="8" class="text-center text-danger">
        Erro ao carregar dados. Tente novamente mais tarde.
      </td>`;
      tblBody.appendChild(tr);
    }
  }
}

// Função para criar ou atualizar uma despesa
async function salvarDespesa(despesa) {
  try {
    const isUpdate = despesa.id !== undefined;
    const url = isUpdate 
      ? `${API}/api/despesas/${despesa.id}` 
      : `${API}/api/despesas`;
    
    const options = {
      method: isUpdate ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(despesa)
    };
    
    const response = await utils.fetchWithRetry(url, options);
    
    if (!response.ok) {
      throw new Error(`Erro ao ${isUpdate ? 'atualizar' : 'criar'} despesa: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Erro ao ${despesa.id ? 'atualizar' : 'criar'} despesa:`, error);
    throw error;
  }
}

// Função para inicializar eventos de teclado nos modais de pagamento
function setupKeyboardEvents() {
  document.addEventListener('keydown', event => {
    // Se a tecla não for Enter, ignoramos
    if (event.key !== 'Enter') return;
    
    // Verificar qual modal está ativo
    const bankModal = document.getElementById('bankModal');
    const methodModal = document.getElementById('methodModal');
    
    // Se o modal de banco estiver ativo, simula o clique no botão de confirmar banco
    if (bankModal && bankModal.classList.contains('active') && selectedBank) {
      event.preventDefault();
      const confirmBtn = document.getElementById('confirmBank');
      if (confirmBtn) confirmBtn.click();
    } 
    // Se o modal de método estiver ativo, simula o clique no botão de confirmar método
    else if (methodModal && methodModal.classList.contains('active') && selectedMethod) {
      event.preventDefault();
      const confirmBtn = document.getElementById('confirmMethod');
      if (confirmBtn) confirmBtn.click();
    }
  });
}

/* ===== SISTEMA DE DESPESAS FIXAS ===== */

// Função para buscar despesas fixas do mês atual
async function buscarDespesasFixas(mesAno = null) {
  try {
    if (!mesAno) {
      const agora = new Date();
      mesAno = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    }
    
    const response = await utils.fetchWithRetry(`${API}/api/despesas-fixas?mesAno=${mesAno}`);
    const despesasFixas = await response.json();
    
    // Buscar resumos de cada despesa fixa
    const despesasComResumo = await Promise.all(
      despesasFixas.map(async (df) => {
        try {
          const resumoResponse = await utils.fetchWithRetry(`${API}/api/despesas-fixas/${df.id}/resumo`);
          const resumo = await resumoResponse.json();
          return resumo;
        } catch (error) {
          console.error('Erro ao buscar resumo da despesa fixa:', df.id, error);
          return {
            ...df,
            valorRetirado: 0,
            valorRestante: df.valorTotal,
            quantidadeRetiradas: 0
          };
        }
      })
    );
    
    allDespesasFixas = despesasComResumo;
    return despesasComResumo;
    
  } catch (error) {
    console.error('Erro ao buscar despesas fixas:', error);
    allDespesasFixas = [];
    return [];
  }
}

// Função para abrir modal de cadastro de despesa fixa
function abrirModalDespesaFixa() {
  const modal = document.getElementById('despesaFixaModal');
  const nomeInput = document.getElementById('despesaFixaNome');
  const unidadeSelect = document.getElementById('despesaFixaUnidade');
  const valorInput = document.getElementById('despesaFixaValor');
  
  // Limpar campos
  if (nomeInput) nomeInput.value = '';
  if (unidadeSelect) unidadeSelect.value = '';
  if (valorInput) valorInput.value = '';
  
  if (modal) {
    modal.classList.add('active');
    if (nomeInput) nomeInput.focus();
  }
}

// Função para salvar despesa fixa
async function salvarDespesaFixa() {
  const nomeInput = document.getElementById('despesaFixaNome');
  const unidadeSelect = document.getElementById('despesaFixaUnidade');
  const valorInput = document.getElementById('despesaFixaValor');
  
  const nome = nomeInput?.value?.trim();
  const unidade = unidadeSelect?.value;
  const valor = parseFloat(valorInput?.value || '0');
  
  if (!nome || !unidade || valor <= 0) {
    utils.showAlert('Erro', 'Todos os campos são obrigatórios e o valor deve ser maior que zero.');
    return;
  }
  
  try {
    const despesaFixa = {
      nome: nome,
      unidade: unidade,
      valorTotal: valor
    };
    
    const response = await utils.fetchWithRetry(`${API}/api/despesas-fixas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(despesaFixa)
    });
    
    if (response.ok) {
      utils.showAlert('Sucesso', 'Despesa fixa cadastrada com sucesso!');
      document.getElementById('despesaFixaModal')?.classList.remove('active');
      
      // Recarregar dados
      await buscarDespesasFixas();
      render();
    } else {
      throw new Error('Erro ao salvar');
    }
  } catch (error) {
    console.error('Erro ao salvar despesa fixa:', error);
    utils.showAlert('Erro', 'Erro ao salvar despesa fixa. Tente novamente.');
  }
}

// Função para abrir modal de retirada
function abrirModalRetirada(despesaFixaId) {
  const despesaFixa = allDespesasFixas.find(df => df.id === despesaFixaId);
  if (!despesaFixa) return;
  
  currentDespesaFixaId = despesaFixaId;
  
  const modal = document.getElementById('retirarDespesaFixaModal');
  const title = document.getElementById('retirarDespesaFixaModalTitle');
  const descricaoInput = document.getElementById('retirarDespesaFixaDescricao');
  const valorInput = document.getElementById('retirarDespesaFixaValor');
  const dataInput = document.getElementById('retirarDespesaFixaData');
  const infoBox = document.getElementById('despesaFixaInfo');
  
  // Preencher informações
  if (title) title.textContent = `Retirar de: ${despesaFixa.nome}`;
  
  if (infoBox) {
    infoBox.innerHTML = `
      <h4>${despesaFixa.nome} - ${despesaFixa.unidade}</h4>
      <p><strong>Valor Total:</strong> R$ ${despesaFixa.valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
      <p><strong>Valor Retirado:</strong> R$ ${despesaFixa.valorRetirado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
      <p><strong>Valor Restante:</strong> R$ ${despesaFixa.valorRestante.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
      <p><strong>Retiradas:</strong> ${despesaFixa.quantidadeRetiradas}</p>
    `;
  }
  
  // Limpar campos
  if (descricaoInput) descricaoInput.value = '';
  if (valorInput) {
    valorInput.value = '';
    valorInput.max = despesaFixa.valorRestante;
  }
  if (dataInput) dataInput.value = '';
  
  if (modal) {
    modal.classList.add('active');
    if (descricaoInput) descricaoInput.focus();
  }
}

// Função para confirmar retirada
async function confirmarRetirada() {
  const valorInput = document.getElementById('retirarDespesaFixaValor');
  const dataInput = document.getElementById('retirarDespesaFixaData');
  
  const valor = parseFloat(valorInput?.value || '0');
  const data = dataInput?.value;
  
  if (valor <= 0 || !data) {
    utils.showAlert('Erro', 'Valor e data são obrigatórios.');
    return;
  }
  
  const despesaFixa = allDespesasFixas.find(df => df.id === currentDespesaFixaId);
  if (!despesaFixa) return;
  
  if (valor > despesaFixa.valorRestante) {
    utils.showAlert('Erro', `Valor superior ao restante. Máximo: R$ ${despesaFixa.valorRestante.toFixed(2)}`);
    return;
  }
  
  try {
    // Criar despesa normal com referência à despesa fixa
    const despesa = {
      fornecedor: `DF-${currentDespesaFixaId}-Retirada`,
      valor: valor,
      data: data,
      unidade: despesaFixa.unidade,
      tipo: 'variavel',
      pago: true,
      banco: 'N/A',
      metodo: 'dinheiro'
    };
    
    const response = await utils.fetchWithRetry(`${API}/api/despesas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(despesa)
    });
    
    if (response.ok) {
      utils.showAlert('Sucesso', 'Valor retirado com sucesso!');
      document.getElementById('retirarDespesaFixaModal')?.classList.remove('active');
      
      // Recarregar dados
      await buscarDespesasFixas();
      render();
    } else {
      throw new Error('Erro ao salvar');
    }
  } catch (error) {
    console.error('Erro ao confirmar retirada:', error);
    utils.showAlert('Erro', 'Erro ao confirmar retirada. Tente novamente.');
  }
}

// Função para deletar despesa fixa
async function deletarDespesaFixa(id) {
  try {
    const despesaFixa = allDespesasFixas.find(d => d.id === id);
    if (!despesaFixa) return;

    const confirmacao = confirm(`Tem certeza que deseja deletar a despesa fixa "${despesaFixa.nome}"?\n\nISTO IRÁ APAGAR PERMANENTEMENTE ESTA DESPESA FIXA.`);
    
    if (!confirmacao) return;

    const response = await utils.fetchWithRetry(`${API}/api/despesas-fixas/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      utils.showAlert('Sucesso', 'Despesa fixa deletada com sucesso!');
      
      // Recarregar dados
      await buscarDespesasFixas();
      render();
    } else {
      utils.showAlert('Erro', 'Erro ao deletar despesa fixa');
    }
  } catch (error) {
    console.error('Erro ao deletar despesa fixa:', error);
    utils.showAlert('Erro', 'Erro ao deletar despesa fixa');
  }
}

// Função para renderizar cards de despesas fixas
function renderDespesasFixas() {
  if (!allDespesasFixas.length) return '';
  
  const cardsHtml = allDespesasFixas.map(df => `
    <div class="despesa-fixa-card" data-id="${df.id}">
      <div class="despesa-fixa-header">
        <h4>${df.nome}</h4>
        <span class="despesa-fixa-unidade">${df.unidade}</span>
      </div>
      <div class="despesa-fixa-valores">
        <div class="valor-item">
          <span class="label">Total:</span>
          <span class="valor">R$ ${df.valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
        </div>
        <div class="valor-item">
          <span class="label">Retirado:</span>
          <span class="valor usado">R$ ${df.valorRetirado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
        </div>
        <div class="valor-item">
          <span class="label">Restante:</span>
          <span class="valor restante">R$ ${df.valorRestante.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
        </div>
      </div>
      <div class="despesa-fixa-actions">
        <button class="btn btn-small btn-primary" onclick="abrirModalRetirada(${df.id})">
          <i class="fas fa-minus-circle"></i> Retirar
        </button>
        <button class="btn btn-small btn-danger" onclick="deletarDespesaFixa(${df.id})" title="Deletar despesa fixa">
          <i class="fas fa-trash"></i>
        </button>
        <span class="retiradas-count">${df.quantidadeRetiradas} retirada(s)</span>
      </div>
    </div>
  `).join('');
  
  return `
    <div class="despesas-fixas-section">
      <h3><i class="fas fa-calculator"></i> DESPESAS FIXAS</h3>
      <div class="despesas-fixas-container">
        ${cardsHtml}
      </div>
    </div>
  `;
}

// Função para renderizar apenas despesas fixas (filtro)
function renderDespesasFixasOnly() {
  if (!tblBody) return;
  
  tblBody.innerHTML = '';
  
  if (!allDespesasFixas.length) {
    tblBody.innerHTML = '<tr><td colspan="9">Nenhuma despesa fixa encontrada</td></tr>';
    return;
  }
  
  // Filtrar por unidade se necessário
  let despesasFixasFiltradas = [...allDespesasFixas];
  if (fUnid && fUnid.value !== 'all') {
    despesasFixasFiltradas = despesasFixasFiltradas.filter(df => df.unidade === fUnid.value);
  }
  
  const headerDespesasFixas = document.createElement('tr');
  headerDespesasFixas.className = 'section-header despesas-fixas-header';
  headerDespesasFixas.innerHTML = `
    <td colspan="9" style="background: #17a2b8; color: white; font-weight: bold; text-align: center; padding: 12px;">
      💳 DESPESAS FIXAS (${despesasFixasFiltradas.length} itens)
    </td>`;
  tblBody.appendChild(headerDespesasFixas);
  
  const despesasFixasRow = document.createElement('tr');
  despesasFixasRow.innerHTML = `
    <td colspan="9" style="padding: 0; border: none;">
      ${renderDespesasFixasCards(despesasFixasFiltradas)}
    </td>`;
  tblBody.appendChild(despesasFixasRow);
  
  // Atualizar resumo apenas com despesas fixas
  atualizarResumoDespesasFixas(despesasFixasFiltradas);
}

// Função auxiliar para renderizar cards filtrados
function renderDespesasFixasCards(despesasFixas) {
  if (!despesasFixas.length) return '<p style="text-align: center; padding: 20px;">Nenhuma despesa fixa encontrada para os filtros aplicados.</p>';
  
  const cardsHtml = despesasFixas.map(df => `
    <div class="despesa-fixa-card" data-id="${df.id}">
      <div class="despesa-fixa-header">
        <h4>${df.nome}</h4>
        <span class="despesa-fixa-unidade">${df.unidade}</span>
      </div>
      <div class="despesa-fixa-valores">
        <div class="valor-item">
          <span class="label">Total:</span>
          <span class="valor">R$ ${df.valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
        </div>
        <div class="valor-item">
          <span class="label">Retirado:</span>
          <span class="valor usado">R$ ${df.valorRetirado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
        </div>
        <div class="valor-item">
          <span class="label">Restante:</span>
          <span class="valor restante">R$ ${df.valorRestante.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
        </div>
      </div>
      <div class="despesa-fixa-actions">
        <button class="btn btn-small btn-primary" onclick="abrirModalRetirada(${df.id})">
          <i class="fas fa-minus-circle"></i> Retirar
        </button>
        <button class="btn btn-small btn-danger" onclick="deletarDespesaFixa(${df.id})" title="Deletar despesa fixa">
          <i class="fas fa-trash"></i>
        </button>
        <span class="retiradas-count">${df.quantidadeRetiradas} retirada(s)</span>
      </div>
    </div>
  `).join('');
  
  return `
    <div class="despesas-fixas-section">
      <div class="despesas-fixas-container">
        ${cardsHtml}
      </div>
    </div>
  `;
}

// Função para atualizar resumo apenas com despesas fixas
function atualizarResumoDespesasFixas(despesasFixas) {
  const total = despesasFixas.reduce((sum, df) => sum + df.valorTotal, 0);
  const retirado = despesasFixas.reduce((sum, df) => sum + df.valorRetirado, 0);
  const restante = total - retirado;
  
  if (resumoTotal) resumoTotal.textContent = `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
  if (resumoPago) resumoPago.textContent = `R$ ${retirado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
  if (resumoAPagar) resumoAPagar.textContent = `R$ ${restante.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
  
  // Atualizar títulos dos cards para despesas fixas
  const cardTotal = document.getElementById('card-total');
  const cardPago = document.getElementById('card-a-pagar');
  
  if (cardTotal) {
    const heading = cardTotal.querySelector('h3');
    if (heading) heading.textContent = 'Total Orçado';
  }
  
  if (cardPago) {
    const heading = cardPago.querySelector('h3');
    if (heading) heading.textContent = 'Valor Restante';
  }
}

// Função para configurar eventos das despesas fixas
function setupDespesasFixasEvents() {
  // Botão para cadastrar nova despesa fixa
  const btnDespesaFixa = document.getElementById('btn-despesa-fixa');
  if (btnDespesaFixa) {
    btnDespesaFixa.addEventListener('click', abrirModalDespesaFixa);
  }
  
  // Botão para salvar despesa fixa
  const btnSalvarDespesaFixa = document.getElementById('salvarDespesaFixa');
  if (btnSalvarDespesaFixa) {
    btnSalvarDespesaFixa.addEventListener('click', salvarDespesaFixa);
  }
  
  // Botão para confirmar retirada
  const btnConfirmarRetirada = document.getElementById('confirmarRetiradaDespesaFixa');
  if (btnConfirmarRetirada) {
    btnConfirmarRetirada.addEventListener('click', confirmarRetirada);
  }
  
  // Configurar modais para fechar
  const despesaFixaModal = document.getElementById('despesaFixaModal');
  const retirarModal = document.getElementById('retirarDespesaFixaModal');
  
  [despesaFixaModal, retirarModal].forEach(modal => {
    if (!modal) return;
    
    const closeButtons = modal.querySelectorAll('.modal-close, .btn-cancel');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modal.classList.remove('active');
        currentDespesaFixaId = null;
      });
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        currentDespesaFixaId = null;
      }
    });
  });
}

// Tornar funções globais para uso inline
window.abrirModalRetirada = abrirModalRetirada;
window.deletarDespesaFixa = deletarDespesaFixa;

// Exporta as funções necessárias
module.exports.init = init;
module.exports.salvarDespesa = salvarDespesa;
module.exports.abrirModalRetirada = abrirModalRetirada;