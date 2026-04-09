// app.js — AI WhatsApp Bot (OpenAI SDK v5+)
const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

// ✅ OpenAI setup (v5+)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Homepage — confirm server is alive
app.get('/', (req, res) => {
  res.send('Server is running ✅');
});

// ✅ Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ✅ Receive & auto-reply to any WhatsApp message
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from; // User number
      const userText = message.text?.body || "";

      console.log("User:", from);
      console.log("Message:", userText);

      // 🔹 Generate AI reply via OpenAI
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: userText }],
      });

      const botReply = aiResponse.choices[0].message.content;
      console.log("AI Reply:", botReply);

      // 🔹 Send reply via WhatsApp
      const response = await axios.post(
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

      console.log("Reply sent:", response.data);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error in /webhook:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

// 🚀 Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
