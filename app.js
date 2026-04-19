const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

// ENV VARIABLES
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const HF_TOKEN = process.env.HF_TOKEN;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// ✅ Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ Hugging Face Router (OpenAI compatible)
const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: HF_TOKEN,
});

/* =========================
   HOME
========================= */
app.get("/", (req, res) => {
  res.send("Lazely AI Bot + Supabase Running ✅");
});

/* =========================
   WEBHOOK VERIFY
========================= */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified ✅");
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

/* =========================
   FETCH CHAT HISTORY (MEMORY)
========================= */
async function getChatHistory(phone) {
  const { data, error } = await supabase
    .from("messages")
    .select("role, message")
    .eq("phone", phone)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    console.error("History Error:", error.message);
    return [];
  }

  return data.map((msg) => ({
    role: msg.role,
    content: msg.message,
  }));
}

/* =========================
   AI RESPONSE
========================= */
async function getAIReply(userText, phone) {
  try {
    const history = await getChatHistory(phone);

    const messages = [
      ...history,
      { role: "user", content: userText },
    ];

    const completion = await client.chat.completions.create({
      model: "mistralai/Mistral-7B-Instruct-v0.2",
      messages: messages,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("AI ERROR:", error.message);
    return "AI service error ❌";
  }
}

/* =========================
   SAVE MESSAGE
========================= */
async function saveMessage(phone, message, role) {
  const { error } = await supabase.from("messages").insert([
    {
      phone,
      message,
      role,
    },
  ]);

  if (error) {
    console.error("Save Error:", error.message);
  }
}

/* =========================
   SEND WHATSAPP MESSAGE
========================= */
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

/* =========================
   MAIN WEBHOOK
========================= */
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

      // 🔥 SAVE USER MESSAGE
      await saveMessage(from, text, "user");

      // 🔥 MENU SYSTEM
      if (text === "menu") {
        const menu = `👋 Welcome to Lazely AI

1️⃣ Products  
2️⃣ Support  
3️⃣ Talk to AI  

Reply with a number.`;

        await sendMessage(from, menu);
        return res.sendStatus(200);
      }

      if (text === "1") {
        await sendMessage(from, "🛍️ We offer AI tools and automation.");
        return res.sendStatus(200);
      }

      if (text === "2") {
        await sendMessage(from, "📞 Contact support: +256 XXX XXX");
        return res.sendStatus(200);
      }

      if (text === "3") {
        await sendMessage(from, "🤖 AI activated. Ask anything!");
        return res.sendStatus(200);
      }

      // ⏳ Human-like delay
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // 🤖 AI RESPONSE
      const aiReply = await getAIReply(text, from);

      console.log("AI Reply:", aiReply);

      // 🔥 SAVE AI MESSAGE
      await saveMessage(from, aiReply, "assistant");

      // 📤 SEND REPLY
      await sendMessage(from, `🤖 Lazely AI:\n\n${aiReply}`);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook Error:", error);
    res.sendStatus(500);
  }
});

/* =========================
   START SERVER
========================= */
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
