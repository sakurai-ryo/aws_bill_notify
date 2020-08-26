#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { BillNotifyToSlackStack } from '../lib/bill_notify_to_slack-stack';

const app = new cdk.App();
new BillNotifyToSlackStack(app, 'BillNotifyToSlackStack');
