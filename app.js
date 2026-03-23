import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
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

const root = document.documentElement;

const connectionStatus = document.getElementById("connectionStatus");
const clockText = document.getElementById("clockText");
const alertBanner = document.getElementById("alertBanner");
const toast = document.getElementById("toast");
const btnThemeToggle = document.getElementById("btnThemeToggle");

const vehicleSearch = document.getElementById("vehicleSearch");
const vehicleList = document.getElementById("vehicleList");
const selectedVehicleText = document.getElementById("selectedVehicleText");
const btnLastVehicle = document.getElementById("btnLastVehicle");
const btnDeleteVehicle = document.getElementById("btnDeleteVehicle");

const vehicleName = document.getElementById("vehicleName");
const vehiclePlate = document.getElementById("vehiclePlate");
const vehicleType = document.getElementById("vehicleType");
const btnAddVehicle = document.getElementById("btnAddVehicle");
const vehicleActionMsg = document.getElementById("vehicleActionMsg");

const nomeMotorista = document.getElementById("nomeMotorista");
const nomePassageiros = document.getElementById("nomePassageiros");

const recordDate = document.getElementById("recordDate");
const btnEnableNotifications = document.getElementById("btnEnableNotifications");
const btnToday = document.getElementById("btnToday");
const btnSave = document.getElementById("btnSave");
const btnReset = document.getElementById("btnReset");
const btnDeleteRecord = document.getElementById("btnDeleteRecord");
const saveMsg = document.getElementById("saveMsg");

const countGood = document.getElementById("countGood");
const countRegular = document.getElementById("countRegular");
const countBad = document.getElementById("countBad");
const overallStatus = document.getElementById("overallStatus");

const metaVehicle = document.getElementById("metaVehicle");
const metaDate = document.getElementById("metaDate");
const metaDriver = document.getElementById("metaDriver");
const metaPassenger = document.getElementById("metaPassenger");
const lastUpdateText = document.getElementById("lastUpdateText");
const historyList = document.getElementById("historyList");
const livePanel = document.getElementById("livePanel");

const fieldIds = [
  "nomeMotorista",
  "nomePassageiros",
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
  nomeMotorista: "",
  nomePassageiros: "",
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

const FROTA_INICIAL = [
  { nome: "OROCH", placa: "SFW9D86", tipo: "Picape" },
  { nome: "OROCH", placa: "SFZ6E09", tipo: "Picape" },
  { nome: "ÔNIX", placa: "SSV3C08", tipo: "Leve" },
  { nome: "POLO", placa: "TMA7B03", tipo: "Leve" },
  { nome: "POLO", placa: "TEA8F37", tipo: "Leve" },
  { nome: "POLO", placa: "TCW7810", tipo: "Leve" },
  { nome: "ARGO", placa: "TEY5J53", tipo: "Leve" },
  { nome: "ARGO", placa: "TEY5J49", tipo: "Leve" },
  { nome: "ARGO", placa: "TEY5J45", tipo: "Leve" },
  { nome: "POLO", placa: "TYA1B34", tipo: "Leve" },
  { nome: "POLO", placa: "TLZ0J58", tipo: "Leve" },
  { nome: "ONIX", placa: "TXN1E93", tipo: "Leve" },
  { nome: "HB20", placa: "TEA2F05", tipo: "Leve" }
];

let vehiclesCache = [];
let filteredVehicles = [];
let currentVehicleId = "";
let currentVehicleName = "";
let currentRecordDate = todayISO();
let unsubscribeRecord = null;
let unsubscribeHistory = null;
let debounceTimer = null;
let lastAlertLevel = "";
let lastToastKey = "";

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

function normalizePlate(value = "") {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPassengersText(text = "") {
  return String(text)
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
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
    if (!el) return;
    data[id] = el.value.trim();
  });
  return data;
}

function fillForm(data = defaults) {
  fieldIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = data[id] ?? defaults[id] ?? "";
  });
}

function hasMeaningfulData(data = {}) {
  return Boolean(
    (data.nomeMotorista || "").trim() ||
    (data.nomePassageiros || "").trim() ||
    (data.antesCasa_obs || "").trim() ||
    (data.aposAlmoco_obs || "").trim() ||
    (data.antesCliente_obs || "").trim()
  );
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
    text = "Alerta crítico: existe ao menos um registro ruim para execução das atividades.";
  } else if (regular > 0) {
    level = "regular";
    text = "Atenção: existem registros regulares que merecem acompanhamento.";
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
  el.style.color = isError ? "#dc2626" : "";
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

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  localStorage.setItem("themeFrota", theme);
  btnThemeToggle.textContent = theme === "dark" ? "☀️ Tema claro" : "🌙 Tema escuro";
}

function initTheme() {
  if (!btnThemeToggle) return;

  const saved = localStorage.getItem("themeFrota");
  if (saved === "dark" || saved === "light") {
    applyTheme(saved);
    return;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function toggleTheme() {
  const current = root.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

function renderSummary(summary) {
  countGood.textContent = summary.good;
  countRegular.textContent = summary.regular;
  countBad.textContent = summary.bad;
  overallStatus.className = `overall-status ${summary.level}`;
  overallStatus.textContent = summary.text;
}

function renderNoRecordState() {
  countGood.textContent = "--";
  countRegular.textContent = "--";
  countBad.textContent = "--";

  overallStatus.className = "overall-status";
  overallStatus.textContent = "Nenhum registro salvo para esta data.";

  alertBanner.className = "alert-banner hidden";
  alertBanner.textContent = "";

  livePanel.innerHTML = `
    <div class="live-item">
      <h3>Sem dados registrados</h3>
      <div class="obs-box" style="margin-top:0;padding-top:0;border-top:none;">
        Nenhum registro foi salvo para este veículo nesta data.
      </div>
    </div>
  `;

  metaDriver.textContent = "--";
  metaPassenger.textContent = "--";
  lastUpdateText.textContent = "Sem salvamento ainda";
}

function renderAlertBanner(summary, show = true) {
  if (!show) {
    alertBanner.className = "alert-banner hidden";
    alertBanner.textContent = "";
    return;
  }

  alertBanner.classList.remove("hidden", "good", "regular", "bad");
  alertBanner.classList.add(summary.level);

  if (summary.level === "bad") {
    alertBanner.textContent = `Alerta • ${currentVehicleName || "Veículo"} • ${formatDateBR(currentRecordDate)} • Há condição ruim para executar as atividades.`;
    return;
  }

  if (summary.level === "regular") {
    alertBanner.textContent = `Atenção • ${currentVehicleName || "Veículo"} • ${formatDateBR(currentRecordDate)} • Existem condições regulares que exigem atenção.`;
    return;
  }

  alertBanner.textContent = `Tudo em condição ótima para ${currentVehicleName || "o veículo"} em ${formatDateBR(currentRecordDate)}.`;
}

function maybeNotify(summary, data) {
  if (!currentVehicleName) return;
  if (!hasMeaningfulData(data)) return;

  const key = `${currentVehicleId}_${currentRecordDate}_${summary.level}`;
  if (lastAlertLevel === key) return;
  lastAlertLevel = key;

  if (summary.level === "bad") {
    showToast(`Alerta crítico em ${currentVehicleName} • ${formatDateBR(currentRecordDate)}`, "bad");
    sendBrowserNotification("Alerta crítico", `${currentVehicleName} está com condição ruim em ${formatDateBR(currentRecordDate)}.`);
  } else if (summary.level === "regular") {
    showToast(`Atenção em ${currentVehicleName} • ${formatDateBR(currentRecordDate)}`, "regular");
    sendBrowserNotification("Atenção", `${currentVehicleName} possui condição regular em ${formatDateBR(currentRecordDate)}.`);
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
  const passageirosFormatados = formatPassengersText(data.nomePassageiros || "--") || "--";

  livePanel.innerHTML = `
    <div class="team-box">
      <div><strong>Motorista:</strong> ${escapeHtml(data.nomeMotorista || "--")}</div>
      <div><strong>Passageiros:</strong> ${escapeHtml(passageirosFormatados)}</div>
    </div>

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
      ${data.antesCasa_obs ? `<div class="obs-box"><strong>Observação:</strong> ${escapeHtml(data.antesCasa_obs)}</div>` : ""}
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
      ${data.aposAlmoco_obs ? `<div class="obs-box"><strong>Observação:</strong> ${escapeHtml(data.aposAlmoco_obs)}</div>` : ""}
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
      ${data.antesCliente_obs ? `<div class="obs-box"><strong>Observação:</strong> ${escapeHtml(data.antesCliente_obs)}</div>` : ""}
    </div>
  `;
}

function renderHistory(items) {
  if (!items.length) {
    historyList.innerHTML = `<div class="history-empty">Sem histórico para este veículo ainda.</div>`;
    return;
  }

  historyList.innerHTML = items.map((item) => {
    const active = item.id === currentRecordDate ? "active" : "";
    const summary = item.summary || computeSummary(item);

    return `
      <div class="history-item ${active}" data-date="${item.id}">
        <div class="history-top">
          <div class="history-date">${formatDateBR(item.id)}</div>
          <span class="badge ${summary.level}">
            ${summary.level === "good" ? "Ótimo" : summary.level === "regular" ? "Atenção" : "Crítico"}
          </span>
        </div>

        <div class="history-mini">
          <span class="badge good">Ótimo: ${summary.good ?? 0}</span>
          <span class="badge regular">Regular: ${summary.regular ?? 0}</span>
          <span class="badge bad">Ruim: ${summary.bad ?? 0}</span>
        </div>

        <div class="history-actions">
          <button class="history-btn edit" data-edit-date="${item.id}">Editar</button>
          <button class="history-btn delete" data-delete-date="${item.id}">Apagar</button>
        </div>
      </div>
    `;
  }).join("");

  historyList.querySelectorAll(".history-item").forEach((item) => {
    item.addEventListener("click", () => {
      loadRecordDate(item.dataset.date);
    });
  });

  historyList.querySelectorAll("[data-edit-date]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      loadRecordDate(btn.dataset.editDate);
      showToast(`Registro de ${formatDateBR(btn.dataset.editDate)} carregado para edição.`, "good");
    });
  });

  historyList.querySelectorAll("[data-delete-date]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await deleteRecordByDate(btn.dataset.deleteDate);
    });
  });
}

async function ensureSeedVehicles() {
  const col = collection(db, "veiculos");
  const snap = await getDocs(col);

  if (!snap.empty) return;

  for (const item of FROTA_INICIAL) {
    await addDoc(col, {
      ...item,
      ativo: true,
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
      applyVehicleFilter();
    },
    () => {
      connectionStatus.textContent = "Erro de conexão";
    }
  );
}

function applyVehicleFilter() {
  const term = vehicleSearch.value.trim().toLowerCase();

  filteredVehicles = vehiclesCache.filter((v) => {
    const text = `${v.nome || ""} ${v.placa || ""} ${v.tipo || ""}`.toLowerCase();
    return text.includes(term);
  });

  renderVehicleList(filteredVehicles);
}

function renderVehicleList(list) {
  if (!list.length) {
    vehicleList.innerHTML = `<div class="history-empty">Nenhum veículo encontrado.</div>`;
    selectedVehicleText.textContent = "Nenhum veículo encontrado";
    return;
  }

  const stillExists = vehiclesCache.some((v) => v.id === currentVehicleId);
  if (!currentVehicleId || !stillExists) {
    currentVehicleId = list[0].id;
  }

  vehicleList.innerHTML = list.map((v) => {
    const active = v.id === currentVehicleId ? "active" : "";
    return `
      <div class="vehicle-item ${active}" data-id="${v.id}">
        <div class="vehicle-top">
          <div class="vehicle-name">${escapeHtml(v.nome || "Sem nome")}</div>
          <div class="vehicle-plate">${escapeHtml(v.placa || "SEM PLACA")}</div>
        </div>
        <div class="vehicle-type">${escapeHtml(v.tipo || "Sem tipo")}</div>
      </div>
    `;
  }).join("");

  vehicleList.querySelectorAll(".vehicle-item").forEach((item) => {
    item.addEventListener("click", () => {
      selectVehicle(item.dataset.id);
    });
  });

  updateSelectedVehicleInfo();
}

function selectVehicle(vehicleId) {
  currentVehicleId = vehicleId;
  const selected = vehiclesCache.find((v) => v.id === currentVehicleId);
  currentVehicleName = selected ? selected.nome : "";

  if (selected) {
    localStorage.setItem("ultimoVeiculoId", selected.id);
  }

  updateSelectedVehicleInfo();
  applyVehicleFilter();
  subscribeCurrentRecord();
  subscribeHistory();
}

function updateSelectedVehicleInfo() {
  const selected = vehiclesCache.find((v) => v.id === currentVehicleId);
  currentVehicleName = selected ? selected.nome : "";

  if (!selected) {
    selectedVehicleText.textContent = "Nenhum veículo selecionado";
    metaVehicle.textContent = "--";
    return;
  }

  const label = `${selected.nome} • ${selected.placa || "sem placa"}${selected.tipo ? ` • ${selected.tipo}` : ""}`;
  selectedVehicleText.textContent = label;
  metaVehicle.textContent = label;
}

function loadLastVehicle() {
  const saved = localStorage.getItem("ultimoVeiculoId");
  if (!saved) {
    showToast("Nenhum último veículo salvo ainda.", "regular");
    return;
  }

  const exists = vehiclesCache.find((v) => v.id === saved);
  if (!exists) {
    showToast("Último veículo não foi encontrado.", "regular");
    return;
  }

  selectVehicle(saved);
  showToast("Último veículo carregado com sucesso.", "good");
}

function loadRecordDate(dateIso) {
  recordDate.value = dateIso;
  currentRecordDate = dateIso;
  subscribeCurrentRecord();
  subscribeHistory();
}

async function addVehicle() {
  const nome = vehicleName.value.trim().toUpperCase();
  const placa = normalizePlate(vehiclePlate.value);
  const tipo = vehicleType.value.trim();

  if (!nome || !placa) {
    setMiniMessage(vehicleActionMsg, "Informe veículo e placa.", true);
    return;
  }

  const duplicado = vehiclesCache.find((v) => normalizePlate(v.placa || "") === placa);
  if (duplicado) {
    setMiniMessage(vehicleActionMsg, "Já existe um veículo com essa placa.", true);
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
    setMiniMessage(vehicleActionMsg, "Veículo adicionado com sucesso.");
  } catch (error) {
    console.error(error);
    setMiniMessage(vehicleActionMsg, "Erro ao adicionar veículo.", true);
  }
}

async function deleteSelectedVehicle() {
  if (!currentVehicleId) {
    showToast("Selecione um veículo primeiro.", "regular");
    return;
  }

  const selected = vehiclesCache.find((v) => v.id === currentVehicleId);
  if (!selected) return;

  const ok = window.confirm(`Deseja remover o veículo ${selected.nome} • ${selected.placa}?`);
  if (!ok) return;

  try {
    await deleteDoc(vehicleDocRef(currentVehicleId));
    localStorage.removeItem("ultimoVeiculoId");
    currentVehicleId = "";
    currentVehicleName = "";
    showToast("Veículo removido da frota.", "good");
  } catch (error) {
    console.error(error);
    showToast("Erro ao remover veículo.", "bad");
  }
}

async function saveCurrentRecord(showMessage = false) {
  if (!currentVehicleId) {
    showToast("Selecione um veículo antes de salvar.", "regular");
    return;
  }

  const form = getFormData();

  if (!hasMeaningfulData(form)) {
    if (showMessage) {
      setMiniMessage(saveMsg, "Preencha motorista, passageiros ou observação antes de salvar.", true);
      showToast("Registro vazio não será salvo.", "regular");
    }
    return;
  }

  const payload = {
    ...form,
    nomePassageiros: formatPassengersText(form.nomePassageiros || ""),
    date: currentRecordDate,
    vehicleId: currentVehicleId,
    vehicleName: currentVehicleName,
    summary: computeSummary(form),
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
        ultimoStatus: payload.summary.level
      },
      { merge: true }
    );

    if (showMessage) {
      setMiniMessage(saveMsg, "Dados salvos com sucesso.");
      showToast(`Registro de ${formatDateBR(currentRecordDate)} salvo com sucesso.`, "good");
    }
  } catch (error) {
    console.error(error);
    setMiniMessage(saveMsg, "Erro ao salvar os dados.", true);
    showToast("Erro ao salvar registro.", "bad");
  }
}

async function deleteCurrentRecord() {
  if (!currentVehicleId) {
    showToast("Selecione um veículo primeiro.", "regular");
    return;
  }

  const docRef = recordDocRef(currentVehicleId, currentRecordDate);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    showToast("Não existe registro salvo neste dia.", "regular");
    return;
  }

  const ok = window.confirm(`Deseja apagar o registro de ${formatDateBR(currentRecordDate)}?`);
  if (!ok) return;

  try {
    await deleteDoc(docRef);
    fillForm(defaults);
    renderNoRecordState();
    setMiniMessage(saveMsg, "Registro apagado com sucesso.");
    showToast(`Registro de ${formatDateBR(currentRecordDate)} apagado.`, "good");
  } catch (error) {
    console.error(error);
    setMiniMessage(saveMsg, "Erro ao apagar o registro.", true);
    showToast("Erro ao apagar registro.", "bad");
  }
}

async function deleteRecordByDate(dateIso) {
  if (!currentVehicleId) {
    showToast("Selecione um veículo primeiro.", "regular");
    return;
  }

  const ok = window.confirm(`Deseja apagar o registro de ${formatDateBR(dateIso)}?`);
  if (!ok) return;

  try {
    await deleteDoc(recordDocRef(currentVehicleId, dateIso));

    if (dateIso === currentRecordDate) {
      fillForm(defaults);
      renderNoRecordState();
    }

    showToast(`Registro de ${formatDateBR(dateIso)} apagado.`, "good");
  } catch (error) {
    console.error(error);
    showToast("Erro ao apagar registro do histórico.", "bad");
  }
}

function scheduleAutoSave() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const form = getFormData();
    if (!hasMeaningfulData(form)) return;
    saveCurrentRecord(false);
  }, 700);
}

function subscribeCurrentRecord() {
  if (!currentVehicleId) return;

  if (unsubscribeRecord) unsubscribeRecord();
  currentRecordDate = recordDate.value || todayISO();

  updateSelectedVehicleInfo();
  metaDate.textContent = formatDateBR(currentRecordDate);

  unsubscribeRecord = onSnapshot(
    recordDocRef(currentVehicleId, currentRecordDate),
    (snap) => {
      if (!snap.exists()) {
        fillForm(defaults);
        renderNoRecordState();
        return;
      }

      const data = { ...defaults, ...snap.data() };
      fillForm(data);

      metaDriver.textContent = data.nomeMotorista || "--";
      metaPassenger.textContent = formatPassengersText(data.nomePassageiros || "--") || "--";

      const summary = data.summary || computeSummary(data);
      renderSummary(summary);
      renderAlertBanner(summary, true);
      renderLivePanel(data);
      maybeNotify(summary, data);

      if (data.updatedAt && typeof data.updatedAt.toDate === "function") {
        lastUpdateText.textContent = formatDateTimeBR(data.updatedAt.toDate());
      } else {
        lastUpdateText.textContent = "Sem salvamento ainda";
      }
    },
    () => {
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

vehicleSearch.addEventListener("input", applyVehicleFilter);
btnLastVehicle.addEventListener("click", loadLastVehicle);
btnDeleteVehicle.addEventListener("click", deleteSelectedVehicle);
btnAddVehicle.addEventListener("click", addVehicle);

if (btnThemeToggle) {
  btnThemeToggle.addEventListener("click", toggleTheme);
}

recordDate.addEventListener("change", () => {
  currentRecordDate = recordDate.value || todayISO();
  subscribeCurrentRecord();
  subscribeHistory();
});

fieldIds.forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", scheduleAutoSave);
  el.addEventListener("change", scheduleAutoSave);
});

btnSave.addEventListener("click", () => saveCurrentRecord(true));

btnReset.addEventListener("click", () => {
  fillForm(defaults);
  setMiniMessage(saveMsg, "Campos restaurados. Salve manualmente se quiser gravar.");
  showToast("Campos restaurados para o padrão.", "regular");
});

btnDeleteRecord.addEventListener("click", deleteCurrentRecord);

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

async function init() {
  initTheme();
  recordDate.value = todayISO();
  currentRecordDate = recordDate.value;
  fillForm(defaults);
  renderNoRecordState();
  metaDate.textContent = formatDateBR(currentRecordDate);
  updateClock();
  setInterval(updateClock, 1000);

  await ensureSeedVehicles();
  subscribeVehicles();
}

init();
