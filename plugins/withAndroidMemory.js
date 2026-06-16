const { withGradleProperties } = require("expo/config-plugins");

const GRADLE_JVM_ARGS =
  "-Xmx3072m -XX:MaxMetaspaceSize=2048m -Dfile.encoding=UTF-8";
const KOTLIN_DAEMON_JVM_ARGS = "-Xmx2048m -XX:MaxMetaspaceSize=2048m";

function setProperty(config, key, value) {
  config.modResults = config.modResults.filter(
    (item) => !(item.type === "property" && item.key === key)
  );
  config.modResults.push({ type: "property", key, value });
  return config;
}

module.exports = function withAndroidMemory(config) {
  return withGradleProperties(config, (config) => {
    setProperty(config, "org.gradle.jvmargs", GRADLE_JVM_ARGS);
    setProperty(config, "kotlin.daemon.jvmargs", KOTLIN_DAEMON_JVM_ARGS);
    return config;
  });
};
