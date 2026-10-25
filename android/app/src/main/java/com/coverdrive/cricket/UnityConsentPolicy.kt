package com.coverdrive.cricket

/** Pure, conservative policy for the pinned adapter, which does not forward AC.
 * canRequestAds permits a request; it is NOT permission to personalize Unity ads.
 * Unity's Google Additional Consent provider ID is 3234 (not our seller/Game ID).
 */
internal object UnityConsentPolicy {
  private const val UNITY_ATP_ID = "3234"

  fun allowsPersonalization(audience: String, canRequestAds: Boolean, signals: Map<String, *>): Boolean {
    if (audience != "adult" || !canRequestAds) return false
    // Do not decode or infer permission from unsupported GPP/US frameworks.
    // Outside a positively confirmed EU grant, Unity stays contextual-only.
    if (signals["IABTCF_gdprApplies"] != 1) return false
    if (signals["IABGPP_HDR_GppString"].let { it != null && it != "" }) return false
    if (signals["IABUSPrivacy_String"].let { it != null && it != "" }) return false
    val purposes = signals["IABTCF_PurposeConsents"] as? String ?: return false
    if (purposes.length != 24 || purposes.any { it != '0' && it != '1' }) return false
    if (listOf(0, 2, 3).any { purposes[it] != '1' }) return false
    val ac = signals["IABTCF_AddtlConsent"] as? String ?: return false
    val parts = ac.split('~')
    when (parts.firstOrNull()) {
      "1" -> if (parts.size != 2) return false
      "2" -> {
        if (parts.size !in 2..3) return false
        if (parts.size == 3 && (!parts[2].startsWith("dv.") || !validIds(parts[2].removePrefix("dv.")))) return false
      }
      else -> return false
    }
    if (!validIds(parts[1])) return false
    // A provider in the disclosed-only list has NOT received consent.
    return UNITY_ATP_ID in parts[1].split('.')
  }

  private fun validIds(value: String): Boolean = value.isEmpty() ||
    value.split('.').all { it.matches(Regex("[1-9][0-9]*")) }
}
