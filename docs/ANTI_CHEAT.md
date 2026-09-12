# Anti-cheat implementation and release checklist

Cricket Legacy is Expo/React Native, not Unity. No percentage of cheaters stopped
is promised. These layers raise the cost of editing; they cannot make an offline
client authoritative or prevent a determined attacker patching JavaScript/native
code, hooking getters, rolling back a previously valid save, or stealing keys on
a compromised device.

## Implemented locally

- `saveEncryption.ts`: AES-256-GCM through Expo Crypto, fresh 12-byte random IV,
  16-byte authentication tag and slot/mode-bound additional authenticated data.
  The encrypted payload retains the existing checksum envelope as an internal
  corruption check. No fixed encryption password ships in source.
- Each slot gets a random key held by SecureStore (Android Keystore-backed
  storage / iOS Keychain). Both primary and readable rolling backup are encrypted.
  A secure migration marker rejects old plaintext formats after migration.
  Legacy saves can only be checked using their old checksum on first migration;
  historical edits cannot be identified retroactively.
- Slot reads, migration, writes and confirmed deletion are serialized. Writes
  capture a snapshot before queuing. Corrupt/keyless slots are not empty, cannot
  be overwritten by creation/autosave, and show recovery guidance. The code does
  not erase careers or ban users on decryption failures. Valid backups recover.
- Active wallet Coins and Gems use masked float64-backed accessors, including
  state replacements. This avoids int32 truncation of large/fractional balances.
  Values necessarily exist in plaintext briefly during calculations, rendering
  and serialization. Club finances and every other game statistic are not masked.
- Play Integrity startup/foreground gate and an online recheck before live
  purchases (a successful live check from the previous 15 seconds is reused to
  avoid throttling immediate checkout). QA builds bypass attestation, not encrypted saves. Production must
  never have QA tools enabled.

Encrypted local saves are device-bound. **Do not uninstall to fix a save problem**:
Android removes Keystore keys on uninstall. A portable cloud backup is separate
from the encrypted local blob. Existing cloud snapshots and user account recovery
remain separate workflows, not authenticated server-owned economy ledgers.
An unreadable slot is intentionally protected from automatic cloud overwrite;
support/recovery must preserve that blob before an explicit replacement workflow.
The web target has no insecure plaintext fallback; this app targets Android.

## Play Integrity server flow (not deployed by this change)

1. Authenticated Supabase user requests a fresh challenge. Guest accounts are
   supported; existing anonymous-signup abuse protections still matter.
2. A service-only table holds one random request hash per user, with a 15-second
   issue throttle, two-minute validity and atomic single-use claim. Old rows are
   pruned during issuance after one day; account deletion cascades immediately.
3. The native standard Integrity API binds its token to that request hash.
4. The server uses its private service account to ask Google to decode the token.
   Only the server-decoded payload is evaluated: request package, hash, timestamp,
   recognised app, signing certificate allowlist and Play licence must match.
   No raw token, credential or device ID is logged or stored.
5. Explicit unrecognised versions, unlicensed installs or wrong certificates
   receive an official-store/retry screen. Unevaluated verdicts, replay attempts,
   timeouts and configuration errors are not called cheating.
6. A device that previously passed may continue ordinary offline gameplay when
   checking is unavailable. A previously rejected device remains blocked until
   a fresh successful check. New live purchases require an online pass; a cached
   offline pass is insufficient. No arbitrary offline expiry was added.

The launch gate itself can be patched out. The verification endpoint does **not**
yet require per-action attestation on every cloud/leaderboard/purchase-fulfilment
endpoint; it is not a replacement for server-owned currency or receipt validation.
Existing RevenueCat and exact-save sponsor fail-closed gates remain unchanged.

## Owner setup before enforcement

1. In Play Console → Cricket Legacy → App integrity → Play Integrity API, link
   the production Google Cloud project and enable the API there.
2. Create a dedicated server service account in that linked project. Configure
   `PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON` only in Supabase Edge Function secrets.
   Never add it to `.env` public variables, the app, screenshots or Git.
3. Set `PLAY_INTEGRITY_CERTIFICATES` to base64url-encoded SHA-256 digest(s) of the
   **Play app-signing certificate**, not the upload or debug key. Configure all
   legitimate certificate rotations. Set server `PLAY_INTEGRITY_ENABLED=true`.
4. Apply `202609080001_play_integrity.sql`, deploy `verify-play-integrity` with
   authenticated gateway access, and confirm backend policy/rate-limit behaviour.
   Review privacy disclosures for Google attestation before enabling collection.
5. Supply `EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER` and set
   `EXPO_PUBLIC_PLAY_INTEGRITY_ENABLED=true` in a signed Play internal-test build.
   A QA APK sideload is not proof that Play attestation works.
6. Test recognised install, wrong signing key, unlicensed copy, expired/replayed
   challenge, first launch offline, previously verified offline play, rejected
   then offline, and successful recovery. Test real sandbox purchases separately.
   Monitor Google quota and anonymous signup abuse before production enforcement.

Native modules changed: rebuild before device QA. No APK, emulator installation,
backend deployment, Play setting change, or production release is implied here.

## References

- https://docs.expo.dev/versions/v57.0.0/sdk/crypto/
- https://docs.expo.dev/versions/v57.0.0/sdk/securestore/
- https://docs.expo.dev/versions/v57.0.0/sdk/app-integrity/
- https://developer.android.com/google/play/integrity/standard
- https://developer.android.com/google/play/integrity/verdicts

Expo marks `@expo/app-integrity` alpha; keep its version pinned and retest native
behaviour on upgrades. Unit tests use actual Node AES-GCM behind a mock of Expo's
native API, not an Android hardware-keystore test.
