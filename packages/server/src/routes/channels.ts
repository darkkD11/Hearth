import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../utils/permissions.js';
import { Permission } from '@hearth/shared';
import { db } from '../db/index.js';

const router = Router();

/**
 * GET /api/servers/:serverId/channels
 * List all channels in a server.
 */
router.get('/servers/:serverId/channels', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;

    const { rows } = await db.query(
      `SELECT id, server_id, name, type, position, created_at
       FROM channels
       WHERE server_id = $1
       ORDER BY position ASC, created_at ASC`,
      [serverId]
    );

    res.json({ channels: rows });
  } catch (err) {
    console.error('[Channels] List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/servers/:serverId/channels
 * Create a new channel (requires MANAGE_CHANNELS permission).
 */
router.post(
  '/servers/:serverId/channels',
  requireAuth,
  requirePermission(Permission.MANAGE_CHANNELS),
  async (req: Request, res: Response) => {
    try {
      const { serverId } = req.params;
      const { name, type = 'text' } = req.body;

      if (!name || name.length < 1 || name.length > 100) {
        return res.status(400).json({ error: 'Channel name must be 1-100 characters' });
      }

      if (!['text', 'voice'].includes(type)) {
        return res.status(400).json({ error: 'Channel type must be "text" or "voice"' });
      }

      // Sanitize channel name (lowercase, hyphens for spaces)
      const sanitizedName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      // Get next position
      const { rows: posRows } = await db.query(
        'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM channels WHERE server_id = $1',
        [serverId]
      );

      const { rows } = await db.query(
        `INSERT INTO channels (server_id, name, type, position)
         VALUES ($1, $2, $3, $4)
         RETURNING id, server_id, name, type, position, created_at`,
        [serverId, sanitizedName, type, posRows[0].next_pos]
      );

      res.status(201).json({ channel: rows[0] });
    } catch (err) {
      console.error('[Channels] Create error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/channels/:channelId
 * Update a channel (requires MANAGE_CHANNELS permission).
 */
router.patch(
  '/channels/:channelId',
  requireAuth,
  requirePermission(Permission.MANAGE_CHANNELS),
  async (req: Request, res: Response) => {
    try {
      const { channelId } = req.params;
      const { name, position } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        const sanitizedName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        updates.push(`name = $${paramIndex++}`);
        values.push(sanitizedName);
      }

      if (position !== undefined) {
        updates.push(`position = $${paramIndex++}`);
        values.push(position);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(channelId);

      const { rows } = await db.query(
        `UPDATE channels SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, server_id, name, type, position, created_at`,
        values
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      res.json({ channel: rows[0] });
    } catch (err) {
      console.error('[Channels] Update error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/channels/:channelId
 * Delete a channel (requires MANAGE_CHANNELS permission).
 */
router.delete(
  '/channels/:channelId',
  requireAuth,
  requirePermission(Permission.MANAGE_CHANNELS),
  async (req: Request, res: Response) => {
    try {
      const { channelId } = req.params;

      const { rowCount } = await db.query(
        'DELETE FROM channels WHERE id = $1',
        [channelId]
      );

      if (rowCount === 0) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      res.json({ success: true });
    } catch (err) {
      console.error('[Channels] Delete error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
