/**
 * Utilitários compartilhados entre módulos
 */

const { API_URL } = require('./env-config');

// Helper function para chamadas de API com retry
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  try {
    const response = await fetch(url, options);
    if (!response.ok && maxRetries > 0) {
      console.log(`Retrying fetch to ${url}. Attempts left: ${maxRetries}`);
      return fetchWithRetry(url, options, maxRetries - 1);
    }
    return response;
  } catch (error) {
    if (maxRetries > 0) {
      console.log(`Retrying fetch to ${url}. Attempts left: ${maxRetries}`);
      return fetchWithRetry(url, options, maxRetries - 1);
    }
    throw error;
  }
}

// Funções para conversão de datas e strings
function slug(text) {
  if (!text) return '';
  return text.toString().toLowerCase()
    .normalize('NFD') // decompõe acentos
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^\w\s-]/g, '') // remove caracteres especiais
    .trim();
}

// Converte representações monetárias para número
function parseMoney(value) {
  if (!value) return 0;
  return parseFloat(
    String(value)
      .replace(/[^\d,.-]/g, '')
      .replace(',', '.')
  );
}

// Modal globals
let alertModal, confirmModal;
let confirmCallback = null;

/**
 * Initialize modal dialogs
 * This should be called once when the application starts
 */
function initModals() {
  // Create modals if they don't exist
  if (!document.getElementById('utilsAlertModal')) {
    createModalElements();
  }
  
  alertModal = document.getElementById('utilsAlertModal');
  confirmModal = document.getElementById('utilsConfirmModal');
  
  // Add event listeners
  setupModalEvents();
}

/**
 * Create the modal HTML elements and append to body
 */
function createModalElements() {
  // Create alert modal
  const alertModalHTML = `
  <div id="utilsAlertModal" class="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h3 id="utilsAlertTitle">Aviso</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <p id="utilsAlertMessage"></p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" id="utilsAlertOk">OK</button>
      </div>
    </div>
  </div>`;
  
  // Create confirm modal
  const confirmModalHTML = `
  <div id="utilsConfirmModal" class="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h3 id="utilsConfirmTitle">Confirmação</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <p id="utilsConfirmMessage"></p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-cancel" id="utilsConfirmCancel">Cancelar</button>
        <button class="btn btn-primary" id="utilsConfirmOk">Confirmar</button>
      </div>
    </div>
  </div>`;
  
  // Append to document body
  const modalContainer = document.createElement('div');
  modalContainer.id = 'utils-modal-container';
  modalContainer.innerHTML = alertModalHTML + confirmModalHTML;
  document.body.appendChild(modalContainer);
}

/**
 * Setup event listeners for modals
 */
function setupModalEvents() {
  if (!alertModal || !confirmModal) return;
  
  // Close buttons
  document.querySelectorAll('#utilsAlertModal .modal-close, #utilsAlertModal #utilsAlertOk').forEach(btn => {
    btn.addEventListener('click', () => closeModal(alertModal));
  });
  
  // Confirm modal buttons
  document.querySelector('#utilsConfirmModal .modal-close').addEventListener('click', () => {
    closeModal(confirmModal);
    if (confirmCallback) {
      confirmCallback(false);
      confirmCallback = null;
    }
  });
  
  document.querySelector('#utilsConfirmModal #utilsConfirmCancel').addEventListener('click', () => {
    closeModal(confirmModal);
    if (confirmCallback) {
      confirmCallback(false);
      confirmCallback = null;
    }
  });
  
  document.querySelector('#utilsConfirmModal #utilsConfirmOk').addEventListener('click', () => {
    closeModal(confirmModal);
    if (confirmCallback) {
      confirmCallback(true);
      confirmCallback = null;
    }
  });
  
  // Click outside to close
  alertModal.addEventListener('click', (e) => {
    if (e.target === alertModal) closeModal(alertModal);
  });
  
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      closeModal(confirmModal);
      if (confirmCallback) {
        confirmCallback(false);
        confirmCallback = null;
      }
    }
  });
  
  // Keyboard events
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isModalActive(alertModal)) {
        closeModal(alertModal);
      }
      if (isModalActive(confirmModal)) {
        closeModal(confirmModal);
        if (confirmCallback) {
          confirmCallback(false);
          confirmCallback = null;
        }
      }
    }
    
    if (e.key === 'Enter') {
      if (isModalActive(alertModal)) {
        e.preventDefault();
        closeModal(alertModal);
      } else if (isModalActive(confirmModal)) {
        e.preventDefault();
        closeModal(confirmModal);
        if (confirmCallback) {
          confirmCallback(true);
          confirmCallback = null;
        }
      }
    }
  });
}

/**
 * Show an alert dialog
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 */
function showAlert(title, message) {
  if (!alertModal) initModals();
  
  const titleEl = document.getElementById('utilsAlertTitle');
  const messageEl = document.getElementById('utilsAlertMessage');
  
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  
  alertModal.classList.add('active');
  
  // Focus the OK button
  const okButton = document.getElementById('utilsAlertOk');
  if (okButton) setTimeout(() => okButton.focus(), 50);
}

/**
 * Show a confirmation dialog
 * @param {string} title - Confirmation title
 * @param {string} message - Confirmation message
 * @param {function} callback - Callback function(confirmed)
 */
function showConfirm(title, message, callback) {
  if (!confirmModal) initModals();
  
  const titleEl = document.getElementById('utilsConfirmTitle');
  const messageEl = document.getElementById('utilsConfirmMessage');
  
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  
  // Store the callback for later use
  confirmCallback = (confirmed) => {
    if (confirmed) {
      callback();
    }
  };
  
  confirmModal.classList.add('active');
  
  // Focus the confirm button
  const okButton = document.getElementById('utilsConfirmOk');
  if (okButton) setTimeout(() => okButton.focus(), 50);
}

/**
 * Close a specific modal
 * @param {HTMLElement} modal - The modal to close
 */
function closeModal(modal) {
  if (modal) modal.classList.remove('active');
}

/**
 * Check if a modal is active
 * @param {HTMLElement} modal - The modal to check
 * @returns {boolean} - True if active
 */
function isModalActive(modal) {
  return modal && modal.classList.contains('active');
}

// Export all utility functions
module.exports = {
  fetchWithRetry,
  slug,
  parseMoney,
  showAlert,
  showConfirm,
  initModals
}; 