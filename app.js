const express = require('express');
const app = express();

app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

// ✅ Homepage (just to confirm server is alive)
app.get('/', (req, res) => {
  res.send('Server is running ✅');
});

// ✅ Webhook verification (Meta will call this)
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

// ✅ Receive WhatsApp messages
app.post('/webhook', (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`Webhook received at ${timestamp}`);
  console.log(JSON.stringify(req.body, null, 2));

  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
