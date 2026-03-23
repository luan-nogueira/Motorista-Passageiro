# Projeto Frota + WhatsApp

## Arquivos
- `index.html`
- `style.css`
- `app.js`
- `server.js`
- `package.json`
- `.env.example`

## Como usar
1. Instale o Node.js.
2. Abra a pasta do projeto no terminal.
3. Rode:
   npm install
4. Copie `.env.example` para `.env` e preencha:
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_TO`
5. Rode o backend:
   npm start
6. Abra o `index.html` em um servidor local ou no seu hospedador.

## Importante
- O alerta por WhatsApp usa a API oficial WhatsApp Cloud API.
- O envio automático funciona quando alguém clica em **Enviar alerta no WhatsApp**.
- Para virar automático sem abrir o site, você pode agendar chamadas no backend depois.
