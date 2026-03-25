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
  appId: "1:988614619560:web:f2521ff21aae96aa486d9d",
  measurementId: "G-S1T8661860"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =========================
// CHECKLIST
// =========================
const CHECKLIST_SECTIONS = [
  {
    id: "condicoes",
    titulo: "Condições Físicas e Mentais",
    itens: [
      { chave: "descansado", label: "Estou descansado (mínimo 6–8h de sono)", alertOn: "nao" },
      { chave: "alcool", label: "Estou sob efeito de álcool", alertOn: "sim" },
      { chave: "drogas", label: "Estou sob efeito de drogas ilícitas", alertOn: "sim" },
      { chave: "medicamentos", label: "Estou sob efeito de medicamentos que afetem reflexos", alertOn: "sim" },
      { chave: "condicoesFisicas", label: "Estou em boas condições físicas", alertOn: "nao" },
      { chave: "emocionalmenteEstavel", label: "Estou emocionalmente estável", alertOn: "nao" },
      { chave: "oculosLentes", label: "Estou utilizando óculos/lentes (se obrigatório)", obrigatorio: false, alertOn: null }
    ]
  }
];

// =========================
// ELEMENTOS
// =========================
const form = document.getElementById("formStatus");
const lista = document.getElementById("lista");
const saveMsg = document.getElementById("saveMsg");
const recordDate = document.getElementById("recordDate");

const fadigaExtra = document.getElementById("fadigaExtra");
const fadigaTempo = document.getElementById("fadiga_tempo");
const fadigaPontuacaoEl = document.getElementById("fadigaPontuacao");

const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const totalRegistrosEl = document.getElementById("totalRegistros");
const totalAlertasEl = document.getElementById("totalAlertas");
const ultimaAtualizacaoEl = document.getElementById("ultimaAtualizacao");

const detailsModal = document.getElementById("detailsModal");
const modalBody = document.getElementById("modalBody");
const modalTitle = document.getElementById("modalTitle");
const modalSubtitle = document.getElementById("modalSubtitle");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalEditBtn = document.getElementById("modalEditBtn");
const modalDeleteBtn = document.getElementById("modalDeleteBtn");

let editingDocId = null;
let currentDocsCache = [];
let openedDocId = null;

// =========================
// DATA E HORA
// =========================
function agoraLocalInput() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

recordDate.value = agoraLocalInput();

// =========================
// HELPERS
// =========================
function setMensagem(msg, erro = false) {
  saveMsg.textContent = msg;
  saveMsg.className = erro ? "message-box error" : "message-box success";
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pegarValor(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function formatarDataHoraBR(valor) {
  if (!valor) return "--";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return String(valor).replace("T", " ");
  }

  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function formatarTimestamp(timestamp) {
  if (!timestamp) return "--";

  const data = typeof timestamp?.toDate === "function"
    ? timestamp.toDate()
    : new Date(timestamp);

  if (Number.isNaN(data.getTime())) return "--";

  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function encontrarItemConfig(chave) {
  for (const section of CHECKLIST_SECTIONS) {
    const item = section.itens.find((i) => i.chave === chave);
    if (item) return item;
  }
  return null;
}

function itemTemAlertaPorChave(chave, itemData) {
  const config = encontrarItemConfig(chave);
  if (!config) return false;

  if (config.alertOn === null || config.alertOn === undefined || config.alertOn === "") {
    return false;
  }

  const resposta = String(itemData?.resposta || "").toLowerCase();
  if (!resposta) return false;

  return resposta === String(config.alertOn).toLowerCase();
}

function fadigaTemAlerta(dados) {
  const fadiga = dados?.fadiga || {};
  return (
    String(fadiga?.recente || "").toLowerCase() === "sim" ||
    String(fadiga?.energia || "").toLowerCase() === "sim" ||
    Number(fadiga?.pontuacao || 0) > 0
  );
}

function registroTemAlerta(dados) {
  const checklistComAlerta = Object.entries(dados?.itens || {}).some(([chave, item]) =>
    itemTemAlertaPorChave(chave, item)
  );

  return checklistComAlerta || fadigaTemAlerta(dados);
}

function contarAlertas(registros) {
  return registros.filter((registro) => registroTemAlerta(registro)).length;
}

function badgeClass(chave, resposta) {
  const itemFake = { resposta };
  return itemTemAlertaPorChave(chave, itemFake) ? "badge-nao" : "badge-sim";
}

function badgeLabel(resposta) {
  if (String(resposta).toLowerCase() === "sim") return "Sim";
  if (String(resposta).toLowerCase() === "nao") return "Não";
  return "--";
}

function obterRespostaPorName(name) {
  const selecionado = document.querySelector(`input[name="${name}"]:checked`);
  return selecionado ? selecionado.value : "";
}

function fadigaRequerComplemento() {
  const recente = obterRespostaPorName("fadiga_recente_resposta");
  const energia = obterRespostaPorName("fadiga_energia_resposta");
  return recente === "sim" || energia === "sim";
}

function calcularPontuacaoFadigaComDados(fadiga) {
  return ["mais3h", "esforco", "prazer"].reduce((total, chave) => {
    return total + (String(fadiga?.[chave] || "").toLowerCase() === "sim" ? 1 : 0);
  }, 0);
}

function obterDadosFadiga() {
  const fadiga = {
    recente: obterRespostaPorName("fadiga_recente_resposta"),
    energia: obterRespostaPorName("fadiga_energia_resposta"),
    tempo: pegarValor("fadiga_tempo"),
    mais3h: obterRespostaPorName("fadiga_3h_resposta"),
    esforco: obterRespostaPorName("fadiga_esforco_resposta"),
    prazer: obterRespostaPorName("fadiga_prazer_resposta")
  };

  fadiga.pontuacao = calcularPontuacaoFadigaComDados(fadiga);
  return fadiga;
}

function atualizarPontuacaoFadiga() {
  const fadiga = obterDadosFadiga();
  fadigaPontuacaoEl.textContent = String(fadiga.pontuacao);
}

// =========================
// FORMULÁRIO
// =========================
function criarItemChecklist(item) {
  return `
    <article class="check-item" id="card_${item.chave}">
      <div class="check-item-head">
        <div class="check-item-title">${escapeHtml(item.label)}</div>
        <div class="check-options">
          <label class="option-pill">
            <input type="radio" name="${item.chave}_resposta" value="sim" />
            Sim
          </label>

          <label class="option-pill">
            <input type="radio" name="${item.chave}_resposta" value="nao" />
            Não
          </label>
        </div>
      </div>

      <div class="field full">
        <label for="${item.chave}_obs">Observações</label>
        <textarea
          id="${item.chave}_obs"
          placeholder="Descreva algo somente se necessário."
        ></textarea>
      </div>
    </article>
  `;
}

function renderizarFormularioChecklist() {
  CHECKLIST_SECTIONS.forEach((section) => {
    const alvo = document.getElementById(`grupo-${section.id}`);
    if (!alvo) return;

    alvo.innerHTML = section.itens
      .map((item) => criarItemChecklist(item))
      .join("");
  });
}

renderizarFormularioChecklist();

// =========================
// VALIDAÇÃO
// =========================
function obterRespostaItem(chave) {
  const selecionado = document.querySelector(`input[name="${chave}_resposta"]:checked`);
  return selecionado ? selecionado.value : "";
}

function montarItensChecklist() {
  const itens = {};

  CHECKLIST_SECTIONS.forEach((section) => {
    section.itens.forEach((item) => {
      itens[item.chave] = {
        resposta: obterRespostaItem(item.chave),
        observacoes: pegarValor(`${item.chave}_obs`)
      };
    });
  });

  return itens;
}

function montarDadosFormulario() {
  const fadiga = obterDadosFadiga();

  return {
    dataRegistro: recordDate.value,
    itens: montarItensChecklist(),
    fadiga
  };
}

function validarDados(dados) {
  if (!dados.dataRegistro) return "Selecione a data e hora.";

  let semResposta = false;

  CHECKLIST_SECTIONS.forEach((section) => {
    section.itens.forEach((item) => {
      const obrigatorio = item.obrigatorio !== false;
      const resposta = dados.itens?.[item.chave]?.resposta || "";

      if (obrigatorio && !resposta) {
        semResposta = true;
      }
    });
  });

  if (semResposta) return "Responda TODOS os itens obrigatórios do checklist.";

  if (!dados.fadiga?.recente || !dados.fadiga?.energia) {
    return "Responda as duas perguntas iniciais da Avaliação de Fadiga.";
  }

  if (fadigaRequerComplemento()) {
    if (!dados.fadiga?.tempo) {
      return "Informe há quanto tempo o cansaço ou a falta de energia está ocorrendo.";
    }

    if (!dados.fadiga?.mais3h || !dados.fadiga?.esforco || !dados.fadiga?.prazer) {
      return "Responda todas as perguntas complementares da Avaliação de Fadiga.";
    }
  }

  return "";
}

// =========================
// PREENCHER / LIMPAR
// =========================
function preencherFormulario(dados) {
  recordDate.value = dados?.dataRegistro || agoraLocalInput();

  CHECKLIST_SECTIONS.forEach((section) => {
    section.itens.forEach((item) => {
      const valor = String(dados?.itens?.[item.chave]?.resposta || "").toLowerCase();

      const radios = document.querySelectorAll(`input[name="${item.chave}_resposta"]`);
      radios.forEach((r) => {
        r.checked = r.value === valor;
      });

      const obs = document.getElementById(`${item.chave}_obs`);
      if (obs) {
        obs.value = dados?.itens?.[item.chave]?.observacoes || "";
      }

      atualizarVisualAlertaItem(item.chave);
    });
  });

  preencherFadiga(dados?.fadiga || {});
  atualizarVisualFadiga();
}

function limparFormulario() {
  form.reset();
  recordDate.value = agoraLocalInput();
  editingDocId = null;
  atualizarModoFormulario();

  CHECKLIST_SECTIONS.forEach((section) => {
    section.itens.forEach((item) => {
      const radios = document.querySelectorAll(`input[name="${item.chave}_resposta"]`);
      radios.forEach((r) => {
        r.checked = false;
      });

      const obs = document.getElementById(`${item.chave}_obs`);
      if (obs) obs.value = "";

      atualizarVisualAlertaItem(item.chave);
    });
  });

  limparFadiga();
}

function atualizarModoFormulario() {
  const emEdicao = !!editingDocId;

  submitBtn.textContent = emEdicao ? "Atualizar checklist" : "Salvar checklist";
  cancelEditBtn.hidden = !emEdicao;

  formTitle.textContent = emEdicao ? "Editar checklist" : "Checklist do dia";
  formSubtitle.textContent = emEdicao
    ? "Altere os dados do registro selecionado e salve novamente."
    : "Preencha as condições do motorista e a avaliação de fadiga.";
}

// =========================
// ALERTA VISUAL
// =========================
function atualizarVisualAlertaItem(chave) {
  const card = document.getElementById(`card_${chave}`);
  const resposta = obterRespostaItem(chave);

  if (!card) return;

  if (!resposta) {
    card.classList.remove("alert");
    return;
  }

  card.classList.toggle(
    "alert",
    itemTemAlertaPorChave(chave, { resposta })
  );
}

// =========================
// FADIGA
// =========================
function marcarRadio(name, valor) {
  const radios = document.querySelectorAll(`input[name="${name}"]`);
  radios.forEach((radio) => {
    radio.checked = radio.value === String(valor || "").toLowerCase();
  });
}

function limparRadios(name) {
  const radios = document.querySelectorAll(`input[name="${name}"]`);
  radios.forEach((radio) => {
    radio.checked = false;
  });
}

function preencherFadiga(fadiga) {
  marcarRadio("fadiga_recente_resposta", fadiga?.recente);
  marcarRadio("fadiga_energia_resposta", fadiga?.energia);
  marcarRadio("fadiga_3h_resposta", fadiga?.mais3h);
  marcarRadio("fadiga_esforco_resposta", fadiga?.esforco);
  marcarRadio("fadiga_prazer_resposta", fadiga?.prazer);
  fadigaTempo.value = fadiga?.tempo || "";
  atualizarPontuacaoFadiga();
  atualizarExibicaoFadigaExtra();
}

function limparFadiga() {
  limparRadios("fadiga_recente_resposta");
  limparRadios("fadiga_energia_resposta");
  limparRadios("fadiga_3h_resposta");
  limparRadios("fadiga_esforco_resposta");
  limparRadios("fadiga_prazer_resposta");
  fadigaTempo.value = "";
  atualizarExibicaoFadigaExtra();
  atualizarPontuacaoFadiga();
  atualizarVisualFadiga();
}

function atualizarExibicaoFadigaExtra() {
  const mostrar = fadigaRequerComplemento();
  fadigaExtra.classList.toggle("hidden", !mostrar);

  if (!mostrar) {
    limparRadios("fadiga_3h_resposta");
    limparRadios("fadiga_esforco_resposta");
    limparRadios("fadiga_prazer_resposta");
    fadigaTempo.value = "";
  }

  atualizarPontuacaoFadiga();
}

function atualizarVisualFadiga() {
  const fadiga = obterDadosFadiga();

  const cardRecente = document.getElementById("card_fadiga_recente");
  const cardEnergia = document.getElementById("card_fadiga_energia");
  const cardTempo = document.getElementById("card_fadiga_tempo");
  const card3h = document.getElementById("card_fadiga_3h");
  const cardEsforco = document.getElementById("card_fadiga_esforco");
  const cardPrazer = document.getElementById("card_fadiga_prazer");
  const cardPontuacao = document.getElementById("card_fadiga_pontuacao");

  const highlight = (card, ativo) => {
    if (!card) return;
    card.classList.toggle("warning", !!ativo);
  };

  highlight(cardRecente, fadiga.recente === "sim");
  highlight(cardEnergia, fadiga.energia === "sim");
  highlight(cardTempo, fadigaRequerComplemento() && !!fadiga.tempo);
  highlight(card3h, fadiga.mais3h === "sim");
  highlight(cardEsforco, fadiga.esforco === "sim");
  highlight(cardPrazer, fadiga.prazer === "sim");
  highlight(cardPontuacao, fadiga.pontuacao > 0);
}

function registrarEventosFadiga() {
  const radiosPrincipais = [
    "fadiga_recente_resposta",
    "fadiga_energia_resposta"
  ];

  const radiosComplementares = [
    "fadiga_3h_resposta",
    "fadiga_esforco_resposta",
    "fadiga_prazer_resposta"
  ];

  radiosPrincipais.forEach((name) => {
    document.querySelectorAll(`input[name="${name}"]`).forEach((radio) => {
      radio.addEventListener("change", () => {
        atualizarExibicaoFadigaExtra();
        atualizarVisualFadiga();
      });
    });
  });

  radiosComplementares.forEach((name) => {
    document.querySelectorAll(`input[name="${name}"]`).forEach((radio) => {
      radio.addEventListener("change", () => {
        atualizarPontuacaoFadiga();
        atualizarVisualFadiga();
      });
    });
  });

  fadigaTempo.addEventListener("input", () => {
    atualizarVisualFadiga();
  });

  atualizarExibicaoFadigaExtra();
  atualizarVisualFadiga();
}

function montarGrupoFadigaDetalhe(fadiga) {
  const pontuacao = Number(fadiga?.pontuacao || 0);

  return `
    <section class="detail-group">
      <h4>Avaliação de Fadiga</h4>

      <div class="detail-item">
        <div class="detail-item-main">
          <div class="detail-item-title">Você notou que tem se sentido cansado recentemente?</div>
        </div>
        <span class="status-badge ${String(fadiga?.recente || "").toLowerCase() === "sim" ? "badge-warning" : "badge-sim"}">${badgeLabel(fadiga?.recente)}</span>
      </div>

      <div class="detail-item">
        <div class="detail-item-main">
          <div class="detail-item-title">Você tem se sentido com falta de energia?</div>
        </div>
        <span class="status-badge ${String(fadiga?.energia || "").toLowerCase() === "sim" ? "badge-warning" : "badge-sim"}">${badgeLabel(fadiga?.energia)}</span>
      </div>

      ${
        fadigaRequerComplementoComDados(fadiga)
          ? `
            <div class="detail-item">
              <div class="detail-item-main">
                <div class="detail-item-title">Há quanto tempo isso está ocorrendo?</div>
                <div class="detail-item-obs">${escapeHtml(fadiga?.tempo || "--")}</div>
              </div>
            </div>

            <div class="detail-item">
              <div class="detail-item-main">
                <div class="detail-item-title">Mais do que 3 horas no dia anterior?</div>
              </div>
              <span class="status-badge ${String(fadiga?.mais3h || "").toLowerCase() === "sim" ? "badge-warning" : "badge-sim"}">${badgeLabel(fadiga?.mais3h)}</span>
            </div>

            <div class="detail-item">
              <div class="detail-item-main">
                <div class="detail-item-title">Teve de se esforçar muito para conseguir fazer as coisas?</div>
              </div>
              <span class="status-badge ${String(fadiga?.esforco || "").toLowerCase() === "sim" ? "badge-warning" : "badge-sim"}">${badgeLabel(fadiga?.esforco)}</span>
            </div>

            <div class="detail-item">
              <div class="detail-item-main">
                <div class="detail-item-title">Sentiu cansaço fazendo coisas que gosta?</div>
              </div>
              <span class="status-badge ${String(fadiga?.prazer || "").toLowerCase() === "sim" ? "badge-warning" : "badge-sim"}">${badgeLabel(fadiga?.prazer)}</span>
            </div>
          `
          : `
            <div class="detail-item">
              <div class="detail-item-main">
                <div class="detail-item-title">Perguntas complementares</div>
                <div class="detail-item-obs">Não foi necessário responder, pois as perguntas iniciais foram marcadas como "Não".</div>
              </div>
            </div>
          `
      }

      <div class="detail-item">
        <div class="detail-item-main">
          <div class="detail-item-title">Pontuação da fadiga</div>
          <div class="detail-item-obs">Soma de respostas "Sim" nas 3 perguntas complementares.</div>
        </div>
        <span class="status-badge ${pontuacao > 0 ? "badge-warning" : "badge-sim"}">${pontuacao}</span>
      </div>
    </section>
  `;
}

function fadigaRequerComplementoComDados(fadiga) {
  return (
    String(fadiga?.recente || "").toLowerCase() === "sim" ||
    String(fadiga?.energia || "").toLowerCase() === "sim"
  );
}

// =========================
// EVENTOS CHECKLIST
// =========================
function registrarEventosChecklist() {
  CHECKLIST_SECTIONS.forEach((section) => {
    section.itens.forEach((item) => {
      const radios = document.querySelectorAll(`input[name="${item.chave}_resposta"]`);
      radios.forEach((radio) => {
        radio.addEventListener("change", () => atualizarVisualAlertaItem(item.chave));
      });

      atualizarVisualAlertaItem(item.chave);
    });
  });
}

registrarEventosChecklist();
registrarEventosFadiga();

// =========================
// LISTA
// =========================
function montarCard(dados) {
  const fadigaInfo = Number(dados?.fadiga?.pontuacao || 0) > 0
    ? ` • Fadiga: ${Number(dados?.fadiga?.pontuacao || 0)}`
    : "";

  const titulo = `Checklist de ${formatarDataHoraBR(dados.dataRegistro)}`;

  return `
    <article class="status-card status-card-clickable" data-open-id="${escapeHtml(dados.dataRegistro)}">
      <div class="status-card-mini-content">
        <div>
          <h3 class="status-card-title">${titulo}</h3>
          <p class="status-card-subtitle">
            Registro preenchido${fadigaInfo}
          </p>
        </div>
        <span class="card-date">${formatarTimestamp(dados.atualizadoEm || dados.criadoEm)}</span>
      </div>
    </article>
  `;
}

function renderizarLista(registros) {
  lista.innerHTML = "";

  if (!registros.length) {
    lista.innerHTML = `
      <li class="empty-state">
        <strong>Nenhum checklist encontrado.</strong>
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

function atualizarResumo(registros) {
  totalRegistrosEl.textContent = String(registros.length);
  totalAlertasEl.textContent = String(contarAlertas(registros));

  const primeiro = registros[0];
  ultimaAtualizacaoEl.textContent = primeiro
    ? formatarTimestamp(primeiro.atualizadoEm || primeiro.criadoEm)
    : "--";
}

// =========================
// MODAL
// =========================
function montarItemDetalhe(itemConfig, itemData) {
  const resposta = itemData?.resposta || "";
  const obs = itemData?.observacoes || "";

  return `
    <div class="detail-item">
      <div class="detail-item-main">
        <div class="detail-item-title">${escapeHtml(itemConfig.label)}</div>
        ${obs ? `<div class="detail-item-obs"><strong>Observações:</strong> ${escapeHtml(obs)}</div>` : ""}
      </div>
      <span class="status-badge ${badgeClass(itemConfig.chave, resposta)}">${badgeLabel(resposta)}</span>
    </div>
  `;
}

function montarGrupoDetalhe(section, dados) {
  return `
    <section class="detail-group">
      <h4>${escapeHtml(section.titulo)}</h4>
      ${section.itens.map((item) => montarItemDetalhe(item, dados?.itens?.[item.chave])).join("")}
    </section>
  `;
}

function montarDetalhesModal(dados) {
  return `
    <div class="detail-grid">
      <div class="detail-box">
        <span>Data e Hora</span>
        <strong>${formatarDataHoraBR(dados.dataRegistro)}</strong>
      </div>
      <div class="detail-box">
        <span>Última atualização</span>
        <strong>${formatarTimestamp(dados.atualizadoEm || dados.criadoEm)}</strong>
      </div>
    </div>

    ${CHECKLIST_SECTIONS.map((section) => montarGrupoDetalhe(section, dados)).join("")}

    ${montarGrupoFadigaDetalhe(dados?.fadiga || {})}
  `;
}

function abrirModal(docId) {
  const dados = currentDocsCache.find((item) => item.dataRegistro === docId);
  if (!dados) return;

  openedDocId = docId;
  modalTitle.textContent = "Detalhes do checklist";
  modalSubtitle.textContent = `Registro de ${formatarDataHoraBR(dados.dataRegistro)}`;
  modalBody.innerHTML = montarDetalhesModal(dados);
  detailsModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function fecharModal() {
  openedDocId = null;
  detailsModal.classList.add("hidden");
  document.body.style.overflow = "";
}

closeModalBtn.addEventListener("click", fecharModal);

detailsModal.addEventListener("click", (e) => {
  if (e.target === detailsModal) {
    fecharModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !detailsModal.classList.contains("hidden")) {
    fecharModal();
  }
});

modalEditBtn.addEventListener("click", () => {
  if (!openedDocId) return;

  const dados = currentDocsCache.find((item) => item.dataRegistro === openedDocId);
  if (!dados) return;

  preencherFormulario(dados);
  editingDocId = openedDocId;
  atualizarModoFormulario();
  setMensagem(`Modo edição ativado para ${formatarDataHoraBR(openedDocId)}.`);
  fecharModal();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

modalDeleteBtn.addEventListener("click", async () => {
  if (!openedDocId) return;

  const confirmar = confirm(`Deseja realmente excluir o checklist de ${formatarDataHoraBR(openedDocId)}?`);
  if (!confirmar) return;

  try {
    await deleteDoc(doc(db, "status", openedDocId));

    if (editingDocId === openedDocId) {
      limparFormulario();
    }

    setMensagem(`Checklist de ${formatarDataHoraBR(openedDocId)} excluído com sucesso.`);
    fecharModal();
  } catch (error) {
    console.error("Erro ao excluir checklist:", error);
    setMensagem(`Erro ao excluir checklist: ${error.message}`, true);
    alert(`Erro ao excluir checklist: ${error.message}`);
  }
});

// =========================
// SALVAR
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
    setMensagem(editingDocId ? "Atualizando checklist..." : "Salvando checklist...");

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
        ? `Checklist de ${formatarDataHoraBR(docId)} atualizado com sucesso.`
        : `Checklist de ${formatarDataHoraBR(docId)} salvo com sucesso.`
    );

    limparFormulario();
  } catch (error) {
    console.error("Erro ao salvar no Firebase:", error);
    setMensagem(`Erro ao salvar no Firebase: ${error.message}`, true);
    alert(`Erro ao salvar no Firebase: ${error.message}`);
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
// TEMPO REAL
// =========================
const colRef = collection(db, "status");
const q = query(colRef, orderBy("dataRegistro", "desc"));

onSnapshot(
  q,
  (snapshot) => {
    currentDocsCache = snapshot.docs.map((registro) => registro.data());
    renderizarLista(currentDocsCache);
    atualizarResumo(currentDocsCache);

    if (openedDocId) {
      const aindaExiste = currentDocsCache.find((item) => item.dataRegistro === openedDocId);
      if (aindaExiste) {
        abrirModal(openedDocId);
      } else {
        fecharModal();
      }
    }
  },
  (error) => {
    console.error("Erro ao carregar registros:", error);
    setMensagem(`Erro ao carregar registros: ${error.message}`, true);
  }
);

// =========================
// CLICK NA LISTA
// =========================
lista.addEventListener("click", (e) => {
  const card = e.target.closest("[data-open-id]");
  if (!card) return;

  const docId = card.getAttribute("data-open-id");
  if (!docId) return;

  abrirModal(docId);
});

// =========================
// INICIALIZAÇÃO
// =========================
atualizarModoFormulario();
atualizarExibicaoFadigaExtra();
atualizarPontuacaoFadiga();
atualizarVisualFadiga();
setMensagem("Sistema pronto para uso.");
