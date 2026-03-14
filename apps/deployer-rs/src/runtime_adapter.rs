use anyhow::{anyhow, Result};

use crate::types::{EnvironmentRow, RuntimeConfig, RuntimeKindConfig, RuntimeNetworkMode};
use crate::workspace_contract::{RuntimeKind, RuntimeTarget};

pub(crate) trait RuntimeAdapter {
    fn kind(&self) -> RuntimeKind;
    fn target_for_environment(&self, environment: &EnvironmentRow) -> Result<RuntimeTarget>;
    fn runtime_port(
        &self,
        environment: &EnvironmentRow,
        runtime: &RuntimeConfig,
        network_mode: RuntimeNetworkMode,
    ) -> Result<u16>;
}

#[derive(Clone, Copy, Debug, Default)]
pub(crate) struct HostRuntimeAdapter;

impl RuntimeAdapter for HostRuntimeAdapter {
    fn kind(&self) -> RuntimeKind {
        RuntimeKind::Host
    }

    fn target_for_environment(&self, environment: &EnvironmentRow) -> Result<RuntimeTarget> {
        RuntimeTarget::for_environment(self.kind(), environment)
    }

    fn runtime_port(
        &self,
        environment: &EnvironmentRow,
        runtime: &RuntimeConfig,
        network_mode: RuntimeNetworkMode,
    ) -> Result<u16> {
        let host_port = u16::try_from(environment.port)
            .map_err(|error| anyhow!("invalid environment port {}: {}", environment.port, error))?;

        Ok(match network_mode {
            RuntimeNetworkMode::Bridge => runtime.container_port,
            RuntimeNetworkMode::Host => host_port,
        })
    }
}

#[derive(Debug)]
pub(crate) enum ResolvedRuntimeAdapter {
    Host(HostRuntimeAdapter),
}

impl ResolvedRuntimeAdapter {
    pub(crate) fn from_config(kind: RuntimeKindConfig) -> Result<Self> {
        match kind {
            RuntimeKindConfig::Host => Ok(Self::Host(HostRuntimeAdapter)),
            RuntimeKindConfig::E2b => Err(anyhow!("runtime kind e2b is not implemented yet")),
            RuntimeKindConfig::Hetzner => {
                Err(anyhow!("runtime kind hetzner is not implemented yet"))
            }
        }
    }
}

impl RuntimeAdapter for ResolvedRuntimeAdapter {
    fn kind(&self) -> RuntimeKind {
        match self {
            Self::Host(adapter) => adapter.kind(),
        }
    }

    fn target_for_environment(&self, environment: &EnvironmentRow) -> Result<RuntimeTarget> {
        match self {
            Self::Host(adapter) => adapter.target_for_environment(environment),
        }
    }

    fn runtime_port(
        &self,
        environment: &EnvironmentRow,
        runtime: &RuntimeConfig,
        network_mode: RuntimeNetworkMode,
    ) -> Result<u16> {
        match self {
            Self::Host(adapter) => adapter.runtime_port(environment, runtime, network_mode),
        }
    }
}
