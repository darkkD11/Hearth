import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from './index.js';
import { config } from '../config/index.js';
import { ALL_PERMISSIONS, DEFAULT_MEMBER_PERMISSIONS } from '@hearth/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seed() {
  console.log('[Seed] Starting database seed...');

  // 1. Run schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await db.query(schema);
  console.log('[Seed] Schema applied.');

  // 2. Check if already seeded
  const { rows: existingUsers } = await db.query('SELECT id FROM users LIMIT 1');
  if (existingUsers.length > 0) {
    console.log('[Seed] Database already seeded. Skipping.');
    process.exit(0);
  }

  // 3. Create admin user
  const passwordHash = await bcrypt.hash(config.admin.password, 12);
  const adminId = uuidv4();

  await db.query(
    `INSERT INTO users (id, username, display_name, email, password_hash, status)
     VALUES ($1, $2, $3, $4, $5, 'offline')`,
    [adminId, config.admin.username, config.admin.username, config.admin.email, passwordHash]
  );
  console.log(`[Seed] Admin user created: ${config.admin.username}`);

  // 4. Create the Hearth server
  const serverId = uuidv4();
  await db.query(
    `INSERT INTO servers (id, name, owner_id) VALUES ($1, $2, $3)`,
    [serverId, 'Hearth', adminId]
  );
  console.log('[Seed] Server "Hearth" created.');

  // 5. Create default roles
  const ownerRoleId = uuidv4();
  const adminRoleId = uuidv4();
  const memberRoleId = uuidv4();

  await db.query(
    `INSERT INTO roles (id, server_id, name, color, permissions, position) VALUES
     ($1, $2, 'Owner',  '#f59e0b', $3, 100),
     ($4, $2, 'Admin',  '#3b82f6', $5, 50),
     ($6, $2, 'Member', '#6b7280', $7, 0)`,
    [ownerRoleId, serverId, ALL_PERMISSIONS, adminRoleId, ALL_PERMISSIONS, memberRoleId, DEFAULT_MEMBER_PERMISSIONS]
  );
  console.log('[Seed] Default roles created.');

  // 6. Add admin as server member with owner role
  await db.query(
    `INSERT INTO server_members (user_id, server_id) VALUES ($1, $2)`,
    [adminId, serverId]
  );
  await db.query(
    `INSERT INTO member_roles (user_id, server_id, role_id) VALUES ($1, $2, $3)`,
    [adminId, serverId, ownerRoleId]
  );
  console.log('[Seed] Admin added as server owner.');

  // 7. Create default channels
  await db.query(
    `INSERT INTO channels (server_id, name, type, position) VALUES
     ($1, 'general',       'text', 0),
     ($1, 'off-topic',     'text', 1),
     ($1, 'voice-hangout', 'voice', 2)`,
    [serverId]
  );
  console.log('[Seed] Default channels created.');

  // 8. Generate a first invite code
  const inviteCode = uuidv4().slice(0, 8).toUpperCase();
  await db.query(
    `INSERT INTO invite_codes (server_id, created_by, code, max_uses)
     VALUES ($1, $2, $3, 10)`,
    [serverId, adminId, inviteCode]
  );
  console.log(`[Seed] Initial invite code: ${inviteCode}`);

  console.log('\n[Seed] ✅ Database seeded successfully!');
  console.log(`[Seed] Login with: ${config.admin.email} / ${config.admin.password}`);
  console.log(`[Seed] Invite code for new users: ${inviteCode}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
