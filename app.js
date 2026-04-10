const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

// ENV VARIABLES
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const HF_TOKEN = process.env.HF_TOKEN;

// ✅ Hugging Face Router (OpenAI compatible)
const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: HF_TOKEN,
});

// ✅ MEMORY STORE
const userSessions = {};

// ✅ Homepage
app.get("/", (req, res) => {
  res.send("Lazely AI Bot Running ✅");
});

// ✅ Webhook Verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified ✅");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ✅ AI FUNCTION WITH MEMORY
async function getAIReply(userText, userId) {
  try {
    if (!userSessions[userId]) {
      userSessions[userId] = [];
    }

    userSessions[userId].push({
      role: "user",
      content: userText,
    });

    const completion = await client.chat.completions.create({
      model: "mistralai/Mistral-7B-Instruct-v0.2",
      messages: userSessions[userId],
    });

    const reply = completion.choices[0].message.content;

    userSessions[userId].push({
      role: "assistant",
      content: reply,
    });

    return `🤖 Lazely AI:\n\n${reply}`;
  } catch (error) {
    console.error("AI ERROR:", error.message);
    return "AI service error ❌";
  }
}

// ✅ SEND WHATSAPP MESSAGE
async function sendMessage(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Reply sent:", text);
  } catch (error) {
    console.error("Send Error:", error.response?.data || error.message);
  }
}

// ✅ MAIN WEBHOOK
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    const message =
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body?.toLowerCase();

      console.log("User:", from);
      console.log("Message:", text);

      // 🔥 MENU SYSTEM
      if (text === "menu") {
        await sendMessage(
          from,
`👋 Welcome to Lazely AI

1️⃣ Products  
2️⃣ Support  
3️⃣ Talk to AI  

Reply with a number.`
        );
        return res.sendStatus(200);
      }

      if (text === "1") {
        await sendMessage(from, "🛍️ We offer digital tools & AI solutions.");
        return res.sendStatus(200);
      }

      if (text === "2") {
        await sendMessage(from, "📞 Contact support: +256 XXX XXX");
        return res.sendStatus(200);
      }

      if (text === "3") {
        await sendMessage(from, "🤖 You can now chat with AI. Ask anything!");
        return res.sendStatus(200);
      }

      // 🔥 HUMAN-LIKE DELAY
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 🔥 AI RESPONSE
      const aiReply = await getAIReply(text, from);

      console.log("AI Reply:", aiReply);

      await sendMessage(from, aiReply);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook Error:", error);
    res.sendStatus(500);
  }
});

// ✅ START SERVER
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
