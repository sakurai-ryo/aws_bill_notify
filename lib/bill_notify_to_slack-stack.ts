import * as path from "node:path";

import { Duration, Stack, type StackProps } from "aws-cdk-lib";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
  Architecture,
  AssetImageCode,
  // biome-ignore lint/suspicious/noShadowRestrictedNames: Function is a CDK construct
  Function,
  Handler,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
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

    const billNotifyLambda = new Function(this, "billNotifier", {
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
    const rule = new Rule(this, "Rule", {
      schedule: Schedule.expression("cron(15 15 * * ? *)"),
    });
    rule.addTarget(new LambdaFunction(billNotifyLambda));
  }
}
