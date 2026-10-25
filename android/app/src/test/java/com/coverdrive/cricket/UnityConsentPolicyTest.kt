package com.coverdrive.cricket

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UnityConsentPolicyTest {
  private fun granted() = mutableMapOf<String, Any>(
    "IABTCF_gdprApplies" to 1,
    "IABTCF_PurposeConsents" to "111111111111111111111111",
    "IABTCF_AddtlConsent" to "2~12.3234.5000~dv.12.3234.5000",
  )
  private fun allowed(signals: Map<String, *> = granted(), audience: String = "adult", permitted: Boolean = true) =
    UnityConsentPolicy.allowsPersonalization(audience, permitted, signals)

  @Test fun explicitAdultAcV2Grant() { assertTrue(allowed()) }
  @Test fun explicitAdultAcV1Grant() {
    assertTrue(allowed(granted().apply { put("IABTCF_AddtlConsent", "1~3234") }))
  }
  @Test fun v2WithoutDisclosedListStillRequiresConsent() {
    assertTrue(allowed(granted().apply { put("IABTCF_AddtlConsent", "2~3234") }))
  }
  @Test fun requestPermissionIsNotPersonalizationPermission() {
    assertFalse(allowed(emptyMap<String, Any>()))
  }
  @Test fun noRequestPermissionEvenWithStoredGrant() { assertFalse(allowed(permitted = false)) }
  @Test fun teenEvenWithStoredAdultGrant() { assertFalse(allowed(audience = "teen")) }
  @Test fun unknownAudienceEvenWithStoredGrant() { assertFalse(allowed(audience = "none")) }
  @Test fun unrecognizedAudienceIsRestricted() { assertFalse(allowed(audience = "ADULT")) }
  @Test fun disclosedOnlyIsNotConsent() {
    assertFalse(allowed(granted().apply { put("IABTCF_AddtlConsent", "2~12~dv.3234") }))
  }
  @Test fun emptyConsentListIsRestricted() {
    assertFalse(allowed(granted().apply { put("IABTCF_AddtlConsent", "2~~dv.3234") }))
  }
  @Test fun exactProviderIdNotSubstringOrOurSellerId() {
    for (ids in listOf("13234", "32340", "143233260", "800404108", "03234")) {
      assertFalse(ids, allowed(granted().apply { put("IABTCF_AddtlConsent", "1~$ids") }))
    }
  }
  @Test fun missingOrWrongTypedSignalsAreRestricted() {
    for (key in granted().keys) {
      assertFalse(key, allowed(granted().apply { remove(key) }))
      assertFalse(key, allowed(granted().apply { put(key, true) }))
    }
    assertFalse(allowed(granted().apply { put("IABTCF_gdprApplies", "1") }))
  }
  @Test fun noRegionalPermissionInference() {
    assertFalse(allowed(granted().apply { put("IABTCF_gdprApplies", 0) }))
    assertFalse(allowed(granted().apply { put("IABTCF_gdprApplies", -1) }))
  }
  @Test fun unknownMalformedAndFutureAcAreRestricted() {
    for (ac in listOf("", "3234", "1", "1~3234~dv.3234", "3~3234", "2~3234~3234", "2~3234~dv.x", "2~3234~dv.12~extra", "1~3234.", "1~.3234", "1~3234.x", "1~ 3234", "1~3234\n")) {
      assertFalse(ac, allowed(granted().apply { put("IABTCF_AddtlConsent", ac) }))
    }
  }
  @Test fun missingStorageProfileOrPersonalizedPurposeIsRestricted() {
    for (index in listOf(0, 2, 3)) {
      val purposes = "111111111111111111111111".toCharArray().also { it[index] = '0' }
      assertFalse(allowed(granted().apply { put("IABTCF_PurposeConsents", String(purposes)) }))
    }
  }
  @Test fun malformedPurposeBitsAreRestricted() {
    for (purposes in listOf("", "1111", "11111111111111111111111x", "1111111111111111111111111")) {
      assertFalse(allowed(granted().apply { put("IABTCF_PurposeConsents", purposes) }))
    }
  }
  @Test fun unsupportedGppOrUsSignalsNeverGrantPersonalization() {
    for (key in listOf("IABGPP_HDR_GppString", "IABUSPrivacy_String")) {
      assertFalse(allowed(granted().apply { put(key, "unknown-or-opt-out") }))
      assertFalse(allowed(granted().apply { put(key, false) }))
    }
  }
  @Test fun withdrawalOverridesEarlierGrant() {
    val signals = granted()
    assertTrue(allowed(signals))
    signals["IABTCF_AddtlConsent"] = "2~~dv.3234"
    assertFalse(allowed(signals))
  }
}
