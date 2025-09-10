// Variáveis globais
const registros = [
  {
    id: 1,
    data: "2025-01-10",
    loja: "Shopee Adob",
    pedido: "122121",
    nota: "2000",
    valor_produto: 299.9,
    estorno_merc: 0,
    estorno_frete: 0,
    status_pedido: "A COLETAR",
    situacao: "EM ABERTO",
    obs: "-",
  },
]

let selectedIds = new Set()
let editingObs = null

const BASE_FRETE = 8.0

// Funções auxiliares
function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0)
}

function formatDate(dateStr) {
  if (!dateStr) return ""
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("pt-BR")
}

function getTodayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function getFirstDayOfMonth() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}-01`
}

function calcularValor(reg) {
  const status = reg.status_pedido
  const produto = Number(reg.valor_produto || 0)
  const estFrete = Number(reg.estorno_frete || 0)
  const estMerc = Number(reg.estorno_merc || 0)

  if (status === "CANCELADO") {
    return estMerc ? Number((-(produto + BASE_FRETE)).toFixed(2)) : 0
  }

  if (status === "COLETADO") {
    let v = BASE_FRETE - estFrete - (estMerc ? produto : 0)
    if (v < 0) v = 0
    return Number(v.toFixed(2))
  }

  return 0 // A COLETAR
}

function normalizeString(s = "") {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function nextId() {
  return Math.max(...registros.map((r) => r.id), 0) + 1
}

// Sistema de notificações
function showNotification(message, type = "info", title = null) {
  const container = getOrCreateNotificationContainer()

  const notification = document.createElement("div")
  notification.className = `notification ${type}`

  const icon = getNotificationIcon(type)

  notification.innerHTML = `
    <div class="notification-icon">${icon}</div>
    <div class="notification-content">
      ${title ? `<div class="notification-title">${title}</div>` : ""}
      <div class="notification-message">${message}</div>
    </div>
    <button class="notification-close" onclick="closeNotification(this)">×</button>
  `

  container.appendChild(notification)

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      closeNotification(notification.querySelector(".notification-close"))
    }
  }, 5000)
}

function getOrCreateNotificationContainer() {
  let container = document.getElementById("notification-container")
  if (!container) {
    container = document.createElement("div")
    container.id = "notification-container"
    container.className = "notification-container"
    document.body.appendChild(container)
  }
  return container
}

function getNotificationIcon(type) {
  switch (type) {
    case "success":
      return "✅"
    case "error":
      return "❌"
    case "warning":
      return "⚠️"
    default:
      return "ℹ️"
  }
}

function closeNotification(closeButton) {
  const notification = closeButton.closest(".notification")
  notification.classList.add("removing")
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification)
    }
  }, 300)
}

// Inicializa o formulário com a data de hoje
function initializeForm() {
  document.getElementById("data").value = getTodayISO()
  document.getElementById("f_ini").value = getFirstDayOfMonth()
  document.getElementById("f_fim").value = getTodayISO()

  // Add event listeners
  document.getElementById("recordForm").addEventListener("submit", saveRecord)
  document.getElementById("searchQuery").addEventListener("input", filterRecords)
  document.getElementById("f_ini").addEventListener("change", filterRecords)
  document.getElementById("f_fim").addEventListener("change", filterRecords)
  document.getElementById("f_loja").addEventListener("change", filterRecords)
}

function clearForm() {
  document.getElementById("recordForm").reset()
  document.getElementById("data").value = getTodayISO()
}

function saveRecord(e) {
  e.preventDefault()

  const formData = new FormData(e.target)
  const data = Object.fromEntries(formData)

  if (!data.data || !data.loja || !data.pedido) {
    showNotification("Preencha os campos obrigatórios: DATA, LOJA e PEDIDO.", "error", "Campos obrigatórios")
    return
  }

  const newRecord = {
    id: nextId(),
    data: data.data,
    loja: data.loja,
    pedido: data.pedido.trim(),
    nota: data.nota.trim(),
    valor_produto: Number(data.valor_produto || 0),
    estorno_merc: Number(data.estorno_merc || 0),
    estorno_frete: Number(data.estorno_frete || 0),
    status_pedido: data.status_pedido,
    situacao: data.situacao,
    obs: data.obs.trim() || "-",
  }

  registros.unshift(newRecord)
  clearForm()
  renderRecords()
  showNotification("Registro salvo com sucesso!", "success", "Sucesso")
}

function getFilteredRecords() {
  const searchQuery = document.getElementById("searchQuery").value
  const f_ini = document.getElementById("f_ini").value
  const f_fim = document.getElementById("f_fim").value
  const f_loja = document.getElementById("f_loja").value

  let lista = registros.map((r) => ({ ...r, valor_a_pagar: calcularValor(r) }))

  if (f_ini) lista = lista.filter((r) => r.data >= f_ini)
  if (f_fim) lista = lista.filter((r) => r.data <= f_fim)
  if (f_loja && f_loja !== "todas") lista = lista.filter((r) => r.loja === f_loja)

  if (searchQuery) {
    const q = normalizeString(searchQuery)
    lista = lista.filter((r) => {
      const pedido = normalizeString(r.pedido)
      const nota = normalizeString(r.nota)
      return pedido.includes(q) || nota.includes(q)
    })
  }

  return lista
}

function renderRecords() {
  const filteredRecords = getFilteredRecords()
  const tbody = document.getElementById("recordsTableBody")

  // Atualiza contador de registros
  document.getElementById("record-count").textContent =
    `${filteredRecords.length} registro${filteredRecords.length !== 1 ? "s" : ""}`

  if (filteredRecords.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="13" class="empty-state">
                    <div class="empty-state-icon">💾</div>
                    <div>Nenhum registro encontrado</div>
                    <div style="font-size: 0.875rem;">Adicione um novo registro ou ajuste os filtros</div>
                </td>
            </tr>
        `
  } else {
    tbody.innerHTML = filteredRecords
      .map(
        (registro) => `
            <tr>
                <td>
                    <input type="checkbox" 
                           ${selectedIds.has(registro.id) ? "checked" : ""} 
                           onchange="handleRowSelect(${registro.id}, this.checked)">
                </td>
                <td style="font-family: monospace; font-size: 0.875rem;">${formatDate(registro.data)}</td>
                <td>${registro.loja}</td>
                <td style="font-family: monospace;">${registro.pedido}</td>
                <td style="font-family: monospace;">${registro.nota || "-"}</td>
                <td class="text-right" style="font-family: monospace;">${formatCurrency(registro.valor_produto)}</td>
                <td class="text-center">
                    <span class="estorno-indicator ${registro.estorno_merc ? "estorno-yes" : "estorno-no"}">
                        ${registro.estorno_merc ? "S" : "N"}
                    </span>
                </td>
                <td class="text-right" style="font-family: monospace;">${formatCurrency(registro.estorno_frete)}</td>
                <td class="text-right" style="font-family: monospace; font-weight: bold;">${formatCurrency(calcularValor(registro))}</td>
                <td class="text-center">
                    <span class="badge ${getStatusBadgeClass(registro.status_pedido, "pedido")}">${registro.status_pedido}</span>
                </td>
                <td class="text-center">
                    <span class="badge ${getStatusBadgeClass(registro.situacao, "situacao")}">${registro.situacao}</span>
                </td>
                <td class="obs-cell">
                    ${
                      editingObs === registro.id
                        ? `
                        <div class="obs-edit">
                            <input type="text" id="obsEdit" value="${registro.obs === "-" ? "" : registro.obs}" style="flex: 1;">
                            <button type="button" class="btn btn-sm btn-secondary" onclick="saveObs(${registro.id})">
                                <span class="icon-save"></span>
                            </button>
                            <button type="button" class="btn btn-sm btn-secondary" onclick="cancelEditObs()">
                                <span class="icon-x"></span>
                            </button>
                        </div>
                    `
                        : `
                        <div class="obs-display" onclick="startEditObs(${registro.id}, '${registro.obs}')" title="${registro.obs}">
                            ${registro.obs || "-"}
                        </div>
                    `
                    }
                </td>
                <td class="text-center">
                    <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; justify-content: center;">
                        <button class="btn btn-sm btn-secondary" onclick="freteAoColetar(${registro.id})">Coletar</button>
                        <button class="btn btn-sm btn-secondary" onclick="cancelarPedido(${registro.id})">Cancelar</button>
                        <button class="btn btn-sm btn-secondary" onclick="startEditObs(${registro.id}, '${registro.obs}')" title="Editar observação">
                            <span class="icon-edit"></span>
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="marcarComoPago(${registro.id})">Pagar</button>
                    </div>
                </td>
            </tr>
        `,
      )
      .join("")
  }

  updateSummary(filteredRecords)
}

function getStatusBadgeClass(status, type) {
  if (type === "pedido") {
    if (status === "COLETADO") return "badge-success"
    if (status === "A COLETAR") return "badge-warning"
    if (status === "CANCELADO") return "badge-danger"
  } else {
    if (status === "PAGO") return "badge-success"
    return "badge-warning"
  }
  return ""
}

function updateSummary(filteredRecords) {
  const total = filteredRecords.length
  const coletados = filteredRecords.filter((r) => r.status_pedido === "COLETADO").length
  const pendentes = filteredRecords.filter((r) => r.status_pedido === "A COLETAR").length
  const valorTotal = filteredRecords.reduce((s, r) => s + calcularValor(r), 0)

  document.getElementById("summary-total").textContent = total
  document.getElementById("summary-coletados").textContent = coletados
  document.getElementById("summary-pendentes").textContent = pendentes
  document.getElementById("summary-valor").textContent = formatCurrency(valorTotal)
}

function filterRecords() {
  renderRecords()
}

function clearSearch() {
  document.getElementById("searchQuery").value = ""
  filterRecords()
}

function updateRegistro(id, updates) {
  const index = registros.findIndex((r) => r.id === id)
  if (index !== -1) {
    registros[index] = { ...registros[index], ...updates }
    renderRecords()
  }
}

function freteAoColetar(id) {
  updateRegistro(id, {
    status_pedido: "COLETADO",
    estorno_merc: 0,
    estorno_frete: 0,
  })
  showNotification("Frete de R$ 8,00 aplicado.", "success", "Pedido COLETADO")
}

function cancelarPedido(id) {
  const naoVoltou = confirm(
    "A mercadoria NÃO voltou ao CD?\n\n" +
      "Se SIM: vamos descontar (valor do produto + frete) deste pagamento.\n" +
      "Se NÃO: apenas não pagaremos o frete (R$ 0,00).",
  )

  if (naoVoltou) {
    updateRegistro(id, { status_pedido: "CANCELADO", estorno_merc: 1 })
    showNotification("Descontado produto + frete.", "warning", "Cancelado sem devolução")
  } else {
    updateRegistro(id, { status_pedido: "CANCELADO", estorno_merc: 0, estorno_frete: 0 })
    showNotification("Sem pagamento de frete.", "warning", "Cancelado com devolução")
  }
}

function marcarComoPago(id) {
  updateRegistro(id, { situacao: "PAGO" })
  showNotification("Registro marcado como PAGO.", "success", "Pagamento")
}

function handleSelectAll(checked) {
  const filteredRecords = getFilteredRecords()
  if (checked) {
    selectedIds = new Set(filteredRecords.map((r) => r.id))
  } else {
    selectedIds = new Set()
  }
  renderRecords()
}

function handleRowSelect(id, checked) {
  if (checked) {
    selectedIds.add(id)
  } else {
    selectedIds.delete(id)
  }

  // Update select all checkbox
  const filteredRecords = getFilteredRecords()
  const selectAllCheckbox = document.getElementById("selectAll")
  selectAllCheckbox.checked = filteredRecords.length > 0 && selectedIds.size === filteredRecords.length
}

function clearSelection() {
  selectedIds = new Set()
  renderRecords()
}

function pagarSelecionados() {
  if (selectedIds.size === 0) {
    showNotification("Nenhum registro selecionado.", "warning", "Seleção vazia")
    return
  }

  let count = 0
  selectedIds.forEach((id) => {
    updateRegistro(id, { situacao: "PAGO" })
    count++
  })

  showNotification(`${count} registro(s) marcado(s) como PAGO.`, "success", "Pagamentos processados")
}

function startEditObs(id, currentObs) {
  editingObs = id
  renderRecords()

  // Focus on the input after render
  setTimeout(() => {
    const input = document.getElementById("obsEdit")
    if (input) {
      input.focus()
      input.value = currentObs === "-" ? "" : currentObs
    }
  }, 0)
}

function saveObs(id) {
  const input = document.getElementById("obsEdit")
  const newObs = input.value.trim() || "-"
  updateRegistro(id, { obs: newObs })
  editingObs = null
  showNotification("Observação atualizada.", "success", "Atualização")
}

function cancelEditObs() {
  editingObs = null
  renderRecords()
}

function exportCSV() {
  const filteredRecords = getFilteredRecords()
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
  ]

  const csv = [
    headers.join(","),
    ...filteredRecords.map((r) =>
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
        .join(","),
    ),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `coletas_${getTodayISO()}.csv`
  a.click()
}

// Inicializa a aplicação
document.addEventListener("DOMContentLoaded", () => {
  initializeForm()
  renderRecords()
  document.getElementById("btnRelatorioGPT")?.addEventListener("click", gerarRelatorioNoChatGPT);
})

// ===== Relatório p/ ChatGPT =====
function buildRelatorioPrompt() {
  // pega exatamente a lista com filtros atuais
  const lista = getFilteredRecords()
    .filter(r => r.status_pedido === "CANCELADO" && Number(r.estorno_merc) === 1);

  const linhas = lista.map(r => {
    // para cancelado com estorno_merc=1, calcularValor é negativo (desconto);
    // usamos valor absoluto para exibir
    const valor = Math.abs(calcularValor(r));
    return `${r.pedido} / ${formatCurrency(valor)} / ${formatDate(r.data)} / ${r.loja}`;
  });

  const corpo = linhas.length
    ? linhas.join("\n")
    : "(nenhum pedido descontado no filtro atual)";

  const prompt =
`Quero um relatório curto e claro (em português) no seguinte formato:

TÍTULO: Relatório de descontos do período filtrado
RESUMO: total de pedidos descontados e soma total dos descontos.
TABELA:
- Colunas: Pedido | Valor descontado | Data | Loja
- Dados:
${corpo}

Observações:
- Considerar "pedidos descontados" como CANCELADO com estorno_merc=1.
- Some o total descontado.
- Se possível, gere uma versão em Markdown bem alinhada.`;

  return prompt;
}

// ===== Relatório p/ ChatGPT (puxa os dados registrados do filtro atual) =====
function buildRelatorioPrompt() {
  const lista = getFilteredRecords(); // já respeita busca, datas e loja

  // filtros atuais (para exibir no cabeçalho do prompt)
  const f_ini = document.getElementById("f_ini")?.value || "";
  const f_fim = document.getElementById("f_fim")?.value || "";
  const f_lojaSel = document.getElementById("f_loja")?.value || "todas";
  const f_lojaTxt = f_lojaSel && f_lojaSel !== "todas" ? f_lojaSel : "(todas)";

  // seções úteis
  const descontados = lista.filter(r => r.status_pedido === "CANCELADO" && Number(r.estorno_merc) === 1);
  const coletados   = lista.filter(r => r.status_pedido === "COLETADO");
  const pendentes   = lista.filter(r => r.status_pedido === "A COLETAR");
  const canceladosComDevolucao = lista.filter(r => r.status_pedido === "CANCELADO" && Number(r.estorno_merc) === 0);

  // somatórios
  const somaValorPagar = lista.reduce((s, r) => s + calcularValor(r), 0);
  const somaDescontos  = descontados.reduce((s, r) => s + Math.abs(calcularValor(r)), 0);

  // helpers para linhas
  const linhaDescontado = (r) =>
    `${r.pedido} / ${formatCurrency(Math.abs(calcularValor(r)))} / ${formatDate(r.data)} / ${r.loja}`;

  const linhasDescontados = descontados.length
    ? descontados.map(linhaDescontado).join("\n")
    : "(nenhum pedido descontado no filtro atual)";

  // tabela completa (Markdown) com os dados registrados
  const headerTabela =
`| Pedido | Nota | Data | Loja | Status | Situação | R$ Produto | Est. Merc | Est. Frete | R$ a Pagar | Obs |
|---|---|---|---|---|---:|---:|---:|---:|---:|---|`;

  const linhasTabela = lista.length
    ? lista.map(r => {
        const estMerc = Number(r.estorno_merc) ? "S" : "N";
        return `| ${r.pedido} | ${r.nota || "-"} | ${formatDate(r.data)} | ${r.loja} | ${r.status_pedido} / ${r.situacao} | ${formatCurrency(r.valor_produto)} | ${estMerc} | ${formatCurrency(r.estorno_frete)} | ${formatCurrency(calcularValor(r))} | ${r.obs || "-"} |`;
      }).join("\n")
    : "(sem registros no filtro atual)";

  const agora = new Date();
  const geradoEm = `${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR")}`;

  const prompt =
`Quero um relatório curto e claro (em português) com base **exatamente** nos dados abaixo.

## Contexto do filtro
- Período: ${f_ini || "(sem início)"} a ${f_fim || "(sem fim)"}  
- Loja: ${f_lojaTxt}  
- Gerado em: ${geradoEm}

## Resumo
- Total de registros: ${lista.length}
- Coletados: ${coletados.length}
- Pendentes (a coletar): ${pendentes.length}
- Cancelados (com devolução): ${canceladosComDevolucao.length}
- **Pedidos descontados** (cancelado + estorno_merc=1): ${descontados.length}
- **Soma dos descontos** (apenas descontados): ${formatCurrency(somaDescontos)}
- **Valor total a pagar** (considerando regras atuais): ${formatCurrency(somaValorPagar)}

## Pedidos descontados (formato: pedido / valor descontado / data / loja)
${linhasDescontados}

## Tabela completa (registros do filtro atual)
${headerTabela}
${linhasTabela}

### Instruções
- Gere um relatório enxuto em **Markdown** com:
  1) Título, período e loja
  2) Um pequeno resumo com os números principais acima
  3) Uma tabela “Pedidos descontados”
  4) Uma tabela “Registros do período”
- Ajuste alinhamento/formatos quando útil e termine com um total de descontos e total a pagar.`;

  return prompt;
}

// ===== Relatório p/ ChatGPT (puxa os dados registrados do filtro atual) =====
function buildRelatorioPrompt() {
  const lista = getFilteredRecords(); // já respeita busca, datas e loja

  // filtros atuais (para exibir no cabeçalho do prompt)
  const f_ini = document.getElementById("f_ini")?.value || "";
  const f_fim = document.getElementById("f_fim")?.value || "";
  const f_lojaSel = document.getElementById("f_loja")?.value || "todas";
  const f_lojaTxt = f_lojaSel && f_lojaSel !== "todas" ? f_lojaSel : "(todas)";

  // seções úteis
  const descontados = lista.filter(r => r.status_pedido === "CANCELADO" && Number(r.estorno_merc) === 1);
  const coletados   = lista.filter(r => r.status_pedido === "COLETADO");
  const pendentes   = lista.filter(r => r.status_pedido === "A COLETAR");
  const canceladosComDevolucao = lista.filter(r => r.status_pedido === "CANCELADO" && Number(r.estorno_merc) === 0);

  // somatórios
  const somaValorPagar = lista.reduce((s, r) => s + calcularValor(r), 0);
  const somaDescontos  = descontados.reduce((s, r) => s + Math.abs(calcularValor(r)), 0);

  // helpers para linhas
  const linhaDescontado = (r) =>
    `${r.pedido} / ${formatCurrency(Math.abs(calcularValor(r)))} / ${formatDate(r.data)} / ${r.loja}`;

  const linhasDescontados = descontados.length
    ? descontados.map(linhaDescontado).join("\n")
    : "(nenhum pedido descontado no filtro atual)";

  // tabela completa (Markdown) com os dados registrados
  const headerTabela =
`| Pedido | Nota | Data | Loja | Status | Situação | R$ Produto | Est. Merc | Est. Frete | R$ a Pagar | Obs |
|---|---|---|---|---|---:|---:|---:|---:|---:|---|`;

  const linhasTabela = lista.length
    ? lista.map(r => {
        const estMerc = Number(r.estorno_merc) ? "S" : "N";
        return `| ${r.pedido} | ${r.nota || "-"} | ${formatDate(r.data)} | ${r.loja} | ${r.status_pedido} / ${r.situacao} | ${formatCurrency(r.valor_produto)} | ${estMerc} | ${formatCurrency(r.estorno_frete)} | ${formatCurrency(calcularValor(r))} | ${r.obs || "-"} |`;
      }).join("\n")
    : "(sem registros no filtro atual)";

  const agora = new Date();
  const geradoEm = `${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR")}`;

  const prompt =
`Quero um relatório curto e claro (em português) com base **exatamente** nos dados abaixo.

## Contexto do filtro
- Período: ${f_ini || "(sem início)"} a ${f_fim || "(sem fim)"}  
- Loja: ${f_lojaTxt}  
- Gerado em: ${geradoEm}

## Resumo
- Total de registros: ${lista.length}
- Coletados: ${coletados.length}
- Pendentes (a coletar): ${pendentes.length}
- Cancelados (com devolução): ${canceladosComDevolucao.length}
- **Pedidos descontados** (cancelado + estorno_merc=1): ${descontados.length}
- **Soma dos descontos** (apenas descontados): ${formatCurrency(somaDescontos)}
- **Valor total a pagar** (considerando regras atuais): ${formatCurrency(somaValorPagar)}

## Pedidos descontados (formato: pedido / valor descontado / data / loja)
${linhasDescontados}

## Tabela completa (registros do filtro atual)
${headerTabela}
${linhasTabela}

### Instruções
- Gere um relatório enxuto em **Markdown** com:
  1) Título, período e loja
  2) Um pequeno resumo com os números principais acima
  3) Uma tabela “Pedidos descontados”
  4) Uma tabela “Registros do período”
- Ajuste alinhamento/formatos quando útil e termine com um total de descontos e total a pagar.`;

  return prompt;
}

async function gerarRelatorioNoChatGPT() {
  const prompt = buildRelatorioPrompt();
  try {
    await navigator.clipboard.writeText(prompt);
    showNotification("Prompt copiado. Abrindo ChatGPT — cole (Ctrl/Cmd+V) e envie.", "success", "Relatório");
  } catch {
    const blob = new Blob([prompt], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "prompt_relatorio_chatgpt.txt";
    a.click();
    showNotification("Não consegui copiar. Baixei um .txt com o prompt.", "warning", "Relatório");
  }
  window.open("https://chat.openai.com/", "_blank", "noopener");
}

