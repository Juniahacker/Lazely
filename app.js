const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

/* =========================
   HOME ROUTE
========================= */
app.get("/", (req, res) => {
  res.send("Lazely AI Bot (Hugging Face) is running ✅");
});

/* =========================
   WEBHOOK VERIFY (Meta)
========================= */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    console.log("WEBHOOK VERIFIED");
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

/* =========================
   HUGGING FACE AI FUNCTION
========================= */
async function getAIReply(userText) {
  try {
    const response = await axios.post(
      "https://router.huggingface.co/",
      { inputs: userText },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return (
      response.data?.generated_text ||
      response.data?.[0]?.generated_text ||
      "I couldn't understand that 😅"
    );
  } catch (error) {
    console.error("HF ERROR:", error.response?.data || error.message);
    return "AI service error ❌";
  }
}

/* =========================
   WEBHOOK RECEIVER
========================= */
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

      // 🤖 AI response
      const botReply = await getAIReply(userText);

      // 📤 Send WhatsApp reply
      await axios.post(
        `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: botReply },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Reply sent:", botReply);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("WEBHOOK ERROR:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

/* =========================
   START SERVER
========================= */
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
