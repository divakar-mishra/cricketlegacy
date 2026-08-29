# Cricket Legacy — Hindi Store Listing & Soft-Launch Plan

---

## 1. Hindi Store Listing (hi-IN)

Devanagari with the English loanwords Indian players actually expect (करियर, मैनेजर, मैच). Paste into the Play Store / App Store **Hindi (hi-IN)** localization.

### Store fields

| Field | Limit | Value |
| --- | --- | --- |
| Title (Play) | ≤30 | `क्रिकेट लिगेसी: करियर सिम` |
| App name (iOS) | ≤30 | `क्रिकेट लिगेसी` |
| Subtitle (iOS) | ≤30 | `बैटिंग करियर और मैनेजर सिम` |

**Short description (Play, ≤80):**

```
क्रिकेट करियर बनाएं या क्लब चलाएं — बॉल-दर-बॉल गहरा क्रिकेट सिम्युलेशन।
```

**Keywords (iOS, ≤100):**

```
मैनेजर,सिम्युलेशन,बैटिंग,बॉलिंग,टी20,वनडे,टेस्ट,लीग,करियर,कोच,कप्तान,नीलामी
```

### Full description

```
क्रिकेट लिगेसी — एक ही गेम में दो क्रिकेट करियर

ज़्यादातर क्रिकेट गेम में आप बस मैच खेलते हैं। क्रिकेट लिगेसी में आप पूरी क्रिकेट ज़िंदगी जीते हैं — एक खिलाड़ी के रूप में भी और एक मैनेजर के रूप में भी।

खिलाड़ी करियर — स्कूल से लेकर लिविंग लेजेंड तक
अपना क्रिकेटर बनाएं और आगे बढ़ें: स्कूल क्रिकेट, U19 वर्ल्ड कप, डोमेस्टिक सीज़न, इंटरनेशनल कॉल-अप और आख़िर में लेजेंड का दर्जा। हर गेंद बॉल-दर-बॉल खेलें, बैटिंग-बॉलिंग की ट्रेनिंग करें, फ़ॉर्म-फ़िटनेस और चोटों को संभालें, स्पॉन्सरशिप और कॉन्ट्रैक्ट साइन करें, कहानी के मोड़ और प्रतिद्वंद्विता जिएं, अवॉर्ड जीतें और हॉल ऑफ़ फ़ेम में जगह बनाएं। रिटायर होकर New Game+ में अपने शागिर्द से नई शुरुआत करें।

मैनेजर करियर — अपना साम्राज्य बनाएं
एक क्लब की कमान संभालें और क्लब से स्टेट और नेशनल लेवल तक पहुँचें। ट्रांसफ़र मार्केट और लाइव नीलामी में खिलाड़ी ख़रीदें-बेचें, फ़ाइनेंशियल फ़ेयर प्ले के तहत वेतन तय करें, स्टाफ़ रखें, सुविधाएँ अपग्रेड करें, नई प्रतिभाओं को स्काउट करें, रणनीति बनाएं, प्रेस कॉन्फ़्रेंस और बोर्ड मीटिंग संभालें, और लीग, कप व कॉन्टिनेंटल ख़िताब जीतें।

असली मैच इंजन
- पाँच फ़ॉर्मेट में बॉल-दर-बॉल सिम्युलेशन: T10, T20, द हंड्रेड, वनडे और टेस्ट
- पिच व मौसम की परिस्थितियाँ, पावरप्ले, बारिश के नियम (DLS) और प्लेयर ऑफ़ द मैच
- असल जैसे, बारीकी से संतुलित नतीजे — हर पारी मेहनत से मिलती है

हमेशा कुछ नया करने को
- 60 अचीवमेंट्स
- 20-टियर सीज़न पास, डेली चैलेंज, डेली व वीकली क्वेस्ट और लॉगिन स्ट्रीक
- अपनी कमाई को स्टॉक मार्केट और अपनी क्रिकेट एकेडमी में लगाएं
- रिकॉर्ड बुक, अवॉर्ड नाइट्स और हॉल ऑफ़ फ़ेम समारोह
- अपने खिलाड़ी को कस्टमाइज़ करें
- मुख्य खिलाड़ी और मैनेजर करियर बिना इंटरनेट खेलें; ऑनलाइन सुविधाएँ उपलब्ध होने पर वैकल्पिक रहेंगी

आपकी क्रिकेट कहानी यहीं से शुरू होती है।

क्रिकेट लिगेसी एक सिंगल-प्लेयर क्रिकेट सिम्युलेशन है। वैकल्पिक इन-ऐप ख़रीदारी उपलब्ध है।
```

> Note: the in-app UI strings can also be localized to Hindi via the `src/i18n` layer later if you want the whole game in Hindi, not just the store listing.

---

## 2. Soft-Launch Plan — first ~1,000 players + reading retention

**Goal:** cheaply get ~1,000 real installs, then let the analytics (already wired) tell you "scale" or "fix" — *before* spending real marketing money.

### Step 0 — Google Play new-account rule (start the clock now)
New personal Play developer accounts must run **closed testing with ~12–20 testers for 14 continuous days** before you can even apply for production. This is often the biggest hidden delay, so kick it off first.

### Step 1 — Ship a testable build
EAS build → Play **internal testing** + Apple **TestFlight**. Wire Firebase (the analytics is ready) so data flows from day one.

### Step 2 — Get the first ~1,000, cheapest first
- **Free / community:** cricket subreddits (r/Cricket), cricket Discords/Telegram groups, a Product Hunt / r/iosgaming / TouchArcade post. Give away TestFlight / Play testing links.
- **Micro-influencers:** DM 10–20 small cricket-gaming YouTubers / Instagram creators with free access. One who likes it beats months of features.
- **Cheap paid test:** ₹10–20k on a Google App Campaign or Meta ad targeting India + cricket interest. India CPIs are low (~₹5–15), so that's ~1,000–3,000 installs — enough for a real retention read.

### Step 3 — Read the curve (the wired events map exactly to this)
- **Retention:** `D1` and `D7` (Firebase auto-computes these).
- **Early funnel:** `onboarding_complete` rate → `career_start` rate → `match_start` → `match_end`. Wherever the biggest drop is, that's your #1 fix.
- **Monetization funnel:** `offer_shown` → `offer_accepted`, `purchase_initiated` → `purchase`, `starter_pack_shown`.

### Step 4 — Go / No-Go thresholds (for a career sim)
- **Green (scale UA):** D1 ≥ 35%, D7 ≥ 12%.
- **Yellow (fix, then retest):** D1 25–35% / D7 6–12% — find the funnel drop and iterate.
- **Red (stop, rethink the core loop):** D1 < 25% / D7 < 6% — more features won't help; the match loop or onboarding isn't landing.

### Step 5 — Loop
Fix the biggest drop-off, re-test with a fresh small cohort, and only pour money into UA once D7 clears ~12%. That's the moment the bet actually tilts in your favor.

---

_Status snapshot: payments/ads wired, misleading products fixed, rebranded to Cricket Legacy, icons in place, analytics + funnel instrumented, and a late-game coin sink (Legacy Fund) added — typecheck + 252 tests green._
