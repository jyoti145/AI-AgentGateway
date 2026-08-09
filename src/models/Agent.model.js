import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    apiKeyHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'agent'],
      default: 'agent',
    },
    rateLimitTier: {
      type: Number,
      default: 50, // requests per minute
    },
    refreshTokenHash: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

     export default mongoose.model('Agent', agentSchema);