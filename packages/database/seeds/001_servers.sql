-- Required reference data: server entries
-- The app reads serverId from server-config.json and expects a matching row here.
-- Without this, domain registration and automation scheduling fail.
--
-- Each physical server needs exactly one row. Add new servers here when scaling.

INSERT INTO app.servers (server_id, name, ip, hostname)
VALUES
  ('srv_alive_dot_best_138_201_56_93', 'alive.best', '138.201.56.93', 'alive.best'),
  ('srv_sonno_dot_tech_95_217_89_48', 'sonno.tech', '95.217.89.48', 'sonno.tech')
ON CONFLICT (server_id) DO NOTHING;
