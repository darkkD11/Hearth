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

export default router;
