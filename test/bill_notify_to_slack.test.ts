import {
  expect as expectCDK,
  matchTemplate,
  MatchStyle,
} from "@aws-cdk/assert";
import * as cdk from "@aws-cdk/core";
import * as BillNotifyToSlack from "../lib/bill_notify_to_slack-stack";

test("Empty Stack", () => {
  const app = new cdk.App();
  // WHEN
  const stack = new BillNotifyToSlack.BillNotifyToSlackStack(
    app,
    "MyTestStack"
  );
  // THEN
  expectCDK(stack).to(
    matchTemplate(
      {
        Resources: {},
      },
      MatchStyle.EXACT
    )
  );
});
