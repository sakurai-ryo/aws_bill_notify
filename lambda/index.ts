import * as AWS from "aws-sdk";
import { GetMetricDataInput } from "aws-sdk/clients/cloudwatch";
import * as moment from "moment";
import { IncomingWebhook, IncomingWebhookSendArguments } from "@slack/webhook";

const ce = new AWS.CostExplorer({ region: "us-east-1" });

const sendToSlack = async (start: string, end: string) => {
  //const credential = await getSecretString();
  const url = process.env.URL!;
  const webhook = new IncomingWebhook(url, {
    username: "AWS Bill Notification",
    icon_emoji: ":ghost:",
  });

  const today = moment().format("YYYY-MM-DD");

  const monthBill = await getMonthTotal(start, end);
  const serviceBill = await getBillingPerService(start, end);

  const input: IncomingWebhookSendArguments = {
    text: `${today}時点の金額は下記の通りです。`,
    channel: "#aws-bill",
    attachments: [{ text: `Total Cost: ${monthBill}$` }],
  };

  serviceBill.forEach((s) => {
    if (s.bill === "0") return;
    input.attachments!.push({
      color: "#f0f8ff",
      fields: [
        {
          title: s.name,
          value: `${s.bill}$`,
        },
      ],
    });
  });

  await webhook.send(input);
};

const getMonthTotal = async (
  start: string,
  end: string
): Promise<string | undefined> => {
  const res = await ce
    .getCostAndUsage({
      TimePeriod: {
        Start: start, //moment().startOf("month").format("YYYY-MM-DD"),
        End: end, //moment().format("YYYY-MM-DD"),
      },
      Granularity: "MONTHLY",
      Metrics: ["AmortizedCost"],
    })
    .promise();
  return res.ResultsByTime![0].Total!.AmortizedCost.Amount;
};

const getBillingPerService = async (
  start: string,
  end: string
): Promise<
  {
    name: string;
    bill: string;
  }[]
> => {
  const res = await ce
    .getCostAndUsage({
      TimePeriod: {
        Start: start,
        End: end,
      },
      Granularity: "MONTHLY",
      Metrics: ["AmortizedCost"],
      GroupBy: [
        {
          Type: "DIMENSION",
          Key: "SERVICE",
        },
      ],
    })
    .promise();
  return res.ResultsByTime![0].Groups!.map((r) => ({
    name: r.Keys![0],
    bill: r.Metrics!.AmortizedCost.Amount!,
  }));
};

export const handler = async () => {
  const start = moment().startOf("month").format("YYYY-MM-DD");
  const end = moment().format("YYYY-MM-DD");

  try {
    await sendToSlack(start, end);
  } catch (err) {
    throw new Error(err);
  }
};
