import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../utils/permissions.js';
import { Permission } from '@hearth/shared';
import { db } from '../db/index.js';

const router = Router();

/**
 * POST /api/invites
 * Generate a new invite code.
 */
router.post(
  '/',
  requireAuth,
  requirePermission(Permission.CREATE_INVITES),
  async (req: Request, res: Response) => {
    try {
      const { max_uses = 1, expires_in_hours } = req.body;
      const code = uuidv4().slice(0, 8).toUpperCase();

      let expiresAt: Date | null = null;
      if (expires_in_hours) {
        expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000);
      }

      const { rows } = await db.query(
        `INSERT INTO invite_codes (server_id, created_by, code, max_uses, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, server_id, created_by, code, max_uses, uses, expires_at, created_at`,
        [req.auth!.serverId, req.auth!.userId, code, max_uses, expiresAt]
      );

      res.status(201).json({ invite: rows[0] });
    } catch (err) {
      console.error('[Invites] Create error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/invites
 * List all active invite codes (for admins).
 */
router.get(
  '/',
  requireAuth,
  requirePermission(Permission.CREATE_INVITES),
  async (req: Request, res: Response) => {
    try {
      const { rows } = await db.query(
        `SELECT ic.*, u.username as created_by_username
         FROM invite_codes ic
         JOIN users u ON u.id = ic.created_by
         WHERE ic.server_id = $1
         ORDER BY ic.created_at DESC`,
        [req.auth!.serverId]
      );

      res.json({ invites: rows });
    } catch (err) {
      console.error('[Invites] List error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/invites/:id
 * Revoke an invite code.
 */
router.delete(
  '/:id',
  requireAuth,
  requirePermission(Permission.CREATE_INVITES),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const { rowCount } = await db.query(
        'DELETE FROM invite_codes WHERE id = $1 AND server_id = $2',
        [id, req.auth!.serverId]
      );

      if (rowCount === 0) {
        return res.status(404).json({ error: 'Invite not found' });
      }

      res.json({ success: true });
    } catch (err) {
      console.error('[Invites] Delete error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
