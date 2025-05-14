/* config.js — agora com tema funcionando corretamente e sem flash */

// Script para aplicar tema imediatamente, mesmo antes da renderização do DOM
(function() {
  // Tenta executar o mais cedo possível
  const saved = localStorage.getItem('theme');
  const dark = saved ? saved === 'dark' : true; // default = escuro
  if (dark) {
    document.documentElement.classList.add('preload-dark');
    document.body.classList.add('dark');
  }
})();

function applyTheme(dark) {
  // Verificações de segurança para evitar erros DOM
  if (!document || !document.documentElement || !document.body) {
    console.warn('Documento não está pronto para aplicar tema');
    return;
  }

  try {
    // Aplica classe dark no BODY e no HTML
    document.documentElement.classList.toggle('preload-dark', dark);
    document.body.classList.toggle('dark', dark);

    // Define a meta tag theme-color para ajustar a cor da UI do sistema
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = dark ? '#181a1b' : '#f5f7fa';

    // Atualiza legenda, se existir na página
    const lbl = document.getElementById('themeLabel');
    if (lbl) lbl.textContent = dark ? 'Tema Escuro' : 'Tema Claro';
    
    // Força repintar a tela para evitar problemas de renderização
    document.body.style.opacity = '0.99';
    setTimeout(() => {
      document.body.style.opacity = '1';
    }, 10);
  } catch (e) {
    console.error('Erro ao aplicar tema:', e);
  }
}

function initTheme() {
  /* 1) busca valor salvo; 2) se não existir, assume escuro */
  const saved = localStorage.getItem('theme');          // "dark" | "light" | null
  const dark  = saved ? saved === 'dark' : true;        // default = escuro
  applyTheme(dark);

  /* liga o toggle se a página for settings.html */
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.checked = dark;
    toggle.onchange = () => {
      localStorage.setItem('theme', toggle.checked ? 'dark' : 'light');
      applyTheme(toggle.checked);
    };
  }
}

// Função para inicializar configurações da data (mês e ano)
function initDateConfig() {
  // Verifica se está na página de configurações
  const monthSelect = document.getElementById('monthSelect');
  const yearInput = document.getElementById('yearInput');
  
  if (!monthSelect || !yearInput) return; // Não estamos na página de configurações
  
  try {
    // Importa o módulo cadastro.js
    const cadastroModule = require('./cadastro.js');
    console.log('Módulo cadastro carregado:', Object.keys(cadastroModule));
    
    // Carrega valores atuais
    const currentMonth = cadastroModule.getCurrentMonth();
    let currentYear = cadastroModule.getCurrentYear();
    
    // Se o ano não estiver definido ou for inválido, usa 2025 como padrão no campo
    if (!currentYear || isNaN(currentYear)) {
      currentYear = 2025;
      yearInput.value = currentYear;
    } else {
      yearInput.value = currentYear;
    }
    
    console.log(`Valores atuais carregados: Mês=${currentMonth}, Ano=${currentYear}`);
    
    // Preenche o campo de mês com o valor atual
    monthSelect.value = currentMonth;
    
    // Adiciona event listeners para atualizações
    monthSelect.addEventListener('change', function() {
      const month = parseInt(this.value, 10);
      cadastroModule.setCurrentMonth(month);
      saveCurrentDateSettings(month, parseInt(yearInput.value, 10));
      
      console.log(`Mês alterado para ${month}, chamando updateDateDisplay`);
      // Chama a função de atualização diretamente
      cadastroModule.updateDateDisplay();
      
      showFeedback(`Mês alterado para ${month}`);
    });
    
    yearInput.addEventListener('change', function() {
      const year = parseInt(this.value, 10);
      cadastroModule.setCurrentYear(year);
      saveCurrentDateSettings(parseInt(monthSelect.value, 10), year);
      
      console.log(`Ano alterado para ${year}, chamando updateDateDisplay`);
      // Chama a função de atualização diretamente
      cadastroModule.updateDateDisplay();
      
      showFeedback(`Ano alterado para ${year}`);
    });
    
    // Adiciona botão para resetar para a data atual
    const resetButton = document.getElementById('resetDateButton');
    if (resetButton) {
      resetButton.addEventListener('click', function() {
        const now = new Date();
        const thisMonth = now.getMonth() + 1;
        const thisYear = now.getFullYear();
        
        monthSelect.value = thisMonth;
        yearInput.value = thisYear;
        
        cadastroModule.setCurrentMonth(thisMonth);
        cadastroModule.setCurrentYear(thisYear);
        
        saveCurrentDateSettings(thisMonth, thisYear);
        
        showFeedback('Data resetada para o mês e ano atual.');
      });
    }
  } catch (e) {
    console.error('Erro ao inicializar configurações de data:', e);
    showFeedback('Erro ao carregar configurações. Veja o console para detalhes.');
  }
}

// Função para mostrar feedback ao usuário na interface
function showFeedback(message) {
  // Função para dar feedback visual sobre alterações
  const feedbackEl = document.getElementById('dateFeedback');
  
  if (!feedbackEl) {
    // Cria o elemento de feedback se não existir
    const feedbackDiv = document.createElement('div');
    feedbackDiv.id = 'dateFeedback';
    feedbackDiv.className = 'feedback-message';
    feedbackDiv.textContent = message;
    
    // Adiciona ao DOM (assumindo que existe um elemento .config-section)
    const container = document.querySelector('.config-section:nth-child(2)');
    if (container) {
      container.appendChild(feedbackDiv);
    } else {
      document.body.appendChild(feedbackDiv);
    }
    
    // Oculta após alguns segundos
    setTimeout(() => {
      if (feedbackDiv.parentNode) {
        feedbackDiv.parentNode.removeChild(feedbackDiv);
      }
    }, 3000);
  } else {
    // Se o elemento já existe, apenas atualiza a mensagem
    feedbackEl.textContent = message;
    
    // Reinicia a animação
    feedbackEl.style.animation = 'none';
    setTimeout(() => {
      feedbackEl.style.animation = '';
    }, 10);
    
    // Oculta após alguns segundos
    clearTimeout(feedbackEl.timeout);
    feedbackEl.timeout = setTimeout(() => {
      if (feedbackEl.parentNode) {
        feedbackEl.parentNode.removeChild(feedbackEl);
      }
    }, 3000);
  }
}

// Função para salvar configurações de data no localStorage
function saveCurrentDateSettings(month, year) {
  localStorage.setItem('currentMonth', month);
  localStorage.setItem('currentYear', year);
}

// Função para carregar configurações de data do localStorage
function loadDateSettings() {
  try {
    // Importa o módulo cadastro.js
    const cadastroModule = require('./cadastro.js');
    
    // Verifica se há valores salvos no localStorage
    const savedMonth = localStorage.getItem('currentMonth');
    const savedYear = localStorage.getItem('currentYear');
    
    // Se não houver valores salvos, define a data atual
    const today = new Date();
    
    // Define os valores no módulo cadastro.js
    if (savedMonth) {
      const month = parseInt(savedMonth, 10);
      console.log(`Definindo mês salvo: ${month}`);
      cadastroModule.setCurrentMonth(month);
    } else {
      const currentMonth = today.getMonth() + 1;
      console.log(`Definindo mês atual: ${currentMonth}`);
      cadastroModule.setCurrentMonth(currentMonth);
      localStorage.setItem('currentMonth', currentMonth);
    }
    
    if (savedYear) {
      const year = parseInt(savedYear, 10);
      console.log(`Definindo ano salvo: ${year}`);
      cadastroModule.setCurrentYear(year);
    } else {
      const currentYear = today.getFullYear();
      console.log(`Definindo ano atual: ${currentYear}`);
      cadastroModule.setCurrentYear(currentYear);
      localStorage.setItem('currentYear', currentYear);
    }
    
    // Atualiza a exibição da data
    cadastroModule.updateDateDisplay();
    
    return {
      month: savedMonth ? parseInt(savedMonth, 10) : today.getMonth() + 1,
      year: savedYear ? parseInt(savedYear, 10) : today.getFullYear()
    };
  } catch (e) {
    console.error('Erro ao carregar configurações de data:', e);
    
    // Fallback para a data atual
    const today = new Date();
    return {
      month: today.getMonth() + 1,
      year: today.getFullYear()
    };
  }
}

function init() {
  // Inicializa tema
  initTheme();
  
  // Inicializa configurações de data (mês/ano)
  initDateConfig();
  
  // Carrega configurações de data do localStorage
  loadDateSettings();
}

// Exporta todas as funções necessárias
module.exports = { 
  init,
  initTheme,
  applyTheme,
  loadDateSettings,
  initDateConfig,
  showFeedback
};