@file:Suppress("DEPRECATION")

package com.coverdrive.cricket

import android.content.SharedPreferences
import android.content.Intent
import android.preference.PreferenceManager
import androidx.startup.AppInitializer
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.ViewManager
import com.unity3d.ads.metadata.MetaData
import com.unity3d.services.core.configuration.AdsSdkInitializer
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.MobileAds

/** Sets privacy metadata only. Never initialize Unity separately from AdMob. */
class UnityConsentModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context),
  SharedPreferences.OnSharedPreferenceChangeListener {
  private val preferences = PreferenceManager.getDefaultSharedPreferences(context)
  private var audience = "none"
  private var canRequestAds = false
  private var listening = false

  override fun getName() = "CricketUnityConsent"

  @ReactMethod
  @Synchronized
  fun applyConsent(audience: String, canRequestAds: Boolean, promise: Promise) {
    try {
      require(audience in setOf("none", "teen", "adult"))
      this.audience = audience
      this.canRequestAds = canRequestAds
      if (!listening) {
        preferences.registerOnSharedPreferenceChangeListener(this)
        listening = true
      }
      updateMetadata()
      if (audience != "none" && canRequestAds) {
        if (BuildConfig.BUILD_TYPE == "qa") {
          // Preserve age/rating flags, mark only the emulator, never a release.
          MobileAds.setRequestConfiguration(MobileAds.getRequestConfiguration().toBuilder()
            .setTestDeviceIds(listOf(AdRequest.DEVICE_ID_EMULATOR)).build())
          // GMA 24.9 rejects setAppMuted before initialize(). The emulator is
          // muted at the OS; the QA Activity applies SDK mute after readiness.
        }
        // Restore the library's context/orientation/Cronet setup only AFTER
        // eligibility, UMP and privacy metadata. AdMob still owns ad SDK init.
        AppInitializer.getInstance(reactApplicationContext)
          .initializeComponent(AdsSdkInitializer::class.java)
      }
      promise.resolve(null)
    } catch (error: Exception) {
      if (BuildConfig.BUILD_TYPE == "qa") {
        android.util.Log.e("CricketAdsQA", "UNITY_PRIVACY_INIT_FAILED", error)
      }
      promise.reject("UNITY_PRIVACY_UNAVAILABLE", "Unable to apply advertising privacy choices", error)
    }
  }

  @ReactMethod
  fun assertQaTestDevice(promise: Promise) {
    if (BuildConfig.BUILD_TYPE != "qa" || audience == "none" ||
      !AdRequest.Builder().build().isTestDevice(reactApplicationContext)) {
      promise.reject("QA_TEST_DEVICE_REQUIRED", "Android QA build and configured Google test device required")
      return
    }
    promise.resolve(null)
  }

  @ReactMethod
  fun openQaDiagnostics(units: ReadableMap, promise: Promise) {
    if (BuildConfig.BUILD_TYPE != "qa" || audience == "none" || !canRequestAds) {
      promise.reject("QA_ADS_DISABLED", "QA build and eligible ad consent are required")
      return
    }
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("QA_ACTIVITY_MISSING", "No foreground Activity")
      return
    }
    val intent = Intent().setClassName(activity, "com.coverdrive.cricket.AdDiagnosticsActivity")
    for (kind in listOf("banner", "interstitial", "rewarded")) {
      val unit = if (units.hasKey(kind)) units.getString(kind) else null
      if (unit == null || !unit.matches(Regex("ca-app-pub-[0-9]+/[0-9]+"))) {
        promise.reject("QA_AD_UNIT_MISSING", "A configured app ad unit is required for each format")
        return
      }
      intent.putExtra(kind, unit)
    }
    activity.runOnUiThread {
      try {
        activity.startActivity(intent)
        promise.resolve(null)
      } catch (error: Exception) {
        promise.reject("QA_DIAGNOSTICS_UNAVAILABLE", "Unable to open QA diagnostics", error)
      }
    }
  }

  @Synchronized
  private fun updateMetadata() {
    val allowed = UnityConsentPolicy.allowsPersonalization(audience, canRequestAds, preferences.all)
    // Unity documents privacy.consent as overriding the older gdpr.consent.
    // Set a single authoritative consent value; commit each field separately.
    MetaData(reactApplicationContext).apply { set("privacy.consent", allowed); commit() }
    MetaData(reactApplicationContext).apply { set("user.nonbehavioral", !allowed); commit() }
  }

  @Synchronized
  override fun onSharedPreferenceChanged(preferences: SharedPreferences?, key: String?) {
    if (key == null || key.startsWith("IABTCF_") || key.startsWith("IABGPP_") || key.startsWith("IABUSPrivacy_")) {
      try {
        updateMetadata()
      } catch (_: Exception) {
        // A provider failure must not crash the UI-thread CMP callback. A
        // subsequent JS applyConsent rejects and prevents SDK initialization.
        canRequestAds = false
        try { updateMetadata() } catch (_: Exception) { /* remain restricted */ }
      }
    }
  }

  override fun invalidate() {
    preferences.unregisterOnSharedPreferenceChangeListener(this)
    super.invalidate()
  }
}

@Suppress("OVERRIDE_DEPRECATION")
class UnityConsentPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = listOf(UnityConsentModule(reactContext))
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
