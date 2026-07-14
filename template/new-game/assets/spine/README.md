# Spine symbol assets (Suki Engine)

Suki slot games use **256×256** Spine exports for reel symbols. This matches typical on-screen symbol size at up to **2×** device pixel ratio (Pixi `resolution` is capped at 2).

## Expected layout

```
assets/spine/cherry/
  cherry.json      # or .skel — Spine 4.2.x
  cherry.atlas
  cherry.png
```

## Authoring rules

1. **Canvas:** export at **256×256** (engine constant `SPINE_TEXTURE_CANVAS_SIZE`).
2. **Crop:** trim empty padding; attachment bounds should match visible art, not the full canvas.
3. **Wire-up:** after export, copy atlas `bounds:` width/height into `designSize` in your game's symbol registry (see Reflecting Pool / Basic-Slot-Pool `js/pixi/symbols.js` for a reference implementation).
4. **Runtime:** `@kap-solo/suki-engine` exports `SPINE_TEXTURE_CANVAS_SIZE` and `SPINE_SYMBOL_FIT_RATIO` from `client/rgs.js`.

Example:

```js
import { SPINE_TEXTURE_CANVAS_SIZE } from '@kap-solo/suki-engine/client/rgs.js';

CH: {
  spine: {
    skeleton: 'assets/spine/cherry/cherry.json',
    atlas: 'assets/spine/cherry/cherry.atlas',
    scale: 1,
    designSize: { width: 200, height: 130 }, // from .atlas bounds after export
  },
},
```

## Animation names (convention)

| State | Track 0 | Loop |
|-------|---------|------|
| idle / static | `idle` | yes |
| land | `land` | no → idle |
| cascade | `cascade` | no → idle (falls back to `land`) |
| win | `win` | yes |

Export from Spine **4.2.x** to match `@esotericsoftware/spine-pixi-v8@4.2.74`.
