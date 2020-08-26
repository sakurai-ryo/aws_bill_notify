#!/bin/sh

echo "============== typescript compiling.... =================="
# tsc lambda/functions/*.ts
npm run build

echo "============== CDK deploying.... =================="
cdk deploy