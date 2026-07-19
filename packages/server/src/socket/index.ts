import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { AuthPayload } from '../middleware/auth.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  Message,
  UserStatus,
} from '@hearth/shared';

type HearthSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

/**
 * Initialize Socket.IO event handlers.
 */
export function initializeSocket(
  io: SocketServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>
) {
  // --- Authentication middleware ---
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret) as AuthPayload;
      socket.data.user_id = payload.userId;
      socket.data.username = payload.username;
      socket.data.server_id = payload.serverId;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (socket: HearthSocket) => {
    const { user_id, username, server_id } = socket.data;
    console.log(`[Socket] ${username} connected (${socket.id})`);

    // Join the server room so broadcasts reach all members
    socket.join(`server:${server_id}`);

    // Update user status to online
    await db.query(
      "UPDATE users SET status = 'online', updated_at = NOW() WHERE id = $1",
      [user_id]
    );

    // Broadcast status change to other members
    socket.to(`server:${server_id}`).emit('user:status_changed', {
      user_id,
      status: 'online' as UserStatus,
    });

    // --- Message handlers ---

    socket.on('message:send', async (
      data: { channel_id: string; content: string; attachments?: any[] },
      callback: (response: { success: boolean; message?: Message; error?: string }) => void
    ) => {
      try {
        const { channel_id, content, attachments } = data;

        if ((!content || content.trim().length === 0) && (!attachments || attachments.length === 0)) {
          return callback({ success: false, error: 'Message cannot be empty' });
        }

        if (content && content.length > 4000) {
          return callback({ success: false, error: 'Message too long (max 4000 characters)' });
        }

        const { rows: channelRows } = await db.query(
          'SELECT id FROM channels WHERE id = $1 AND server_id = $2',
          [channel_id, server_id]
        );

        if (channelRows.length === 0) {
          return callback({ success: false, error: 'Channel not found' });
        }

        const { rows } = await db.query(
          `INSERT INTO messages (channel_id, author_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, channel_id, author_id, content, edited_at, created_at`,
          [channel_id, user_id, content?.trim() || '']
        );

        const messageId = rows[0].id;
        
        let insertedAttachments = [];
        if (attachments && attachments.length > 0) {
          for (const att of attachments) {
            const { rows: attRows } = await db.query(
              `INSERT INTO attachments (message_id, url, file_type) VALUES ($1, $2, $3) RETURNING id, url, file_type`,
              [messageId, att.url, att.file_type]
            );
            insertedAttachments.push(attRows[0]);
          }
        }

        const { rows: authorRows } = await db.query(
          `SELECT id, username, display_name, avatar_url, status, created_at, updated_at
           FROM users WHERE id = $1`,
          [user_id]
        );

        const message: Message = {
          ...rows[0],
          author: authorRows[0],
          attachments: insertedAttachments,
          reactions: []
        };

        io.to(`channel:${channel_id}`).emit('message:new', message);
        callback({ success: true, message });
      } catch (err) {
        console.error('[Socket] message:send error:', err);
        callback({ success: false, error: 'Failed to send message' });
      }
    });

    socket.on('message:edit', async (
      data: { message_id: string; channel_id: string; content: string },
      callback: (response: { success: boolean; error?: string }) => void
    ) => {
      try {
        const { message_id, channel_id, content } = data;
        const { rowCount } = await db.query(
          `UPDATE messages SET content = $1, edited_at = NOW() WHERE id = $2 AND author_id = $3`,
          [content.trim(), message_id, user_id]
        );
        if (rowCount === 0) return callback({ success: false, error: 'Not authorized or message not found' });
        
        const { rows: fullMsg } = await db.query(`
          SELECT m.id, m.channel_id, m.author_id, m.content, m.edited_at, m.created_at,
                 json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'status', u.status) as author,
                 COALESCE((SELECT json_agg(json_build_object('id', a.id, 'url', a.url, 'file_type', a.file_type)) FROM attachments a WHERE a.message_id = m.id), '[]'::json) as attachments,
                 COALESCE((SELECT json_agg(json_build_object('id', r.id, 'user_id', r.user_id, 'emoji', r.emoji)) FROM reactions r WHERE r.message_id = m.id), '[]'::json) as reactions
          FROM messages m JOIN users u ON u.id = m.author_id WHERE m.id = $1
        `, [message_id]);
        
        io.to(`channel:${channel_id}`).emit('message:updated', fullMsg[0]);
        callback({ success: true });
      } catch (err) {
        console.error('[Socket] message:edit error:', err);
        callback({ success: false, error: 'Failed to edit message' });
      }
    });

    socket.on('message:delete', async (
      data: { message_id: string; channel_id: string },
      callback: (response: { success: boolean; error?: string }) => void
    ) => {
      try {
        const { message_id, channel_id } = data;
        const { rowCount } = await db.query(
          `DELETE FROM messages WHERE id = $1 AND author_id = $2`,
          [message_id, user_id]
        );
        if (rowCount === 0) return callback({ success: false, error: 'Not authorized or message not found' });
        
        io.to(`channel:${channel_id}`).emit('message:deleted', { message_id, channel_id });
        callback({ success: true });
      } catch (err) {
        console.error('[Socket] message:delete error:', err);
        callback({ success: false, error: 'Failed to delete message' });
      }
    });

    socket.on('message:react', async (
      data: { message_id: string; channel_id: string; emoji: string },
      callback: (response: { success: boolean; error?: string }) => void
    ) => {
      try {
        const { message_id, channel_id, emoji } = data;
        await db.query(
          `INSERT INTO reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [message_id, user_id, emoji]
        );
        
        const { rows: fullMsg } = await db.query(`
          SELECT m.id, m.channel_id, m.author_id, m.content, m.edited_at, m.created_at,
                 json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'status', u.status) as author,
                 COALESCE((SELECT json_agg(json_build_object('id', a.id, 'url', a.url, 'file_type', a.file_type)) FROM attachments a WHERE a.message_id = m.id), '[]'::json) as attachments,
                 COALESCE((SELECT json_agg(json_build_object('id', r.id, 'user_id', r.user_id, 'emoji', r.emoji)) FROM reactions r WHERE r.message_id = m.id), '[]'::json) as reactions
          FROM messages m JOIN users u ON u.id = m.author_id WHERE m.id = $1
        `, [message_id]);
        
        io.to(`channel:${channel_id}`).emit('message:updated', fullMsg[0]);
        callback({ success: true });
      } catch (err) {
        console.error('[Socket] message:react error:', err);
        callback({ success: false, error: 'Failed to react to message' });
      }
    });

    socket.on('message:unreact', async (
      data: { message_id: string; channel_id: string; emoji: string },
      callback: (response: { success: boolean; error?: string }) => void
    ) => {
      try {
        const { message_id, channel_id, emoji } = data;
        await db.query(
          `DELETE FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
          [message_id, user_id, emoji]
        );
        
        const { rows: fullMsg } = await db.query(`
          SELECT m.id, m.channel_id, m.author_id, m.content, m.edited_at, m.created_at,
                 json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'status', u.status) as author,
                 COALESCE((SELECT json_agg(json_build_object('id', a.id, 'url', a.url, 'file_type', a.file_type)) FROM attachments a WHERE a.message_id = m.id), '[]'::json) as attachments,
                 COALESCE((SELECT json_agg(json_build_object('id', r.id, 'user_id', r.user_id, 'emoji', r.emoji)) FROM reactions r WHERE r.message_id = m.id), '[]'::json) as reactions
          FROM messages m JOIN users u ON u.id = m.author_id WHERE m.id = $1
        `, [message_id]);
        
        io.to(`channel:${channel_id}`).emit('message:updated', fullMsg[0]);
        callback({ success: true });
      } catch (err) {
        console.error('[Socket] message:unreact error:', err);
        callback({ success: false, error: 'Failed to unreact' });
      }
    });

    // --- Channel room management ---

    socket.on('channel:join', (channel_id: string) => {
      socket.join(`channel:${channel_id}`);
      console.log(`[Socket] ${username} joined channel:${channel_id}`);
    });

    socket.on('channel:leave', (channel_id: string) => {
      socket.leave(`channel:${channel_id}`);
      console.log(`[Socket] ${username} left channel:${channel_id}`);
    });

    // --- User status ---

    socket.on('user:status', async (status: UserStatus) => {
      if (!['online', 'idle', 'dnd'].includes(status)) return;

      await db.query(
        'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
        [status, user_id]
      );

      io.to(`server:${server_id}`).emit('user:status_changed', {
        user_id,
        status,
      });
    });

    // --- Typing indicators ---

    socket.on('typing:start', (channel_id: string) => {
      socket.to(`channel:${channel_id}`).emit('typing:update', {
        channel_id,
        user_id,
        username,
        is_typing: true,
      });
    });

    socket.on('typing:stop', (channel_id: string) => {
      socket.to(`channel:${channel_id}`).emit('typing:update', {
        channel_id,
        user_id,
        username,
        is_typing: false,
      });
    });

    // --- Disconnect ---

    socket.on('disconnect', async (reason: string) => {
      console.log(`[Socket] ${username} disconnected (${reason})`);

      // Check if user has other active connections
      const sockets = await io.in(`server:${server_id}`).fetchSockets();
      const stillConnected = sockets.some(
        (s) => s.data.user_id === user_id && s.id !== socket.id
      );

      if (!stillConnected) {
        await db.query(
          "UPDATE users SET status = 'offline', updated_at = NOW() WHERE id = $1",
          [user_id]
        );

        socket.to(`server:${server_id}`).emit('user:status_changed', {
          user_id,
          status: 'offline' as UserStatus,
        });
      }
    });
  });
}
