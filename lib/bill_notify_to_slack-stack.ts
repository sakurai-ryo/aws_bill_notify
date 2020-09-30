import * as cdk from "@aws-cdk/core";
import {
  Function,
  AssetCode,
  Runtime,
  LayerVersion,
} from "@aws-cdk/aws-lambda";
import { Role, ServicePrincipal, ManagedPolicy } from "@aws-cdk/aws-iam";
import { Rule, Schedule } from "@aws-cdk/aws-events";
import { LambdaFunction } from "@aws-cdk/aws-events-targets";
import { StringParameter } from "@aws-cdk/aws-ssm";

const layerDirName = `${process.cwd()}/bundle/nodejs`;

export class BillNotifyToSlackStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // IAM Role
    const executionLambdaRole = new Role(this, "secureLambdaRole", {
      roleName: "lambdaSecureExecutionRole",
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
        ManagedPolicy.fromAwsManagedPolicyName("CloudWatchFullAccess"),
      ],
    });

    //   aws ssm put-parameter \
    //  --type 'String' \
    //  --name '/Lambda/production/aws_bill_webhook' \
    //  --value 'hook-url'
    const slackChannel = StringParameter.fromStringParameterAttributes(
      this,
      "slackChannel",
      {
        parameterName: "/Lambda/production/aws_bill_webhook",
      }
    );
    console.log(
      "BillNotifyToSlackStack -> constructor -> slackChannel",
      slackChannel.stringValue
    );

    // Layer version
    const nodeModulesLayer = new LayerVersion(this, "NodeModulesLayer", {
      code: AssetCode.fromAsset(layerDirName),
      compatibleRuntimes: [Runtime.NODEJS_12_X],
    });

    // Lambda
    const billNotifyLambda = new Function(this, "billNotifier", {
      functionName: "billNotifier",
      runtime: Runtime.NODEJS_12_X,
      code: AssetCode.fromAsset("dist/handler"),
      layers: [nodeModulesLayer],
      handler: "index.handler",
      timeout: cdk.Duration.seconds(300),
      role: executionLambdaRole,
      environment: {
        TZ: "Asia/Tokyo",
        URL: slackChannel.stringValue,
      },
    });

    // JSTで0時15分に起動するように設定
    const rule = new Rule(this, "Rule", {
      schedule: Schedule.expression("cron(15 15 * * ? *)"),
    });

    rule.addTarget(new LambdaFunction(billNotifyLambda));
  }
}
