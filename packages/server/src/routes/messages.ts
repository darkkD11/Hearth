import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/index.js';

const router = Router();

/**
 * GET /api/channels/:channelId/messages
 * Paginated message history with cursor-based pagination.
 * Query params: before (message ID), limit (default 50, max 100)
 */
router.get('/channels/:channelId/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string | undefined;

    let query: string;
    let params: any[];

    if (before) {
      // Get the created_at of the cursor message
      query = `
        SELECT m.id, m.channel_id, m.author_id, m.content, m.edited_at, m.created_at,
               json_build_object(
                 'id', u.id,
                 'username', u.username,
                 'display_name', u.display_name,
                 'avatar_url', u.avatar_url,
                 'status', u.status,
                 'created_at', u.created_at,
                 'updated_at', u.updated_at
               ) as author,
               COALESCE((SELECT json_agg(json_build_object('id', a.id, 'url', a.url, 'file_type', a.file_type)) FROM attachments a WHERE a.message_id = m.id), '[]'::json) as attachments,
               COALESCE((SELECT json_agg(json_build_object('id', r.id, 'user_id', r.user_id, 'emoji', r.emoji)) FROM reactions r WHERE r.message_id = m.id), '[]'::json) as reactions
        FROM messages m
        JOIN users u ON u.id = m.author_id
        WHERE m.channel_id = $1
          AND m.created_at < (SELECT created_at FROM messages WHERE id = $2)
        ORDER BY m.created_at DESC
        LIMIT $3
      `;
      params = [channelId, before, limit + 1]; // Fetch one extra to determine has_more
    } else {
      query = `
        SELECT m.id, m.channel_id, m.author_id, m.content, m.edited_at, m.created_at,
               json_build_object(
                 'id', u.id,
                 'username', u.username,
                 'display_name', u.display_name,
                 'avatar_url', u.avatar_url,
                 'status', u.status,
                 'created_at', u.created_at,
                 'updated_at', u.updated_at
               ) as author,
               COALESCE((SELECT json_agg(json_build_object('id', a.id, 'url', a.url, 'file_type', a.file_type)) FROM attachments a WHERE a.message_id = m.id), '[]'::json) as attachments,
               COALESCE((SELECT json_agg(json_build_object('id', r.id, 'user_id', r.user_id, 'emoji', r.emoji)) FROM reactions r WHERE r.message_id = m.id), '[]'::json) as reactions
        FROM messages m
        JOIN users u ON u.id = m.author_id
        WHERE m.channel_id = $1
        ORDER BY m.created_at DESC
        LIMIT $2
      `;
      params = [channelId, limit + 1];
    }

    const { rows } = await db.query(query, params);

    const hasMore = rows.length > limit;
    const messages = rows.slice(0, limit).reverse(); // Reverse to get chronological order

    res.json({ messages, has_more: hasMore });
  } catch (err) {
    console.error('[Messages] List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
