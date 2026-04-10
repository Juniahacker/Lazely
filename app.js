import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import admin from "firebase-admin";

const app = express();
app.use(bodyParser.json());

// 🔥 FIREBASE INIT
//import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 🔑 CONFIG
const TOKEN = "YOUR_WHATSAPP_TOKEN";
const PHONE_NUMBER_ID = "YOUR_PHONE_ID";

// 🧠 SAVE USER
async function saveUser(phone) {
  const userRef = db.collection("users").doc(phone);
  await userRef.set({ phone, createdAt: new Date() }, { merge: true });
}

// 💬 SAVE MESSAGE
async function saveMessage(phone, message, fromMe = false) {
  await db.collection("messages").add({
    phone,
    message,
    fromMe,
    timestamp: new Date(),
  });
}

// 🤖 AUTO REPLY LOGIC
function getReply(text) {
  text = text.toLowerCase();

  if (text.includes("hello")) return "Hey 👋 Welcome to JH Codes!";
  if (text.includes("services")) return "We offer Apps, AI Bots & Marketing 🚀";
  if (text.includes("price")) return "Pricing depends on your needs. Chat us 👍";

  return "I didn't understand that. Type 'services' to see what we offer.";
}

// 📩 WEBHOOK
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body;

      // SAVE USER + MESSAGE
      await saveUser(from);
      await saveMessage(from, text, false);

      const reply = getReply(text);

      // SEND REPLY
      await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply },
        }),
      });

      // SAVE BOT REPLY
      await saveMessage(from, reply, true);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

// 🔐 VERIFY WEBHOOK
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "test123";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.listen(3000, () => console.log("Server running 🚀"));
