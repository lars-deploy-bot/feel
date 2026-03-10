use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    alive_deployer_rs::run().await
}
