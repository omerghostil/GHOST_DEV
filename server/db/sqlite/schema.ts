/**
 * סכמת SQLite v1 — טבלאות ליבה, אינדקסים ואילוצי שלמות.
 * מותאמת למעבר עתידי ל-Firebase Realtime + Firestore.
 */

export const SCHEMA_VERSION = 4

export const MIGRATE_V2_TO_V3_SQL = `
ALTER TABLE organizations ADD COLUMN operations_count INTEGER NOT NULL DEFAULT 0;
UPDATE schema_version SET version = 3;
`

export const MIGRATE_V3_TO_V4_SQL = `
ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT '';
UPDATE schema_version SET version = 4;
`

/** SQL מיגרציה מגרסה 1 לגרסה 2 — טבלאות ערוצים עשירים, הודעות, מבצעים והרצות. */
export const MIGRATE_V1_TO_V2_SQL = `
CREATE TABLE IF NOT EXISTS channel_data (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'personal' CHECK(type IN ('personal', 'group')),
  subtitle TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  watch_scope TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  memory_interval INTEGER NOT NULL DEFAULT 30,
  rtsp_feed TEXT NOT NULL DEFAULT 'rtsp://',
  live_state TEXT NOT NULL DEFAULT 'LIVE' CHECK(live_state IN ('LIVE', 'SYNC', 'DEGRADED', 'OFFLINE')),
  camera_enabled INTEGER NOT NULL DEFAULT 0,
  linked_channel_ids TEXT NOT NULL DEFAULT '[]',
  members TEXT NOT NULL DEFAULT '[]',
  is_blocked INTEGER NOT NULL DEFAULT 0,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  author TEXT NOT NULL CHECK(author IN ('user', 'ghost', 'system')),
  text TEXT NOT NULL,
  time TEXT NOT NULL,
  alert_level TEXT,
  score REAL,
  frame_data_url TEXT,
  sources TEXT,
  created_at_iso TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS channel_operations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  channel_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('alert', 'report', 'rating', 'assessment')),
  schedule TEXT NOT NULL DEFAULT '24/7',
  trigger_text TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  model_override TEXT,
  detail_level TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  parsed_schedule TEXT,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS operation_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  channel_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'running', 'success', 'failed')),
  started_at_iso TEXT NOT NULL,
  ended_at_iso TEXT,
  error_code TEXT,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_channel_data_organization ON channel_data(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_user_channel ON messages(organization_id, user_id, channel_id, created_at_iso);
CREATE INDEX IF NOT EXISTS idx_messages_org_channel ON messages(organization_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_operations_org_channel ON channel_operations(organization_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_operations_enabled ON channel_operations(enabled, organization_id);
CREATE INDEX IF NOT EXISTS idx_operation_runs_operation ON operation_runs(operation_id, status);
CREATE INDEX IF NOT EXISTS idx_operation_runs_org ON operation_runs(organization_id);
UPDATE schema_version SET version = 2;
`

export const CREATE_TABLES_SQL = `
-- גרסת סכימה לצורך מיגרציות
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

-- ארגונים
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
  allowed_models TEXT NOT NULL DEFAULT '["gpt-4.1","gpt-4.1-mini"]',
  encrypted_openai_api_key TEXT,
  openai_usage_usd REAL NOT NULL DEFAULT 0,
  openai_last_sync_iso TEXT,
  max_channels INTEGER NOT NULL DEFAULT 20,
  max_messages_per_channel_per_month INTEGER NOT NULL DEFAULT 10000,
  monthly_charge_amount REAL NOT NULL DEFAULT 499,
  max_agents_total_cost REAL NOT NULL DEFAULT 2000,
  max_ai_total_cost REAL NOT NULL DEFAULT 5000,
  max_api_total_cost REAL NOT NULL DEFAULT 2500,
  sent_messages INTEGER NOT NULL DEFAULT 0,
  received_messages INTEGER NOT NULL DEFAULT 0,
  devices_count INTEGER NOT NULL DEFAULT 0,
  channels_count INTEGER NOT NULL DEFAULT 0,
  operations_count INTEGER NOT NULL DEFAULT 0,
  ai_total_cost REAL NOT NULL DEFAULT 0,
  api_total_cost REAL NOT NULL DEFAULT 0,
  agents_total_cost REAL NOT NULL DEFAULT 0,
  usage_updated_at_iso TEXT NOT NULL
);

-- משתמשים
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  username TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin', 'system_manager', 'regular_user')),
  allowed_channel_ids TEXT NOT NULL DEFAULT '[]',
  blocked_channel_ids TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  last_login_at_iso TEXT
);

-- ערוצים
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  is_blocked INTEGER NOT NULL DEFAULT 0
);

-- מבצעים
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- כרטיסי תשלום (כרטיס אחד לארגון)
CREATE TABLE IF NOT EXISTS payment_cards (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id),
  encrypted_pan TEXT NOT NULL,
  cardholder_name TEXT NOT NULL,
  expiry_month TEXT NOT NULL,
  expiry_year TEXT NOT NULL,
  billing_email TEXT NOT NULL,
  masked_pan TEXT NOT NULL,
  last4 TEXT NOT NULL,
  created_at_iso TEXT NOT NULL
);

-- יומן שימוש ועלויות
CREATE TABLE IF NOT EXISTS usage_ledger (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  metric_type TEXT NOT NULL CHECK(metric_type IN ('openai', 'api', 'agent', 'message')),
  amount REAL NOT NULL,
  details TEXT NOT NULL,
  created_at_iso TEXT NOT NULL
);

-- מוני שימוש חודשיים פר ערוץ
CREATE TABLE IF NOT EXISTS channel_usage_monthly (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  channel_id TEXT NOT NULL REFERENCES channels(id),
  month_key TEXT NOT NULL,
  outgoing_user INTEGER NOT NULL DEFAULT 0,
  incoming_ghost INTEGER NOT NULL DEFAULT 0,
  incoming_system INTEGER NOT NULL DEFAULT 0,
  incoming_operations INTEGER NOT NULL DEFAULT 0,
  operations_count_total INTEGER NOT NULL DEFAULT 0,
  operations_count_active INTEGER NOT NULL DEFAULT 0,
  UNIQUE(channel_id, month_key)
);

-- אירועי שימוש (Event Log) — בסיס לסנכרון עתידי עם Firebase Realtime
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  channel_id TEXT,
  campaign_id TEXT,
  event_type TEXT NOT NULL,
  direction TEXT,
  source TEXT,
  count INTEGER NOT NULL DEFAULT 1,
  created_at_iso TEXT NOT NULL
);

-- תקלות ובאגים
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved')),
  severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);

-- יומן ביקורת
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at_iso TEXT NOT NULL
);

-- טוקני רענון
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at_unix INTEGER NOT NULL
);

-- ערוצים עשירים פר ארגון
CREATE TABLE IF NOT EXISTS channel_data (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'personal' CHECK(type IN ('personal', 'group')),
  subtitle TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  watch_scope TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  memory_interval INTEGER NOT NULL DEFAULT 30,
  rtsp_feed TEXT NOT NULL DEFAULT 'rtsp://',
  live_state TEXT NOT NULL DEFAULT 'LIVE' CHECK(live_state IN ('LIVE', 'SYNC', 'DEGRADED', 'OFFLINE')),
  camera_enabled INTEGER NOT NULL DEFAULT 0,
  linked_channel_ids TEXT NOT NULL DEFAULT '[]',
  members TEXT NOT NULL DEFAULT '[]',
  is_blocked INTEGER NOT NULL DEFAULT 0,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);

-- הודעות פר משתמש + ערוץ + ארגון
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  author TEXT NOT NULL CHECK(author IN ('user', 'ghost', 'system')),
  text TEXT NOT NULL,
  time TEXT NOT NULL,
  alert_level TEXT,
  score REAL,
  frame_data_url TEXT,
  sources TEXT,
  created_at_iso TEXT NOT NULL
);

-- מבצעים פר ערוץ + ארגון
CREATE TABLE IF NOT EXISTS channel_operations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  channel_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('alert', 'report', 'rating', 'assessment')),
  schedule TEXT NOT NULL DEFAULT '24/7',
  trigger_text TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  model_override TEXT,
  detail_level TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  parsed_schedule TEXT,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);

-- היסטוריית הרצות מבצעים (scheduler שרתי)
CREATE TABLE IF NOT EXISTS operation_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  channel_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'running', 'success', 'failed')),
  started_at_iso TEXT NOT NULL,
  ended_at_iso TEXT,
  error_code TEXT,
  error_message TEXT
);

-- אינדקסים לשאילתות תכופות
CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_channels_organization ON channels(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_organization ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_organization ON usage_ledger(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_created ON usage_ledger(created_at_iso);
CREATE INDEX IF NOT EXISTS idx_channel_usage_monthly_org ON channel_usage_monthly(organization_id);
CREATE INDEX IF NOT EXISTS idx_channel_usage_monthly_channel ON channel_usage_monthly(channel_id, month_key);
CREATE INDEX IF NOT EXISTS idx_usage_events_organization ON usage_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at_iso);
CREATE INDEX IF NOT EXISTS idx_issues_organization ON issues(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at_iso);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_data_organization ON channel_data(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_user_channel ON messages(organization_id, user_id, channel_id, created_at_iso);
CREATE INDEX IF NOT EXISTS idx_messages_org_channel ON messages(organization_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_operations_org_channel ON channel_operations(organization_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_operations_enabled ON channel_operations(enabled, organization_id);
CREATE INDEX IF NOT EXISTS idx_operation_runs_operation ON operation_runs(operation_id, status);
CREATE INDEX IF NOT EXISTS idx_operation_runs_org ON operation_runs(organization_id);
`
