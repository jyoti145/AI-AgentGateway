import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import connectDB from '../config/db.js';
import Agent from '../models/Agent.model.js';

await connectDB();

const plainApiKey = 'admin-key-456';
const apiKeyHash = await bcrypt.hash(plainApiKey, 10);

await Agent.create({
  name: 'admin-bot',
  apiKeyHash,
  role: 'admin',
});

console.log('Admin created. API key (shown once):', plainApiKey);

await mongoose.disconnect();
process.exit(0);
