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

/**
 * GET /api/messages/search?q=...&channelId=...&limit=25
 * Full-text search across messages.
 */
router.get('/messages/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const { q, channelId } = req.query;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 50);

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    // Convert the user query to a tsquery (prefix matching for partial words)
    const searchTerms = q.trim().split(/\s+/).map(t => t + ':*').join(' & ');

    let query: string;
    let params: any[];

    if (channelId && typeof channelId === 'string') {
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
               ts_rank(to_tsvector('english', m.content), to_tsquery('english', $1)) as rank
        FROM messages m
        JOIN users u ON u.id = m.author_id
        WHERE m.channel_id = $2
          AND to_tsvector('english', m.content) @@ to_tsquery('english', $1)
        ORDER BY rank DESC, m.created_at DESC
        LIMIT $3
      `;
      params = [searchTerms, channelId, limit];
    } else {
      // Search across all channels the user has access to (in their server)
      const user = req.auth;
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
               c.name as channel_name,
               ts_rank(to_tsvector('english', m.content), to_tsquery('english', $1)) as rank
        FROM messages m
        JOIN users u ON u.id = m.author_id
        JOIN channels c ON c.id = m.channel_id
        JOIN server_members sm ON sm.server_id = c.server_id AND sm.user_id = $2
        WHERE to_tsvector('english', m.content) @@ to_tsquery('english', $1)
        ORDER BY rank DESC, m.created_at DESC
        LIMIT $3
      `;
      params = [searchTerms, user?.userId, limit];
    }

    const { rows } = await db.query(query, params);

    res.json({ results: rows });
  } catch (err) {
    console.error('[Messages] Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
