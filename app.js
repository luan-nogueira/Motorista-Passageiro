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
let notificacoesAtivas = [];

// =========================
// CONFIG DE LEMBRETES
// =========================
const LEMBRETES = [
  {
    chave: "aposAlmoco",
    titulo: "Após almoço",
    horario: "13:00",
    texto: "Está na hora de preencher o período 'Após almoço'."
  },
  {
    chave: "antesCliente",
    titulo: "Antes de sair do cliente",
    horario: "16:00",
    texto: "Está na hora de preencher o período 'Antes de sair do cliente'."
  }
];

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
  const textoExibicao = nomeOuLista ? escapeHtml(nomeOuLista) : "-";
  const badge = status
    ? `<span class="status-badge ${classeStatus(status)}">${textoStatus(status)}</span>`
    : `<span class="status-badge badge-regular">Pendente</span>`;

  return `
    <div class="period-row ${ruim ? "row-bad" : ""}">
      <div class="period-role">
        <strong>${papel}</strong>
        <span>${textoExibicao}</span>
      </div>
      ${badge}
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

function periodoPreenchido(periodo) {
  const motoristaNome = String(periodo?.motorista?.nome || "").trim();
  const passageirosNomes = String(periodo?.passageiros?.nomes || "").trim();
  return !!motoristaNome && !!passageirosNomes;
}

function algumPeriodoPreenchido(dados) {
  return (
    periodoPreenchido(dados.antesCasa) ||
    periodoPreenchido(dados.aposAlmoco) ||
    periodoPreenchido(dados.antesCliente)
  );
}

function validarPeriodoParcial(periodo, titulo) {
  const motoristaNome = String(periodo?.motorista?.nome || "").trim();
  const passageirosNomes = String(periodo?.passageiros?.nomes || "").trim();

  const motoristaPreenchido = !!motoristaNome;
  const passageirosPreenchidos = !!passageirosNomes;

  if (motoristaPreenchido !== passageirosPreenchidos) {
    return `No período "${titulo}", preencha motorista e passageiros juntos.`;
  }

  return "";
}

function validarDados(dados) {
  if (!dados.dataRegistro) {
    return "Selecione a data.";
  }

  if (!algumPeriodoPreenchido(dados)) {
    return "Preencha pelo menos um período antes de salvar.";
  }

  const erroAntesCasa = validarPeriodoParcial(dados.antesCasa, "Antes de sair de casa");
  if (erroAntesCasa) return erroAntesCasa;

  const erroAposAlmoco = validarPeriodoParcial(dados.aposAlmoco, "Após almoço");
  if (erroAposAlmoco) return erroAposAlmoco;

  const erroAntesCliente = validarPeriodoParcial(dados.antesCliente, "Antes de sair do cliente");
  if (erroAntesCliente) return erroAntesCliente;

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
}

function limparFormulario() {
  form.reset();
  recordDate.value = hojeISO();
  editingDocId = null;
  atualizarModoFormulario();
}

function atualizarModoFormulario() {
  const emEdicao = !!editingDocId;

  submitBtn.textContent = emEdicao ? "Atualizar registro" : "Salvar registro do dia";
  cancelEditBtn.hidden = !emEdicao;

  formTitle.textContent = emEdicao ? "Editar registro" : "Controle do dia";
  formSubtitle.textContent = emEdicao
    ? "Altere os dados do registro selecionado e salve novamente."
    : "Você pode salvar parcialmente e completar os próximos períodos depois.";
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
// NOTIFICAÇÕES / LEMBRETES
// =========================
function getRegistroHoje() {
  const hoje = hojeISO();
  return currentDocsCache.find((item) => item.dataRegistro === hoje) || null;
}

function periodoDoRegistroEstaPreenchido(registro, chavePeriodo) {
  if (!registro) return false;
  return periodoPreenchido(registro[chavePeriodo]);
}

function horarioHojeData(hhmm) {
  const [hora, minuto] = hhmm.split(":").map(Number);
  const data = new Date();
  data.setHours(hora, minuto, 0, 0);
  return data;
}

function limparAgendamentosNotificacao() {
  notificacoesAtivas.forEach((id) => clearTimeout(id));
  notificacoesAtivas = [];
}

function salvarMarcacaoNotificacao(chave) {
  const dia = hojeISO();
  localStorage.setItem(`notificado_${chave}_${dia}`, "sim");
}

function jaNotificouHoje(chave) {
  const dia = hojeISO();
  return localStorage.getItem(`notificado_${chave}_${dia}`) === "sim";
}

function solicitarPermissaoNotificacao() {
  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function mostrarNotificacao(titulo, corpo) {
  setMensagem(corpo);

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(titulo, {
        body: corpo,
        icon: ""
      });
    } catch {
      alert(corpo);
    }
  } else {
    alert(corpo);
  }
}

function verificarELembrarAgora() {
  const registroHoje = getRegistroHoje();
  const agora = new Date();

  LEMBRETES.forEach((lembrete) => {
    const horarioLiberado = horarioHojeData(lembrete.horario);

    if (agora < horarioLiberado) return;
    if (jaNotificouHoje(lembrete.chave)) return;
    if (periodoDoRegistroEstaPreenchido(registroHoje, lembrete.chave)) {
      salvarMarcacaoNotificacao(lembrete.chave);
      return;
    }

    mostrarNotificacao("Lembrete de preenchimento", lembrete.texto);
    salvarMarcacaoNotificacao(lembrete.chave);
  });
}

function agendarLembretesDoDia() {
  limparAgendamentosNotificacao();

  const registroHoje = getRegistroHoje();
  const agora = new Date();

  LEMBRETES.forEach((lembrete) => {
    if (jaNotificouHoje(lembrete.chave)) return;
    if (periodoDoRegistroEstaPreenchido(registroHoje, lembrete.chave)) {
      salvarMarcacaoNotificacao(lembrete.chave);
      return;
    }

    const dataLembrete = horarioHojeData(lembrete.horario);
    const diferenca = dataLembrete.getTime() - agora.getTime();

    if (diferenca <= 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const registroAtual = getRegistroHoje();

      if (!periodoDoRegistroEstaPreenchido(registroAtual, lembrete.chave) && !jaNotificouHoje(lembrete.chave)) {
        mostrarNotificacao("Lembrete de preenchimento", lembrete.texto);
        salvarMarcacaoNotificacao(lembrete.chave);
      }
    }, diferenca);

    notificacoesAtivas.push(timeoutId);
  });
}

function atualizarLembretes() {
  verificarELembrarAgora();
  agendarLembretesDoDia();
}

// =========================
// SALVAR / EDITAR
// =========================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

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
    atualizarLembretes();
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
    atualizarLembretes();
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
      atualizarLembretes();
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
solicitarPermissaoNotificacao();
atualizarLembretes();
setInterval(verificarELembrarAgora, 60000);
setMensagem("Sistema pronto para uso.");
