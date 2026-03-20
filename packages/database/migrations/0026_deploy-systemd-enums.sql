-- Add systemd support to deployer enums.
-- The deployer-rs supports both docker and systemd runtimes,
-- but migration 0020 only defined docker values.

ALTER TYPE deploy.executor_backend ADD VALUE IF NOT EXISTS 'systemd';
ALTER TYPE deploy.artifact_kind ADD VALUE IF NOT EXISTS 'build_directory';
