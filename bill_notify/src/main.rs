use std::{env, sync};

use aws_lambda_events::eventbridge::EventBridgeEvent;
use aws_sdk_costexplorer::{self as costexplorer, Client};
use lambda_runtime::{service_fn, Error, LambdaEvent};

use chrono::{Datelike, NaiveDate, Utc};

use anyhow::{anyhow, Result};
use reqwest;
use serde::Serialize;

const SLACK_WEBHOOK_URL_ENV_KEY: &str = "SLACK_WEBHOOK_URL";

static CE_CLIENT: sync::OnceLock<Client> = sync::OnceLock::new();

#[derive(Serialize, Debug, Clone)]
struct BillPerService {
    name: String,
    bill: String,
}

#[derive(Serialize, Debug, Clone)]
struct SlackAttachmentField {
    title: String,
    value: String,
}
#[derive(Serialize, Debug, Clone)]
struct SlackAttachment {
    color: Option<String>,
    text: Option<String>,
    fields: Option<Vec<SlackAttachmentField>>,
}
#[derive(Serialize, Debug, Clone)]
struct SlackWebhookPayload {
    text: String,
    channel: String,
    attachments: Vec<SlackAttachment>,
}

#[tokio::main]
async fn main() -> std::result::Result<(), Error> {
    let func = service_fn(bill_notify);
    lambda_runtime::run(func).await?;
    Ok(())
}

async fn bill_notify(_: LambdaEvent<EventBridgeEvent>) -> std::result::Result<(), Error> {
    let aws_config = aws_config::load_from_env().await;
    let ce_client = costexplorer::Client::new(&aws_config);
    let _ = CE_CLIENT.set(ce_client);

    let slack_webhook_url = match env::var(SLACK_WEBHOOK_URL_ENV_KEY) {
        Ok(val) => val,
        Err(_) => {
            return Err(Error::from("SLACK_WEBHOOK_URL not set"));
        }
    };

    let utc_today = Utc::now();
    let start = NaiveDate::from_ymd_opt(utc_today.year(), utc_today.month(), 1)
        .unwrap()
        .format("%Y-%m-%d")
        .to_string();
    let end = utc_today.clone().format("%Y-%m-%d").to_string();

    let month_total = get_month_total(&CE_CLIENT, &start, &end).await?;
    let bill_per_services = get_bill_per_service(&CE_CLIENT, &start, &end).await?;

    // TODO: use Block kit
    let mut slack_attachment: Vec<SlackAttachment> = vec![SlackAttachment {
        text: Some(format!("Total Cost: {}", month_total)),
        color: None,
        fields: None,
    }];
    let mut additional_slack_attachments: Vec<SlackAttachment> = bill_per_services
        .iter()
        .map(|bill_per_service| SlackAttachment {
            color: Some("#f0f8ff".to_string()),
            text: None,
            fields: Some(vec![SlackAttachmentField {
                title: bill_per_service.name.clone(),
                value: bill_per_service.bill.clone(),
            }]),
        })
        .collect();
    slack_attachment.append(&mut additional_slack_attachments);
    let tokyo_timezone = chrono_tz::Asia::Tokyo;
    let today = Utc::now().with_timezone(&tokyo_timezone);
    let slack_webhook_payload = SlackWebhookPayload {
        text: format!(
            "{}時点の金額は下記の通りです。",
            today.format("%Y-%m-%d %H:%M")
        ),
        channel: "#aws-bill".to_string(),
        attachments: slack_attachment,
    };

    send_slack(slack_webhook_url, &slack_webhook_payload).await?;

    Ok(())
}

async fn get_month_total(
    client: &sync::OnceLock<Client>,
    start: &String,
    end: &String,
) -> Result<String> {
    let time_period = costexplorer::types::DateInterval::builder()
        .start(start)
        .end(end)
        .build()?;

    let result = client
        .get()
        .ok_or_else(|| anyhow!("Client is not initialized"))?
        .get_cost_and_usage()
        .time_period(time_period)
        .granularity(costexplorer::types::Granularity::Monthly)
        .metrics(costexplorer::types::Metric::AmortizedCost.as_str())
        .send()
        .await?;

    let amount = result
        .results_by_time()
        .get(0)
        .ok_or_else(|| anyhow!("ResultByTime is not found"))?
        .total()
        .ok_or_else(|| anyhow!("Total is not found"))?
        .get("AmortizedCost")
        .ok_or_else(|| anyhow!("AmortizedCost value is not found"))?
        .amount()
        .ok_or_else(|| anyhow!("Amount value is not found"))?;

    Ok(amount.to_string())
}

async fn get_bill_per_service(
    client: &sync::OnceLock<Client>,
    start: &String,
    end: &String,
) -> Result<Vec<BillPerService>> {
    let time_period = costexplorer::types::DateInterval::builder()
        .start(start)
        .end(end)
        .build()?;
    let group_by = costexplorer::types::GroupDefinition::builder()
        .r#type(costexplorer::types::GroupDefinitionType::Dimension)
        .key("SERVICE")
        .build();

    let result = client
        .get()
        .ok_or_else(|| anyhow!("Client is not initialized"))?
        .get_cost_and_usage()
        .time_period(time_period)
        .granularity(costexplorer::types::Granularity::Monthly)
        .metrics(costexplorer::types::Metric::AmortizedCost.as_str())
        .group_by(group_by)
        .send()
        .await?;

    let bill_per_services = result
        .results_by_time()
        .get(0)
        .ok_or_else(|| anyhow!("ResultByTime is not found"))?
        .groups()
        .iter()
        .map(|bill| extract_bill_per_service(bill))
        .collect();

    Ok(bill_per_services)
}

fn extract_bill_per_service(bill_group: &costexplorer::types::Group) -> BillPerService {
    let name = bill_group.keys().get(0).unwrap();
    let bill = bill_group
        .metrics()
        .unwrap()
        .get("AmortizedCost")
        .unwrap()
        .amount()
        .unwrap();

    return BillPerService {
        name: name.to_string(),
        bill: bill.to_string(),
    };
}

async fn send_slack(url: String, payload: &SlackWebhookPayload) -> Result<()> {
    let serialized_payload = serde_json::to_string(payload)?;

    let client = reqwest::Client::new();
    let res = client
        .post(url)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body(serialized_payload)
        .send()
        .await?;

    let status = res.status();
    let res_body = res.text().await?;
    println!("{:?}", res_body);

    match status {
        reqwest::StatusCode::OK => Ok(()),
        reqwest::StatusCode::CREATED => Ok(()),
        _ => Err(anyhow!("Failed to send slack message")),
    }
}
