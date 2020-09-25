#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { BillNotifyToSlackStack } from "../lib/bill_notify_to_slack-stack";
import { bundleNpm } from "../lib/process/setup";

// Layer version用のプリプロセス
// bundleNpm();

// const targetEnv = process.env.SYSTEM_ENV ? process.env.SYSTEM_ENV : "dev";

const app = new cdk.App();
new BillNotifyToSlackStack(app, "BillNotifyToSlackStack");
