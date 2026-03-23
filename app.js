import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =========================
// FIREBASE
// =========================
const firebaseConfig = {
  apiKey: "AIzaSyDReYPPhvjjQ4DdLOeQQDg_PrqPCwYaFfU",
  authDomain: "motorista-80298.firebaseapp.com",
  projectId: "motorista-80298",
  storageBucket: "motorista-80298.firebasestorage.app",
  messagingSenderId: "988614619560",
  appId: "1:988614619560:web:f2521ff21aae96aa486d9d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =========================
// ELEMENTOS
// =========================
const form = document.getElementById("formStatus");
const lista = document.getElementById("lista");
const saveMsg = document.getElementById("saveMsg");
const recordDate = document.getElementById("recordDate");
const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const totalRegistrosEl = document.getElementById("totalRegistros");
const totalAlertasEl = document.getElementById("totalAlertas");
const ultimaAtualizacaoEl = document.getElementById("ultimaAtualizacao");

let editingDocId = null;
let currentDocsCache = [];

// =========================
// CONFIG DE HORÁRIO
// =========================
const PERIODOS_CONFIG = {
  antesCasa: {
    key: "antesCasa",
    titulo: "Antes de sair de casa",
    liberaEm: "06:00",
    inputIds: [
      "antesCasa_motorista_nome",
      "antesCasa_motorista_status",
      "antesCasa_passageiros",
      "antesCasa_passageiros_status"
    ],
    cardId: "cardAntesCasa",
    infoId: "infoAntesCasa"
  },
  aposAlmoco: {
    key: "aposAlmoco",
    titulo: "Após almoço",
    liberaEm: "13:00",
    inputIds: [
      "aposAlmoco_motorista_nome",
      "aposAlmoco_motorista_status",
      "aposAlmoco_passageiros",
      "aposAlmoco_passageiros_status"
    ],
    cardId: "cardAposAlmoco",
    infoId: "infoAposAlmoco"
  },
  antesCliente: {
    key: "antesCliente",
    titulo: "Antes de sair do cliente",
    liberaEm: "16:00",
    inputIds: [
      "antesCliente_motorista_nome",
      "antesCliente_motorista_status",
      "antesCliente_passageiros",
      "antesCliente_passageiros_status"
    ],
    cardId: "cardAntesCliente",
    infoId: "infoAntesCliente"
  }
};

// =========================
// DATA
// =========================
function hojeISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
}

recordDate.value = hojeISO();

// =========================
// HELPERS
// =========================
function setMensagem(msg, erro = false) {
  saveMsg.textContent = msg;
  saveMsg.className = erro ? "message-box error" : "message-box success";
}

function normalizarStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function classeStatus(status) {
  const valor = normalizarStatus(status);
  if (valor === "ótimo" || valor === "otimo") return "badge-otimo";
  if (valor === "regular") return "badge-regular";
  return "badge-ruim";
}

function textoStatus(status) {
  const valor = normalizarStatus(status);
  if (valor === "ótimo" || valor === "otimo") return "Ótimo";
  if (valor === "regular") return "Regular";
  return "Ruim";
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "--/--/----";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarTimestamp(timestamp) {
  if (!timestamp) return "Agora";
  try {
    const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(data.getTime())) return "Agora";

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(data);
  } catch {
    return "Agora";
  }
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pegarValor(id) {
  return document.getElementById(id).value.trim();
}

function formatarPassageiros(texto) {
  return String(texto || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function periodoTemRuim(periodo) {
  const motoristaRuim = normalizarStatus(periodo?.motorista?.status) === "ruim";
  const passageirosRuim = normalizarStatus(periodo?.passageiros?.status) === "ruim";
  return motoristaRuim || passageirosRuim;
}

function registroTemRuim(dados) {
  return (
    periodoTemRuim(dados?.antesCasa) ||
    periodoTemRuim(dados?.aposAlmoco) ||
    periodoTemRuim(dados?.antesCliente)
  );
}

function contarAlertas(registros) {
  return registros.filter((item) => registroTemRuim(item)).length;
}

function atualizarResumo(registros) {
  totalRegistrosEl.textContent = registros.length;
  totalAlertasEl.textContent = contarAlertas(registros);

  if (!registros.length) {
    ultimaAtualizacaoEl.textContent = "--";
    return;
  }

  const maisRecente = registros[0];
  ultimaAtualizacaoEl.textContent = formatarTimestamp(
    maisRecente.atualizadoEm || maisRecente.criadoEm
  );
}

function montarLinha(papel, nomeOuLista, status) {
  const ruim = normalizarStatus(status) === "ruim";

  return `
    <div class="period-row ${ruim ? "row-bad" : ""}">
      <div class="period-role">
        <strong>${papel}</strong>
        <span>${escapeHtml(nomeOuLista || "-")}</span>
      </div>
      <span class="status-badge ${classeStatus(status)}">${textoStatus(status)}</span>
    </div>
  `;
}

function montarPeriodo(titulo, periodo) {
  const ruimNoPeriodo = periodoTemRuim(periodo);

  return `
    <section class="period-card-view ${ruimNoPeriodo ? "period-alert" : ""}">
      <h4 class="period-title">${titulo}</h4>
      ${montarLinha("Motorista", periodo?.motorista?.nome, periodo?.motorista?.status)}
      ${montarLinha("Passageiros", formatarPassageiros(periodo?.passageiros?.nomes), periodo?.passageiros?.status)}
    </section>
  `;
}

function montarCard(dados) {
  const alerta = registroTemRuim(dados);

  return `
    <article class="status-card ${alerta ? "has-bad" : ""}">
      <div class="status-card-header">
        <div>
          <h3 class="status-card-title">Registro do dia ${formatarDataBR(dados.dataRegistro)}</h3>
          <p class="status-card-subtitle">
            ${alerta ? "Existe pelo menos um status ruim neste registro." : "Registro dentro do padrão."}
          </p>
        </div>
        <span class="card-date">${formatarTimestamp(dados.atualizadoEm || dados.criadoEm)}</span>
      </div>

      ${alerta ? `<div class="alert-bad">⚠ Atenção: há condição ruim informada neste registro.</div>` : ""}

      <div class="period-list">
        ${montarPeriodo("Antes de sair de casa", dados.antesCasa)}
        ${montarPeriodo("Após almoço", dados.aposAlmoco)}
        ${montarPeriodo("Antes de sair do cliente", dados.antesCliente)}
      </div>

      <div class="card-actions">
        <button class="btn btn-secondary btn-edit" type="button" data-id="${dados.dataRegistro}">
          Editar
        </button>
        <button class="btn btn-danger btn-delete" type="button" data-id="${dados.dataRegistro}">
          Excluir
        </button>
      </div>
    </article>
  `;
}

function montarDadosFormulario() {
  return {
    dataRegistro: recordDate.value,
    antesCasa: {
      motorista: {
        nome: pegarValor("antesCasa_motorista_nome"),
        status: document.getElementById("antesCasa_motorista_status").value
      },
      passageiros: {
        nomes: pegarValor("antesCasa_passageiros"),
        status: document.getElementById("antesCasa_passageiros_status").value
      }
    },
    aposAlmoco: {
      motorista: {
        nome: pegarValor("aposAlmoco_motorista_nome"),
        status: document.getElementById("aposAlmoco_motorista_status").value
      },
      passageiros: {
        nomes: pegarValor("aposAlmoco_passageiros"),
        status: document.getElementById("aposAlmoco_passageiros_status").value
      }
    },
    antesCliente: {
      motorista: {
        nome: pegarValor("antesCliente_motorista_nome"),
        status: document.getElementById("antesCliente_motorista_status").value
      },
      passageiros: {
        nomes: pegarValor("antesCliente_passageiros"),
        status: document.getElementById("antesCliente_passageiros_status").value
      }
    }
  };
}

// =========================
// HORÁRIO / BLOQUEIO
// =========================
function agora() {
  return new Date();
}

function minutosAgora() {
  const d = agora();
  return d.getHours() * 60 + d.getMinutes();
}

function horarioParaMinutos(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatarDuracao(minutosRestantes) {
  const horas = Math.floor(minutosRestantes / 60);
  const minutos = minutosRestantes % 60;

  if (horas > 0 && minutos > 0) {
    return `${horas}h ${minutos}min`;
  }
  if (horas > 0) {
    return `${horas}h`;
  }
  return `${minutos}min`;
}

function getPeriodoLiberado(periodoKey) {
  const config = PERIODOS_CONFIG[periodoKey];
  return minutosAgora() >= horarioParaMinutos(config.liberaEm);
}

function getStatusPeriodo(periodoKey) {
  const config = PERIODOS_CONFIG[periodoKey];
  const agoraMin = minutosAgora();
  const liberaMin = horarioParaMinutos(config.liberaEm);
  const liberado = agoraMin >= liberaMin;
  const faltam = Math.max(0, liberaMin - agoraMin);

  return {
    liberado,
    faltam,
    liberaEm: config.liberaEm,
    titulo: config.titulo
  };
}

function bloquearPeriodo(inputIds, bloqueado) {
  inputIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = bloqueado;
  });
}

function atualizarInfoVisualPeriodo(periodoKey) {
  const config = PERIODOS_CONFIG[periodoKey];
  const card = document.getElementById(config.cardId);
  const info = document.getElementById(config.infoId);
  const status = getStatusPeriodo(periodoKey);

  if (!card || !info) return;

  if (status.liberado) {
    card.classList.remove("locked-period");
    card.classList.add("unlocked-period");
    info.className = "period-unlock-info unlocked";
    info.innerHTML = `✅ Liberado desde <strong>${status.liberaEm}</strong>`;
  } else {
    card.classList.remove("unlocked-period");
    card.classList.add("locked-period");
    info.className = "period-unlock-info locked";
    info.innerHTML = `🔒 Libera às <strong>${status.liberaEm}</strong> • falta <strong>${formatarDuracao(status.faltam)}</strong>`;
  }
}

function aplicarRegrasHorario() {
  Object.keys(PERIODOS_CONFIG).forEach((periodoKey) => {
    const config = PERIODOS_CONFIG[periodoKey];
    const status = getStatusPeriodo(periodoKey);
    bloquearPeriodo(config.inputIds, !status.liberado);
    atualizarInfoVisualPeriodo(periodoKey);
  });
}

function existePeriodoBloqueadoComPreenchimentoManual() {
  for (const periodoKey of Object.keys(PERIODOS_CONFIG)) {
    const config = PERIODOS_CONFIG[periodoKey];
    const status = getStatusPeriodo(periodoKey);

    if (status.liberado) continue;

    const temConteudo = config.inputIds.some((id) => {
      const el = document.getElementById(id);
      if (!el) return false;
      return String(el.value || "").trim() !== "";
    });

    if (temConteudo) {
      return config.titulo;
    }
  }

  return "";
}

function validarDados(dados) {
  if (!dados.dataRegistro) {
    return "Selecione a data.";
  }

  const validacoes = [
    {
      key: "antesCasa",
      titulo: "Antes de sair de casa",
      motorista: dados.antesCasa.motorista.nome,
      passageiros: dados.antesCasa.passageiros.nomes
    },
    {
      key: "aposAlmoco",
      titulo: "Após almoço",
      motorista: dados.aposAlmoco.motorista.nome,
      passageiros: dados.aposAlmoco.passageiros.nomes
    },
    {
      key: "antesCliente",
      titulo: "Antes de sair do cliente",
      motorista: dados.antesCliente.motorista.nome,
      passageiros: dados.antesCliente.passageiros.nomes
    }
  ];

  for (const item of validacoes) {
    if (!getPeriodoLiberado(item.key)) {
      continue;
    }

    if (!item.motorista || !item.passageiros) {
      return `Preencha motorista e passageiros no período "${item.titulo}".`;
    }
  }

  const periodoBloqueadoPreenchido = existePeriodoBloqueadoComPreenchimentoManual();
  if (periodoBloqueadoPreenchido) {
    return `O período "${periodoBloqueadoPreenchido}" ainda está bloqueado pelo horário permitido.`;
  }

  return "";
}

function preencherFormulario(dados) {
  recordDate.value = dados.dataRegistro || hojeISO();

  document.getElementById("antesCasa_motorista_nome").value = dados?.antesCasa?.motorista?.nome || "";
  document.getElementById("antesCasa_motorista_status").value = dados?.antesCasa?.motorista?.status || "ótimo";
  document.getElementById("antesCasa_passageiros").value = dados?.antesCasa?.passageiros?.nomes || "";
  document.getElementById("antesCasa_passageiros_status").value = dados?.antesCasa?.passageiros?.status || "ótimo";

  document.getElementById("aposAlmoco_motorista_nome").value = dados?.aposAlmoco?.motorista?.nome || "";
  document.getElementById("aposAlmoco_motorista_status").value = dados?.aposAlmoco?.motorista?.status || "ótimo";
  document.getElementById("aposAlmoco_passageiros").value = dados?.aposAlmoco?.passageiros?.nomes || "";
  document.getElementById("aposAlmoco_passageiros_status").value = dados?.aposAlmoco?.passageiros?.status || "ótimo";

  document.getElementById("antesCliente_motorista_nome").value = dados?.antesCliente?.motorista?.nome || "";
  document.getElementById("antesCliente_motorista_status").value = dados?.antesCliente?.motorista?.status || "ótimo";
  document.getElementById("antesCliente_passageiros").value = dados?.antesCliente?.passageiros?.nomes || "";
  document.getElementById("antesCliente_passageiros_status").value = dados?.antesCliente?.passageiros?.status || "ótimo";

  aplicarRegrasHorario();
}

function limparFormulario() {
  form.reset();
  recordDate.value = hojeISO();
  editingDocId = null;
  atualizarModoFormulario();
  aplicarRegrasHorario();
}

function atualizarModoFormulario() {
  const emEdicao = !!editingDocId;

  submitBtn.textContent = emEdicao ? "Atualizar registro" : "Salvar registro do dia";
  cancelEditBtn.hidden = !emEdicao;

  formTitle.textContent = emEdicao ? "Editar registro" : "Controle do dia";
  formSubtitle.textContent = emEdicao
    ? "Altere os dados do registro selecionado e salve novamente."
    : "Preencha os nomes e a condição por período.";
}

function renderizarLista(registros) {
  lista.innerHTML = "";

  if (!registros.length) {
    lista.innerHTML = `
      <li class="empty-state">
        <strong>Nenhum registro encontrado.</strong>
        <span>Os registros salvos aparecerão aqui em tempo real.</span>
      </li>
    `;
    return;
  }

  registros.forEach((dados) => {
    const li = document.createElement("li");
    li.innerHTML = montarCard(dados);
    lista.appendChild(li);
  });
}

// =========================
// SALVAR / EDITAR
// =========================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  aplicarRegrasHorario();

  const dados = montarDadosFormulario();
  const erroValidacao = validarDados(dados);

  if (erroValidacao) {
    setMensagem(erroValidacao, true);
    alert(erroValidacao);
    return;
  }

  const docId = editingDocId || dados.dataRegistro;
  const docRef = doc(db, "status", docId);

  try {
    submitBtn.disabled = true;
    setMensagem(editingDocId ? "Atualizando registro..." : "Salvando registro...");

    await setDoc(
      docRef,
      {
        ...dados,
        dataRegistro: docId,
        ...(editingDocId ? {} : { criadoEm: serverTimestamp() }),
        atualizadoEm: serverTimestamp()
      },
      { merge: true }
    );

    setMensagem(
      editingDocId
        ? `Registro do dia ${formatarDataBR(docId)} atualizado com sucesso.`
        : `Registro do dia ${formatarDataBR(docId)} salvo com sucesso.`
    );

    limparFormulario();
  } catch (error) {
    console.error("Erro ao salvar no Firebase:", error);
    setMensagem("Erro ao salvar no Firebase.", true);
    alert("Erro ao salvar no Firebase.");
  } finally {
    submitBtn.disabled = false;
  }
});

// =========================
// CANCELAR EDIÇÃO
// =========================
cancelEditBtn.addEventListener("click", () => {
  limparFormulario();
  setMensagem("Edição cancelada.");
});

// =========================
// LISTAGEM TEMPO REAL
// =========================
const colRef = collection(db, "status");
const q = query(colRef, orderBy("dataRegistro", "desc"));

onSnapshot(
  q,
  (snapshot) => {
    currentDocsCache = snapshot.docs.map((registro) => registro.data());
    renderizarLista(currentDocsCache);
    atualizarResumo(currentDocsCache);
  },
  (error) => {
    console.error("Erro ao carregar registros:", error);
    setMensagem("Erro ao carregar registros do Firebase.", true);
  }
);

// =========================
// AÇÕES EDITAR / EXCLUIR
// =========================
lista.addEventListener("click", async (e) => {
  const editBtn = e.target.closest(".btn-edit");
  const deleteBtn = e.target.closest(".btn-delete");

  if (editBtn) {
    const docId = editBtn.dataset.id;
    const dados = currentDocsCache.find((item) => item.dataRegistro === docId);

    if (!dados) {
      setMensagem("Não foi possível localizar o registro para edição.", true);
      return;
    }

    preencherFormulario(dados);
    editingDocId = docId;
    atualizarModoFormulario();
    setMensagem(`Modo edição ativado para ${formatarDataBR(docId)}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (deleteBtn) {
    const docId = deleteBtn.dataset.id;
    const confirmar = confirm(`Deseja realmente excluir o registro do dia ${formatarDataBR(docId)}?`);

    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "status", docId));

      if (editingDocId === docId) {
        limparFormulario();
      }

      setMensagem(`Registro do dia ${formatarDataBR(docId)} excluído com sucesso.`);
    } catch (error) {
      console.error("Erro ao excluir:", error);
      setMensagem("Erro ao excluir registro.", true);
      alert("Erro ao excluir registro.");
    }
  }
});

// =========================
// INICIALIZAÇÃO
// =========================
atualizarModoFormulario();
aplicarRegrasHorario();
setInterval(aplicarRegrasHorario, 60000);
setMensagem("Sistema pronto para uso.");
