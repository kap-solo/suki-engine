# Game audio

Add your own files here:

| File | Use |
|------|-----|
| `music.mp3` | Looping background music |
| `play.mp3` | Bet / play button |
| `win.mp3` | Winning round |
| `lose.mp3` | Losing round |

Update paths in `js/audio.js` if you use different names or formats (OGG is fine).

**Burger menu:** labeled **Music** and **Sound effects** rows — each has a mute icon (tap to mute/unmute) and a volume slider. Prefs persist in `localStorage` via `createAudioPrefs` (`musicVolume` / `sfxVolume`, 0–1).
