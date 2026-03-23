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

// CONFIG FIREBASE
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

// ELEMENTOS
const form = document.getElementById("formStatus");
const lista = document.getElementById("lista");

// COLEÇÃO
const col = collection(db, "status");

// SALVAR DADOS
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const motorista = document.getElementById("motorista").value;
  const passageiro = document.getElementById("passageiro").value;

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

// LISTAGEM EM TEMPO REAL
const q = query(col, orderBy("criadoEm", "desc"));

onSnapshot(q, (snapshot) => {
  lista.innerHTML = "";

  snapshot.forEach((doc) => {
    const d = doc.data();

    const li = document.createElement("li");

    li.innerHTML = `
      <strong>Motorista:</strong> ${d.motorista}<br>
      <strong>Passageiro:</strong> ${d.passageiro}<br><br>

      <strong>Antes de sair de casa:</strong><br>
      Motorista - ${d.antesCasa_motorista} para executar as atividades<br>
      Passageiro - ${d.antesCasa_passageiro} para executar as atividades<br><br>

      <strong>Após almoço:</strong><br>
      Motorista - ${d.aposAlmoco_motorista} para executar as atividades<br>
      Passageiro - ${d.aposAlmoco_passageiro} para executar as atividades<br><br>

      <strong>Antes de sair do cliente:</strong><br>
      Motorista - ${d.antesCliente_motorista} para executar as atividades<br>
      Passageiro - ${d.antesCliente_passageiro} para executar as atividades
    `;

    lista.appendChild(li);
  });
});
