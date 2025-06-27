/* cadastro.js – formulário de lançamento com integração API */

const { API_URL } = require('./env-config');
const utils = require('./utils');
let initialized = false;
let buffer = [];
// Variáveis para armazenar mês e ano atual
let currentMonth;
let currentYear;
// Callbacks para funções específicas do cadastro
let deleteCallback = null;
// Último valor de unidade selecionado
let lastSelectedUnit = localStorage.getItem('lastSelectedUnit') || 'UN1';

// Função global para atualizar a visualização da data
function updateDateDisplay() {
  const dateDisplayEl = document.getElementById('currentDateDisplay');
  if (!dateDisplayEl) return;
  
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  const monthName = months[currentMonth - 1] || 'Mês Desconhecido';
  dateDisplayEl.textContent = `${monthName} ${currentYear}`;
}

function init() {
  if (initialized) return;
  initialized = true;
  
  // Garantir que os modais do utils estejam disponíveis
  utils.initModals();

  const form = document.getElementById('entryForm');
  const tbody = document.querySelector('#preview tbody');

  // Inicializa as variáveis de mês e ano atual com os valores salvos ou valores atuais
  loadSavedDateSettings();
  
  // Substitui o campo date padrão por um campo personalizado
  customizeDateField();

  // Define a última unidade selecionada se existir
  if (lastSelectedUnit && form.unidade) {
    form.unidade.value = lastSelectedUnit;
  }
  
  carregarUltimosLancamentos();

  // Adiciona comportamento para a tecla Enter ir para o próximo campo em vez de submeter o form
  configurarNavegacaoPorTeclado(form);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    
    // Prepara o objeto para enviar à API
    const formData = new FormData(form);
    const entrada = {
      data: formData.get('data'),
      operador: formData.get('operador'),
      unidade: formData.get('unidade'),
      dinheiro: parseFloat(formData.get('din') || 0),
      debito: parseFloat(formData.get('deb') || 0),
      credito: parseFloat(formData.get('cre') || 0),
      pix: parseFloat(formData.get('pix') || 0),
      voucher: parseFloat(formData.get('vou') || 0)
    };
    
    // Salva a última unidade selecionada
    localStorage.setItem('lastSelectedUnit', entrada.unidade);
    lastSelectedUnit = entrada.unidade;
    
    try {
      // Envia para a API
      const response = await fetch(`${API_URL}/api/entradas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entrada)
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao salvar entrada: ${response.status}`);
      }
      
      const savedEntry = await response.json();
      
      // Atualiza o buffer local e a tabela
      buffer.push(savedEntry);
      appendRow(savedEntry);
      
      // Limpa o formulário e mantém o foco
      form.reset();
      
      // Restaura a unidade previamente selecionada
      if (form.unidade) {
        form.unidade.value = lastSelectedUnit;
      }
      
      // Atualiza o campo de data para o dia atual
      setHoje();
      
      // Foca o campo de dia
      setTimeout(() => {
        const dayInput = form.querySelector('.day-input');
        if (dayInput) {
          dayInput.focus();
          dayInput.select(); // Seleciona o conteúdo para fácil alteração
        }
      }, 50);
      
          } catch (error) {
        console.error('Erro ao salvar entrada:', error);
        utils.showAlert('Erro', 'Falha ao salvar entrada - veja o console para mais detalhes.');
      }
  });

  // Função para carregar configurações de data salvas
  function loadSavedDateSettings() {
    try {
      const savedMonth = localStorage.getItem('currentMonth');
      const savedYear = localStorage.getItem('currentYear');
      
      const today = new Date();
      
      // Se existirem valores salvos, use-os; caso contrário, use a data atual
      currentMonth = savedMonth ? parseInt(savedMonth, 10) : today.getMonth() + 1;
      currentYear = savedYear ? parseInt(savedYear, 10) : today.getFullYear();
      
      // Salva os valores atuais no localStorage caso não existam
      if (!savedMonth) {
        localStorage.setItem('currentMonth', currentMonth);
      }
      if (!savedYear) {
        localStorage.setItem('currentYear', currentYear);
      }
      
      // Atualiza a visualização da data
      updateDateDisplay();
    } catch (e) {
      console.error('Erro ao carregar configurações de data:', e);
      // Fallback para a data atual em caso de erro
      const today = new Date();
      currentMonth = today.getMonth() + 1;
      currentYear = today.getFullYear();
      
      // Salva os valores fallback no localStorage
      localStorage.setItem('currentMonth', currentMonth);
      localStorage.setItem('currentYear', currentYear);
    }
  }

  // Função para configurar navegação por teclado entre campos
  function configurarNavegacaoPorTeclado(form) {
    // Seleciona todos os campos interativos, incluindo input, select e botões, excluindo campos ocultos
    const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]), select, button[type="submit"]'));
    
    if (inputs.length === 0) return;
    
    // Adiciona evento keydown para cada campo
    inputs.forEach((input, index) => {
      input.addEventListener('keydown', function(e) {
        // Se pressionar Enter e não for o botão submit
        if (e.key === 'Enter' && this.type !== 'submit') {
          // Impede a submissão do formulário
          e.preventDefault();
          
          // Se for o último campo de entrada, foca no botão de submit
          if (index === inputs.length - 2) { // -2 porque o último será o botão submit
            const submitButton = inputs[inputs.length - 1];
            if (submitButton && submitButton.type === 'submit') {
              submitButton.focus();
            }
          } else if (index < inputs.length - 1) {
            // Foca no próximo campo
            inputs[index + 1].focus();
            
            // Se for um campo de texto, número ou dia, seleciona o conteúdo
            if (inputs[index + 1].type === 'text' || 
                inputs[index + 1].type === 'number' ||
                inputs[index + 1].classList.contains('day-input')) {
              inputs[index + 1].select();
            }
          }
        }
      });
    });
    
    // O botão submit deve submeter o formulário ao pressionar Enter
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          form.requestSubmit(); // Submete o formulário programaticamente
        }
      });
    }
  }

  // Função para personalizar o campo de data
  function customizeDateField() {
    const dataInputContainer = form.querySelector('label:first-child');
    if (!dataInputContainer) return;
    
    // Obtém o input date original
    const originalDateInput = dataInputContainer.querySelector('input[type="date"]');
    if (!originalDateInput) return;
    
    // Cria um novo container para os elementos
    const newContainer = document.createElement('div');
    newContainer.className = 'custom-date-container';
    
    // Cria um div para mostrar o mês e ano fixos
    const fixedPart = document.createElement('div');
    fixedPart.className = 'date-fixed-part';
    fixedPart.textContent = `${getMesNome(currentMonth)}/${currentYear}`;
    
    // Cria um input para o dia
    const dayInput = document.createElement('input');
    dayInput.type = 'number';
    dayInput.min = 1;
    dayInput.max = 31;
    dayInput.className = 'day-input';
    dayInput.placeholder = 'DD';
    dayInput.value = new Date().getDate();
    dayInput.required = true;
    
    // Campo oculto para manter o valor formatado completo (para envio ao servidor)
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = 'data';
    
    // Adiciona os elementos ao container
    newContainer.appendChild(fixedPart);
    newContainer.appendChild(dayInput);
    
    // Substitui o input original pelo container personalizado
    originalDateInput.parentNode.replaceChild(newContainer, originalDateInput);
    dataInputContainer.appendChild(hiddenInput);
    
    // Evento para atualizar o valor oculto quando o dia for alterado
    dayInput.addEventListener('input', function() {
      // Limita o valor entre 1 e 31
      let day = parseInt(this.value);
      if (isNaN(day) || day < 1) day = 1;
      if (day > 31) day = 31;
      this.value = day;
      
      // Ajusta pelo último dia do mês atual
      const ultimoDia = new Date(currentYear, currentMonth, 0).getDate();
      if (day > ultimoDia) {
        day = ultimoDia;
        this.value = day;
      }
      
      // Atualiza o campo oculto com o valor formatado
      updateHiddenDateValue(day);
    });
    
    // Previne submissão do formulário ao pressionar Enter no campo de dia
    dayInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Move o foco para o próximo campo no formulário
        const allInputs = Array.from(form.querySelectorAll('input:not([type="hidden"]), select'));
        const currentIndex = allInputs.indexOf(this);
        if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
          allInputs[currentIndex + 1].focus();
          if (allInputs[currentIndex + 1].type === 'text' || 
              allInputs[currentIndex + 1].type === 'number') {
            allInputs[currentIndex + 1].select();
          }
        }
      }
    });
    
    // Atualiza inicialmente
    updateHiddenDateValue(dayInput.value);
    
    // Foca automaticamente no campo de dia ao iniciar
    setTimeout(() => {
      dayInput.focus();
      dayInput.select(); // Seleciona o valor para fácil edição
    }, 100);
    
    // Função de atualização do valor oculto
    function updateHiddenDateValue(day) {
      const paddedDay = day.toString().padStart(2, '0');
      const paddedMonth = currentMonth.toString().padStart(2, '0');
      hiddenInput.value = `${currentYear}-${paddedMonth}-${paddedDay}`;
    }
  }
  
  // Função para obter o nome do mês
  function getMesNome(mes) {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mes - 1]; // -1 porque os meses são indexados de 0 a 11, mas currentMonth é 1 a 12
  }
  
  // Função para definir a data de hoje no formulário
  function setHoje() {
    const today = new Date();
    const day = today.getDate();
    
    // Atualiza o campo de dia
    const dayInput = form.querySelector('.day-input');
    if (dayInput) {
      dayInput.value = day;
      // Dispara o evento input para atualizar o campo oculto
      const event = new Event('input');
      dayInput.dispatchEvent(event);
      
      // Foca e seleciona o campo dia após definir o valor
      setTimeout(() => {
        dayInput.focus();
        dayInput.select();
      }, 10);
    }
    
    // Atualiza a exibição do mês/ano
    updateDateDisplay();
  }

  // Função para formatar valores monetários
  function money(v) {
    return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }

  // Função para adicionar linha na tabela de preview
  function appendRow(o) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatarDataBR(o.data)}</td>
      <td>${o.operador}</td>
      <td>${o.unidade}</td>
      <td>${money(o.dinheiro)}</td>
      <td>${money(o.debito)}</td>
      <td>${money(o.credito)}</td>
      <td>${money(o.pix)}</td>
      <td>${money(o.voucher)}</td>
      <td>${money(o.total)}</td>
      <td>
        <button class="btn-delete" data-id="${o.id}" title="Excluir">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>`;
      
    // Adiciona event listener para o botão de exclusão
    tr.querySelector('.btn-delete').addEventListener('click', async function() {
      const id = this.getAttribute('data-id');
      
      // Usar modal de confirmação personalizado
      utils.showConfirm('Confirmar exclusão', 'Tem certeza que deseja excluir este lançamento?', async () => {
        try {
          const response = await fetch(`${API_URL}/api/entradas/${id}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            throw new Error(`Erro ao excluir: ${response.status}`);
          }
          
          // Remove do buffer e da tabela
          const index = buffer.findIndex(item => item.id == id);
          if (index !== -1) {
            buffer.splice(index, 1);
          }
          
          tr.remove();
          
                  } catch (error) {
            console.error('Erro ao excluir entrada:', error);
            utils.showAlert('Erro', 'Falha ao excluir entrada - veja o console para mais detalhes.');
          }
      });
    });
    
    tbody.prepend(tr);
  }
  
  // Função para converter data do formato ISO para BR
  function formatarDataBR(data) {
    if (!data) return '';
    // Se já estiver no formato DD/MM/AAAA, retorna como está
    if (data.includes('/')) return data;
    
    // Converte de AAAA-MM-DD para DD/MM/AAAA
    const partes = data.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return data;
  }
  
  // Função para carregar os últimos lançamentos da API
  async function carregarUltimosLancamentos() {
    try {
      const response = await fetch(`${API_URL}/api/entradas`);
      
      if (!response.ok) {
        throw new Error(`Erro ao carregar entradas: ${response.status}`);
      }
      
      const entradas = await response.json();
      
      // Limita aos últimos 10 lançamentos
      const ultimasEntradas = entradas
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .slice(0, 10);
      
      // Atualiza o buffer local
      buffer = ultimasEntradas;
      
      // Limpa a tabela e adiciona as entradas
      tbody.innerHTML = '';
      ultimasEntradas.forEach(entrada => appendRow(entrada));
      
    } catch (error) {
      console.error('Erro ao carregar entradas:', error);
      tbody.innerHTML = '<tr><td colspan="10">Erro ao carregar dados - veja o console</td></tr>';
    }
  }
  
  // Modais específicos do cadastro foram removidos - usando utils.js
}

// Exporta as funções necessárias
module.exports = {
  init,
  // Acessores para obter valores atuais
  getCurrentMonth: () => currentMonth,
  getCurrentYear: () => currentYear,
  // Métodos para definir novos valores
  setCurrentMonth: (month) => { 
    currentMonth = month; 
    
    // Salvar a configuração no localStorage
    localStorage.setItem('currentMonth', month);
    
    // Atualizar a visualização da data
    updateDateDisplay();
  },
  setCurrentYear: (year) => { 
    currentYear = year; 
    
    // Salvar a configuração no localStorage
    localStorage.setItem('currentYear', year);
    
    // Atualizar a visualização da data
    updateDateDisplay();
  },
  // Exporta a função de atualização para uso externo
  updateDateDisplay
};