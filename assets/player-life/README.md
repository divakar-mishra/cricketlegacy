# Player Life illustrations

Seven original, built-in imagegen illustrations matching the facility collection's
cream/teal isometric diorama direction. Full generation prompts and source PNG
paths are recorded in [provenance.json](provenance.json). Original PNGs are retained;
the app bundles the 1020 × 680 WebP files locally for offline use.

- `personal-bank.webp`: vault and service-counter cutaway.
- `starter-apartment.webp`: City Apartment.
- `family-house.webp`: Family House.
- `legacy-estate.webp`: Legacy Estate.
- `bat-workshop.webp`: Bat Workshop.
- `fitness-studio.webp`: Performance Studio.
- `media-company.webp`: Sports Media Company.

PlayerLifeAssetCard maps the existing catalogue IDs to artwork and reuses
VenueIllustration, including its accessible image label and loading-error fallback.
Surrounding text and controls follow the app theme. Art is decorative: depicted
rooms, gardens and equipment grant no extra benefits. All income, costs,
ownership and eligibility come from existing gameplay state. No save migration.

Artwork and focused component checks are not a substitute for Android screen QA.
