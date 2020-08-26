import * as AWS from "aws-sdk";
import { GetMetricDataInput } from "aws-sdk/clients/cloudwatch";
import * as moment from "moment";
import { IncomingWebhook } from "@slack/webhook";

interface Credential {
  url: string;
}

const createParam = (startTime: Date, endTime: Date, id: string) => {
  const params: GetMetricDataInput = {
    MetricDataQueries: [
      {
        Id: "id",
        MetricStat: {
          Metric: {
            Namespace: "AWS/Billing",
            MetricName: "EstimatedCharges",
            Dimensions: [
              {
                Name: "Currency",
                Value: "USD",
              },
            ],
          },
          Period: 86400,
          Stat: "Maximum",
        },
      },
    ],
    StartTime: startTime,
    EndTime: endTime,
  };
  return params;
};

const getMetricStatistics = async (
  cw: AWS.CloudWatch,
  params: GetMetricDataInput
) => {
  try {
    const result = await cw.getMetricData(params).promise();
    return result;
  } catch (err) {
    throw new Error(err);
  }
};

/**
 * Secret Managerからsecretを取得
 */
// export const getSecretString = async (): Promise<Credential> => {
//   const secretManagerClient = new AWS.SecretsManager();
//   const SECRET_ID = process.env.SECRET_ID!;
//   const secretValue = await secretManagerClient
//     .getSecretValue({ SecretId: SECRET_ID })
//     .promise();
//   return JSON.parse(secretValue.SecretString!);
// };

const sendToSlack = async (bill: number) => {
  //const credential = await getSecretString();
  const url = process.env.URL!;
  const webhook = new IncomingWebhook(url, {
    username: "AWS Bill Notification",
    icon_emoji: ":ghost:",
  });

  const today = moment().format("YYYY-MM-DD");

  await webhook.send({
    text: `${today}時点の金額は下記の通りです。`,
    channel: "#aws-bill",
    attachments: [{ text: `Total Cost: ${bill}$` }],
  });
};

export const handler = async () => {
  const cw = new AWS.CloudWatch({ region: "us-east-1" });

  const today = moment(new Date()).utc().startOf("day");
  const tomorrow = moment(today).add(1, "days");
  const startDay = new Date(today.toISOString());
  const endDay = new Date(tomorrow.toISOString());

  // const startOfMonth = new Date(
  //   moment(new Date()).startOf("month").toISOString()
  // );

  const dailyParams = createParam(startDay, endDay, "monitoringAwsCostPerDay");
  // const monthlyParams = createParam(
  //   startOfMonth,
  //   new Date(today.toISOString()),
  //   "monitoringAwsCostPerMonth"
  // );

  const dailyBill = await getMetricStatistics(cw, dailyParams);
  console.log("handler -> dailyBill", JSON.stringify(dailyBill));
  try {
    const bill = dailyBill.MetricDataResults![0].Values![0];
    await sendToSlack(bill);
  } catch (err) {
    throw new Error(err);
  }
  // const monthlyBill = await getMetricStatistics(cw, monthlyParams);
  // console.log("handler -> monthlyBill", JSON.stringify(monthlyBill));
};
