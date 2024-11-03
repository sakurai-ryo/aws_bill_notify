use std::{env, sync};

use aws_lambda_events::eventbridge::EventBridgeEvent;
use aws_sdk_costexplorer::{self as costexplorer, Client};
use lambda_runtime::{service_fn, tracing, Diagnostic, LambdaEvent};

use chrono::{Datelike, NaiveDate, Utc};

use anyhow::anyhow;
use anyhow::Context as _;
use tokio::{spawn, try_join};

mod aws;
mod exchange_rate;
mod slack;

const SLACK_WEBHOOK_URL_ENV_KEY: &str = "SLACK_WEBHOOK_URL";

static CE_CLIENT: sync::OnceLock<Client> = sync::OnceLock::new();
static HTTP_CLIENT: sync::OnceLock<reqwest::Client> = sync::OnceLock::new();

#[tokio::main]
async fn main() -> std::result::Result<(), lambda_runtime::Error> {
    tracing::init_default_subscriber();
    let func = service_fn(bill_notify);
    lambda_runtime::run(func).await?;
    Ok(())
}

async fn bill_notify(_: LambdaEvent<EventBridgeEvent>) -> std::result::Result<(), Diagnostic> {
    let aws_config = aws_config::load_from_env().await;
    let ce_client = costexplorer::Client::new(&aws_config);
    let _ = CE_CLIENT.set(ce_client);
    let _ = HTTP_CLIENT.set(reqwest::Client::new());

    let slack_webhook_url =
        env::var(SLACK_WEBHOOK_URL_ENV_KEY).context("SLACK_WEBHOOK_URL is not set")?;

    let ce_client = CE_CLIENT
        .get()
        .context("Cost Explorer client is not initialized")?;
    let http_client = HTTP_CLIENT
        .get()
        .context("Http client is not initialized")?;

    let utc_today = Utc::now();
    let start = NaiveDate::from_ymd_opt(utc_today.year(), utc_today.month(), 1)
        .unwrap()
        .format("%Y-%m-%d")
        .to_string();
    let end = utc_today.clone().format("%Y-%m-%d").to_string();

    let sdk_result = try_join!(
        spawn(aws::get_month_total(ce_client, start.clone(), end.clone())),
        spawn(aws::get_bill_per_service(
            ce_client,
            start.clone(),
            end.clone()
        )),
        spawn(exchange_rate::get_exchange_rate(http_client))
    );

    match sdk_result {
        Ok((month_total, bill_per_services, jpy_rate)) => {
            let slack_webhook_payload =
                slack::create_slack_payload(month_total?, bill_per_services?, jpy_rate?);
            slack::send_slack(http_client, slack_webhook_url, &slack_webhook_payload).await?;
        }
        Err(e) => {
            return Err(anyhow!("{:?}", e).into());
        }
    };

    Ok(())
}
