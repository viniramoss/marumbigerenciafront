/* despesas.js – cadastro de boletos / variáveis (SQLite via Spring) */

const { API_URL } = require('./env-config');
const utils = require('./utils');
const API = `${API_URL}/api/despesas`;
let ready = false;

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

  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();

      /* preserva opções selecionadas antes de resetar o form */
      const unidadeSel = form.unidade.value;
      const tipoSel    = form.tipo.value;

      /* monta objeto da despesa */
      const d = Object.fromEntries(new FormData(form).entries());
      d.valor = parseFloat(d.valor || 0);
      d.pago  = false;

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