#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BillNotifyToSlackStack } from "../lib/bill_notify_to_slack-stack";

const app = new cdk.App();

new BillNotifyToSlackStack(app, "BillNotifyToSlackStack", {
  env: {
    region: "ap-northeast-1",
    account: "593359509969",
  },
});
