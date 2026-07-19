import { Permission } from '@hearth/shared';
import { db } from '../db/index.js';

/**
 * Check if a bitfield has a specific permission.
 */
export function hasPermission(permissions: number, permission: Permission): boolean {
  // Administrator overrides everything
  if (permissions & Permission.ADMINISTRATOR) return true;
  return (permissions & permission) === permission;
}

/**
 * Get the combined permissions for a user in a server.
 * Merges permissions from all roles the user holds.
 */
export async function getUserPermissions(userId: string, serverId: string): Promise<number> {
  // Check if user is the server owner (full permissions)
  const { rows: serverRows } = await db.query(
    'SELECT owner_id FROM servers WHERE id = $1',
    [serverId]
  );

  if (serverRows.length > 0 && serverRows[0].owner_id === userId) {
    // Owner gets all permissions
    return 0x7FFFFFFF; // All bits set
  }

  // Get all roles for this member
  const { rows: roleRows } = await db.query(
    `SELECT r.permissions
     FROM member_roles mr
     JOIN roles r ON r.id = mr.role_id
     WHERE mr.user_id = $1 AND mr.server_id = $2`,
    [userId, serverId]
  );

  // Combine all role permissions with OR
  return roleRows.reduce((acc, row) => acc | Number(row.permissions), 0);
}

/**
 * Express middleware factory: require specific permission.
 */
export function requirePermission(permission: Permission) {
  return async (req: any, res: any, next: any) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const perms = await getUserPermissions(req.auth.userId, req.auth.serverId);

    if (!hasPermission(perms, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}
