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
// CHECKLIST BASEADO NO PDF
// =========================
const CHECKLIST_SECTIONS = [
  {
    id: "condicoes",
    titulo: "Condições Físicas e Mentais",
    itens: [
      { chave: "descansado", label: "Estou descansado (mínimo 6–8h de sono)" },
      { chave: "alcool", label: "Não estou sob efeito de álcool" },
      { chave: "drogas", label: "Não estou sob efeito de drogas ilícitas" },
      { chave: "medicamentos", label: "Não estou sob efeito de medicamentos que afetem reflexos" },
      { chave: "condicoesFisicas", label: "Estou em boas condições físicas" },
      { chave: "emocionalmenteEstavel", label: "Estou emocionalmente estável" },
      { chave: "oculosLentes", label: "Estou utilizando óculos/lentes (se obrigatório)" }
    ]
  },
  {
    id: "documentacao",
    titulo: "Documentação Obrigatória",
    itens: [
      { chave: "cnhValida", label: "CNH válida e compatível com o veículo" },
      { chave: "crlvValido", label: "Documento do veículo (CRLV) válido" },
      { chave: "autorizacaoEmpresa", label: "Autorização da empresa (se aplicável)" }
    ]
  },
  {
    id: "veiculo",
    titulo: "Verificação do Veículo (Pré-Uso)",
    itens: [
      { chave: "pneus", label: "Pneus em bom estado" },
      { chave: "estepe", label: "Estepe em boas condições" },
      { chave: "combustivel", label: "Nível de combustível adequado" },
      { chave: "oleoMotor", label: "Óleo do motor em nível adequado" },
      { chave: "freios", label: "Freios funcionando normalmente" },
      { chave: "faroisSetas", label: "Faróis e setas funcionando" }
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
const motorista = document.getElementById("motorista");
const veiculoPlaca = document.getElementById("veiculoPlaca");
const km = document.getElementById("km");
const observacoesGerais = document.getElementById("observacoesGerais");

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

function formatarDataBR(dataISO) {
  if (!dataISO) return "--";
  const [ano, mes, dia] = String(dataISO).split("-");
  if (!ano || !mes || !dia) return dataISO;
  return `${dia}/${mes}/${ano}`;
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

function badgeClass(resposta) {
  return String(resposta).toLowerCase() === "nao" ? "badge-nao" : "badge-sim";
}

function badgeLabel(resposta) {
  return String(resposta).toLowerCase() === "nao" ? "Não" : "Sim";
}

function itemTemAlerta(item) {
  return String(item?.resposta || "").toLowerCase() === "nao";
}

function registroTemAlerta(dados) {
  return Object.values(dados?.itens || {}).some((item) => itemTemAlerta(item));
}

function contarAlertas(registros) {
  return registros.filter((registro) => registroTemAlerta(registro)).length;
}

// =========================
// MONTAGEM DO FORMULÁRIO
// =========================
function criarItemChecklist(item, sectionId) {
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
          data-section="${sectionId}"
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
      .map((item) => criarItemChecklist(item, section.id))
      .join("");
  });
}

renderizarFormularioChecklist();

// =========================
// COLETA E VALIDAÇÃO
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
  return {
    dataRegistro: recordDate.value,
    responsavel: responsavel.value.trim(),
    motorista: motorista.value.trim(),
    veiculoPlaca: veiculoPlaca.value.trim(),
    km: km.value.trim(),
    observacoesGerais: observacoesGerais.value.trim(),
    itens: montarItensChecklist()
  };
}

function validarDados(dados) {
  if (!dados.dataRegistro) return "Selecione a data.";
  if (!dados.responsavel) return "Informe quem fez o checklist.";
  if (!dados.motorista) return "Informe o motorista.";
  if (!dados.veiculoPlaca) return "Informe o veículo / placa.";

  const itens = Object.values(dados.itens || []);
  if (!itens.length) return "Nenhum item do checklist foi carregado.";

  const semResposta = itens.some((item) => !item.resposta);
  if (semResposta) return "Responda TODOS os itens do checklist.";

  return "";
}

// =========================
// PREENCHER / LIMPAR
// =========================
function preencherFormulario(dados) {
  recordDate.value = dados?.dataRegistro || hojeISO();
  responsavel.value = dados?.responsavel || "";
  motorista.value = dados?.motorista || "";
  veiculoPlaca.value = dados?.veiculoPlaca || "";
  km.value = dados?.km || "";
  observacoesGerais.value = dados?.observacoesGerais || "";

  CHECKLIST_SECTIONS.forEach((section) => {
    section.itens.forEach((item) => {
      const valor = String(dados?.itens?.[item.chave]?.resposta || "sim").toLowerCase();
      const radio = document.querySelector(`input[name="${item.chave}_resposta"][value="${valor}"]`);
      if (radio) radio.checked = true;

      const obs = document.getElementById(`${item.chave}_obs`);
      if (obs) {
        obs.value = dados?.itens?.[item.chave]?.observacoes || "";
      }

      atualizarVisualAlertaItem(item.chave);
    });
  });
}

function limparFormulario() {
  form.reset();
  recordDate.value = hojeISO();
  editingDocId = null;
  atualizarModoFormulario();

  CHECKLIST_SECTIONS.forEach((section) => {
    section.itens.forEach((item) => {
      const radios = document.querySelectorAll(`input[name="${item.chave}_resposta"]`);
      radios.forEach(r => r.checked = false);

      const obs = document.getElementById(`${item.chave}_obs`);
      if (obs) obs.value = "";

      atualizarVisualAlertaItem(item.chave);
    });
  });
}

function atualizarModoFormulario() {
  const emEdicao = !!editingDocId;

  submitBtn.textContent = emEdicao ? "Atualizar checklist" : "Salvar checklist";
  cancelEditBtn.hidden = !emEdicao;

  formTitle.textContent = emEdicao ? "Editar checklist" : "Checklist do dia";
  formSubtitle.textContent = emEdicao
    ? "Altere os dados do registro selecionado e salve novamente."
    : "Preencha as condições do motorista e do veículo antes do uso.";
}

// =========================
// ALERTA VISUAL NOS ITENS
// =========================
function atualizarVisualAlertaItem(chave) {
  const card = document.getElementById(`card_${chave}`);
  const resposta = obterRespostaItem(chave);

  if (!card) return;

  card.classList.toggle("alert", String(resposta).toLowerCase() === "nao");
}

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

// =========================
// RENDERIZAÇÃO LISTA
// =========================
function montarItemView(itemConfig, dadosItem) {
  const resposta = dadosItem?.resposta || "sim";
  const observacao = dadosItem?.observacoes || "";

  return `
    <div class="item-view">
      <div class="item-view-top">
        <div class="item-view-title">${escapeHtml(itemConfig.label)}</div>
        <span class="status-badge ${badgeClass(resposta)}">${badgeLabel(resposta)}</span>
      </div>
      ${
        observacao
          ? `<div class="item-view-obs"><strong>Observações:</strong> ${escapeHtml(observacao)}</div>`
          : ""
      }
    </div>
  `;
}

function montarGrupo(section, dados) {
  const temAlertaNoGrupo = section.itens.some((item) => itemTemAlerta(dados?.itens?.[item.chave]));

  return `
    <section class="group-card ${temAlertaNoGrupo ? "alert" : ""}">
      <h4>${escapeHtml(section.titulo)}</h4>
      ${section.itens.map((item) => montarItemView(item, dados?.itens?.[item.chave])).join("")}
    </section>
  `;
}

function montarCard(dados) {
  return `
    <article class="status-card status-card-mini">
      <div class="status-card-mini-content">
        <div>
          <h3 class="status-card-title">${escapeHtml(dados.responsavel || "--")}</h3>
          <p class="status-card-subtitle">
            Checklist preenchido em ${formatarDataBR(dados.dataRegistro)}
          </p>
        </div>

        <span class="card-date">${formatarTimestamp(dados.atualizadoEm || dados.criadoEm)}</span>
      </div>
    </article>
  `;
}

      <div class="card-actions">
        <button class="btn btn-secondary btn-edit" type="button" data-id="${escapeHtml(dados.dataRegistro)}">
          Editar
        </button>
        <button class="btn btn-danger btn-delete" type="button" data-id="${escapeHtml(dados.dataRegistro)}">
          Excluir
        </button>
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
        ? `Checklist do dia ${formatarDataBR(docId)} atualizado com sucesso.`
        : `Checklist do dia ${formatarDataBR(docId)} salvo com sucesso.`
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
// EDITAR / EXCLUIR
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
    const confirmar = confirm(`Deseja realmente excluir o checklist do dia ${formatarDataBR(docId)}?`);

    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "status", docId));

      if (editingDocId === docId) {
        limparFormulario();
      }

      setMensagem(`Checklist do dia ${formatarDataBR(docId)} excluído com sucesso.`);
    } catch (error) {
      console.error("Erro ao excluir:", error);
      setMensagem("Erro ao excluir checklist.", true);
      alert("Erro ao excluir checklist.");
    }
  }
});

// =========================
// INICIALIZAÇÃO
// =========================
atualizarModoFormulario();
setMensagem("Sistema pronto para uso.");
