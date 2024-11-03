use anyhow::Context as _;
use anyhow::Result;
use reqwest::Client;

const EXCHANGE_RATE_API_URL: &str = "https://api.exchangerate-api.com/v4/latest/USD";

pub async fn get_exchange_rate(client: &Client) -> Result<f64> {
    let res = client.get(EXCHANGE_RATE_API_URL).send().await?;

    let res_body: serde_json::Value = res.json().await?;
    let exchange_rate = res_body["rates"]["JPY"]
        .as_f64()
        .context("JPY rate is not found")?;

    Ok(exchange_rate)
}

pub fn convert_usd_to_jpy(usd: &str, jpy_rate: f64) -> i64 {
    let jpy = usd.parse::<f64>().unwrap() * jpy_rate;

    jpy.trunc() as i64
}
