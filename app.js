import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import admin from "firebase-admin";
import fs from "fs";

const app = express();
app.use(bodyParser.json());

/* ---------------- FIREBASE SETUP ---------------- */
const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf-8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
await db.collection("test").add({
  message: "Firebase is working 🚀",
  time: new Date()
});
console.log("✅ Firebase connected");

/* ---------------- WHATSAPP CONFIG ---------------- */
const TOKEN = "YOUR_WHATSAPP_TOKEN";
const PHONE_NUMBER_ID = "YOUR_PHONE_NUMBER_ID";
const VERIFY_TOKEN = "jh_verify_token";

/* ---------------- SAVE FUNCTIONS ---------------- */
async function saveUser(phone) {
  await db.collection("users").doc(phone).set({
    phone,
    lastSeen: new Date()
  }, { merge: true });
}

async function saveMessage(phone, message, fromMe) {
  await db.collection("messages").add({
    phone,
    message,
    fromMe,
    timestamp: new Date()
  });
}

/* ---------------- BOT LOGIC ---------------- */
function getReply(text) {
  text = text.toLowerCase();

  if (text.includes("hello")) return "👋 Hey! Welcome to JH Codes.";
  if (text.includes("services")) return "We offer Apps, AI Bots & Digital Marketing 🚀";
  if (text.includes("price")) return "💰 Pricing depends on your needs. Contact us!";
  if (text.includes("bot")) return "🤖 We build WhatsApp automation bots like this one!";

  return "🤖 I didn’t understand that. Type 'services' to explore.";
}

/* ---------------- WEBHOOK (RECEIVE) ---------------- */
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body;

      await saveUser(from);
      await saveMessage(from, text, false);

      const reply = getReply(text);

      await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply }
        })
      });

      await saveMessage(from, reply, true);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

/* ---------------- WEBHOOK VERIFY ---------------- */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

/* ---------------- START SERVER ---------------- */
app.listen(3000, () => {
  console.log("🚀 JH Codes Bot running on port 3000");
});
