import express from 'express';

const app = express();
const PORT = parseInt(process.env.PORT || '3100', 10);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'haa-proxy' });
});

app.listen(PORT, () => {
  console.log(`HAA Proxy listening on port ${PORT}`);
});
