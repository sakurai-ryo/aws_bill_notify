const path = require("path");
const nodeExternals = require("webpack-node-externals");

module.exports = {
  mode: "development",
  target: "node",
  entry: {
    handler: path.resolve(__dirname, "./lambda/index.ts"),
  },
  // 依存ライブラリをデプロイ対象とするか設定(対象はpackage.json参照)
  // devDependencies:開発時に必要なライブラリを入れる
  // dependencies:実行時に必要なライブラリを入れる
  externals: [
    nodeExternals({
      modulesFromFile: {
        exclude: ["dependencies"],
        include: ["devDependencies"],
      },
    }),
  ],
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist/handler"),
    libraryTarget: "commonjs2",
  },
  // 変換後ソースと変換前ソースの関連付け
  devtool: "inline-source-map",
  module: {
    rules: [
      {
        // ローダーが処理対象とするファイルを設定
        test: /\.ts$/,
        // 先ほど追加したts-loaderを設定
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  // import時のファイル指定で拡張子を外す
  // https://webpack.js.org/configuration/module/#ruleresolve
  resolve: {
    extensions: [".ts", ".js"],
  },
};
