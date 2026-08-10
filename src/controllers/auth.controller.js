import bcrypt from 'bcrypt';
import Agent from '../models/Agent.model.js';
import jwt from 'jsonwebtoken';
import { signAccessToken, signRefreshToken } from '../utils/token.util.js';

export const login = async (req, res) => {
  const { name, apiKey } = req.body;

  const agent = await Agent.findOne({ name });
  if (!agent) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(apiKey, agent.apiKeyHash);
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const accessToken = signAccessToken(agent);
  const refreshToken = signRefreshToken(agent);

  agent.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await agent.save();

  res.status(200).json({ accessToken, refreshToken });
};

export const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    return res.status(403).json({ message: 'Invalid refresh token' });
  }

  const agent = await Agent.findById(payload.id);
  if (!agent || !agent.refreshTokenHash) {
    return res.status(403).json({ message: 'Session not found' });
  }

  const isMatch = await bcrypt.compare(refreshToken, agent.refreshTokenHash);
  if (!isMatch) {
    agent.refreshTokenHash = null;
    await agent.save();
    return res.status(403).json({ message: 'Token reuse detected, session revoked' });
  }

  const newAccessToken = signAccessToken(agent);
  const newRefreshToken = signRefreshToken(agent);

  agent.refreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
  await agent.save();

  res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
};

export const logout = async (req, res) => {
  const agent = await Agent.findById(req.agent.id);
  if (agent) {
    agent.refreshTokenHash = null;
    await agent.save();
  }
  res.status(200).json({ message: 'Logged out' });
};
