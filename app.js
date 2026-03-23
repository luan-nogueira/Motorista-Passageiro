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
// ESTILO VISUAL INJETADO
// =========================
const visualStyle = document.createElement("style");
visualStyle.innerHTML = `
  #lista {
    list-style: none;
    padding: 0;
    margin: 24px 0 0;
    display: grid;
    gap: 16px;
  }

  #lista li {
    list-style: none;
  }

  .status-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 18px;
    padding: 18px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.06);
  }

  .status-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }

  .status-card-title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #111827;
  }

  .status-card-subtitle {
    margin: 4px 0 0;
    font-size: 13px;
    color: #6b7280;
  }

  .person-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 16px;
  }

  .person-box {
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 12px;
  }

  .person-label {
    display: block;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #6b7280;
    margin-bottom: 6px;
  }

  .person-name {
    font-size: 16px;
    font-weight: 700;
    color: #111827;
  }

  .period-list {
    display: grid;
    gap: 12px;
  }

  .period-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 14px;
  }

  .period-title {
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 700;
    color: #111827;
  }

  .period-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 0;
    border-top: 1px solid #edf2f7;
  }

  .period-row:first-of-type {
    border-top: none;
    padding-top: 0;
  }

  .period-role {
    font-size: 14px;
    font-weight: 600;
    color: #374151;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    text-transform: capitalize;
    white-space: nowrap;
  }

  .badge-otimo {
    background: #dcfce7;
    color: #166534;
    border: 1px solid #86efac;
  }

  .badge-regular {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fcd34d;
  }

  .badge-ruim {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
  }

  .card-date {
    font-size: 12px;
    color: #6b7280;
    background: #f3f4f6;
    padding: 6px 10px;
    border-radius: 999px;
  }

  .empty-state {
    text-align: center;
    color: #6b7280;
    background: #ffffff;
    border: 1px dashed #d1d5db;
    border-radius: 18px;
    padding: 28px 16px;
  }

  @media (max-width: 640px) {
    .person-grid {
      grid-template-columns: 1fr;
    }

    .period-row {
      flex-direction: column;
      align-items: flex-start;
    }

    .status-card-header {
      flex-direction: column;
      align-items: flex-start;
    }
  }
`;
document.head.appendChild(visualStyle);

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
  if (!timestamp) return "Agora";
  try {
    const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(data);
  } catch {
    return "Agora";
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

  await addDoc(col, dados);
  form.reset();
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
