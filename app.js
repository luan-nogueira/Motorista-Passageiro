import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
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

// =========================
// DATA PADRÃO
// =========================
function hojeISO() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

recordDate.value = hojeISO();

// =========================
// HELPERS
// =========================
function setMensagem(texto, erro = false) {
  saveMsg.textContent = texto;
  saveMsg.style.color = erro ? "#b91c1c" : "#475569";
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

function formatarDataISOParaBR(dataISO) {
  if (!dataISO) return "--";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarTimestamp(timestamp) {
  if (!timestamp) return "Aguardando horário...";
  try {
    const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(data.getTime())) return "Aguardando horário...";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(data);
  } catch {
    return "Aguardando horário...";
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

function montarLinha(papel, pessoa) {
  return `
    <div class="period-row">
      <div class="period-role">
        <strong>${papel}</strong>
        <span>${escapeHtml(pessoa?.nome || "-")}</span>
      </div>
      <span class="status-badge ${classeStatus(pessoa?.status)}">${textoStatus(pessoa?.status)}</span>
    </div>
  `;
}

function montarCard(dados) {
  return `
    <article class="status-card">
      <div class="status-card-header">
        <div>
          <h3 class="status-card-title">Registro do dia ${formatarDataISOParaBR(dados.dataRegistro)}</h3>
          <p class="status-card-subtitle">Avaliação de motorista e passageiro por período</p>
        </div>
        <span class="card-date">${formatarTimestamp(dados.criadoEm)}</span>
      </div>

      <div class="period-list">
        <section class="period-card-view">
          <h4 class="period-title">Antes de sair de casa</h4>
          ${montarLinha("Motorista", dados.antesCasa?.motorista)}
          ${montarLinha("Passageiro", dados.antesCasa?.passageiro)}
        </section>

        <section class="period-card-view">
          <h4 class="period-title">Após almoço</h4>
          ${montarLinha("Motorista", dados.aposAlmoco?.motorista)}
          ${montarLinha("Passageiro", dados.aposAlmoco?.passageiro)}
        </section>

        <section class="period-card-view">
          <h4 class="period-title">Antes de sair do cliente</h4>
          ${montarLinha("Motorista", dados.antesCliente?.motorista)}
          ${montarLinha("Passageiro", dados.antesCliente?.passageiro)}
        </section>
      </div>
    </article>
  `;
}

function pegarValor(id) {
  return document.getElementById(id).value.trim();
}

function montarDadosFormulario() {
  return {
    dataRegistro: recordDate.value,
    antesCasa: {
      motorista: {
        nome: pegarValor("antesCasa_motorista_nome"),
        status: document.getElementById("antesCasa_motorista").value
      },
      passageiro: {
        nome: pegarValor("antesCasa_passageiro_nome"),
        status: document.getElementById("antesCasa_passageiro").value
      }
    },
    aposAlmoco: {
      motorista: {
        nome: pegarValor("aposAlmoco_motorista_nome"),
        status: document.getElementById("aposAlmoco_motorista").value
      },
      passageiro: {
        nome: pegarValor("aposAlmoco_passageiro_nome"),
        status: document.getElementById("aposAlmoco_passageiro").value
      }
    },
    antesCliente: {
      motorista: {
        nome: pegarValor("antesCliente_motorista_nome"),
        status: document.getElementById("antesCliente_motorista").value
      },
      passageiro: {
        nome: pegarValor("antesCliente_passageiro_nome"),
        status: document.getElementById("antesCliente_passageiro").value
      }
    }
  };
}

function validarDados(dados) {
  if (!dados.dataRegistro) {
    return "Selecione a data.";
  }

  const campos = [
    dados.antesCasa.motorista.nome,
    dados.antesCasa.passageiro.nome,
    dados.aposAlmoco.motorista.nome,
    dados.aposAlmoco.passageiro.nome,
    dados.antesCliente.motorista.nome,
    dados.antesCliente.passageiro.nome
  ];

  if (campos.some((item) => !item)) {
    return "Preencha todos os nomes de motorista e passageiro.";
  }

  return "";
}

// =========================
// SALVAR COM BLOQUEIO POR DIA
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

  const docId = dados.dataRegistro;
  const registroRef = doc(db, "status", docId);

  try {
    setMensagem("Verificando duplicidade...");

    const registroExistente = await getDoc(registroRef);

    if (registroExistente.exists()) {
      const mensagem = `Já existe um registro salvo para a data ${formatarDataISOParaBR(docId)}.`;
      setMensagem(mensagem, true);
      alert(mensagem);
      return;
    }

    await setDoc(registroRef, {
      ...dados,
      criadoEm: serverTimestamp()
    });

    setMensagem(`Registro do dia ${formatarDataISOParaBR(docId)} salvo com sucesso.`);
    form.reset();
    recordDate.value = hojeISO();
  } catch (error) {
    console.error("Erro ao salvar:", error);
    setMensagem("Erro ao salvar no Firebase.", true);
    alert("Erro ao salvar no Firebase.");
  }
});

// =========================
// LISTAGEM EM TEMPO REAL
// =========================
const registrosRef = collection(db, "status");
const q = query(registrosRef, orderBy("dataRegistro", "desc"));

onSnapshot(q, (snapshot) => {
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
});
