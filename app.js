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
// CONFIG
// =========================
const PAGE_SIZE = 5;
const SENHA_GESTOR = "anglo2026";

const CHECKLIST_SECTIONS = [
  {
    id: "condicoes",
    titulo: "Condições Físicas e Mentais",
    itens: [
      {
        chave: "descansado",
        label: "Quantas horas você dormiu na última noite?",
        alertOn: null,
        opcoes: [
          { valor: "Menos de 4 horas", label: "Menos de 4 horas" },
          { valor: "4 a 6 horas", label: "4 a 6 horas" },
          { valor: "6 a 8 horas", label: "6 a 8 horas" },
          { valor: "Mais de 8 horas", label: "Mais de 8 horas" }
        ]
      },
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
const responsavel = document.getElementById("responsavel");

const fadigaExtra = document.getElementById("fadigaExtra");
const fadigaTempo = document.getElementById("fadiga_tempo");
const fadigaPontuacaoEl = document.getElementById("fadigaPontuacao");

const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const totalRegistrosEl = document.getElementById("totalRegistros");
const totalAlertasEl = document.getElementById("totalAlertas");
const totalRiscoAltoEl = document.getElementById("totalRiscoAlto");
const totalHojeEl = document.getElementById("totalHoje");
const mediaFadigaEl = document.getElementById("mediaFadiga");
const ultimaAtualizacaoEl = document.getElementById("ultimaAtualizacao");

const filtroNomeEl = document.getElementById("filtroNome");
const filtroStatusEl = document.getElementById("filtroStatus");
const filtroDataInicioEl = document.getElementById("filtroDataInicio");
const filtroDataFimEl = document.getElementById("filtroDataFim");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");
const btnVerMais = document.getElementById("btnVerMais");
const btnVerMenos = document.getElementById("btnVerMenos");
const btnExportarExcel = document.getElementById("btnExportarExcel");

const detailsModal = document.getElementById("detailsModal");
const modalBody = document.getElementById("modalBody");
const modalTitle = document.getElementById("modalTitle");
const modalSubtitle = document.getElementById("modalSubtitle");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalEditBtn = document.getElementById("modalEditBtn");
const modalDeleteBtn = document.getElementById("modalDeleteBtn");

const welcomeScreen = document.getElementById("welcomeScreen");
const appShell = document.getElementById("appShell");
const enterSystemBtn = document.getElementById("enterSystemBtn");

const btnToggleTheme = document.getElementById("btnToggleTheme");
const btnToggleCharts = document.getElementById("btnToggleCharts");
const chartsPanel = document.getElementById("chartsPanel");

const insightStatus = document.getElementById("insightStatus");
const insightResumo = document.getElementById("insightResumo");
const insightAcao = document.getElementById("insightAcao");

const toastEl = document.getElementById("toast");


// =========================
// ESTADO
// =========================
let editingDocId = null;
let currentDocsCache = [];
let openedDocId = null;
let visibleCount = PAGE_SIZE;
let chartRegistrosPorDia = null;
let chartStatusGeral = null;
let chartDistFadiga = null;
let chartFatoresRisco = null;

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
  showToast(msg, erro);
}

function showToast(message, isError = false) {
  if (!toastEl) return;

  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  toastEl.style.background = isError ? "#991b1b" : "#0f172a";

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toastEl.classList.add("hidden");
  }, 2600);
}

function abrirSistema() {
  welcomeScreen?.classList.add("hidden");
  appShell?.classList.remove("hidden");
  showToast("Sistema carregado com sucesso.");
}

function aplicarTemaSalvo() {
  const tema = localStorage.getItem("safe_theme");
  const dark = tema === "dark";
  document.body.classList.toggle("dark", dark);
  if (btnToggleTheme) btnToggleTheme.textContent = dark ? "☀️" : "🌙";
}

function alternarTema() {
  const dark = document.body.classList.toggle("dark");
  localStorage.setItem("safe_theme", dark ? "dark" : "light");
  if (btnToggleTheme) btnToggleTheme.textContent = dark ? "☀️" : "🌙";
  showToast(dark ? "Modo escuro ativado." : "Modo claro ativado.");
}

function alternarGraficos() {
  if (!chartsPanel || !btnToggleCharts) return;

  const escondido = chartsPanel.classList.contains("hidden");
  chartsPanel.classList.toggle("hidden");
  btnToggleCharts.textContent = escondido ? "📊 Ocultar gráficos" : "📊 Gráficos";

  if (escondido) {
    renderizarGraficos(getRegistrosFiltrados());
    showToast("Gráficos exibidos.");
  } else {
    showToast("Gráficos ocultados.");
  }
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

function formatarDataArquivo(date = new Date()) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  const hora = String(date.getHours()).padStart(2, "0");
  const minuto = String(date.getMinutes()).padStart(2, "0");
  return `${ano}-${mes}-${dia}_${hora}-${minuto}`;
}

function mesmaDataLocal(dataA, dataB) {
  const a = new Date(dataA);
  const b = new Date(dataB);

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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

function calcularPontuacaoFadigaComDados(fadiga) {
  return ["mais3h", "esforco", "prazer"].reduce((total, chave) => {
    return total + (String(fadiga?.[chave] || "").toLowerCase() === "sim" ? 1 : 0);
  }, 0);
}

function fadigaTemAlerta(dados) {
  const fadiga = dados?.fadiga || {};
  return (
    String(fadiga?.recente || "").toLowerCase() === "sim" ||
    String(fadiga?.energia || "").toLowerCase() === "sim" ||
    Number(fadiga?.pontuacao || 0) > 0
  );
}

function riscoAlto(dados) {
  return Number(dados?.fadiga?.pontuacao || 0) >= 2;
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

function contarRiscoAlto(registros) {
  return registros.filter((registro) => riscoAlto(registro)).length;
}

function badgeClass(chave, resposta) {
  if (chave === "descansado") {
    if (resposta === "Menos de 4 horas" || resposta === "4 a 6 horas") return "badge-warning";
    return "badge-sim";
  }
  const itemFake = { resposta };
  return itemTemAlertaPorChave(chave, itemFake) ? "badge-nao" : "badge-sim";
}

function badgeLabel(resposta) {
  if (!resposta) return "--";
  const respLower = String(resposta).toLowerCase();
  if (respLower === "sim") return "Sim";
  if (respLower === "nao") return "Não";
  return resposta;
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

function fadigaRequerComplementoComDados(fadiga) {
  return (
    String(fadiga?.recente || "").toLowerCase() === "sim" ||
    String(fadiga?.energia || "").toLowerCase() === "sim"
  );
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
  const pontuacao = fadiga.pontuacao;
  fadigaPontuacaoEl.textContent = String(pontuacao);
  fadigaPontuacaoEl.classList.toggle("high", pontuacao >= 2);
}

// =========================
// FORMULÁRIO
// =========================
function criarItemChecklist(item) {
  const optionsHtml = item.opcoes 
    ? item.opcoes.map(opt => `
        <label class="option-pill">
          <input type="radio" name="${item.chave}_resposta" value="${escapeHtml(opt.valor)}" />
          ${escapeHtml(opt.label)}
        </label>
      `).join("")
    : `
        <label class="option-pill">
          <input type="radio" name="${item.chave}_resposta" value="sim" />
          Sim
        </label>

        <label class="option-pill">
          <input type="radio" name="${item.chave}_resposta" value="nao" />
          Não
        </label>
      `;

  const obsLabel = item.chave === "descansado" ? "Justificativa" : "Observações";
  const placeholder = item.chave === "descansado" 
    ? "Descreva o motivo de ter dormido menos de 4 horas." 
    : "Descreva algo somente se necessário.";

  return `
    <article class="check-item" id="card_${item.chave}">
      <div class="check-item-head">
        <div class="check-item-title">${escapeHtml(item.label)}</div>
        <div class="check-options">
          ${optionsHtml}
        </div>
      </div>

      <div class="field full ${item.chave === "descansado" ? "hidden" : ""}" id="container_obs_${item.chave}">
        <label for="${item.chave}_obs">${obsLabel}</label>
        <textarea
          id="${item.chave}_obs"
          placeholder="${placeholder}"
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
    responsavel: responsavel.value.trim(),
    itens: montarItensChecklist(),
    fadiga
  };
}

function validarDados(dados) {
  if (!dados.responsavel) return "Informe o nome.";
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

  if (dados.itens?.descansado?.resposta === "Menos de 4 horas" && !dados.itens?.descansado?.observacoes?.trim()) {
    return "Por favor, preencha a justificativa por ter dormido menos de 4 horas.";
  }

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
  responsavel.value = dados?.responsavel || "";

  CHECKLIST_SECTIONS.forEach((section) => {
    section.itens.forEach((item) => {
      const valor = String(dados?.itens?.[item.chave]?.resposta || "").toLowerCase();

      const radios = document.querySelectorAll(`input[name="${item.chave}_resposta"]`);
      radios.forEach((r) => {
        r.checked = String(r.value).toLowerCase() === valor;
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
  responsavel.value = "";
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
    ? "Altere o nome, a data e as respostas do registro selecionado."
    : "Preencha o nome, a data e a avaliação.";
}

// =========================
// ALERTA VISUAL
// =========================
function atualizarVisualAlertaItem(chave) {
  const card = document.getElementById(`card_${chave}`);
  const resposta = obterRespostaItem(chave);

  if (!card) return;

  if (chave === "descansado") {
    const containerObs = document.getElementById("container_obs_descansado");
    const obsTextarea = document.getElementById("descansado_obs");
    if (containerObs) {
      if (resposta === "Menos de 4 horas") {
        containerObs.classList.remove("hidden");
        if (obsTextarea) {
          obsTextarea.required = true;
        }
      } else {
        containerObs.classList.add("hidden");
        if (obsTextarea) {
          obsTextarea.required = false;
        }
      }
    }
    card.classList.remove("alert");
    card.classList.remove("danger");
    return;
  }

  if (!resposta) {
    card.classList.remove("alert");
    card.classList.remove("danger");
    return;
  }

  const temAlerta = itemTemAlertaPorChave(chave, { resposta });

  card.classList.toggle("alert", temAlerta);
  card.classList.toggle("danger", false);
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

  const highlight = (card, ativo, danger = false) => {
    if (!card) return;
    card.classList.toggle("warning", !!ativo && !danger);
    card.classList.toggle("danger", !!ativo && danger);
  };

  highlight(cardRecente, fadiga.recente === "sim");
  highlight(cardEnergia, fadiga.energia === "sim");
  highlight(cardTempo, fadigaRequerComplemento() && !!fadiga.tempo);
  highlight(card3h, fadiga.mais3h === "sim");
  highlight(cardEsforco, fadiga.esforco === "sim");
  highlight(cardPrazer, fadiga.prazer === "sim");
  highlight(cardPontuacao, fadiga.pontuacao > 0, fadiga.pontuacao >= 2);
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

// =========================
// INSIGHTS E GRÁFICOS
// =========================
function atualizarInsights(registros) {
  if (!insightStatus || !insightResumo || !insightAcao) return;

  const total = registros.length;
  const alertas = contarAlertas(registros);
  const altos = contarRiscoAlto(registros);
  const media = total
    ? registros.reduce((acc, item) => acc + Number(item?.fadiga?.pontuacao || 0), 0) / total
    : 0;

  if (!total) {
    insightStatus.textContent = "Aguardando registros";
    insightResumo.textContent = "Nenhum checklist encontrado";
    insightAcao.textContent = "Cadastre o primeiro registro";
    return;
  }

  if (altos > 0) {
    insightStatus.textContent = "Atenção imediata";
    insightResumo.textContent = `${altos} registro(s) com risco alto`;
    insightAcao.textContent = "Priorizar análise dos casos críticos";
    return;
  }

  if (alertas > 0) {
    insightStatus.textContent = "Operação com alertas";
    insightResumo.textContent = `${alertas} registro(s) exigem atenção`;
    insightAcao.textContent = "Acompanhar equipe e revisar condições";
    return;
  }

  insightStatus.textContent = "Operação estável";
  insightResumo.textContent = `Média de fadiga em ${media.toFixed(1)}`;
  insightAcao.textContent = "Sem ação corretiva imediata";
}

function agruparRegistrosPorDia(registros) {
  const mapa = new Map();

  registros.forEach((item) => {
    const data = String(item?.dataRegistro || "").slice(0, 10);
    if (!data) return;
    mapa.set(data, (mapa.get(data) || 0) + 1);
  });

  return Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function destruirGraficosSeExistirem() {
  if (chartRegistrosPorDia) {
    chartRegistrosPorDia.destroy();
    chartRegistrosPorDia = null;
  }

  if (chartStatusGeral) {
    chartStatusGeral.destroy();
    chartStatusGeral = null;
  }

  if (chartDistFadiga) {
    chartDistFadiga.destroy();
    chartDistFadiga = null;
  }

  if (chartFatoresRisco) {
    chartFatoresRisco.destroy();
    chartFatoresRisco = null;
  }
}

function renderizarGraficos(registros) {
  if (!chartsPanel || chartsPanel.classList.contains("hidden") || typeof Chart === "undefined") return;

  const canvasLinha = document.getElementById("chartRegistrosPorDia");
  const canvasStatus = document.getElementById("chartStatusGeral");
  const canvasDistFadiga = document.getElementById("chartDistFadiga");
  const canvasFatoresRisco = document.getElementById("chartFatoresRisco");
  if (!canvasLinha || !canvasStatus) return;

  destruirGraficosSeExistirem();

  // 1. Registros por dia
  const agrupado = agruparRegistrosPorDia(registros);
  const labelsDias = agrupado.map(([dia]) => {
    const [ano, mes, diaNum] = dia.split("-");
    return `${diaNum}/${mes}`;
  });
  const valoresDias = agrupado.map(([, total]) => total);

  // 2. Status dos registros
  const semAlerta = registros.filter((r) => !registroTemAlerta(r)).length;
  const comAlerta = registros.filter((r) => registroTemAlerta(r) && !riscoAlto(r)).length;
  const risco = registros.filter((r) => riscoAlto(r)).length;

  chartRegistrosPorDia = new Chart(canvasLinha, {
    type: "line",
    data: {
      labels: labelsDias,
      datasets: [{
        label: "Registros",
        data: valoresDias,
        tension: 0.35,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  chartStatusGeral = new Chart(canvasStatus, {
    type: "bar",
    data: {
      labels: ["Sem alerta", "Com alerta", "Risco alto"],
      datasets: [{
        label: "Quantidade",
        data: [semAlerta, comAlerta, risco]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  // 3. Distribuição da Fadiga (Rosca)
  if (canvasDistFadiga) {
    const contagemFadiga = [0, 0, 0, 0];
    registros.forEach((r) => {
      const pts = Math.min(3, Math.max(0, Number(r?.fadiga?.pontuacao || 0)));
      contagemFadiga[pts]++;
    });

    chartDistFadiga = new Chart(canvasDistFadiga, {
      type: "doughnut",
      data: {
        labels: ["Pontuação 0", "Pontuação 1", "Pontuação 2", "Pontuação 3"],
        datasets: [{
          data: contagemFadiga,
          backgroundColor: ["#166534", "#ca8a04", "#ea580c", "#dc2626"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom"
          }
        }
      }
    });
  }

  // 4. Fatores de Risco (Barras Horizontais)
  if (canvasFatoresRisco) {
    const contagemFatores = {
      "Sono insuficiente": 0,
      "Álcool": 0,
      "Drogas ilícitas": 0,
      "Medicamentos": 0,
      "Condição física ruim": 0,
      "Instabilidade emocional": 0,
      "Cansaço recente": 0,
      "Falta de energia": 0
    };

    registros.forEach((r) => {
      const respSono = r?.itens?.descansado?.resposta;
      if (respSono === "Menos de 4 horas" || respSono === "4 a 6 horas") {
        contagemFatores["Sono insuficiente"]++;
      }
      if (itemTemAlertaPorChave("alcool", r?.itens?.alcool)) contagemFatores["Álcool"]++;
      if (itemTemAlertaPorChave("drogas", r?.itens?.drogas)) contagemFatores["Drogas ilícitas"]++;
      if (itemTemAlertaPorChave("medicamentos", r?.itens?.medicamentos)) contagemFatores["Medicamentos"]++;
      if (itemTemAlertaPorChave("condicoesFisicas", r?.itens?.condicoesFisicas)) contagemFatores["Condição física ruim"]++;
      if (itemTemAlertaPorChave("emocionalmenteEstavel", r?.itens?.emocionalmenteEstavel)) contagemFatores["Instabilidade emocional"]++;

      if (String(r?.fadiga?.recente || "").toLowerCase() === "sim") contagemFatores["Cansaço recente"]++;
      if (String(r?.fadiga?.energia || "").toLowerCase() === "sim") contagemFatores["Falta de energia"]++;
    });

    const entradasFatores = Object.entries(contagemFatores).sort((a, b) => b[1] - a[1]);
    const labelsFatores = entradasFatores.map((e) => e[0]);
    const dadosFatores = entradasFatores.map((e) => e[1]);

    chartFatoresRisco = new Chart(canvasFatoresRisco, {
      type: "bar",
      data: {
        labels: labelsFatores,
        datasets: [{
          label: "Ocorrências",
          data: dadosFatores,
          backgroundColor: "#2563eb"
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
}

// =========================
// LISTA / FILTROS
// =========================
function getRegistrosFiltrados() {
  const nome = filtroNomeEl.value.trim().toLowerCase();
  const status = filtroStatusEl ? filtroStatusEl.value : "todos";
  const dataInicio = filtroDataInicioEl.value;
  const dataFim = filtroDataFimEl.value;
  const hoje = new Date();

  return currentDocsCache.filter((item) => {
    const nomeOk = !nome || String(item.responsavel || "").toLowerCase().includes(nome);

    const dataItem = item?.dataRegistro ? new Date(item.dataRegistro) : null;
    const dataValida = dataItem && !Number.isNaN(dataItem.getTime());

    const inicioOk = !dataInicio || (dataValida && item.dataRegistro.slice(0, 10) >= dataInicio);
    const fimOk = !dataFim || (dataValida && item.dataRegistro.slice(0, 10) <= dataFim);

    let statusOk = true;
    if (status === "atencao_hoje") {
      statusOk = registroTemAlerta(item) && item?.dataRegistro && mesmaDataLocal(item.dataRegistro, hoje);
    } else if (status === "hoje") {
      statusOk = item?.dataRegistro && mesmaDataLocal(item.dataRegistro, hoje);
    } else if (status === "alerta") {
      statusOk = registroTemAlerta(item);
    } else if (status === "risco_alto") {
      statusOk = riscoAlto(item);
    }

    return nomeOk && inicioOk && fimOk && statusOk;
  });
}

function montarCard(dados) {
  const temAlerta = registroTemAlerta(dados);
  const alto = riscoAlto(dados);
  const pontuacao = Number(dados?.fadiga?.pontuacao || 0);

  let chipStatus = `<span class="status-badge badge-sim">Sem alerta</span>`;
  if (alto) {
    chipStatus = `<span class="risk-chip">🚨 RISCO ALTO</span>`;
  } else if (temAlerta) {
    chipStatus = `<span class="alert-chip">⚠ Com alerta</span>`;
  }

  return `
    <article class="status-card status-card-clickable ${alto ? "high-risk-card" : temAlerta ? "alert-card" : ""}" data-open-id="${escapeHtml(dados.__docId)}">
      <div class="status-card-mini-content">
        <div>
          <h3 class="status-card-title">${escapeHtml(dados.responsavel || "--")}</h3>
          <p class="status-card-subtitle">
            Checklist de ${formatarDataHoraBR(dados.dataRegistro)} • Fadiga: ${pontuacao}
          </p>
        </div>

        <div class="status-card-mini-content">
          <span class="card-date">${formatarTimestamp(dados.atualizadoEm || dados.criadoEm)}</span>
          ${chipStatus}
        </div>
      </div>
    </article>
  `;
}

function renderizarLista() {
  const filtrados = getRegistrosFiltrados();
  const exibidos = filtrados.slice(0, visibleCount);

  lista.innerHTML = "";

  if (!filtrados.length) {
    lista.innerHTML = `
      <li class="empty-state">
        <strong>Nenhum checklist encontrado.</strong>
        <span>Tente ajustar os filtros ou criar um novo registro.</span>
      </li>
    `;
    btnVerMais.classList.add("hidden");
    btnVerMenos.classList.add("hidden");
    return;
  }

  exibidos.forEach((dados) => {
    const li = document.createElement("li");
    li.innerHTML = montarCard(dados);
    lista.appendChild(li);
  });

  btnVerMais.classList.toggle("hidden", filtrados.length <= visibleCount);
  btnVerMenos.classList.toggle("hidden", visibleCount <= PAGE_SIZE);
}

function atualizarResumo(registros) {
  const filtrados = getRegistrosFiltrados();
  const hoje = new Date();

  totalRegistrosEl.textContent = String(registros.length);
  totalAlertasEl.textContent = String(contarAlertas(registros));
  totalRiscoAltoEl.textContent = String(contarRiscoAlto(registros));
  totalHojeEl.textContent = String(
    registros.filter((item) => item?.dataRegistro && mesmaDataLocal(item.dataRegistro, hoje)).length
  );

  const media = filtrados.length
    ? filtrados.reduce((acc, item) => acc + Number(item?.fadiga?.pontuacao || 0), 0) / filtrados.length
    : 0;

  mediaFadigaEl.textContent = media.toFixed(1);

  const primeiro = registros[0];
  ultimaAtualizacaoEl.textContent = primeiro
    ? formatarTimestamp(primeiro.atualizadoEm || primeiro.criadoEm)
    : "--";
}

function reaplicarRenderizacao() {
  const filtrados = getRegistrosFiltrados();
  renderizarLista();
  atualizarResumo(currentDocsCache);
  atualizarInsights(filtrados);

  if (chartsPanel && !chartsPanel.classList.contains("hidden")) {
    renderizarGraficos(filtrados);
  }
}

// =========================
// EXPORTAR EXCEL
// =========================
function gerarLinhasExcel(registros) {
  return registros.map((dados) => ({
    "Nome": dados.responsavel || "",
    "Data e Hora": formatarDataHoraBR(dados.dataRegistro),
    "Data ISO": dados.dataRegistro || "",
    "Descansado": dados?.itens?.descansado?.resposta || "",
    "Álcool": dados?.itens?.alcool?.resposta || "",
    "Drogas": dados?.itens?.drogas?.resposta || "",
    "Medicamentos": dados?.itens?.medicamentos?.resposta || "",
    "Condições Físicas": dados?.itens?.condicoesFisicas?.resposta || "",
    "Emocionalmente Estável": dados?.itens?.emocionalmenteEstavel?.resposta || "",
    "Óculos/Lentes": dados?.itens?.oculosLentes?.resposta || "",
    "Obs Descansado": dados?.itens?.descansado?.observacoes || "",
    "Obs Álcool": dados?.itens?.alcool?.observacoes || "",
    "Obs Drogas": dados?.itens?.drogas?.observacoes || "",
    "Obs Medicamentos": dados?.itens?.medicamentos?.observacoes || "",
    "Obs Condições Físicas": dados?.itens?.condicoesFisicas?.observacoes || "",
    "Obs Emocionalmente Estável": dados?.itens?.emocionalmenteEstavel?.observacoes || "",
    "Obs Óculos/Lentes": dados?.itens?.oculosLentes?.observacoes || "",
    "Fadiga Recente": dados?.fadiga?.recente || "",
    "Fadiga Energia": dados?.fadiga?.energia || "",
    "Fadiga Tempo": dados?.fadiga?.tempo || "",
    "Fadiga +3h": dados?.fadiga?.mais3h || "",
    "Fadiga Esforço": dados?.fadiga?.esforco || "",
    "Fadiga Prazer": dados?.fadiga?.prazer || "",
    "Pontuação Fadiga": Number(dados?.fadiga?.pontuacao || 0),
    "Com Alerta": registroTemAlerta(dados) ? "Sim" : "Não",
    "Risco Alto": riscoAlto(dados) ? "Sim" : "Não",
    "Última Atualização": formatarTimestamp(dados.atualizadoEm || dados.criadoEm)
  }));
}

function exportarExcel() {
  const filtrados = getRegistrosFiltrados();

  if (!filtrados.length) {
    setMensagem("Não há registros para exportar com os filtros atuais.", true);
    return;
  }

  const linhas = gerarLinhasExcel(filtrados);
  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Checklists");

  const nomeArquivo = `checklists_fadiga_${formatarDataArquivo()}.xlsx`;
  XLSX.writeFile(wb, nomeArquivo);
}

// =========================
// MODAL
// =========================
function montarItemDetalhe(itemConfig, itemData) {
  const resposta = itemData?.resposta || "";
  const obs = itemData?.observacoes || "";
  const obsLabel = itemConfig.chave === "descansado" ? "Justificativa" : "Observações";

  return `
    <div class="detail-item">
      <div class="detail-item-main">
        <div class="detail-item-title">${escapeHtml(itemConfig.label)}</div>
        ${obs ? `<div class="detail-item-obs"><strong>${obsLabel}:</strong> ${escapeHtml(obs)}</div>` : ""}
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

function montarGrupoFadigaDetalhe(fadiga) {
  const pontuacao = Number(fadiga?.pontuacao || 0);
  const pontuacaoClass = pontuacao >= 2 ? "badge-danger" : pontuacao > 0 ? "badge-warning" : "badge-sim";

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
        <span class="status-badge ${pontuacaoClass}">${pontuacao}</span>
      </div>
    </section>
  `;
}

function montarDetalhesModal(dados) {
  return `
    <div class="detail-grid">
      <div class="detail-box">
        <span>Nome</span>
        <strong>${escapeHtml(dados.responsavel || "--")}</strong>
      </div>
      <div class="detail-box">
        <span>Data e Hora</span>
        <strong>${formatarDataHoraBR(dados.dataRegistro)}</strong>
      </div>
      <div class="detail-box">
        <span>Última atualização</span>
        <strong>${formatarTimestamp(dados.atualizadoEm || dados.criadoEm)}</strong>
      </div>
      <div class="detail-box">
        <span>Status</span>
        <strong>${riscoAlto(dados) ? "RISCO ALTO" : registroTemAlerta(dados) ? "Com alerta" : "Sem alerta"}</strong>
      </div>
    </div>

    ${CHECKLIST_SECTIONS.map((section) => montarGrupoDetalhe(section, dados)).join("")}

    ${montarGrupoFadigaDetalhe(dados?.fadiga || {})}
  `;
}

function abrirModal(docId) {
  const dados = currentDocsCache.find((item) => item.__docId === docId);
  if (!dados) return;

  openedDocId = docId;
  modalTitle.textContent = dados.responsavel || "Detalhes do checklist";
  modalSubtitle.textContent = `Checklist de ${formatarDataHoraBR(dados.dataRegistro)}`;
  modalBody.innerHTML = montarDetalhesModal(dados);
  detailsModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function fecharModal() {
  openedDocId = null;
  detailsModal.classList.add("hidden");
  document.body.style.overflow = "";
}

let resolvePasswordPromise = null;

function solicitarSenhaGestor() {
  const passwordModal = document.getElementById("passwordModal");
  const gestorPasswordInput = document.getElementById("gestorPasswordInput");
  const passwordErrorMsg = document.getElementById("passwordErrorMsg");

  if (!passwordModal || !gestorPasswordInput) {
    const senha = prompt("Digite a senha do gestor:");
    return Promise.resolve(senha === SENHA_GESTOR);
  }

  gestorPasswordInput.value = "";
  passwordErrorMsg.classList.add("hidden");
  passwordModal.classList.remove("hidden");
  gestorPasswordInput.focus();
  document.body.style.overflow = "hidden";

  return new Promise((resolve) => {
    resolvePasswordPromise = resolve;
  });
}

function fecharPasswordModal() {
  const passwordModal = document.getElementById("passwordModal");
  if (passwordModal) {
    passwordModal.classList.add("hidden");
    document.body.style.overflow = "";
  }
  resolvePasswordPromise = null;
}

function tratarConfirmarSenha() {
  const gestorPasswordInput = document.getElementById("gestorPasswordInput");
  const passwordErrorMsg = document.getElementById("passwordErrorMsg");
  const senha = gestorPasswordInput?.value || "";

  if (senha === SENHA_GESTOR) {
    fecharPasswordModal();
    if (resolvePasswordPromise) resolvePasswordPromise(true);
  } else {
    passwordErrorMsg.classList.remove("hidden");
    gestorPasswordInput.value = "";
    gestorPasswordInput.focus();
  }
}

function tratarCancelarSenha() {
  fecharPasswordModal();
  if (resolvePasswordPromise) resolvePasswordPromise(false);
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

// =========================
// EVENTOS GERAIS
// =========================
closeModalBtn.addEventListener("click", fecharModal);
enterSystemBtn?.addEventListener("click", abrirSistema);
btnToggleTheme?.addEventListener("click", alternarTema);
btnToggleCharts?.addEventListener("click", alternarGraficos);

detailsModal.addEventListener("click", (e) => {
  if (e.target === detailsModal) {
    fecharModal();
  }
});

const passwordModalEl = document.getElementById("passwordModal");
if (passwordModalEl) {
  passwordModalEl.addEventListener("click", (e) => {
    if (e.target === passwordModalEl) {
      tratarCancelarSenha();
    }
  });
}

document.getElementById("closePasswordModalBtn")?.addEventListener("click", tratarCancelarSenha);
document.getElementById("cancelPasswordBtn")?.addEventListener("click", tratarCancelarSenha);
document.getElementById("confirmPasswordBtn")?.addEventListener("click", tratarConfirmarSenha);
document.getElementById("gestorPasswordInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    tratarConfirmarSenha();
  } else if (e.key === "Escape") {
    tratarCancelarSenha();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !detailsModal.classList.contains("hidden")) {
    fecharModal();
  }
});

modalEditBtn.addEventListener("click", async () => {
  if (!openedDocId) return;

  const dados = currentDocsCache.find((item) => item.__docId === openedDocId);
  if (!dados) return;

  const autorizado = await solicitarSenhaGestor();
  if (!autorizado) return;

  preencherFormulario(dados);
  editingDocId = openedDocId;
  atualizarModoFormulario();
  setMensagem(`Modo edição ativado para ${dados.responsavel || "registro"} - ${formatarDataHoraBR(dados.dataRegistro)}.`);
  fecharModal();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

modalDeleteBtn.addEventListener("click", async () => {
  if (!openedDocId) return;

  const dados = currentDocsCache.find((item) => item.__docId === openedDocId);
  const nome = dados?.responsavel || "este registro";

  const autorizado = await solicitarSenhaGestor();
  if (!autorizado) return;

  const confirmar = confirm(`Deseja realmente excluir o checklist de ${nome} em ${formatarDataHoraBR(dados?.dataRegistro)}?`);
  if (!confirmar) return;

  try {
    await deleteDoc(doc(db, "status", openedDocId));

    if (editingDocId === openedDocId) {
      limparFormulario();
    }

    setMensagem("Checklist excluído com sucesso.");
    fecharModal();
  } catch (error) {
    console.error("Erro ao excluir checklist:", error);
    setMensagem(`Erro ao excluir checklist: ${error.message}`, true);
  }
});

btnVerMais.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  renderizarLista();
});

btnVerMenos.addEventListener("click", () => {
  visibleCount = PAGE_SIZE;
  renderizarLista();
  window.scrollTo({ top: document.querySelector(".panel.card:last-of-type")?.offsetTop || 0, behavior: "smooth" });
});

filtroNomeEl.addEventListener("input", () => {
  visibleCount = PAGE_SIZE;
  reaplicarRenderizacao();
});

filtroStatusEl?.addEventListener("change", () => {
  visibleCount = PAGE_SIZE;
  reaplicarRenderizacao();
});

filtroDataInicioEl.addEventListener("input", () => {
  visibleCount = PAGE_SIZE;
  reaplicarRenderizacao();
});

filtroDataFimEl.addEventListener("input", () => {
  visibleCount = PAGE_SIZE;
  reaplicarRenderizacao();
});

btnLimparFiltros.addEventListener("click", () => {
  filtroNomeEl.value = "";
  if (filtroStatusEl) filtroStatusEl.value = "todos";
  filtroDataInicioEl.value = "";
  filtroDataFimEl.value = "";
  visibleCount = PAGE_SIZE;
  reaplicarRenderizacao();
});

btnExportarExcel.addEventListener("click", exportarExcel);

lista.addEventListener("click", (e) => {
  const card = e.target.closest("[data-open-id]");
  if (!card) return;

  const docId = card.getAttribute("data-open-id");
  if (!docId) return;

  abrirModal(docId);
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
    return;
  }

  const docId = editingDocId || crypto.randomUUID();
  const docRef = doc(db, "status", docId);

  try {
    submitBtn.disabled = true;
    setMensagem(editingDocId ? "Atualizando checklist..." : "Salvando checklist...");

    await setDoc(
      docRef,
      {
        ...dados,
        ...(editingDocId ? {} : { criadoEm: serverTimestamp() }),
        atualizadoEm: serverTimestamp()
      },
      { merge: true }
    );

    const temRisco = registroTemAlerta(dados);
    setMensagem(
      editingDocId
        ? "Checklist atualizado." + (temRisco ? " 🚨 ATENÇÃO: Contate a Gestora de Seg. (31 9779-6710)." : "")
        : "Checklist salvo com sucesso." + (temRisco ? " 🚨 ATENÇÃO: Contate a Gestora de Seg. (31 9779-6710)." : "")
    );

    limparFormulario();
  } catch (error) {
    console.error("Erro ao salvar no Firebase:", error);
    setMensagem(`Erro ao salvar no Firebase: ${error.message}`, true);
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
    currentDocsCache = snapshot.docs.map((registro) => {
      const data = registro.data();
      const fadiga = {
        ...(data.fadiga || {})
      };

      fadiga.pontuacao = Number(
        data?.fadiga?.pontuacao ?? calcularPontuacaoFadigaComDados(fadiga)
      );

      return {
        __docId: registro.id,
        ...data,
        fadiga
      };
    });

    visibleCount = Math.max(PAGE_SIZE, visibleCount);
    reaplicarRenderizacao();

    if (openedDocId) {
      const aindaExiste = currentDocsCache.find((item) => item.__docId === openedDocId);
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
// INICIALIZAÇÃO
// =========================
renderizarFormularioChecklist();
registrarEventosChecklist();
registrarEventosFadiga();
atualizarModoFormulario();
atualizarExibicaoFadigaExtra();
atualizarPontuacaoFadiga();
atualizarVisualFadiga();
aplicarTemaSalvo();
atualizarInsights([]);
showToast("Sistema pronto para uso.");
