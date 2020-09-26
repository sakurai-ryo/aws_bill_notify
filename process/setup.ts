#!/usr/bin/env node

// !参考: https://dev.classmethod.jp/articles/aws-cdk-ga-serverless-application/
import * as childProcess from "child_process";
import { mkdirSync, copyFileSync, existsSync } from "fs";

/**
 * 指定したパスにディレクトリを作成する
 */
const createDir = (layerDir: string, layerDirName: string) => {
  mkdirSync(layerDir);
  mkdirSync(layerDirName);
};

/**
 * layer用のディレクトリを作成し、rootのpackage.json & package.lock.jsonをコピー
 */
const copyPackageJson = (layerDirName: string) => {
  const packages = ["package.json", "package-lock.json"];
  packages.forEach((file) =>
    copyFileSync(`${process.cwd()}/${file}`, `${layerDirName}/${file}`)
  );
};

/**
 * layerが存在すればそのディレクトリを消し、インストールし直す
 */
const createLambdaLayer = () => {
  const layerDir = `${process.cwd()}/bundle`;
  const layerDirName = `${process.cwd()}/bundle/nodejs`;

  try {
    if (existsSync(`${process.cwd()}/bundle`))
      childProcess.execSync(`rm -r ${layerDir}`);

    createDir(layerDir, layerDirName);
    copyPackageJson(layerDirName);

    // childProcess.execSync(
    //   `npm --prefix ${layerDirName} install --production --progress=false`,
    //   {
    //     stdio: ["ignore", "inherit", "inherit"],
    //     env: { ...process.env },
    //     shell: "bash",
    //   }
    // );
    childProcess.execSync(
      `npm --prefix ${layerDirName} install --production --progress=false`
    );
  } catch (err) {
    console.error("create Layer failed", err);
    throw new Error(err);
  }
};
createLambdaLayer();
