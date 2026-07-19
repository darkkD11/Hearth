import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { requireAuth, generateToken, AuthPayload } from '../middleware/auth.js';
import { DEFAULT_MEMBER_PERMISSIONS } from '@hearth/shared';

const router = Router();

/**
 * POST /api/auth/register
 * Invite-only registration. Requires a valid invite code.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, invite_code } = req.body;

    // Validate input
    if (!username || !email || !password || !invite_code) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (username.length < 2 || username.length > 32) {
      return res.status(400).json({ error: 'Username must be 2-32 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate invite code
    const { rows: inviteRows } = await db.query(
      `SELECT id, server_id, max_uses, uses, expires_at
       FROM invite_codes
       WHERE code = $1`,
      [invite_code]
    );

    if (inviteRows.length === 0) {
      return res.status(400).json({ error: 'Invalid invite code' });
    }

    const invite = inviteRows[0];

    if (invite.uses >= invite.max_uses) {
      return res.status(400).json({ error: 'Invite code has reached its maximum uses' });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invite code has expired' });
    }

    // Check for existing user
    const { rows: existingUser } = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Email or username already taken' });
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows: newUser } = await db.query(
      `INSERT INTO users (username, display_name, email, password_hash, status)
       VALUES ($1, $1, $2, $3, 'online')
       RETURNING id, username, display_name, email, avatar_url, status, created_at, updated_at`,
      [username, email, passwordHash]
    );

    const user = newUser[0];

    // Add user to server
    await db.query(
      'INSERT INTO server_members (user_id, server_id) VALUES ($1, $2)',
      [user.id, invite.server_id]
    );

    // Assign default "Member" role
    const { rows: memberRole } = await db.query(
      `SELECT id FROM roles WHERE server_id = $1 AND name = 'Member'`,
      [invite.server_id]
    );

    if (memberRole.length > 0) {
      await db.query(
        'INSERT INTO member_roles (user_id, server_id, role_id) VALUES ($1, $2, $3)',
        [user.id, invite.server_id, memberRole[0].id]
      );
    }

    // Increment invite usage
    await db.query(
      'UPDATE invite_codes SET uses = uses + 1 WHERE id = $1',
      [invite.id]
    );

    // Get server info
    const { rows: serverRows } = await db.query(
      'SELECT id, name, owner_id, icon_url, created_at FROM servers WHERE id = $1',
      [invite.server_id]
    );

    // Generate token
    const tokenPayload: AuthPayload = {
      userId: user.id,
      username: user.username,
      serverId: invite.server_id,
    };
    const token = generateToken(tokenPayload);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      server: serverRows[0],
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const { rows } = await db.query(
      `SELECT id, username, display_name, email, password_hash, avatar_url, status, created_at, updated_at
       FROM users WHERE email = $1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Get user's server membership
    const { rows: memberRows } = await db.query(
      'SELECT server_id FROM server_members WHERE user_id = $1 LIMIT 1',
      [user.id]
    );

    if (memberRows.length === 0) {
      return res.status(403).json({ error: 'User is not a member of any server' });
    }

    const serverId = memberRows[0].server_id;

    // Get server info
    const { rows: serverRows } = await db.query(
      'SELECT id, name, owner_id, icon_url, created_at FROM servers WHERE id = $1',
      [serverId]
    );

    // Update status to online
    await db.query(
      "UPDATE users SET status = 'online', updated_at = NOW() WHERE id = $1",
      [user.id]
    );

    // Generate token
    const tokenPayload: AuthPayload = {
      userId: user.id,
      username: user.username,
      serverId,
    };
    const token = generateToken(tokenPayload);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        status: 'online',
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      server: serverRows[0],
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 * Returns the current user from the JWT.
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const { rows } = await db.query(
      `SELECT id, username, display_name, avatar_url, status, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.auth!.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { rows: serverRows } = await db.query(
      'SELECT id, name, owner_id, icon_url, created_at FROM servers WHERE id = $1',
      [req.auth!.serverId]
    );

    res.json({
      user: rows[0],
      server: serverRows[0],
    });
  } catch (err) {
    console.error('[Auth] Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
