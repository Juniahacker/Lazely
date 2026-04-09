const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

// ✅ Homepage
app.get("/", (req, res) => {
  res.send("Server is running ✅");
});

// ✅ Webhook verification (Meta)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    console.log("WEBHOOK VERIFIED");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 🔥 AI FUNCTION (YOU.com)
async function getAIReply(userText) {
  try {
    const response = await axios.post(
      "https://api.ydc-index.io/chat",
      {
        query: userText,
        chat_mode: "chat",
        search_mode: "default"
      },
      {
        headers: {
          "X-API-Key": process.env.YOU_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    // YOU.com response extraction (safe fallback included)
    const reply =
      response.data?.answer ||
      response.data?.output ||
      response.data?.message ||
      "I couldn't think of a response.";

    return reply;
  } catch (error) {
    console.error("YOU API ERROR:", error.response?.data || error.message);
    return "AI service error ❌";
  }
}

// 📩 WhatsApp webhook
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const userText = message.text?.body || "";

      console.log("User:", from);
      console.log("Message:", userText);

      // 🤖 Get AI reply from YOU.com
      const botReply = await getAIReply(userText);
      console.log("AI Reply:", botReply);

      // 📤 Send WhatsApp reply
      await axios.post(
        `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: botReply }
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook Error:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

// 🚀 Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
