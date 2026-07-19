-- ============================================
-- Hearth — Database Schema
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(32) UNIQUE NOT NULL,
  display_name  VARCHAR(64),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url    TEXT,
  status        VARCHAR(16) DEFAULT 'offline',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Servers (single instance, but schema supports future flexibility)
CREATE TABLE IF NOT EXISTS servers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  owner_id    UUID NOT NULL REFERENCES users(id),
  icon_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Channels
CREATE TABLE IF NOT EXISTS channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(16) DEFAULT 'text',
  position    INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  edited_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_created
  ON messages(channel_id, created_at DESC);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name        VARCHAR(64) NOT NULL,
  color       VARCHAR(7),
  permissions BIGINT DEFAULT 0,
  position    INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Server Members
CREATE TABLE IF NOT EXISTS server_members (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  nickname    VARCHAR(64),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, server_id)
);

-- Member Roles
CREATE TABLE IF NOT EXISTS member_roles (
  user_id     UUID NOT NULL,
  server_id   UUID NOT NULL,
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, server_id, role_id),
  FOREIGN KEY (user_id, server_id) REFERENCES server_members(user_id, server_id) ON DELETE CASCADE
);

-- Invite Codes
CREATE TABLE IF NOT EXISTS invite_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES users(id),
  code        VARCHAR(16) UNIQUE NOT NULL,
  max_uses    INT DEFAULT 1,
  uses        INT DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Friendships (prep for Phase 2 DMs)
CREATE TABLE IF NOT EXISTS friendships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      VARCHAR(16) DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Attachments
CREATE TABLE IF NOT EXISTS attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  file_type   VARCHAR(64),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Reactions
CREATE TABLE IF NOT EXISTS reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       VARCHAR(32) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Full-text search index on messages
CREATE INDEX IF NOT EXISTS idx_messages_search
  ON messages USING GIN (to_tsvector('english', content));
