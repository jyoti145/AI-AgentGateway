import 'dotenv/config';
import express from 'express';
import connectDB from './config/db.js';
import agentRoutes from './routes/agent.routes.js';
import authRoutes from './routes/auth.routes.js';
import proxyRoutes from './routes/proxy.routes.js';
import { rateLimiter } from './middleware/rateLimiter.middleware.js';

await connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(rateLimiter);
app.use(express.json());
app.use('/agents', agentRoutes);
app.use('/api/proxy', proxyRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
});
