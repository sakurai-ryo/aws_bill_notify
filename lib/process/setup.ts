#!/usr/bin/env node

// !参考: https://dev.classmethod.jp/articles/aws-cdk-ga-serverless-application/
import * as childProcess from "child_process";
import { mkdirSync, copyFileSync, existsSync } from "fs";

export const NODE_LAMBDA_LAYER_DIR = `${process.cwd()}/bundle`;
export const NODE_LAMBDA_LAYER_RUNTIME_DIR_NAME = `${process.cwd()}/bundle/nodejs`;

const copyPackageJson = (
  NODE_LAMBDA_LAYER_DIR: string,
  NODE_LAMBDA_LAYER_RUNTIME_DIR_NAME: string
) => {
  //mkdirSync(getModulesInstallDirName());
  mkdirSync(NODE_LAMBDA_LAYER_DIR);
  mkdirSync(NODE_LAMBDA_LAYER_RUNTIME_DIR_NAME);

  ["package.json", "package-lock.json"].map((file) =>
    copyFileSync(
      `${process.cwd()}/${file}`,
      `${NODE_LAMBDA_LAYER_RUNTIME_DIR_NAME}/${file}`
    )
  );
};

export const bundleNpm = () => {
  if (existsSync(`${process.cwd()}/bundle`))
    childProcess.execSync(`rm -r ${NODE_LAMBDA_LAYER_DIR}`);

  // create bundle directory
  copyPackageJson(NODE_LAMBDA_LAYER_DIR, NODE_LAMBDA_LAYER_RUNTIME_DIR_NAME);

  childProcess.execSync(
    `npm --prefix ${NODE_LAMBDA_LAYER_RUNTIME_DIR_NAME} install --production`,
    {
      stdio: ["ignore", "inherit", "inherit"],
      env: { ...process.env },
      shell: "bash",
    }
  );
};
