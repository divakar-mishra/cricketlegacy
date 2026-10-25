# Cricket: Player and Manager — final marketing pack

Finalised on 29 September 2026. The folder keeps the date on which production began.

## Upload files

| Item | File or folder | Format |
| --- | --- | --- |
| Eight phone screenshot panels | `screenshots/01-…png` through `08-…png`, in filename order | 1080 × 1920, RGB PNG |
| Screenshot overview | `CONTACT_SHEET.png` | Preview only; do not upload as one phone screenshot |
| Feature graphic | `store-assets/feature-graphic-1024x500.png` | 1024 × 500, RGB PNG |
| App icon | `store-assets/app-icon-512.png` | 512 × 512 PNG |
| High-resolution icon source | `store-assets/app-icon-1024.png` | 1024 × 1024 PNG |
| Portrait trailer | `video/cricket-player-and-manager-preview-45s.mp4` | 45 seconds, 1080 × 1920, H.264/AAC |
| Captions | `video/captions.srt` | Short captions matching the burned-in headlines |
| Store text | `PLAY_STORE_LISTING.md` | Copy the three text blocks into the corresponding listing fields |

The exact title is **Cricket: Player and Manager**. The phone launcher label remains **Cricket**. No app code, package name or store release was changed by producing these assets.

## What is real, and what is editorial

The eight panels use genuine app screenshots. Framing, cropped sections, typography and decorative boundary lines are marketing layout; the game's scores, controls, player ratings and interface have not been redrawn or replaced.

The trailer opens with a fresh, uninterrupted recording of actual live match play. Other chapters use genuine still captures with editorial framing and motion; they are not fabricated videos of app interactions. The end card uses the existing icon. The feature graphic is the supplied current-name promotional illustration, not a gameplay claim.

The new September 29 snapshots were inspected. Their accompanying README and saves identify manually boosted 99-rated Player and 97–99-rated Manager QA careers. None of those snapshots is used in the public exports. Fresh Player images instead come from a normally created Arjun Rao career. Some older Manager screenshots are retained where they provide useful genuine, non-staged UI; the source map records this.

The public images do not display the old name, emulator tools, test ads, prices or invented trophies. Cropped source originals may contain system bars or other material outside the exported region; **only the files in `screenshots/`, the final feature/icon and final MP4 are upload assets**.

## Editable projects

- Screenshot layouts and exact source crops: `project/screenshots.json`.
- Screenshot/contact-sheet renderer: `project/render-screenshots.swift`.
- Trailer timeline, captions, source crops and scene provenance: `video/project.json`.
- Trailer renderer: `video/render.swift`.
- Source screenshots: `sources/`; video sources and music: `video/media/`.
- Font files and open-font licences accompany both projects.

These are editable, reproducible native macOS projects, not proprietary Premiere, CapCut or Photoshop project files. They require macOS with Xcode Command Line Tools; Node.js is used only for validation.

From the unzipped pack folder:

```sh
swift -module-cache-path /private/tmp/cricket-marketing-swift-cache project/render-screenshots.swift .
node project/validate.mjs
```

For the video, open Terminal in `video/` and run:

```sh
swift -module-cache-path /private/tmp/cricket-marketing-swift-cache render.swift
```

Rendering replaces the generated assets inside this pack, not the app or any game saves.

## Remaining optional recording upgrades

The delivered trailer is finished and can be used as a mixed gameplay-and-stills preview. A complete moving-image tour of every requested system is not available from the supplied footage. To replace still chapters or show additional systems, see the exact recording list in `RECORDING_GAPS.md`. In particular, no adviser event, unlocked investment portfolio or earned trophy is invented for this pack.

## Play Console handoff

1. Copy the title, short description and full description from `PLAY_STORE_LISTING.md`.
2. Upload the 512 px icon and 1024 × 500 feature graphic in the appropriate graphic fields.
3. Upload all eight phone screenshots in filename order. Do not upload the contact sheet.
4. Upload the final MP4 to YouTube as an embeddable public or unlisted video, without age restrictions or monetisation, then paste that video's URL into the Play Console preview-video field. Play Console does not take the local MP4 there.
5. Review any AI-content declaration for the supplied promotional artwork; gameplay itself remains genuine app captures. See `SOURCE_NOTES.md` for the official guidance and provenance.

`VALIDATION.json`, `TEXT_REVIEW.txt` and the video's validation report document file-format, dimensions, text and duration checks. These marketing checks are not app regression tests or confirmation of production ads/IAP availability.
