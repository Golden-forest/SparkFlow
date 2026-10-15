CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
CREATE TABLE app.notes (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notes_user_created_idx ON app.notes(user_id, created_at DESC);
ALTER TABLE app.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notes FORCE ROW LEVEL SECURITY;
CREATE POLICY notes_owner ON app.notes FOR ALL
  USING (user_id = nullif(current_setting('app.current_user_id', true), ''))
  WITH CHECK (user_id = nullif(current_setting('app.current_user_id', true), ''));
REVOKE ALL ON app.notes FROM PUBLIC;
