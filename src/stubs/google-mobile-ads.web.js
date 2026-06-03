module.exports = {
  default: () => ({ initialize: () => Promise.resolve() }),
  BannerAd: () => null,
  BannerAdSize: {},
  InterstitialAd: { createForAdRequest: () => ({ load: () => {}, addAdEventListener: () => () => {} }) },
  RewardedAd: { createForAdRequest: () => ({ load: () => {}, addAdEventListener: () => () => {} }) },
  AppOpenAd: { createForAdRequest: () => ({ load: () => {}, addAdEventListener: () => () => {} }) },
  NativeAd: () => null,
  AdsConsent: { requestInfoUpdate: () => Promise.resolve(), loadAndShowConsentFormIfRequired: () => Promise.resolve() },
  AdEventType: {},
  RewardedAdEventType: {},
  TestIds: {},
};
