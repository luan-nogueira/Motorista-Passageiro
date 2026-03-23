import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

/* =========================
   ELEMENTOS
========================= */
const connectionStatus = document.getElementById("connectionStatus");
const clockText = document.getElementById("clockText");
const alertBanner = document.getElementById("alertBanner");
const toast = document.getElementById("toast");

const vehicleSelect = document.getElementById("vehicleSelect");
const recordDate = document.getElementById("recordDate");

const vehicleName = document.getElementById("vehicleName");
const vehiclePlate = document.getElementById("vehiclePlate");
const vehicleType = document.getElementById("vehicleType");
const vehicleActionMsg = document.getElementById("vehicleActionMsg");

const btnAddVehicle = document.getElementById("btnAddVehicle");
const btnEnableNotifications = document.getElementById("btnEnableNotifications");
const btnToday = document.getElementById("btnToday");
const btnSave = document.getElementById("btnSave");
const btnReset = document.getElementById("btnReset");
const saveMsg = document.getElementById("saveMsg");

const countGood = document.getElementById("countGood");
const countRegular = document.getElementById("countRegular");
const countBad = document.getElementById("countBad");
const overallStatus = document.getElementById("overallStatus");

const metaVehicle = document.getElementById("metaVehicle");
const metaDate = document.getElementById("metaDate");
const lastUpdateText = document.getElementById("lastUpdateText");
const historyList = document.getElementById("historyList");
const livePanel = document.getElementById("livePanel");

/* =========================
   CAMPOS DO FORM
========================= */
const fieldIds = [
  "antesCasa_motorista",
  "antesCasa_passageiro",
  "antesCasa_obs",
  "aposAlmoco_motorista",
  "aposAlmoco_passageiro",
  "aposAlmoco_obs",
  "antesCliente_motorista",
  "antesCliente_passageiro",
  "antesCliente_obs"
];

const defaults = {
  antesCasa_motorista: "ótimo",
  antesCasa_passageiro: "ótimo",
  antesCasa_obs: "",
  aposAlmoco_motorista: "ótimo",
  aposAlmoco_passageiro: "ótimo",
  aposAlmoco_obs: "",
  antesCliente_motorista: "ótimo",
  antesCliente_passageiro: "ótimo",
  antesCliente_obs: ""
};

/* =========================
   ESTADO
========================= */
let vehiclesCache = [];
let currentVehicleId = "";
let currentVehicleName = "";
let currentRecordDate = todayISO();
let unsubscribeRecord = null;
let unsubscribeHistory = null;
let debounceTimer = null;
let lastAlertLevel = "";
let lastToastKey = "";

/* =========================
   HELPERS
========================= */
function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDateBR(iso) {
  if (!iso) return "--";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatDateTimeBR(dateObj) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(dateObj);
}

function normalizePlate(value) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusClass(value) {
  if (value === "ótimo") return "good";
  if (value === "regular") return "regular";
  return "bad";
}

function statusLabel(value) {
  if (value === "ótimo") return "Ótimo";
  if (value === "regular") return "Regular";
  return "Ruim";
}

function getFormData() {
  const data = {};
  fieldIds.forEach((id) => {
    const el = document.getElementById(id);
    data[id] = el.value.trim();
  });
  return data;
}

function fillForm(data = defaults) {
  fieldIds.forEach((id) => {
    const el = document.getElementById(id);
    el.value = data[id] ?? defaults[id] ?? "";
  });
}

function computeSummary(data) {
  const statuses = [
    data.antesCasa_motorista,
    data.antesCasa_passageiro,
    data.aposAlmoco_motorista,
    data.aposAlmoco_passageiro,
    data.antesCliente_motorista,
    data.antesCliente_passageiro
  ];

  const good = statuses.filter((s) => s === "ótimo").length;
  const regular = statuses.filter((s) => s === "regular").length;
  const bad = statuses.filter((s) => s === "ruim").length;

  let level = "good";
  let text = "Condição geral ótima para execução das atividades.";

  if (bad > 0) {
    level = "bad";
    text = "Alerta crítico: existe ao menos um registro RUIM para execução das atividades.";
  } else if (regular > 0) {
    level = "regular";
    text = "Atenção: existem registros REGULARES que merecem acompanhamento.";
  }

  return { good, regular, bad, level, text };
}

function vehicleDocRef(vehicleId) {
  return doc(db, "veiculos", vehicleId);
}

function recordsColRef(vehicleId) {
  return collection(db, "veiculos", vehicleId, "registros");
}

function recordDocRef(vehicleId, dateIso) {
  return doc(db, "veiculos", vehicleId, "registros", dateIso);
}

function setMiniMessage(el, text, isError = false) {
  el.textContent = text;
  el.style.color = isError ? "#dc2626" : "#475569";
}

function showToast(message, level = "good") {
  const key = `${level}:${message}`;
  if (lastToastKey === key) return;
  lastToastKey = key;

  toast.className = `toast ${level}`;
  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3500);
}

function updateClock() {
  clockText.textContent = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date());
}

function renderSummary(summary) {
  countGood.textContent = summary.good;
  countRegular.textContent = summary.regular;
  countBad.textContent = summary.bad;

  overallStatus.className = `overall-status ${summary.level}`;
  overallStatus.textContent = summary.text;
}

function renderAlertBanner(summary) {
  alertBanner.classList.remove("hidden", "good", "regular", "bad");
  alertBanner.classList.add(summary.level);

  if (summary.level === "bad") {
    alertBanner.textContent = `🚨 ALERTA AUTOMÁTICO • ${currentVehicleName || "Veículo"} • ${formatDateBR(currentRecordDate)} • Há condição ruim para executar as atividades.`;
    return;
  }

  if (summary.level === "regular") {
    alertBanner.textContent = `⚠️ ATENÇÃO • ${currentVehicleName || "Veículo"} • ${formatDateBR(currentRecordDate)} • Existem condições regulares que exigem atenção.`;
    return;
  }

  alertBanner.textContent = `✅ Tudo em condição ótima para ${currentVehicleName || "o veículo"} em ${formatDateBR(currentRecordDate)}.`;
}

function maybeNotify(summary) {
  if (!currentVehicleName) return;

  const key = `${currentVehicleId}_${currentRecordDate}_${summary.level}`;
  if (lastAlertLevel === key) return;
  lastAlertLevel = key;

  if (summary.level === "bad") {
    showToast(`Alerta crítico em ${currentVehicleName} • ${formatDateBR(currentRecordDate)}`, "bad");
    sendBrowserNotification(
      "Alerta crítico",
      `${currentVehicleName} está com condição ruim em ${formatDateBR(currentRecordDate)}.`
    );
  } else if (summary.level === "regular") {
    showToast(`Atenção em ${currentVehicleName} • ${formatDateBR(currentRecordDate)}`, "regular");
    sendBrowserNotification(
      "Atenção",
      `${currentVehicleName} possui condição regular em ${formatDateBR(currentRecordDate)}.`
    );
  }
}

function sendBrowserNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification(title, {
    body,
    icon: "https://www.gstatic.com/images/branding/product/2x/firebase_96dp.png"
  });
}

function renderLivePanel(data) {
  livePanel.innerHTML = `
    <div class="live-item">
      <h3>Antes de sair de casa</h3>
      <div class="live-line">
        <strong>Motorista</strong>
        <span class="badge ${statusClass(data.antesCasa_motorista)}">${statusLabel(data.antesCasa_motorista)}</span>
      </div>
      <div class="live-line">
        <strong>Passageiro</strong>
        <span class="badge ${statusClass(data.antesCasa_passageiro)}">${statusLabel(data.antesCasa_passageiro)}</span>
      </div>
      ${
        data.antesCasa_obs
          ? `<div class="obs-box"><strong>Observação:</strong> ${escapeHtml(data.antesCasa_obs)}</div>`
          : ""
      }
    </div>

    <div class="live-item">
      <h3>Após almoço</h3>
      <div class="live-line">
        <strong>Motorista</strong>
        <span class="badge ${statusClass(data.aposAlmoco_motorista)}">${statusLabel(data.aposAlmoco_motorista)}</span>
      </div>
      <div class="live-line">
        <strong>Passageiro</strong>
        <span class="badge ${statusClass(data.aposAlmoco_passageiro)}">${statusLabel(data.aposAlmoco_passageiro)}</span>
      </div>
      ${
        data.aposAlmoco_obs
          ? `<div class="obs-box"><strong>Observação:</strong> ${escapeHtml(data.aposAlmoco_obs)}</div>`
          : ""
      }
    </div>

    <div class="live-item">
      <h3>Antes de sair do cliente</h3>
      <div class="live-line">
        <strong>Motorista</strong>
        <span class="badge ${statusClass(data.antesCliente_motorista)}">${statusLabel(data.antesCliente_motorista)}</span>
      </div>
      <div class="live-line">
        <strong>Passageiro</strong>
        <span class="badge ${statusClass(data.antesCliente_passageiro)}">${statusLabel(data.antesCliente_passageiro)}</span>
      </div>
      ${
        data.antesCliente_obs
          ? `<div class="obs-box"><strong>Observação:</strong> ${escapeHtml(data.antesCliente_obs)}</div>`
          : ""
      }
    </div>
  `;
}

function renderHistory(items) {
  if (!items.length) {
    historyList.innerHTML = `<div class="history-empty">Sem histórico para este veículo ainda.</div>`;
    return;
  }

  historyList.innerHTML = items
    .map((item) => {
      const active = item.id === currentRecordDate ? "active" : "";
      const summary = item.summary || computeSummary(item);
      return `
        <div class="history-item ${active}" data-date="${item.id}">
          <div class="history-top">
            <div class="history-date">${formatDateBR(item.id)}</div>
            <span class="badge ${summary.level}">${
        summary.level === "good" ? "Ótimo" : summary.level === "regular" ? "Atenção" : "Crítico"
      }</span>
          </div>
          <div class="history-mini">
            <span class="badge good">Ótimo: ${summary.good ?? 0}</span>
            <span class="badge regular">Regular: ${summary.regular ?? 0}</span>
            <span class="badge bad">Ruim: ${summary.bad ?? 0}</span>
          </div>
        </div>
      `;
    })
    .join("");

  historyList.querySelectorAll(".history-item").forEach((item) => {
    item.addEventListener("click", () => {
      recordDate.value = item.dataset.date;
      currentRecordDate = item.dataset.date;
      subscribeCurrentRecord();
      subscribeHistory();
    });
  });
}

/* =========================
   VEÍCULOS
========================= */
async function ensureSeedVehicles() {
  const col = collection(db, "veiculos");
  const snap = await getDocs(col);
  if (!snap.empty) return;

  const seed = [
    { nome: "Polo 01", placa: "AAA1A11", tipo: "Leve", ativo: true },
    { nome: "Onix 02", placa: "BBB2B22", tipo: "Leve", ativo: true }
  ];

  for (const item of seed) {
    await addDoc(col, {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

function subscribeVehicles() {
  const q = query(collection(db, "veiculos"), orderBy("nome"));
  onSnapshot(
    q,
    (snap) => {
      connectionStatus.textContent = "Online em tempo real";
      vehiclesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderVehicleSelect();
    },
    () => {
      connectionStatus.textContent = "Erro de conexão";
    }
  );
}

function renderVehicleSelect() {
  if (!vehiclesCache.length) {
    vehicleSelect.innerHTML = `<option value="">Nenhum veículo cadastrado</option>`;
    currentVehicleId = "";
    currentVehicleName = "";
    return;
  }

  vehicleSelect.innerHTML = vehiclesCache
    .map((v) => {
      const label = `${v.nome} • ${v.placa || "sem placa"}${v.tipo ? ` • ${v.tipo}` : ""}`;
      return `<option value="${v.id}">${escapeHtml(label)}</option>`;
    })
    .join("");

  const exists = vehiclesCache.some((v) => v.id === currentVehicleId);
  if (!exists) {
    currentVehicleId = vehiclesCache[0].id;
  }

  vehicleSelect.value = currentVehicleId;
  const selected = vehiclesCache.find((v) => v.id === currentVehicleId);
  currentVehicleName = selected ? selected.nome : "";

  metaVehicle.textContent = selected
    ? `${selected.nome} • ${selected.placa || "sem placa"}${selected.tipo ? ` • ${selected.tipo}` : ""}`
    : "--";

  subscribeCurrentRecord();
  subscribeHistory();
}

async function addVehicle() {
  const nome = vehicleName.value.trim();
  const placa = normalizePlate(vehiclePlate.value);
  const tipo = vehicleType.value.trim();

  if (!nome) {
    setMiniMessage(vehicleActionMsg, "Informe o nome do veículo.", true);
    return;
  }

  try {
    setMiniMessage(vehicleActionMsg, "Adicionando veículo...");
    await addDoc(collection(db, "veiculos"), {
      nome,
      placa,
      tipo,
      ativo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    vehicleName.value = "";
    vehiclePlate.value = "";
    vehicleType.value = "";

    setMiniMessage(vehicleActionMsg, "Veículo cadastrado com sucesso.");
  } catch (error) {
    console.error(error);
    setMiniMessage(vehicleActionMsg, "Erro ao cadastrar veículo.", true);
  }
}

/* =========================
   REGISTRO ATUAL
========================= */
async function saveCurrentRecord(showMessage = false) {
  if (!currentVehicleId) return;

  const form = getFormData();
  const summary = computeSummary(form);

  const payload = {
    ...form,
    date: currentRecordDate,
    vehicleId: currentVehicleId,
    vehicleName: currentVehicleName,
    summary,
    updatedAt: serverTimestamp()
  };

  try {
    if (showMessage) setMiniMessage(saveMsg, "Salvando...");
    await setDoc(recordDocRef(currentVehicleId, currentRecordDate), payload, { merge: true });
    await setDoc(
      vehicleDocRef(currentVehicleId),
      {
        updatedAt: serverTimestamp(),
        ultimoRegistroData: currentRecordDate,
        ultimoStatus: summary.level
      },
      { merge: true }
    );
    if (showMessage) setMiniMessage(saveMsg, "Dados salvos com sucesso.");
  } catch (error) {
    console.error(error);
    setMiniMessage(saveMsg, "Erro ao salvar os dados.", true);
  }
}

function scheduleAutoSave() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    saveCurrentRecord(false);
  }, 400);
}

function subscribeCurrentRecord() {
  if (!currentVehicleId) return;

  if (unsubscribeRecord) unsubscribeRecord();
  currentRecordDate = recordDate.value || todayISO();

  const currentVehicle = vehiclesCache.find((v) => v.id === currentVehicleId);
  currentVehicleName = currentVehicle ? currentVehicle.nome : "";
  metaVehicle.textContent = currentVehicle
    ? `${currentVehicle.nome} • ${currentVehicle.placa || "sem placa"}${currentVehicle.tipo ? ` • ${currentVehicle.tipo}` : ""}`
    : "--";
  metaDate.textContent = formatDateBR(currentRecordDate);

  unsubscribeRecord = onSnapshot(
    recordDocRef(currentVehicleId, currentRecordDate),
    (snap) => {
      const data = snap.exists()
        ? { ...defaults, ...snap.data() }
        : { ...defaults };

      fillForm(data);

      const summary = data.summary || computeSummary(data);
      renderSummary(summary);
      renderAlertBanner(summary);
      renderLivePanel(data);
      maybeNotify(summary);

      if (data.updatedAt && typeof data.updatedAt.toDate === "function") {
        lastUpdateText.textContent = formatDateTimeBR(data.updatedAt.toDate());
      } else {
        lastUpdateText.textContent = "Sem salvamento ainda";
      }
    },
    (error) => {
      console.error(error);
      connectionStatus.textContent = "Erro de conexão";
    }
  );
}

function subscribeHistory() {
  if (!currentVehicleId) return;

  if (unsubscribeHistory) unsubscribeHistory();

  const q = query(recordsColRef(currentVehicleId), orderBy("date", "desc"), limit(30));
  unsubscribeHistory = onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderHistory(items);
  });
}

/* =========================
   EVENTOS
========================= */
vehicleSelect.addEventListener("change", () => {
  currentVehicleId = vehicleSelect.value;
  const selected = vehiclesCache.find((v) => v.id === currentVehicleId);
  currentVehicleName = selected ? selected.nome : "";
  subscribeCurrentRecord();
  subscribeHistory();
});

recordDate.addEventListener("change", () => {
  currentRecordDate = recordDate.value || todayISO();
  subscribeCurrentRecord();
  subscribeHistory();
});

fieldIds.forEach((id) => {
  const el = document.getElementById(id);
  el.addEventListener("change", () => saveCurrentRecord(false));
  el.addEventListener("input", scheduleAutoSave);
});

btnAddVehicle.addEventListener("click", addVehicle);

btnSave.addEventListener("click", () => saveCurrentRecord(true));

btnReset.addEventListener("click", async () => {
  fillForm(defaults);
  await saveCurrentRecord(true);
});

btnToday.addEventListener("click", () => {
  recordDate.value = todayISO();
  currentRecordDate = recordDate.value;
  subscribeCurrentRecord();
  subscribeHistory();
});

btnEnableNotifications.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    showToast("Este navegador não suporta notificações.", "regular");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    showToast("Notificações ativadas com sucesso.", "good");
  } else {
    showToast("Notificações não foram autorizadas.", "regular");
  }
});

/* =========================
   INICIALIZAÇÃO
========================= */
async function init() {
  recordDate.value = todayISO();
  currentRecordDate = recordDate.value;
  fillForm(defaults);
  renderLivePanel(defaults);
  renderSummary(computeSummary(defaults));
  renderAlertBanner(computeSummary(defaults));
  updateClock();
  setInterval(updateClock, 1000);

  await ensureSeedVehicles();
  subscribeVehicles();
}

init();