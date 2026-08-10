import Agent from '../models/Agent.model.js';

export const getAllAgents = async (req, res) => {
  const agents = await Agent.find().select('-apiKeyHash -refreshTokenHash');
  res.status(200).json(agents);
};
