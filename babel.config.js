module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // reanimated 4부터는 worklets 플러그인을 별도 패키지에서 가져옴
    plugins: ["react-native-worklets/plugin"],
  };
};
