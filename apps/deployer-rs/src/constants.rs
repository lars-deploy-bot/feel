use std::time::Duration;

pub(crate) const DATA_DIR: &str = "/var/lib/alive/deployer";
pub(crate) const HEALTH_PORT: u16 = 5095;
pub(crate) const POLL_INTERVAL: Duration = Duration::from_secs(5);
pub(crate) const HEALTH_TIMEOUT: Duration = Duration::from_secs(60);
pub(crate) const STABILIZATION_WINDOW: Duration = Duration::from_secs(75);
pub(crate) const STABILIZATION_POLL_INTERVAL: Duration = Duration::from_secs(5);
pub(crate) const PUBLIC_HEALTH_TIMEOUT: Duration = Duration::from_secs(45);
pub(crate) const LEASE_DURATION_SECONDS: i32 = 15 * 60;
pub(crate) const LEASE_RENEW_INTERVAL: Duration = Duration::from_secs(60);
pub(crate) const LOCAL_BIND_IP: &str = "127.0.0.1";
pub(crate) const GITHUB_API_PREFIX: &str = "repos";
