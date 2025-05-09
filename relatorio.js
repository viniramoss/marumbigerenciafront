/* relatorio.js – lista, filtros e marcação pago */

const { API_URL } = require('./env-config');
let firstRun = true;
let tblBody, fUnid, fTipo, fStat;
let currentDespesaId = null;
let selectedBank = null;
let selectedMethod = null;

const API = API_URL;

// Configuração dinâmica das opções de bancos e métodos
let BANK_OPTIONS = [
  { id: 'itau', label: 'Itaú' },
  { id: 'bradesco', label: 'Bradesco' },
  { id: 'santander', label: 'Santander' },
  { id: 'nubank', label: 'Nubank' }
];

let PAYMENT_METHODS = [
  { id: 'pix', label: 'Pix' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'ted', label: 'TED/DOC' },
  { id: 'debito', label: 'Débito' }
];

function init() {
  if (firstRun) {
    tblBody = document.querySelector('#tblPag tbody');
    fUnid   = document.getElementById('f-unidade');
    fTipo   = document.getElementById('f-tipo');
    fStat   = document.getElementById('f-status');
    
    const bankModal = document.getElementById('bankModal');
    const methodModal = document.getElementById('methodModal');
    const deleteModal = document.getElementById('deleteModal');
    const addOptionModal = document.getElementById('addOptionModal');

    // Event listeners para os filtros
    [fUnid, fTipo, fStat].forEach(sel => sel.addEventListener('change', render));
    
    // Carregar opções de bancos e métodos do backend
    loadOptionsFromBackend();
    
    // Event listeners para os modais
    setupModalEvents();
    
    firstRun = false;
  }
  render();
}

// Função para carregar opções do backend
async function loadOptionsFromBackend() {
  try {
    const resp = await fetch(`${API}/api/opcoes`);
    if (resp.ok) {
      const options = await resp.json();
      if (options.bancos && Array.isArray(options.bancos)) {
        BANK_OPTIONS = options.bancos;
      }
      if (options.metodos && Array.isArray(options.metodos)) {
        PAYMENT_METHODS = options.metodos;
      }
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
      if (confirm(`Tem certeza que deseja remover "${option.label}"?`)) {
        // Remove da lista de opções
        const optionsList = isBank ? BANK_OPTIONS : PAYMENT_METHODS;
        const index = optionsList.findIndex(o => o.id === option.id);
        if (index !== -1) {
          optionsList.splice(index, 1);
          // Salva as alterações no backend
          saveOptionsToBackend();
          // Regenera as opções
          generatePaymentOptions(modalId, optionsList);
        }
      }
    });
    
    container.appendChild(optionDiv);
  });
  
  // Adiciona botão para adicionar nova opção
  const addButton = document.createElement('div');
  addButton.className = 'payment-option add-option';
  addButton.innerHTML = '<i class="fas fa-plus"></i> Adicionar Novo';
  addButton.addEventListener('click', () => {
    const isBank = modalId === 'bankModal';
    // Configurar o modal de adição
    document.getElementById('addOptionTitle').textContent = 
      `Adicionar Novo ${isBank ? 'Banco' : 'Método de Pagamento'}`;
    
    const inputField = document.getElementById('newOptionName');
    inputField.value = '';
    inputField.focus();
    
    // Armazenar qual tipo está sendo adicionado
    document.getElementById('addOptionModal').setAttribute('data-type', isBank ? 'bank' : 'method');
    
    // Mostrar o modal
    document.getElementById('addOptionModal').classList.add('active');
  });
  container.appendChild(addButton);
}

// Função para salvar opções no backend
async function saveOptionsToBackend() {
  try {
    const resp = await fetch(`${API}/api/opcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bancos: BANK_OPTIONS,
        metodos: PAYMENT_METHODS
      })
    });
    
    if (!resp.ok) {
      console.warn('Erro ao salvar opções:', resp.status);
    }
  } catch (err) {
    console.error('Falha ao salvar opções:', err);
  }
}

/* monta ?unidade=II&tipo=boleto&status=np  */
function buildQuery() {
  const p = new URLSearchParams();
  if (fUnid.value !== 'all') p.append('unidade', fUnid.value);
  if (fTipo.value !== 'all') p.append('tipo',    fTipo.value);
  if (fStat.value !== 'all') p.append('status',  fStat.value);   // p | np
  return p.toString();
}

function setupModalEvents() {
  // Fechar todos os modais
  document.querySelectorAll('.modal-close, .btn-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.remove('active');
      });
      // Resetar estados
      currentDespesaId = null;
      selectedBank = null;
      selectedMethod = null;
      
      // Limpar seleções nos modais
      document.querySelectorAll('.payment-option').forEach(opt => {
        opt.classList.remove('selected');
      });
    });
  });
  
  // Handler para salvar nova opção
  document.getElementById('saveNewOption').addEventListener('click', addNewOption);
  
  // Permitir pressionar Enter no campo para salvar
  document.getElementById('newOptionName').addEventListener('keyup', e => {
    if (e.key === 'Enter') {
      addNewOption();
    }
  });
  
  // Função para adicionar nova opção
  function addNewOption() {
    const modalType = document.getElementById('addOptionModal').getAttribute('data-type');
    const newName = document.getElementById('newOptionName').value.trim();
    
    if (!newName) {
      alert('Por favor, digite um nome válido');
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
    document.getElementById('addOptionModal').classList.remove('active');
  }
  
  // Delegação de eventos para seleção de banco
  document.querySelector('#bankModal .payment-options').addEventListener('click', e => {
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
  
  // Delegação de eventos para seleção de método
  document.querySelector('#methodModal .payment-options').addEventListener('click', e => {
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
  
  // Confirmação de banco - passa para próximo modal
  document.getElementById('confirmBank').addEventListener('click', () => {
    if (!selectedBank) return alert('Por favor, selecione um banco');
    
    document.getElementById('bankModal').classList.remove('active');
    document.getElementById('methodModal').classList.add('active');
  });
  
  // Confirmação de método - finaliza processo de pagamento
  document.getElementById('confirmMethod').addEventListener('click', async () => {
    if (!selectedMethod) return alert('Por favor, selecione um método de pagamento');
    if (!currentDespesaId) return alert('Erro ao identificar despesa');
    
    try {
      const paymentData = {
        banco: selectedBank,
        metodo: selectedMethod
      };
      
      console.log('Enviando dados de pagamento:', paymentData);
      
      const resp = await fetch(`${API}/api/despesas/${currentDespesaId}/pago?valor=true`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });
      
      if (!resp.ok) throw new Error(`Erro ${resp.status}`);
      
      document.getElementById('methodModal').classList.remove('active');
      // Limpar seleções
      currentDespesaId = null;
      selectedBank = null;
      selectedMethod = null;
      
      // Atualizar tabela
      render();
      
    } catch (err) {
      console.error('Falha ao processar pagamento:', err);
      alert('Falha ao processar pagamento – veja o console');
    }
  });
  
  // Confirmação de exclusão
  document.getElementById('confirmDelete').addEventListener('click', async () => {
    if (!currentDespesaId) return;
    
    try {
      const resp = await fetch(`${API}/api/despesas/${currentDespesaId}`, {
        method: 'DELETE'
      });
      
      if (!resp.ok) throw new Error(`Erro ${resp.status}`);
      
      document.getElementById('deleteModal').classList.remove('active');
      currentDespesaId = null;
      
      // Atualizar tabela
      render();
      
    } catch (err) {
      console.error(err);
      alert('Falha ao excluir despesa – veja o console');
    }
  });
}

function render() {
  tblBody.innerHTML = '<tr><td colspan="9">Carregando…</td></tr>';

  const qs  = buildQuery();
  const url = `${API}/api/despesas${qs ? '?' + qs : ''}`;

  fetch(url)
    .then(r => r.json())
    .then(list => {
      tblBody.innerHTML = '';
      console.log(list)
      list.sort((a,b)=> new Date(a.data) - new Date(b.data));   // asc

      for (const d of list) {
        const tr = document.createElement('tr');
        tr.className = d.pago ? 'pago' : 'nao-pago';
        tr.setAttribute('data-id', d.id);

        const dataFmt  = new Date(d.data + 'T00:00').toLocaleDateString('pt-BR');
        const valorFmt = Number(d.valor)
                         .toLocaleString('pt-BR',{minimumFractionDigits:2});

        tr.innerHTML = `
          <td>${dataFmt}</td>
          <td>${d.fornecedor}</td>
          <td>${d.tipo}</td>
          <td>${d.unidade}</td>
          <td class="valor">R$ ${valorFmt}</td>
          <td>${d.banco || '-'}</td>
          <td>${d.metodo || '-'}</td>
          <td><input type="checkbox" ${d.pago ? 'checked' : ''}></td>
          <td>
            <button class="btn-delete" title="Excluir">
              <i class="fas fa-trash-alt"></i>
            </button>
          </td>`;

        /* alterna pago / não pago com modal */
        tr.querySelector('input').addEventListener('change', e => {
          if (e.target.checked) {
            // Se estiver marcando como pago, mostra modal de seleção de banco
            currentDespesaId = d.id;
            document.getElementById('bankModal').classList.add('active');
          } else {
            // Se estiver desmarcando, apenas atualiza o status
            fetch(
              `${API}/api/despesas/${d.id}/pago?valor=false`,
              { 
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
              }
            )
            .then(response => {
              if (!response.ok) {
                throw new Error(`Erro ${response.status}`);
              }
              return response.json();
            })
            .then(() => render())
            .catch(error => {
              console.error('Erro ao desmarcar como pago:', error);
              alert('Falha ao desmarcar pagamento - veja o console');
              render(); // Re-renderiza para restaurar o estado anterior
            });
          }
        });
        
        // Evento para o botão de exclusão
        tr.querySelector('.btn-delete').addEventListener('click', () => {
          currentDespesaId = d.id;
          document.getElementById('deleteModal').classList.add('active');
        });

        tblBody.appendChild(tr);
      }

      if (!list.length)
        tblBody.innerHTML = '<tr><td colspan="9">Nenhuma despesa encontrada</td></tr>';
    })
    .catch(err => {
      console.error(err);
      tblBody.innerHTML = '<tr><td colspan="9">Erro ao carregar dados</td></tr>';
    });
}

module.exports.init = init;