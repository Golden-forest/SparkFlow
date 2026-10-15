-- Review, then run once as the local PostgreSQL administrator with psql -f.
-- Passwords are prompted by psql; they are never part of this file or shell arguments.
\set ON_ERROR_STOP on

CREATE ROLE sparkflow_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE sparkflow_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
\password sparkflow_migrator
\password sparkflow_app

CREATE DATABASE sparkflow_accounts OWNER sparkflow_migrator;
REVOKE ALL ON DATABASE sparkflow_accounts FROM PUBLIC;
GRANT CONNECT ON DATABASE sparkflow_accounts TO sparkflow_app;

\connect sparkflow_accounts
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO sparkflow_app;
-- The versioned migration grants only the table/sequence access required by the app.
-- Never grant app membership of the migration role or make the app a table owner.
