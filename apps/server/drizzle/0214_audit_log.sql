create table audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  app         text not null,          -- 'server' | 'internal-dashboard' | 'pixl-dashboard'
  actor_type  text not null,          -- 'player' | 'staff' | 'service' | 'anonymous'
  actor_id    text,                   -- users.id, or service name
  slack_id    text,
  action      text not null,          -- dotted verb, e.g. 'auth.login', 'shop.buy'
  target      text,                   -- e.g. 'project:123'
  result      text not null,          -- 'ok' | 'denied' | 'error'
  ip          text,
  user_agent  text,
  meta        jsonb not null default '{}'::jsonb
);
create index audit_log_at_idx on audit_log (at desc);
create index audit_log_slack_idx on audit_log (slack_id, at desc);
create index audit_log_action_idx on audit_log (action, at desc);
