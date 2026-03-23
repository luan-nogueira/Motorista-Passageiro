import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
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

// =========================
// HELPERS
// =========================
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

function formatarData(timestamp) {
  if (!timestamp) return "Aguardando horário...";

  try {
    const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

    if (isNaN(data.getTime())) {
      return "Aguardando horário...";
    }

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(data);
  } catch {
    return "Aguardando horário...";
  }
}

function montarLinha(role, status) {
  return `
    <div class="period-row">
      <span class="period-role">${role}</span>
      <span class="status-badge ${classeStatus(status)}">${textoStatus(status)}</span>
    </div>
  `;
}

function montarCard(d) {
  return `
    <article class="status-card">
      <div class="status-card-header">
        <div>
          <h3 class="status-card-title">Avaliação de condições</h3>
          <p class="status-card-subtitle">Registro de motorista e passageiro</p>
        </div>
        <span class="card-date">${formatarData(d.criadoEm)}</span>
      </div>

      <div class="person-grid">
        <div class="person-box">
          <span class="person-label">Motorista</span>
          <div class="person-name">${d.motorista || "-"}</div>
        </div>

        <div class="person-box">
          <span class="person-label">Passageiro</span>
          <div class="person-name">${d.passageiro || "-"}</div>
        </div>
      </div>

      <div class="period-list">
        <section class="period-card">
          <h4 class="period-title">Antes de sair de casa</h4>
          ${montarLinha("Motorista", d.antesCasa_motorista)}
          ${montarLinha("Passageiro", d.antesCasa_passageiro)}
        </section>

        <section class="period-card">
          <h4 class="period-title">Após almoço</h4>
          ${montarLinha("Motorista", d.aposAlmoco_motorista)}
          ${montarLinha("Passageiro", d.aposAlmoco_passageiro)}
        </section>

        <section class="period-card">
          <h4 class="period-title">Antes de sair do cliente</h4>
          ${montarLinha("Motorista", d.antesCliente_motorista)}
          ${montarLinha("Passageiro", d.antesCliente_passageiro)}
        </section>
      </div>
    </article>
  `;
}

// =========================
// FIRESTORE
// =========================
const col = collection(db, "status");

// =========================
// SALVAR
// =========================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const motorista = document.getElementById("motorista").value.trim();
  const passageiro = document.getElementById("passageiro").value.trim();

  if (!motorista || !passageiro) {
    alert("Preencha o nome do motorista e do passageiro.");
    return;
  }

  const dados = {
    motorista,
    passageiro,
    antesCasa_motorista: document.getElementById("antesCasa_motorista").value,
    antesCasa_passageiro: document.getElementById("antesCasa_passageiro").value,
    aposAlmoco_motorista: document.getElementById("aposAlmoco_motorista").value,
    aposAlmoco_passageiro: document.getElementById("aposAlmoco_passageiro").value,
    antesCliente_motorista: document.getElementById("antesCliente_motorista").value,
    antesCliente_passageiro: document.getElementById("antesCliente_passageiro").value,
    criadoEm: serverTimestamp()
  };

  try {
    await addDoc(col, dados);
    form.reset();
  } catch (error) {
    console.error("Erro ao salvar no Firebase:", error);
    alert("Erro ao salvar o registro. Verifique o Firebase.");
  }
});

// =========================
// LISTAGEM EM TEMPO REAL
// =========================
const q = query(col, orderBy("criadoEm", "desc"));

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

  snapshot.forEach((doc) => {
    const d = doc.data();
    const li = document.createElement("li");
    li.innerHTML = montarCard(d);
    lista.appendChild(li);
  });
});
