import { Router } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config/index.js';

export const livekitRouter = Router();

livekitRouter.get('/token', requireAuth, (req, res) => {
  const { channelId } = req.query;
  const user = (req as any).user;

  if (!channelId || typeof channelId !== 'string') {
    return res.status(400).json({ error: 'channelId is required' });
  }

  // Generate an access token for this user to join the specific room
  const roomName = `voice_${channelId}`;
  const participantIdentity = user.userId;
  const participantName = user.username;

  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: participantIdentity,
    name: participantName,
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });

  const token = at.toJwt();
  res.json({ token, url: config.livekit.url });
});
