export const API_MULT = 1_000_000;
export const START_BALANCE_API = 1000 * API_MULT;

export const JURISDICTION_MOCK = {
  social: {
    socialCasino: true,
  },
  strict: {
    disabledTurbo: true,
    disabledSuperTurbo: true,
    disabledAutoplay: true,
    disabledSpacebar: true,
    disabledSlamstop: true,
    disabledBuyFeature: true,
    displayNetPosition: false,
    displayRTP: false,
    displaySessionTimer: true,
    minimumRoundDuration: 2500,
  },
};

export const DEFAULT_JURISDICTION = {
  socialCasino: false,
  disabledFullscreen: false,
  disabledTurbo: false,
  disabledSuperTurbo: false,
  disabledAutoplay: false,
  disabledSlamstop: false,
  disabledSpacebar: false,
  disabledBuyFeature: true,
  displayNetPosition: true,
  displayRTP: true,
  displaySessionTimer: false,
  minimumRoundDuration: 0,
};
