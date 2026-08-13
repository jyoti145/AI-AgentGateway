import redis from '../config/redis.js';

const WINDOW_SECONDS = 60;
const LIMIT = 50;

export const rateLimiter = async (req, res, next) => {
  const key = `ratelimit:${req.ip}`;

  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }

  if (current > LIMIT) {
    return res.status(429).json({ message: 'Too many requests, slow down' });
  }

  next();
};
