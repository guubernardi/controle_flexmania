// =================== Config ===================
const BASE_FRETE = 8.00;                  // R$ por pedido
const PAGA_BASE_AO_COLETAR = true;        // paga base só quando COLETADO

// =================== Mock inicial (exemplo) ===================
let registros = [
  {
    id: 1,
    data: "2025-09-10",
    loja: "LOJA A",
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

// =================== Cálculo ===================
// Regras:
// - COLETADO: 8 - estorno_frete - (estorno_merc? valor_produto : 0), mínimo 0.
// - CANCELADO: estorno_merc = 1 (não devolveu) => -(valor_produto + 8); estorno_merc = 0 => 0.
// - A COLETAR: 0 (porque só paga quando coletado).
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

  // A COLETAR
  return 0;
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
}

function updateTable() {
  aplicarFiltros();
  renderTable();
  updateSummary();
  updateRecordCount();
}

function renderTable() {
  tableBody.innerHTML = "";

  if (registrosFiltrados.length === 0) {
    const tr = document.createElement("tr");
    tr.className = "empty-state";
    tr.innerHTML = `
      <td colspan="12">
        <div class="empty-content">
          <div>Nenhum registro encontrado</div>
          <div class="empty-subtitle">Adicione um novo registro ou ajuste os filtros</div>
        </div>
      </td>`;
    tableBody.appendChild(tr);
    return;
  }

  for (const r of registrosFiltrados) {
    const tr = document.createElement("tr");
    tr.className = "data-row";
    tr.innerHTML = `
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
      <td title="${r.obs || ""}" style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.obs || "-"}</td>
      <td class="text-center">
        <div class="actions" style="display:flex; gap:6px; justify-content:center;">
          <button class="btn btn-secondary" data-action="coletar" data-id="${r.id}">Coletar</button>
          <button class="btn btn-secondary" data-action="cancelar" data-id="${r.id}">Cancelar</button>
          <button class="btn btn-primary" data-action="pagar" data-id="${r.id}">Pagar</button>
        </div>
      </td>
    `;
    tr.children[5].appendChild(createEstornoIndicator(r.estorno_merc));
    tr.children[8].appendChild(createStatusBadge(r.status_pedido, "pedido"));
    tr.children[9].appendChild(createStatusBadge(r.situacao, "situacao"));
    tableBody.appendChild(tr);
  }
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

// =================== Export CSV ===================
function exportCSV() {
  const headers = [
    "Data",
    "Loja",
    "Pedido",
    "Nota",
    "Val. Produto",
    "Est. Merc",
    "Est. Frete",
    "Valor a Pagar",
    "Status",
    "Situação",
    "Observação",
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

// =================== FUNÇÃO DE FRETE AO COLETAR ===================
// Sempre que marcar como COLETADO, aplica frete de R$ 8,00 (sem estornos).
function freteAoColetar(id) {
  // zera estornos e marca COLETADO para garantir os R$ 8
  const reg = updateRegistro(id, {
    status_pedido: "COLETADO",
    estorno_merc: 0,
    estorno_frete: 0,
  });
  if (!reg) return;
  showToast("Atualizado", "Pedido COLETADO: frete de R$ 8,00 aplicado.");
  updateTable();
}

// =================== Ações por linha ===================
function handleRowAction(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const id = Number(btn.getAttribute("data-id"));
  const action = btn.getAttribute("data-action");

  if (action === "coletar") {
    freteAoColetar(id); // <<< usa a função de frete ao coletar
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
  }

  if (action === "pagar") {
    updateRegistro(id, { situacao: "PAGO" });
    showToast("Atualizado", "Registro marcado como PAGO.");
  }

  updateTable();
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

  form.addEventListener("submit", saveRecord);
  limparBtn.addEventListener("click", clearForm);
  atualizarBtn.addEventListener("click", updateTable);
  exportarBtn.addEventListener("click", exportCSV);
  $("tableBody").addEventListener("click", handleRowAction);

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
