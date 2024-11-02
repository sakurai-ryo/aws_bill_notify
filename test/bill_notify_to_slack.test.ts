import {
  MatchStyle,
  SynthUtils,
  expect as expectCDK,
  haveResource,
  matchTemplate,
} from "@aws-cdk/assert";
import * as cdk from "@aws-cdk/core";
import * as BillNotifyToSlack from "../lib/bill_notify_to_slack-stack";

test("has lambda handler", () => {
  const app = new cdk.App();
  // WHEN
  const stack = new BillNotifyToSlack.BillNotifyToSlackStack(
    app,
    "MyTestStack",
  );

  expectCDK(stack).to(
    haveResource("AWS::Lambda::Function", {
      Handler: "index.handler",
    }),
  );
  // THEN
  // expectCDK(stack).to(
  //   matchTemplate(
  //     {
  //       Resources: {},
  //     },
  //     MatchStyle.EXACT
  //   )
  // );
});
