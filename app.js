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

const form = document.getElementById("formStatus");
const lista = document.getElementById("lista");

const col = collection(db, "status");

// SALVAR
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = document.getElementById("nome").value;
  const status = document.getElementById("status").value;

  await addDoc(col, {
    nome,
    status,
    criadoEm: serverTimestamp()
  });

  form.reset();
});

// LISTAR EM TEMPO REAL
const q = query(col, orderBy("criadoEm", "desc"));

onSnapshot(q, (snapshot) => {
  lista.innerHTML = "";

  snapshot.forEach((doc) => {
    const data = doc.data();

    const li = document.createElement("li");
    li.textContent = `${data.nome} - ${data.status}`;

    lista.appendChild(li);
  });
});
