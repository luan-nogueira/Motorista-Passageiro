import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
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
// DATA
// =========================
function hojeISO() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}
recordDate.value = hojeISO();

// =========================
// HELPERS
// =========================
function setMensagem(msg, erro = false) {
  saveMsg.textContent = msg;
  saveMsg.style.color = erro ? "#dc2626" : "#16a34a";
}

function classeStatus(s) {
  s = (s || "").toLowerCase();
  if (s.includes("ótimo") || s.includes("otimo")) return "badge-otimo";
  if (s.includes("regular")) return "badge-regular";
  return "badge-ruim";
}

function formatarHoraAgora() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeStyle: "medium"
  }).format(new Date());
}

function montarCard(d) {
  return `
    <article class="status-card">
      <div class="status-card-header">
        <div>
          <h3 class="status-card-title">Registro ${d.dataRegistro}</h3>
          <p class="status-card-subtitle">Atualizado em tempo real</p>
        </div>
        <span class="card-date">${formatarHoraAgora()}</span>
      </div>

      ${periodo("Antes de sair de casa", d.antesCasa)}
      ${periodo("Após almoço", d.aposAlmoco)}
      ${periodo("Antes de sair do cliente", d.antesCliente)}
    </article>
  `;
}

function periodo(titulo, p) {
  return `
    <div class="period-card-view">
      <h4 class="period-title">${titulo}</h4>

      <div class="period-row">
        <div>
          <strong>Motorista</strong><br>
          ${p.motorista.nome}
        </div>
        <span class="status-badge ${classeStatus(p.motorista.status)}">
          ${p.motorista.status}
        </span>
      </div>

      <div class="period-row">
        <div>
          <strong>Passageiros</strong><br>
          ${p.passageiros.nomes}
        </div>
        <span class="status-badge ${classeStatus(p.passageiros.status)}">
          ${p.passageiros.status}
        </span>
      </div>
    </div>
  `;
}

// =========================
// SALVAR (TEMPO REAL)
// =========================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = recordDate.value;

  const docRef = doc(db, "status", data);

  const dados = {
    dataRegistro: data,

    antesCasa: {
      motorista: {
        nome: document.getElementById("antesCasa_motorista_nome").value,
        status: document.getElementById("antesCasa_motorista_status").value
      },
      passageiros: {
        nomes: document.getElementById("antesCasa_passageiros").value,
        status: document.getElementById("antesCasa_passageiros_status").value
      }
    },

    aposAlmoco: {
      motorista: {
        nome: document.getElementById("aposAlmoco_motorista_nome").value,
        status: document.getElementById("aposAlmoco_motorista_status").value
      },
      passageiros: {
        nomes: document.getElementById("aposAlmoco_passageiros").value,
        status: document.getElementById("aposAlmoco_passageiros_status").value
      }
    },

    antesCliente: {
      motorista: {
        nome: document.getElementById("antesCliente_motorista_nome").value,
        status: document.getElementById("antesCliente_motorista_status").value
      },
      passageiros: {
        nomes: document.getElementById("antesCliente_passageiros").value,
        status: document.getElementById("antesCliente_passageiros_status").value
      }
    },

    atualizadoEm: serverTimestamp()
  };

  try {
    await setDoc(docRef, dados, { merge: true });

    setMensagem("Atualizado em tempo real ✔");
    form.reset();
    recordDate.value = hojeISO();

  } catch (err) {
    console.error(err);
    setMensagem("Erro no Firebase", true);
  }
});

// =========================
// LISTAGEM TEMPO REAL
// =========================
const colRef = collection(db, "status");
const q = query(colRef, orderBy("dataRegistro", "desc"));

onSnapshot(q, (snapshot) => {
  lista.innerHTML = "";

  snapshot.forEach((doc) => {
    const d = doc.data();
    const li = document.createElement("li");
    li.innerHTML = montarCard(d);
    lista.appendChild(li);
  });
});
