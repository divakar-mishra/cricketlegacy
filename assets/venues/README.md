# Illustrated venues

User-approved stylised 2.5D direction: simple cream buildings, teal roofs, geometric trees and a charcoal backdrop. These are generated original illustrations, not copied reference artwork. Generation prompts and PNG provenance are in [provenance.json](provenance.json).

All 25 WebP images are bundled locally at 1020 × 680. `src/components/venueArtwork.ts` owns the literal asset imports and clamps visual levels to 1–5. `VenueIllustration` contains the whole composition without cropping, labels it accessibly, and handles load errors. The ten new Training and Medical illustrations were generated with the built-in image tool; their prompt set and original paths are in [facility-provenance.json](facility-provenance.json).

| Track               | Level 1                  | Level 2            | Level 3              | Level 4               | Level 5                      |
| ------------------- | ------------------------ | ------------------ | -------------------- | --------------------- | ---------------------------- |
| Capacity            | Small terraces           | More side seating  | Low seating bowl     | Upper tiers           | Roofed grandstands           |
| Matchday experience | Pavilion and entrance    | Fan-zone marquees  | Hospitality pavilion | Premium frontage      | Landmark entrance and lights |
| Academy             | One net                  | Two nets           | Three nets           | Learning wing         | Welcome gate and campus      |
| Training            | One net and kit pavilion | Two nets           | Three nets           | Covered training hall | Performance campus           |
| Medical             | Treatment room           | Two treatment bays | Rehabilitation space | Recovery wing         | Sports-health centre         |

Capacity and matchday experience are separate views because their upgrades are independent. A capacity preview does not imply matching hospitality or lighting. The capacity artwork retains a baseline pavilion; matchday artwork intentionally excludes the seating bowl. `GroundDevelopment` labels the selected track and marks future levels as previews. Viewing artwork does not buy an upgrade or change save data.

Manager academies use their actual facility level. Personal academy tiers retain their existing 1/3/5 visual mapping and are labelled as tiers. Club Office previews reuse these same components. The illustrated palette is fixed; surrounding UI and club identity retain existing theme/team colours.

This asset pass does not replace live-match rendering or change delivery timing, player coordinates, ball trajectories, upgrade costs or progression. Training and Medical now use the same illustrated presentation as the stadium and Academy, in both Club Office and dedicated facility screens. Artwork depicts the current saved level; decorative equipment does not introduce additional gameplay benefits.

Review the rendered assets on Android before release; component tests and raster contact-sheet inspection are not a substitute for emulator/device QA.
