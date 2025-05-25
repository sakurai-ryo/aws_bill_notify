import * as path from "node:path";

import { Duration, Stack, type StackProps, TimeZone } from "aws-cdk-lib";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
  Architecture,
  AssetImageCode,
  // biome-ignore lint/suspicious/noShadowRestrictedNames: Function is a CDK construct
  Function,
  Handler,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { Schedule, ScheduleExpression } from "aws-cdk-lib/aws-scheduler";
import { LambdaInvoke } from "aws-cdk-lib/aws-scheduler-targets";
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

    const lambdaImage = AssetImageCode.fromAssetImage(
      path.join(__dirname, "../bill_notify"),
      {
        platform: Platform.LINUX_ARM64,
      },
    );

    const billNotifyLambda = new Function(this, "BillNotifier", {
      functionName: "billNotifier",
      runtime: Runtime.FROM_IMAGE,
      architecture: Architecture.ARM_64,
      memorySize: 1024,
      timeout: Duration.seconds(300),
      code: lambdaImage,
      handler: Handler.FROM_IMAGE,
      initialPolicy: [costExplorerPolicy],
      environment: {
        SLACK_WEBHOOK_URL: slackWebhookUrlParameter.stringValue,
      },
    });

    // JSTで0時15分に起動するように設定
    new Schedule(this, "Schedule", {
      target: new LambdaInvoke(billNotifyLambda),
      schedule: ScheduleExpression.cron({
        minute: "15",
        hour: "15",
        day: "*",
        month: "*",
        year: "*",
        timeZone: TimeZone.ASIA_TOKYO,
      }),
    });
  }
}
