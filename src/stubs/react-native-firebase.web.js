module.exports = () => ({
  setAnalyticsCollectionEnabled: () => Promise.resolve(),
  setCrashlyticsCollectionEnabled: () => Promise.resolve(),
  logScreenView: () => Promise.resolve(),
  logEvent: () => Promise.resolve(),
  recordError: () => {},
});
