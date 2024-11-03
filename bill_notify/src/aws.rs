use aws_sdk_costexplorer::{self as costexplorer, Client};

use anyhow::Context as _;
use anyhow::Result;
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
pub struct BillPerService {
    pub name: String,
    pub bill: String,
}

pub async fn get_month_total(client: &Client, start: String, end: String) -> Result<String> {
    let time_period = costexplorer::types::DateInterval::builder()
        .start(start)
        .end(end)
        .build()?;

    let result = client
        .get_cost_and_usage()
        .time_period(time_period)
        .granularity(costexplorer::types::Granularity::Monthly)
        .metrics(costexplorer::types::Metric::AmortizedCost.as_str())
        .send()
        .await?;

    let amount = result
        .results_by_time()
        .first()
        .context("ResultByTime is not found")?
        .total()
        .context("Total is not found")?
        .get("AmortizedCost")
        .context("AmortizedCost value is not found")?
        .amount()
        .context("Amount value is not found")?;
    Ok(amount.to_string())
}

pub async fn get_bill_per_service(
    client: &Client,
    start: String,
    end: String,
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
        .get_cost_and_usage()
        .time_period(time_period)
        .granularity(costexplorer::types::Granularity::Monthly)
        .metrics(costexplorer::types::Metric::AmortizedCost.as_str())
        .group_by(group_by)
        .send()
        .await?;

    let bill_per_services = result
        .results_by_time()
        .first()
        .context("ResultByTime is not found")?
        .groups()
        .iter()
        .map(extract_bill_per_service)
        .collect();

    Ok(bill_per_services)
}

fn extract_bill_per_service(bill_group: &costexplorer::types::Group) -> BillPerService {
    let name = bill_group.keys().first().unwrap();
    let bill = bill_group
        .metrics()
        .unwrap()
        .get("AmortizedCost")
        .unwrap()
        .amount()
        .unwrap();

    BillPerService {
        name: name.into(),
        bill: bill.into(),
    }
}
