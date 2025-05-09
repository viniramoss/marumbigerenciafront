/* despesas.js – cadastro de boletos / variáveis (SQLite via Spring) */

const { API_URL } = require('./env-config');
const API = `${API_URL}/api/despesas`;
let ready = false;

function init() {
  if (ready) return;            // garante 1ª execução
  ready = true;

  const form  = document.getElementById('formDesp');
  const tbody = document.querySelector('#previewDesp tbody');
  const deleteModal = document.getElementById('deleteModal');
  let deleteId = null;

  prefillHoje();

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
      form.fornecedor.focus();

    } catch (err) {
      console.error(err);
      alert('Falha ao salvar despesa – veja o console.');
    }
  });

  // Implementação do modal de delete
  document.querySelectorAll('.modal-close, .btn-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteModal.classList.remove('active');
    });
  });

  document.getElementById('confirmDelete').addEventListener('click', async () => {
    if (!deleteId) return;
    
    try {
      const resp = await fetch(`${API}/${deleteId}`, {
        method: 'DELETE'
      });
      
      if (!resp.ok) throw new Error(`Erro ${resp.status}`);
      
      // Remove a linha da tabela após exclusão bem-sucedida
      const row = document.querySelector(`tr[data-id="${deleteId}"]`);
      if (row) row.remove();
      
      deleteModal.classList.remove('active');
      deleteId = null;
    } catch (err) {
      console.error(err);
      alert('Falha ao excluir despesa – veja o console.');
    }
  });

  /* ---------- helpers ---------- */

  function prefillHoje() {
    form.data.value = new Date().toISOString().slice(0, 10);
  }

  function money(v) {
    return 'R$ ' + Number(v)
      .toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }

  function addRow(o) {
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
      deleteModal.classList.add('active');
    });
    
    tbody.prepend(tr);
  }
}

module.exports.init = init;