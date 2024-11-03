use chrono::Utc;

use anyhow::{anyhow, Result};
use serde::Serialize;

use crate::aws;
use crate::exchange_rate::convert_usd_to_jpy;

#[derive(Serialize, Debug, Clone)]
struct SlackText {
    r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    emoji: Option<bool>,
    text: String,
}
#[derive(Serialize, Debug, Clone)]
struct SlackBlock {
    r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<SlackText>,
    #[serde(skip_serializing_if = "Option::is_none")]
    fields: Option<Vec<SlackText>>,
}
#[derive(Serialize, Debug, Clone)]
pub struct SlackWebhookPayload {
    blocks: Vec<SlackBlock>,
}

pub fn create_slack_payload(
    month_total: String,
    bill_per_services: Vec<aws::BillPerService>,
    jpy_rate: f64,
) -> SlackWebhookPayload {
    let tokyo_timezone = chrono_tz::Asia::Tokyo;
    let today = Utc::now().with_timezone(&tokyo_timezone);
    let mut slack_blocks: Vec<SlackBlock> = vec![
        SlackBlock {
            r#type: "header".into(),
            text: Some(SlackText {
                r#type: "plain_text".into(),
                emoji: Some(true),
                text: format!(
                    "{}時点の金額は下記の通りです\n💰Total Cost: ${} / ¥{}",
                    today.format("%Y-%m-%d %H:%M"),
                    month_total.chars().take(5).collect::<String>(),
                    convert_usd_to_jpy(month_total.as_str(), jpy_rate)
                ),
            }),
            fields: None,
        },
        SlackBlock {
            r#type: "section".into(),
            text: None,
            fields: Some(vec![
                SlackText {
                    r#type: "mrkdwn".into(),
                    emoji: None,
                    text: "Service".into(),
                },
                SlackText {
                    r#type: "mrkdwn".into(),
                    emoji: None,
                    text: "Price".into(),
                },
            ]),
        },
    ];
    slack_blocks.extend(
        bill_per_services
            .iter()
            .filter(|service| {
                service.bill != "0" && service.bill.chars().take(6).collect::<String>() != "0.0000"
            })
            .flat_map(|service| {
                vec![
                    SlackBlock {
                        r#type: "divider".into(),
                        text: None,
                        fields: None,
                    },
                    SlackBlock {
                        r#type: "section".into(),
                        text: None,
                        fields: Some(vec![
                            SlackText {
                                r#type: "mrkdwn".into(),
                                emoji: None,
                                text: format!("*{}*", service.name),
                            },
                            SlackText {
                                r#type: "mrkdwn".into(),
                                emoji: None,
                                text: format!(
                                    "${} / ¥{}",
                                    service.bill.chars().take(6).collect::<String>(),
                                    convert_usd_to_jpy(service.bill.as_str(), jpy_rate)
                                ),
                            },
                        ]),
                    },
                ]
            }),
    );

    SlackWebhookPayload {
        blocks: slack_blocks,
    }
}

pub async fn send_slack(
    client: &reqwest::Client,
    url: String,
    payload: &SlackWebhookPayload,
) -> Result<()> {
    let serialized_payload = serde_json::to_string(payload)?;

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
        reqwest::StatusCode::OK | reqwest::StatusCode::CREATED => Ok(()),
        _ => Err(anyhow!("Failed to send slack message")),
    }
}
