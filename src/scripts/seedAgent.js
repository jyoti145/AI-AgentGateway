import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import connectDB from '../config/db.js';
import Agent from '../models/Agent.model.js';

await connectDB();

const plainApiKey = 'test-key-123';
const apiKeyHash = await bcrypt.hash(plainApiKey, 10);

await Agent.create({
  name: 'billing-bot',
  apiKeyHash,
  role: 'agent',
});

console.log('Agent created. Save this API key now — it is shown only once:', plainApiKey);

await mongoose.disconnect();
process.exit(0);