const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@opentelemetry")) {
    return {
      filePath: path.resolve(__dirname, "otel-stub.js"),
      type: "sourceFile",
    };
  }
  if (moduleName === "react-native-web-webview") {
    return {
      filePath: path.resolve(__dirname, "otel-stub.js"),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;