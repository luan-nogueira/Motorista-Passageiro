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

let editingDocId = null;

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
  saveMsg.style.color = erro ? "#dc2626" : "#166534";
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
  if (valor === "ótimo" || valor === "otimo") return "Ótimo para as atividades";
  if (valor === "regular") return "Regular para as atividades";
  return "Ruim para as atividades";
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
            ${alerta ? "Atenção: existe status ruim neste registro" : "Atualizado em tempo real"}
          </p>
        </div>
        <span class="card-date">${formatarTimestamp(dados.atualizadoEm || dados.criadoEm)}</span>
      </div>

      ${alerta ? `<div class="alert-bad">⚠ Existe pelo menos um participante com status ruim.</div>` : ""}

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

function validarDados(dados) {
  if (!dados.dataRegistro) {
    return "Selecione a data.";
  }

  const camposObrigatorios = [
    dados.antesCasa.motorista.nome,
    dados.antesCasa.passageiros.nomes,
    dados.aposAlmoco.motorista.nome,
    dados.aposAlmoco.passageiros.nomes,
    dados.antesCliente.motorista.nome,
    dados.antesCliente.passageiros.nomes
  ];

  if (camposObrigatorios.some((item) => !item)) {
    return "Preencha motorista e passageiros em todos os períodos.";
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
}

function limparFormulario() {
  form.reset();
  recordDate.value = hojeISO();
  editingDocId = null;
}

function atualizarTextoBotao() {
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = editingDocId ? "Atualizar registro" : "Salvar registro do dia";
  }
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
    setMensagem(editingDocId ? "Atualizando registro..." : "Salvando registro...");

    await setDoc(
      docRef,
      {
        ...dados,
        dataRegistro: docId,
        criadoEm: editingDocId ? undefined : serverTimestamp(),
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
    atualizarTextoBotao();
  } catch (error) {
    console.error("Erro ao salvar no Firebase:", error);
    setMensagem("Erro ao salvar no Firebase.", true);
    alert("Erro ao salvar no Firebase.");
  }
});

// =========================
// LISTAGEM TEMPO REAL
// =========================
const colRef = collection(db, "status");
const q = query(colRef, orderBy("dataRegistro", "desc"));

onSnapshot(
  q,
  (snapshot) => {
    lista.innerHTML = "";

    if (snapshot.empty) {
      lista.innerHTML = `
        <li class="empty-state">
          Nenhum registro encontrado ainda.
        </li>
      `;
      return;
    }

    snapshot.forEach((registro) => {
      const dados = registro.data();
      const li = document.createElement("li");
      li.innerHTML = montarCard(dados);
      lista.appendChild(li);
    });
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
    const card = editBtn.closest("li");
    if (!card) return;

    const cardTitle = card.querySelector(".status-card-title")?.textContent || "";
    const subtitulo = card.querySelector(".status-card-subtitle")?.textContent || "";

    const snapshotItems = Array.from(lista.querySelectorAll(".btn-edit"));
    const index = snapshotItems.findIndex((btn) => btn.dataset.id === docId);

    const docs = currentDocsCache;
    const dados = docs[index];

    if (!dados) return;

    preencherFormulario(dados);
    editingDocId = docId;
    atualizarTextoBotao();
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
        atualizarTextoBotao();
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
// CACHE PARA EDIÇÃO
// =========================
let currentDocsCache = [];

onSnapshot(
  q,
  (snapshot) => {
    currentDocsCache = [];
    lista.innerHTML = "";

    if (snapshot.empty) {
      lista.innerHTML = `
        <li class="empty-state">
          Nenhum registro encontrado ainda.
        </li>
      `;
      return;
    }

    snapshot.forEach((registro) => {
      const dados = registro.data();
      currentDocsCache.push(dados);

      const li = document.createElement("li");
      li.innerHTML = montarCard(dados);
      lista.appendChild(li);
    });
  },
  (error) => {
    console.error("Erro ao carregar registros:", error);
    setMensagem("Erro ao carregar registros do Firebase.", true);
  }
);

atualizarTextoBotao();
