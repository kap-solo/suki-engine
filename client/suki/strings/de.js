/**
 * German UI strings — scaffold placeholder.
 * Copy keys from en.js and translate; register in strings/index.js.
 */

export const de = {
  balance: 'Guthaben',
  bet: 'Einsatz',
  betAmount: 'Einsatzhöhe',
  lastResult: 'Letztes Ergebnis',
  drop: 'Drop',
  playVerb: 'spielen',
  insufficientBalance: 'Unzureichende Mittel.',
  setBetPrompt: 'Einsatz wählen · Drop drücken.',
  connectingRgs: 'Verbindung zum RGS…',
  sessionPl: 'Sitzung G/V',
  sessionPlays: 'Spiele in Sitzung',
  replayNote: 'Aufgezeichnete Runde — kein Live-Einsatz',
  stakeReturned: 'Push, Einsatz zurück',
  won: 'gewonnen',
  onAmount: 'bei',
  newSessionBalance: 'Neue Sitzung — Guthaben',
  autoplayStopped: 'Autoplay gestoppt — nicht genug Guthaben nach',
  autoplayButton: 'Autoplay',
  autoplayTitle: 'Autoplay',
  autoplaySummary: 'Wähle, wie viele Runden automatisch mit dem aktuellen Einsatz gespielt werden.',
  autoplayRoundsLabel: 'Anzahl Runden',
  autoplayCostLine: 'Kosten pro Runde: {playCost}',
  autoplayStart: 'Autoplay starten',
  autoplayCancel: 'Abbrechen',
  autoplayProgress: 'Autoplay {current}/{total}…',
  autoplayComplete: 'Autoplay abgeschlossen — {count} Spiele.',
  connectionLost: 'Verbindung unterbrochen',
  connectionRetry: 'Erneut versuchen',
  invalidRgsConnection:
    'Verbindung fehlgeschlagen — ungültige Verbindungseinstellungen. Spiel über Stake erneut öffnen.',
  replayAgain: 'Erneut abspielen',
  loadingReplay: 'Replay wird geladen…',
  replayingRound: 'Runde wird abgespielt…',
  replayPlayLabel: 'Spielkosten',
  payoutMultiplierLabel: 'Auszahlungsmultiplikator',
  replayFinalAmountLabel: 'Endbetrag',
  baseBetLabel: 'Basiseinsatz',
  costMultiplierLabel: 'Kostenmultiplikator',
  playModeLabel: 'Spielmodus',
  modeCostLine:
    '{playLabel}: {playCost} — {baseLabel}: {baseAmount} × {multLabel} {costMult}',
  replayStartSummary:
    '{playLabel}: {playAmount} · {worthLabel}: {worthMult} · {finalLabel}: {finalAmount}',
  gamblingLimitReached: 'Spielgrenze erreicht.',
  roundingNote: 'Alle angezeigten Beträge werden auf 2 Dezimalstellen gerundet.',
  maxWinLabel: 'Max. Gewinn',
  rtpLabel: 'RTP',
};

/** German social casino overrides (extend when targeting social markets). */
export const deSocial = {
  balance: 'Münzen',
  bet: 'Spielen',
  betAmount: 'Spielbetrag',
  insufficientBalance: 'Unzureichendes Guthaben.',
  setBetPrompt: 'Spielbetrag wählen · Drop drücken.',
  connectingRgs: 'Verbindung…',
  sessionPl: 'Sitzung Münzen',
  replayNote: 'Aufgezeichnete Runde — kein Live-Spiel',
  stakeReturned: 'Push, Spielbetrag zurück',
  newSessionBalance: 'Neue Sitzung — Münzen',
  autoplayStopped: 'Autoplay gestoppt — nicht genug Münzen nach',
  replayPlayLabel: 'Spielbetrag',
  payoutMultiplierLabel: 'Endmultiplikator',
  baseBetLabel: 'Basis-Spiel',
  costMultiplierLabel: 'Feature-Multiplikator',
};
