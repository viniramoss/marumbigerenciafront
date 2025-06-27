/* despesas.js – cadastro de boletos / variáveis (SQLite via Spring) */

const { API_URL } = require('./env-config');
const utils = require('./utils');
const API = `${API_URL}/api/despesas`;
let ready = false;

// Sistema de autocomplete para fornecedores
let fornecedoresCache = [];
let autocompleteInitialized = false;

// Cache de fornecedores únicos
async function loadFornecedores() {
  if (fornecedoresCache.length > 0) return fornecedoresCache;
  
  try {
    const response = await utils.fetchWithRetry(API);
    const despesas = await response.json();
    
    // Extrair fornecedores únicos e ordenar
    const fornecedoresUnicos = [...new Set(despesas.map(d => d.fornecedor))]
      .filter(f => f && f.trim()) // Remove valores vazios/nulos
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    fornecedoresCache = fornecedoresUnicos;
    return fornecedoresUnicos;
  } catch (error) {
    console.error('Erro ao carregar fornecedores:', error);
    return [];
  }
}

// Função para filtrar fornecedores baseado no texto digitado
function filterFornecedores(query) {
  if (!query || query.length < 1) return [];
  
  const lowerQuery = query.toLowerCase();
  return fornecedoresCache
    .filter(fornecedor => 
      fornecedor.toLowerCase().includes(lowerQuery) ||
      fornecedor.toLowerCase().startsWith(lowerQuery)
    )
    .slice(0, 8); // Limita a 8 sugestões para performance
}

// Inicializar sistema de autocomplete
function initAutocomplete(form) {
  if (autocompleteInitialized || !form) return;
  autocompleteInitialized = true;
  
  const fornecedorInput = form.querySelector('input[name="fornecedor"]');
  if (!fornecedorInput) return;
  
  // Carregar fornecedores em background
  loadFornecedores();
  
  // Criar container do autocomplete
  const container = document.createElement('div');
  container.className = 'autocomplete-container';
  container.style.position = 'relative';
  
  // Wrapper do input
  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'autocomplete-wrapper';
  inputWrapper.style.position = 'relative';
  
  // Lista de sugestões
  const suggestionsList = document.createElement('div');
  suggestionsList.className = 'autocomplete-suggestions';
  suggestionsList.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-top: none;
    border-radius: 0 0 8px 8px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    display: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  
  // Reorganizar DOM
  const parent = fornecedorInput.parentNode;
  parent.insertBefore(container, fornecedorInput);
  container.appendChild(inputWrapper);
  inputWrapper.appendChild(fornecedorInput);
  inputWrapper.appendChild(suggestionsList);
  
  let selectedIndex = -1;
  let currentSuggestions = [];
  
  // Função para mostrar sugestões
  function showSuggestions(suggestions) {
    currentSuggestions = suggestions;
    selectedIndex = -1;
    
    if (suggestions.length === 0) {
      suggestionsList.style.display = 'none';
      return;
    }
    
    suggestionsList.innerHTML = suggestions
      .map((fornecedor, index) => `
        <div class="autocomplete-item" data-index="${index}" style="
          padding: 12px 16px;
          cursor: pointer;
          border-bottom: 1px solid var(--border-light);
          transition: background-color 0.2s;
        ">
          ${highlightMatch(fornecedor, fornecedorInput.value)}
        </div>
      `)
      .join('');
    
    suggestionsList.style.display = 'block';
    
    // Adicionar eventos de clique
    suggestionsList.querySelectorAll('.autocomplete-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        selectSuggestion(suggestions[index]);
      });
      
      item.addEventListener('mouseenter', () => {
        clearSelection();
        selectedIndex = index;
        updateSelection();
      });
      
      item.addEventListener('mouseleave', () => {
        // Não limpar seleção ao sair com mouse, manter navegação por teclado
      });
    });
  }
  
  // Função para destacar o texto correspondente
  function highlightMatch(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
  }
  
  // Escape para regex
  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  // Função para selecionar uma sugestão
  function selectSuggestion(fornecedor) {
    fornecedorInput.value = fornecedor;
    suggestionsList.style.display = 'none';
    
    // Focar no próximo campo (tipo)
    const tipoSelect = form.querySelector('select[name="tipo"]');
    if (tipoSelect) {
      setTimeout(() => tipoSelect.focus(), 10);
    }
  }
  
  // Função para limpar seleção visual
  function clearSelection() {
    suggestionsList.querySelectorAll('.autocomplete-item').forEach(item => {
      item.classList.remove('selected');
    });
  }
  
  // Função para atualizar seleção visual
  function updateSelection() {
    clearSelection();
    if (selectedIndex >= 0 && selectedIndex < currentSuggestions.length) {
      const selectedItem = suggestionsList.children[selectedIndex];
      if (selectedItem) {
        selectedItem.classList.add('selected');
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }
  
  // Event listeners do input
  let debounceTimer;
  
  fornecedorInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const query = e.target.value.trim();
      
      if (query.length < 1) {
        suggestionsList.style.display = 'none';
        return;
      }
      
      // Garantir que os fornecedores estão carregados
      await loadFornecedores();
      
      const suggestions = filterFornecedores(query);
      showSuggestions(suggestions);
    }, 150); // Debounce de 150ms
  });
  
  fornecedorInput.addEventListener('keydown', (e) => {
    if (suggestionsList.style.display === 'none') return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
        updateSelection();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateSelection();
        break;
        
      case 'Tab':
      case 'Enter':
        if (selectedIndex >= 0 && currentSuggestions[selectedIndex]) {
          e.preventDefault();
          selectSuggestion(currentSuggestions[selectedIndex]);
        }
        break;
        
      case 'Escape':
        suggestionsList.style.display = 'none';
        selectedIndex = -1;
        break;
    }
  });
  
  // Fechar sugestões ao clicar fora
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      suggestionsList.style.display = 'none';
    }
  });
  
  // Fechar sugestões ao dar blur no input
  fornecedorInput.addEventListener('blur', (e) => {
    // Pequeno delay para permitir clique nas sugestões
    setTimeout(() => {
      if (!container.contains(document.activeElement)) {
        suggestionsList.style.display = 'none';
      }
    }, 150);
  });
}

function init() {
  if (ready) return;            // garante 1ª execução
  ready = true;

  let form = document.getElementById('formDesp');
  const tbody = document.querySelector('#previewDesp tbody');
  let deleteId = null;

  // Limpa event listeners antigos
  if (form) {
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    form = newForm;
  }

  prefillHoje();
  
  // Inicializar autocomplete para fornecedores
  initAutocomplete(form);

  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();

      /* preserva opções selecionadas antes de resetar o form */
      const unidadeSel = form.unidade.value;
      const tipoSel    = form.tipo.value;

      /* monta objeto da despesa */
      const d = Object.fromEntries(new FormData(form).entries());
      d.valor = parseFloat(d.valor || 0);
      
      // Se for despesa variável, automaticamente marcar como paga em dinheiro
      if (d.tipo === 'variavel') {
        d.pago = true;
        d.banco = 'N/A';
        d.metodo = 'dinheiro';
      } else {
        d.pago = false;
      }

      /* envia ao back-end */
      try {
        const resp = await fetch(API, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify(d)
        });
        if (!resp.ok) throw new Error(`Erro ${resp.status}`);

        const saved = await resp.json();
        addRow(saved);            // insere na tabela preview
        
        // Atualizar cache de fornecedores se for um fornecedor novo
        if (saved.fornecedor && !fornecedoresCache.includes(saved.fornecedor)) {
          fornecedoresCache.push(saved.fornecedor);
          fornecedoresCache.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        }

        form.reset();             // limpa campos
        prefillHoje();            // nova data = hoje
        form.unidade.value = unidadeSel;
        form.tipo.value    = tipoSel;
        
        // Foca no campo de data em vez do fornecedor
        if (form.data) {
          focusAndSelectDateField(form.data);
        }

      } catch (err) {
        console.error(err);
        utils.showAlert('Erro', 'Falha ao salvar despesa – veja o console.');
      }
    });
  }

  /* ---------- helpers ---------- */

  function prefillHoje() {
    if (form && form.data) {
      form.data.value = new Date().toISOString().slice(0, 10);
    }
  }
  
  // Função para focar e selecionar o campo de data
  function focusAndSelectDateField(dateField) {
    setTimeout(() => {
      dateField.focus();
      // Se for um campo de texto, selecionamos todo o conteúdo
      if (dateField.type === 'text') {
        dateField.select();
      } 
      // Se for um campo de data do tipo 'date', tentamos selecionar o conteúdo
      else if (dateField.type === 'date') {
        dateField.click(); // Abre o seletor de data em alguns navegadores
      }
    }, 10);
  }

  function money(v) {
    return 'R$ ' + Number(v)
      .toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }

  function addRow(o) {
    if (!tbody) return;
    
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', o.id); // Para facilitar remoção após exclusão
    
    tr.innerHTML = `
      <td>${o.data}</td>
      <td>${o.fornecedor}</td>
      <td>${o.tipo}</td>
      <td>${o.unidade}</td>
      <td>${money(o.valor)}</td>
      <td>
        <button class="btn-delete" title="Excluir">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>`;
    
    // Adiciona evento de exclusão ao botão
    tr.querySelector('.btn-delete').addEventListener('click', () => {
      deleteId = o.id;
      utils.showConfirm('Confirmar exclusão', 'Tem certeza que deseja excluir esta despesa?', async () => {
        try {
          const resp = await fetch(`${API}/${deleteId}`, {
            method: 'DELETE'
          });
          
          if (!resp.ok) throw new Error(`Erro ${resp.status}`);
          
          // Remove a linha da tabela após exclusão bem-sucedida
          tr.remove();
          deleteId = null;
        } catch (err) {
          console.error(err);
          utils.showAlert('Erro', 'Falha ao excluir despesa – veja o console.');
        }
      });
    });
    
    tbody.prepend(tr);
  }
}

module.exports.init = init;