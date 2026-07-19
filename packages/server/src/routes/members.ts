import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/index.js';

const router = Router();

/**
 * GET /api/servers/:serverId/members
 * List all members of a server with their roles.
 */
router.get('/servers/:serverId/members', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;

    const { rows } = await db.query(
      `SELECT
         sm.user_id,
         sm.server_id,
         sm.nickname,
         sm.joined_at,
         json_build_object(
           'id', u.id,
           'username', u.username,
           'display_name', u.display_name,
           'avatar_url', u.avatar_url,
           'status', u.status,
           'created_at', u.created_at,
           'updated_at', u.updated_at
         ) as user,
         COALESCE(
           json_agg(
             json_build_object(
               'id', r.id,
               'name', r.name,
               'color', r.color,
               'position', r.position
             )
           ) FILTER (WHERE r.id IS NOT NULL),
           '[]'
         ) as roles
       FROM server_members sm
       JOIN users u ON u.id = sm.user_id
       LEFT JOIN member_roles mr ON mr.user_id = sm.user_id AND mr.server_id = sm.server_id
       LEFT JOIN roles r ON r.id = mr.role_id
       WHERE sm.server_id = $1
       GROUP BY sm.user_id, sm.server_id, sm.nickname, sm.joined_at,
                u.id, u.username, u.display_name, u.avatar_url, u.status, u.created_at, u.updated_at
       ORDER BY sm.joined_at ASC`,
      [serverId]
    );

    res.json({ members: rows });
  } catch (err) {
    console.error('[Members] List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/servers/:serverId/members/:userId/kick
 * Kick a member from the server. Requires MANAGE_MEMBERS or ADMINISTRATOR permission.
 */
router.post('/servers/:serverId/members/:userId/kick', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params;
    const requestingUser = req.auth;

    // Check if the server owner
    const { rows: serverRows } = await db.query(
      'SELECT owner_id FROM servers WHERE id = $1',
      [serverId]
    );
    if (serverRows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const isOwner = serverRows[0].owner_id === requestingUser.userId;

    // Check permissions if not owner
    if (!isOwner) {
      const { rows: roleRows } = await db.query(
        `SELECT COALESCE(BIT_OR(r.permissions), 0) as permissions
         FROM member_roles mr
         JOIN roles r ON r.id = mr.role_id
         WHERE mr.user_id = $1 AND mr.server_id = $2`,
        [requestingUser.userId, serverId]
      );
      const perms = roleRows[0]?.permissions || 0;
      // MANAGE_MEMBERS = 1 << 2 = 4, ADMINISTRATOR = 1 << 6 = 64
      if (!(perms & 4) && !(perms & 64)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    // Cannot kick the owner
    if (userId === serverRows[0].owner_id) {
      return res.status(403).json({ error: 'Cannot kick the server owner' });
    }

    // Cannot kick yourself
    if (userId === requestingUser.userId) {
      return res.status(400).json({ error: 'Cannot kick yourself' });
    }

    // Remove the member
    const { rowCount } = await db.query(
      'DELETE FROM server_members WHERE user_id = $1 AND server_id = $2',
      [userId, serverId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Members] Kick error:', err);
    res.status(500).json({ error: 'Failed to kick member' });
  }
});

export default router;
