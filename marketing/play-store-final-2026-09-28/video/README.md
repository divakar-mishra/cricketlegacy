# Cricket: Player and Manager — editable preview project

The final delivery is `cricket-player-and-manager-preview-45s.mp4`: portrait 1080 × 1920, 30 fps, 45 seconds, H.264 video with AAC audio. `captions.srt` contains the short on-screen marketing captions. There is no voice-over.

## Edit and render

This is a self-contained, source-editable project, not a Premiere/CapCut proprietary project. All selected media, fonts and music are included.

1. Edit `project.json`: change clip order, durations, source start times, captions or crop rectangles. Crops are pixel coordinates `[left, top, width, height]` in the original source.
2. Keep the total clip duration at 45 seconds (42 seconds of real app media, followed by the 3-second brand end card).
3. On macOS with Xcode Command Line Tools installed, open Terminal in this `video` folder and run:

   ```sh
   swift -module-cache-path /private/tmp/cricket-marketing-swift-cache render.swift
   ```

`render.swift` contains the typography, spacing, colour palette, transitions, gentle still-image motion, audio level/fades and end card. Running it replaces this project's MP4, intermediate video, SRT, keyframe previews and validation text. It does not change the app or any saves.

## Fidelity

- Actual Android recordings supply the moving gameplay. No AI-created gameplay, scores, button presses, wins or screen animations are used.
- Other scenes are genuine app screenshots with a restrained editorial camera move. A moving screenshot is not presented as a recorded tap or app transition.
- Android system bars and empty borders are cropped away. Captions are outside the game interface.
- The end card uses the supplied icon and exact current app title.
- `media/music.wav` is the game's original, developer-generated selected B composition, `assets/audio/menu_broadcast_soft.wav`. Its provenance is `scripts/generate-audio-previews.mjs`. The quieter/lower-pitched app version is used unchanged, with a further quiet trailer mix and entry/exit fades. No third-party commercial song is included.
- Sora and Inter font licences are included in `fonts/`.

For Google Play's video field, upload the MP4 to a public or unlisted, embeddable YouTube video with monetisation disabled. Do not paste a local MP4 path in Play Console.
