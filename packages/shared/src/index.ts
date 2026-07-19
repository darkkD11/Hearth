// ============================================
// Hearth — Shared Type Definitions
// ============================================

// --- Database Models ---

export interface User {
  id: string;
  username: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

/** User without sensitive fields — safe for client consumption */
export type PublicUser = Omit<User, 'email'>;

export type UserStatus = 'online' | 'offline' | 'idle' | 'dnd';

export interface Server {
  id: string;
  name: string;
  owner_id: string;
  icon_url: string | null;
  created_at: string;
}

export interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: ChannelType;
  position: number;
  created_at: string;
}

export type ChannelType = 'text' | 'voice';

export interface Attachment {
  id: string;
  url: string;
  file_type: string | null;
}

export interface Reaction {
  id: string;
  user_id: string;
  emoji: string;
}

export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  edited_at: string | null;
  created_at: string;
  /** Populated on read */
  author?: PublicUser;
  attachments?: Attachment[];
  reactions?: Reaction[];
}

export interface Role {
  id: string;
  server_id: string;
  name: string;
  color: string | null;
  permissions: number;
  position: number;
  created_at: string;
}

export interface ServerMember {
  user_id: string;
  server_id: string;
  nickname: string | null;
  joined_at: string;
  /** Populated on read */
  user?: PublicUser;
  roles?: Role[];
}

export interface InviteCode {
  id: string;
  server_id: string;
  created_by: string;
  code: string;
  max_uses: number;
  uses: number;
  expires_at: string | null;
  created_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
}

// --- Permissions (Bitfield) ---

export const Permission = {
  MANAGE_CHANNELS:  1 << 0,
  MANAGE_ROLES:     1 << 1,
  MANAGE_MEMBERS:   1 << 2,
  SEND_MESSAGES:    1 << 3,
  MANAGE_MESSAGES:  1 << 4,
  CREATE_INVITES:   1 << 5,
  ADMINISTRATOR:    1 << 6,
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

/** Default permissions for the "member" role */
export const DEFAULT_MEMBER_PERMISSIONS =
  Permission.SEND_MESSAGES |
  Permission.CREATE_INVITES;

/** All permissions combined */
export const ALL_PERMISSIONS = Object.values(Permission)
  .reduce((acc, v) => acc | v, 0);

// --- API Types ---

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: PublicUser;
  server: Server;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  invite_code: string;
}

export interface RegisterResponse {
  token: string;
  user: PublicUser;
  server: Server;
}

export interface CreateChannelRequest {
  name: string;
  type?: ChannelType;
}

export interface UpdateChannelRequest {
  name?: string;
  position?: number;
}

export interface CreateInviteRequest {
  max_uses?: number;
  expires_in_hours?: number;
}

export interface MessagesQuery {
  before?: string;  // cursor: message ID
  limit?: number;   // default 50
}

export interface PaginatedMessages {
  messages: Message[];
  has_more: boolean;
}

// --- Socket.IO Event Maps ---

/** Events the client sends to the server */
export interface ClientToServerEvents {
  'message:send': (data: { channel_id: string; content: string; attachments?: Attachment[] }, callback: (response: { success: boolean; message?: Message; error?: string }) => void) => void;
  'message:edit': (data: { message_id: string; channel_id: string; content: string }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'message:delete': (data: { message_id: string; channel_id: string }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'message:react': (data: { message_id: string; channel_id: string; emoji: string }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'message:unreact': (data: { message_id: string; channel_id: string; emoji: string }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'channel:join': (channel_id: string) => void;
  'channel:leave': (channel_id: string) => void;
  'user:status': (status: UserStatus) => void;
  'typing:start': (channel_id: string) => void;
  'typing:stop': (channel_id: string) => void;
}

/** Events the server sends to the client */
export interface ServerToClientEvents {
  'message:new': (message: Message) => void;
  'message:updated': (message: Message) => void;
  'message:deleted': (data: { message_id: string; channel_id: string }) => void;
  'channel:created': (channel: Channel) => void;
  'channel:updated': (channel: Channel) => void;
  'channel:deleted': (channel_id: string) => void;
  'user:status_changed': (data: { user_id: string; status: UserStatus }) => void;
  'member:joined': (member: ServerMember) => void;
  'member:left': (user_id: string) => void;
  'typing:update': (data: { channel_id: string; user_id: string; username: string; is_typing: boolean }) => void;
}

/** Data attached to each socket connection */
export interface SocketData {
  user_id: string;
  username: string;
  server_id: string;
}
