import { Duration, Stack, type StackProps } from "aws-cdk-lib";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
// biome-ignore lint/suspicious/noShadowRestrictedNames: Function is a CDK construct
import { AssetImageCode, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

export class BillNotifyToSlackStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const slackWebhookUrlParameter =
      StringParameter.fromStringParameterAttributes(
        this,
        "SlackWebhookUrlParameter",
        {
          parameterName: "/Lambda/production/aws_bill_webhook",
        },
      );

    const costExplorerPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["ce:GetCostAndUsage"],
      resources: ["*"],
    });

    const billNotifyLambda = new Function(this, "billNotifier", {
      functionName: "billNotifier",
      runtime: Runtime.FROM_IMAGE,
      code: AssetImageCode.fromAssetImage(""),
      handler: "index.handler",
      timeout: Duration.seconds(300),
      initialPolicy: [costExplorerPolicy],
      environment: {
        TZ: "Asia/Tokyo",
        URL: slackWebhookUrlParameter.stringValue,
      },
    });

    // JSTで0時15分に起動するように設定
    const rule = new Rule(this, "Rule", {
      schedule: Schedule.expression("cron(15 15 * * ? *)"),
    });
    rule.addTarget(new LambdaFunction(billNotifyLambda));
  }
}
