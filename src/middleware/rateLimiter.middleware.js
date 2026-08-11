import crypto from 'crypto';
import redis from '../config/redis.js';

const WINDOW_MS = 60 * 1000;
const LIMIT = 50;

const slidingWindowScript = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

local count = redis.call('ZCARD', key)

if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return 1
else
  return 0
end
`;

export const rateLimiter = async (req, res, next) => {
  const key = `ratelimit:${req.ip}`;
  const now = Date.now();
  const member = `${now}-${crypto.randomUUID()}`;

  const allowed = await redis.eval(
    slidingWindowScript,
    1,
    key,
    now,
    WINDOW_MS,
    LIMIT,
    member
  );

  if (allowed === 0) {
    return res.status(429).json({ message: 'Too many requests, slow down' });
  }

  next();
};
