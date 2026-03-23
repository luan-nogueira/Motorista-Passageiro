import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const WHATSAPP_TO = process.env.WHATSAPP_TO || "";

function isConfigured() {
  return Boolean(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID && WHATSAPP_TO);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, whatsappConfigured: isConfigured() });
});

app.post("/api/notify-pending", async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({
        ok: false,
        message: "WhatsApp não configurado no backend."
      });
    }

    const { date, pendingVehicles = [], filledCount = 0, totalVehicles = 0 } = req.body || {};

    if (!date) {
      return res.status(400).json({ ok: false, message: "Data obrigatória." });
    }

    if (!Array.isArray(pendingVehicles) || pendingVehicles.length === 0) {
      return res.status(400).json({ ok: false, message: "Nenhum veículo pendente para enviar." });
    }

    const pendingLines = pendingVehicles.map((vehicle, index) => {
      const nome = vehicle.nome || "Veículo";
      const placa = vehicle.placa ? ` (${vehicle.placa})` : "";
      return `${index + 1}. ${nome}${placa}`;
    }).join("\n");

    const text = [
      "🚗 *Alerta de preenchimento de frota*",
      "",
      `📅 Data: ${date}`,
      `✅ Preenchidos: ${filledCount}/${totalVehicles}`,
      `⚠️ Pendentes: ${pendingVehicles.length}`,
      "",
      pendingLines
    ].join("\n");

    const endpoint = `https://graph.facebook.com/v23.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: WHATSAPP_TO,
        type: "text",
        text: {
          body: text
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        ok: false,
        message: "Erro ao enviar mensagem no WhatsApp.",
        details: data
      });
    }

    res.json({ ok: true, message: "Mensagem enviada com sucesso.", data });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Erro interno no backend.",
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
