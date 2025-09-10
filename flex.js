// =================== Config ===================
const BASE_FRETE = 8.00;                  // R$ por pedido
const PAGA_BASE_AO_COLETAR = true;        // paga base só quando COLETADO

// =================== Mock inicial (exemplo) ===================
let registros = [
  {
    id: 1,
    data: "2025-09-10",
    loja: "Shopee Adob",
    pedido: "122121",
    nota: "2000",
    valor_produto: 299.90,
    estorno_merc: 0,
    estorno_frete: 0,
    status_pedido: "A COLETAR",
    situacao: "EM ABERTO",
    obs: "-"
  }
];

let registrosFiltrados = [];
const selectedIds = new Set(); // seleção em massa

// =================== Helpers ===================
const $ = sel => document.getElementById(sel);

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("pt-BR");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function getTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getFirstDayOfMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function showToast(title, description) {
  const toast = $("toast");
  $("toastTitle").textContent = title;
  $("toastDescription").textContent = description;
  toast.style.display = "block";
  setTimeout(() => (toast.style.display = "none"), 3000);
}

function createStatusBadge(status, type) {
  const span = document.createElement("span");
  span.className = "badge";
  span.textContent = status;
  if (type === "pedido") {
    if (status === "COLETADO") span.classList.add("success");
    else if (status === "A COLETAR") span.classList.add("warning");
    else if (status === "CANCELADO") span.classList.add("destructive");
  } else {
    if (status === "PAGO") span.classList.add("success");
    else span.classList.add("warning");
  }
  return span;
}

function createEstornoIndicator(estorno) {
  const s = document.createElement("span");
  s.className = `estorno-indicator ${estorno ? "yes" : "no"}`;
  s.textContent = estorno ? "S" : "N";
  return s;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// =================== Cálculo ===================
// - COLETADO: 8 - estorno_frete - (estorno_merc? valor_produto : 0), mínimo 0.
// - CANCELADO: estorno_merc = 1 (não devolveu) => -(valor_produto + 8); estorno_merc = 0 => 0.
// - A COLETAR: 0 (só paga quando coletado).
function calcularValor(reg) {
  const status = reg.status_pedido;
  const produto = Number(reg.valor_produto || 0);
  const estFrete = Number(reg.estorno_frete || 0);
  const estMerc = Number(reg.estorno_merc || 0);

  if (status === "CANCELADO") {
    return estMerc ? Number((-(produto + BASE_FRETE)).toFixed(2)) : 0;
  }

  if (status === "COLETADO") {
    let v = BASE_FRETE - estFrete - (estMerc ? produto : 0);
    if (v < 0) v = 0;
    return Number(v.toFixed(2));
  }

  return 0; // A COLETAR
}

// =================== Persistência local (array) ===================
function nextId() {
  return (registros[0]?.id || 0) + 1;
}

function addRegistro(data) {
  const reg = { id: nextId(), ...data };
  reg.valor_a_pagar = calcularValor(reg);
  registros.unshift(reg);
  return reg;
}

function updateRegistro(id, patch) {
  const idx = registros.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  registros[idx] = { ...registros[idx], ...patch };
  registros[idx].valor_a_pagar = calcularValor(registros[idx]);
  return registros[idx];
}

// =================== Form ===================
const form = $("registroForm");
const limparBtn = $("limparBtn");
const atualizarBtn = $("atualizarBtn");
const exportarBtn = $("exportarBtn");

// Fechamento opcional
const cancelarNaoEntreguesBtn = $("cancelarNaoEntreguesBtn");
const diaFechamentoInput = $("diaFechamento");

// Ações em massa
const selectAll = $("selectAll");
const pagarSelecionadosBtn = $("pagarSelecionadosBtn");
const limparSelecaoBtn = $("limparSelecaoBtn");

function initializeForm() {
  $("data").value = getTodayISO();
  $("f_ini").value = getFirstDayOfMonth();
  $("f_fim").value = getTodayISO();
  $("f_loja").value = "todas";
  if (diaFechamentoInput && !diaFechamentoInput.value) {
    diaFechamentoInput.value = getTodayISO();
  }
}

function clearForm() {
  $("data").value = getTodayISO();
  $("loja").value = "";
  $("pedido").value = "";
  $("nota").value = "";
  $("valor_produto").value = "0";
  $("estorno_merc").value = "0";
  $("estorno_frete").value = "0";
  $("status_pedido").value = "A COLETAR";
  $("situacao").value = "EM ABERTO";
  $("obs").value = "";
  $("pedido").focus();
}

function saveRecord(e) {
  e.preventDefault();
  const data = {
    data: $("data").value,
    loja: $("loja").value,
    pedido: $("pedido").value.trim(),
    nota: $("nota").value.trim(),
    valor_produto: Number($("valor_produto").value || 0),
    estorno_merc: Number($("estorno_merc").value || 0),
    estorno_frete: Number($("estorno_frete").value || 0),
    status_pedido: $("status_pedido").value,
    situacao: $("situacao").value,
    obs: $("obs").value.trim(),
  };
  if (!data.data || !data.loja || !data.pedido) {
    showToast("Campos obrigatórios", "Preencha DATA, LOJA e PEDIDO.");
    return;
  }
  addRegistro(data);
  clearForm();
  updateTable();
  showToast("Registro salvo", "O registro foi adicionado com sucesso.");
}

// =================== Tabela / Filtros ===================
const tableBody = $("tableBody");
const recordCount = $("recordCount");
const fechamento = $("fechamento");

function aplicarFiltros() {
  const ini = $("f_ini").value;
  const fim = $("f_fim").value;
  const loja = $("f_loja").value;

  let lista = registros.map((r) => ({ ...r, valor_a_pagar: calcularValor(r) }));
  if (ini) lista = lista.filter((r) => r.data >= ini);
  if (fim) lista = lista.filter((r) => r.data <= fim);
  if (loja && loja !== "todas") lista = lista.filter((r) => r.loja === loja);
  registrosFiltrados = lista;

  // higieniza seleção
  const idsExistentes = new Set(registros.map(r => r.id));
  for (const id of [...selectedIds]) {
    if (!idsExistentes.has(id)) selectedIds.delete(id);
  }
}

function renderTable() {
  tableBody.innerHTML = "";

  if (registrosFiltrados.length === 0) {
    const tr = document.createElement("tr");
    tr.className = "empty-state";
    tr.innerHTML = `
      <td colspan="13">
        <div class="empty-content">
          <div>Nenhum registro encontrado</div>
          <div class="empty-subtitle">Adicione um novo registro ou ajuste os filtros</div>
        </div>
      </td>`;
    tableBody.appendChild(tr);
    syncHeaderCheckbox();
    return;
  }

  for (const r of registrosFiltrados) {
    const checked = selectedIds.has(r.id) ? "checked" : "";
    const tr = document.createElement("tr");
    tr.className = "data-row";
    tr.innerHTML = `
      <td class="text-center">
        <input type="checkbox" class="row-check" data-id="${r.id}" ${checked}/>
      </td>
      <td class="font-mono">${formatDate(r.data)}</td>
      <td>${r.loja}</td>
      <td class="font-mono">${r.pedido}</td>
      <td class="font-mono">${r.nota || "-"}</td>
      <td class="text-right font-mono">${formatCurrency(r.valor_produto)}</td>
      <td class="text-center"></td>
      <td class="text-right font-mono">${formatCurrency(r.estorno_frete)}</td>
      <td class="text-right font-mono" style="font-weight:700">${formatCurrency(r.valor_a_pagar)}</td>
      <td class="text-center"></td>
      <td class="text-center"></td>
      <td class="obs-cell" title="${escapeHtml(r.obs || "")}" style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(r.obs || "-")}</td>
      <td class="text-center">
        <div class="actions" style="display:flex; gap:6px; justify-content:center;">
          <button class="btn btn-secondary" data-action="coletar" data-id="${r.id}">Coletar</button>
          <button class="btn btn-secondary" data-action="cancelar" data-id="${r.id}">Cancelar</button>

          <!-- Botão LÁPIS (editar observação) -->
          <button class="btn btn-secondary" data-action="obs-edit" data-id="${r.id}" title="Editar observação" style="padding:6px 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
          </button>

          <button class="btn btn-primary" data-action="pagar" data-id="${r.id}">Pagar</button>
        </div>
      </td>
    `;
    tr.children[6].appendChild(createEstornoIndicator(r.estorno_merc)); // S/N
    tr.children[9].appendChild(createStatusBadge(r.status_pedido, "pedido"));
    tr.children[10].appendChild(createStatusBadge(r.situacao, "situacao"));
    tableBody.appendChild(tr);
  }

  syncHeaderCheckbox();
}

function updateRecordCount() {
  const n = registrosFiltrados.length;
  recordCount.textContent = `${n} registro${n !== 1 ? "s" : ""}`;
}

function updateSummary() {
  const total = registrosFiltrados.reduce((s, r) => s + calcularValor(r), 0);
  $("stat-total").textContent = registrosFiltrados.length;
  $("stat-coletados").textContent = registrosFiltrados.filter((r) => r.status_pedido === "COLETADO").length;
  $("stat-pendentes").textContent = registrosFiltrados.filter((r) => r.status_pedido === "A COLETAR").length;
  $("stat-valor").textContent = formatCurrency(total);
  fechamento.style.display = "block";
}

function updateTable() {
  aplicarFiltros();
  renderTable();
  updateSummary();
  updateRecordCount();
}

// =================== Export CSV ===================
function exportCSV() {
  const headers = [
    "Data","Loja","Pedido","Nota","Val. Produto","Est. Merc","Est. Frete","Valor a Pagar","Status","Situação","Observação",
  ];
  const csv = [
    headers.join(","),
    ...registrosFiltrados.map((r) =>
      [
        r.data,
        r.loja,
        r.pedido,
        r.nota || "",
        Number(r.valor_produto || 0).toFixed(2),
        r.estorno_merc ? "S" : "N",
        Number(r.estorno_frete || 0).toFixed(2),
        calcularValor(r).toFixed(2),
        r.status_pedido,
        r.situacao,
        r.obs || "",
      ]
        .map((x) => `"${x}"`)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `coletas_${getTodayISO()}.csv`;
  a.click();
}

// =================== Frete ao coletar ===================
function freteAoColetar(id) {
  const reg = updateRegistro(id, {
    status_pedido: "COLETADO",
    estorno_merc: 0,
    estorno_frete: 0,
  });
  if (!reg) return;
  showToast("Atualizado", "Pedido COLETADO: frete de R$ 8,00 aplicado.");
  updateTable();
}

// =================== Edição inline da Observação ===================
function enterObsEdit(id) {
  // acha a linha/célula
  const rowBtn = tableBody.querySelector(`button[data-action="obs-edit"][data-id="${id}"]`);
  if (!rowBtn) return;
  const tr = rowBtn.closest("tr");
  const cell = tr.querySelector(".obs-cell");
  if (!cell) return;

  // valor atual
  const atual = (registros.find(r => r.id === id)?.obs || "").replace(/^-\s*$/, "");
  const val = escapeHtml(atual);

  // guarda conteúdo original para cancelar
  cell.dataset.original = cell.innerHTML;

  // editor inline
  cell.innerHTML = `
    <div class="obs-edit" style="display:flex; gap:6px; align-items:center;">
      <input type="text" class="input obs-input" value="${val}" style="flex:1; min-width:180px; padding:6px 8px;"/>
      <button class="btn btn-primary" data-action="obs-save" data-id="${id}" title="Salvar" style="padding:6px 8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
      </button>
      <button class="btn btn-secondary" data-action="obs-cancel" data-id="${id}" title="Cancelar" style="padding:6px 8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `;

  // foco no input
  const input = cell.querySelector(".obs-input");
  input?.focus();
  input?.setSelectionRange(input.value.length, input.value.length);
}

function saveObsInline(id) {
  const rowBtn = tableBody.querySelector(`button[data-action="obs-save"][data-id="${id}"]`);
  if (!rowBtn) return;
  const tr = rowBtn.closest("tr");
  const cell = tr.querySelector(".obs-cell");
  const input = cell.querySelector(".obs-input");
  const novo = (input?.value || "").trim();
  updateRegistro(id, { obs: novo.length ? novo : "-" });
  showToast("Observação", "Observação atualizada.");
  updateTable();
}

function cancelObsInline(id) {
  // apenas re-renderiza a tabela (ou restaura o original se quiser sem re-render)
  updateTable();
}

// =================== Ações por linha ===================
function handleRowAction(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const id = Number(btn.getAttribute("data-id"));
  const action = btn.getAttribute("data-action");

  if (action === "coletar") {
    freteAoColetar(id);
    return;
  }

  if (action === "cancelar") {
    const naoVoltou = confirm(
      "A mercadoria NÃO voltou ao CD?\n\n" +
        "Se SIM: vamos descontar (valor do produto + frete) deste pagamento.\n" +
        "Se NÃO: apenas não pagaremos o frete (R$ 0,00)."
    );

    if (naoVoltou) {
      updateRegistro(id, { status_pedido: "CANCELADO", estorno_merc: 1 });
      showToast("Cancelado", "Sem devolução: descontado produto + frete.");
    } else {
      updateRegistro(id, {
        status_pedido: "CANCELADO",
        estorno_merc: 0,
        estorno_frete: 0,
      });
      showToast("Cancelado", "Com devolução: sem pagamento de frete.");
    }
    updateTable();
    return;
  }

  if (action === "obs-edit") { enterObsEdit(id); return; }
  if (action === "obs-save") { saveObsInline(id); return; }
  if (action === "obs-cancel") { cancelObsInline(id); return; }

  if (action === "pagar") {
    updateRegistro(id, { situacao: "PAGO" });
    showToast("Atualizado", "Registro marcado como PAGO.");
    updateTable();
  }
}

// =================== Seleção em massa ===================
function handleSelectAllChange(e) {
  const check = e.target.checked;
  for (const r of registrosFiltrados) {
    if (check) selectedIds.add(r.id);
    else selectedIds.delete(r.id);
  }
  renderTable();
}

function handleRowCheckboxChange(e) {
  const box = e.target.closest("input.row-check[data-id]");
  if (!box) return;
  const id = Number(box.getAttribute("data-id"));
  if (box.checked) selectedIds.add(id);
  else selectedIds.delete(id);
  syncHeaderCheckbox();
}

function syncHeaderCheckbox() {
  if (!selectAll) return;
  if (registrosFiltrados.length === 0) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
    return;
  }
  let selectedCount = 0;
  for (const r of registrosFiltrados) if (selectedIds.has(r.id)) selectedCount++;
  selectAll.checked = selectedCount === registrosFiltrados.length;
  selectAll.indeterminate = selectedCount > 0 && selectedCount < registrosFiltrados.length;
}

function clearSelection() {
  selectedIds.clear();
  renderTable();
  showToast("Seleção", "Seleção limpa.");
}

function pagarSelecionados() {
  if (selectedIds.size === 0) {
    showToast("Seleção", "Nenhum registro selecionado.");
    return;
  }
  let count = 0;
  for (const id of selectedIds) {
    const reg = updateRegistro(id, { situacao: "PAGO" });
    if (reg) count++;
  }
  updateTable();
  showToast("Pago", `${count} registro(s) marcado(s) como PAGO.`);
}

// =================== Cancelar não entregues do dia ===================
function cancelarNaoEntreguesDoDia(diaISO) {
  const dia = diaISO || getTodayISO();
  let alterados = 0;

  for (const r of registros) {
    if (r.data === dia && r.status_pedido !== "COLETADO") {
      r.status_pedido = "CANCELADO";
      r.estorno_merc = 1; // não devolveu
      r.obs =
        (r.obs ? r.obs + " | " : "") +
        `Cancelado por não entregue no dia ${formatDate(dia)}`;
      r.valor_a_pagar = calcularValor(r);
      alterados++;
    }
  }

  updateTable();
  showToast(
    "Fechamento do dia",
    `${alterados} registro(s) não entregues foram CANCELADOS em ${formatDate(
      dia
    )}.`
  );
}
window.cancelarNaoEntreguesDoDia = cancelarNaoEntreguesDoDia;

// =================== Eventos ===================
document.addEventListener("DOMContentLoaded", () => {
  registros = registros.map((r) => ({
    ...r,
    valor_a_pagar: calcularValor(r),
  }));

  initializeForm();
  updateTable();

  form?.addEventListener("submit", saveRecord);
  limparBtn?.addEventListener("click", clearForm);

  atualizarBtn?.addEventListener("click", updateTable);
  exportarBtn?.addEventListener("click", exportCSV);

  $("tableBody")?.addEventListener("click", handleRowAction);

  selectAll?.addEventListener("change", handleSelectAllChange);
  $("tableBody")?.addEventListener("change", handleRowCheckboxChange);
  limparSelecaoBtn?.addEventListener("click", clearSelection);
  pagarSelecionadosBtn?.addEventListener("click", pagarSelecionados);

  if (cancelarNaoEntreguesBtn) {
    cancelarNaoEntreguesBtn.addEventListener("click", () => {
      const dia =
        (diaFechamentoInput && diaFechamentoInput.value)
          ? diaFechamentoInput.value
          : getTodayISO();
      cancelarNaoEntreguesDoDia(dia);
    });
  }
});
