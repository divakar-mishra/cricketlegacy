package com.coverdrive.cricket

import android.app.Activity
import android.os.Bundle
import android.preference.PreferenceManager
import android.util.Log
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.ResponseInfo
import com.google.android.gms.ads.RequestConfiguration
import com.google.ads.mediation.admob.AdMobAdapter
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.ump.UserMessagingPlatform

/** Compiled only in qa. Does not import any game/store or grant a real reward. */
class AdDiagnosticsActivity : Activity() {
  private lateinit var content: LinearLayout
  private lateinit var status: TextView
  private lateinit var testModeConfirmed: CheckBox
  private var banner: AdView? = null
  private var loading = false
  private var earnedCallbacks = 0

  private fun report(message: String) {
    status.append("\n$message")
    Log.i("CricketAdsQA", message)
  }
  private fun request(): AdRequest {
    val builder = AdRequest.Builder()
    if (MobileAds.getRequestConfiguration().tagForUnderAgeOfConsent ==
      RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE) {
      builder.addNetworkExtrasBundle(AdMobAdapter::class.java, Bundle().apply { putString("npa", "1") })
    }
    return builder.build()
  }
  private fun canLoad(): Boolean {
    if (loading) return false
    if (!request().isTestDevice(this) || !testModeConfirmed.isChecked ||
      !UserMessagingPlatform.getConsentInformation(this).canRequestAds()) {
      report("BLOCKED: Google test device, Unity dashboard test mode and UMP permission required")
      return false
    }
    loading = true
    return true
  }
  private fun unit(kind: String) = intent.getStringExtra(kind) ?: error("Missing QA ad unit")
  private fun loaded(kind: String, response: ResponseInfo?) {
    report("$kind LOADED adapter=${response?.mediationAdapterClassName ?: "unknown"}")
    response?.adapterResponses?.forEach { adapter ->
      report("$kind response adapter=${adapter.adapterClassName} latencyMs=${adapter.latencyMillis} errorCode=${adapter.adError?.code}")
    }
  }
  private fun failed(kind: String, error: LoadAdError) {
    loading = false
    report("$kind LOAD_FAILED domain=${error.domain} code=${error.code} message=${error.message}")
    error.responseInfo?.adapterResponses?.forEach { adapter ->
      report("$kind failed adapter=${adapter.adapterClassName} error=${adapter.adError?.message}")
    }
  }
  private fun fullscreen(kind: String) = object : FullScreenContentCallback() {
    override fun onAdShowedFullScreenContent() { report("$kind SHOWN") }
    override fun onAdDismissedFullScreenContent() { loading = false; report("$kind CLOSED") }
    override fun onAdFailedToShowFullScreenContent(error: AdError) {
      loading = false; report("$kind SHOW_FAILED domain=${error.domain} code=${error.code}")
    }
  }
  private fun button(label: String, action: () -> Unit) {
    content.addView(Button(this).apply { text = label; setOnClickListener { action() } })
  }
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (BuildConfig.BUILD_TYPE != "qa" || !request().isTestDevice(this) ||
      !UserMessagingPlatform.getConsentInformation(this).canRequestAds()) { finish(); return }
    MobileAds.setAppMuted(true)
    content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(24, 48, 24, 24) }
    setContentView(ScrollView(this).apply { addView(content) })
    content.addView(TextView(this).apply { text = "Unity / AdMob QA — no game rewards\nNever click an ad. Use Ad Inspector single-source testing."; textSize = 19f })
    testModeConfirmed = CheckBox(this).apply { text = "Unity dashboard test mode ON verified" }
    content.addView(testModeConfirmed)
    button("Open Ad Inspector") {
      MobileAds.openAdInspector(this) { error ->
        report(if (error == null) "INSPECTOR CLOSED" else "INSPECTOR ERROR code=${error.code} message=${error.message}")
      }
    }
    button("Load banner test") {
      if (canLoad()) {
        banner?.destroy()
        banner?.let { content.removeView(it) }
        val view = AdView(this).apply { setAdSize(AdSize.BANNER); adUnitId = unit("banner") }
        banner = view
        view.adListener = object : AdListener() {
          override fun onAdLoaded() { loading = false; loaded("BANNER", view.responseInfo) }
          override fun onAdFailedToLoad(error: LoadAdError) { failed("BANNER", error) }
        }
        content.addView(view, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        report("BANNER REQUEST testDevice=true")
        view.loadAd(request())
      }
    }
    button("Load and show interstitial test") {
      if (canLoad()) {
        report("INTERSTITIAL REQUEST testDevice=true")
        InterstitialAd.load(this, unit("interstitial"), request(), object : InterstitialAdLoadCallback() {
          override fun onAdLoaded(ad: InterstitialAd) {
            loaded("INTERSTITIAL", ad.responseInfo)
            ad.fullScreenContentCallback = fullscreen("INTERSTITIAL")
            ad.show(this@AdDiagnosticsActivity)
          }
          override fun onAdFailedToLoad(error: LoadAdError) { failed("INTERSTITIAL", error) }
        })
      }
    }
    button("Load and show rewarded test (no currency)") {
      if (canLoad()) {
        report("REWARDED REQUEST testDevice=true")
        RewardedAd.load(this, unit("rewarded"), request(), object : RewardedAdLoadCallback() {
          override fun onAdLoaded(ad: RewardedAd) {
            loaded("REWARDED", ad.responseInfo)
            ad.fullScreenContentCallback = fullscreen("REWARDED")
            ad.show(this@AdDiagnosticsActivity) {
              earnedCallbacks += 1
              report("REWARDED EARNED callbackCount=$earnedCallbacks; gameGrant=NONE")
            }
          }
          override fun onAdFailedToLoad(error: LoadAdError) { failed("REWARDED", error) }
        })
      }
    }
    button("Back to game (no save changes)") { finish() }
    status = TextView(this).apply { textSize = 13f; setTextIsSelectable(true) }
    content.addView(status)
    report("QA READY build=${BuildConfig.VERSION_NAME} googleTestDevice=${request().isTestDevice(this)}")
    val config = MobileAds.getRequestConfiguration()
    val teen = config.tagForUnderAgeOfConsent == RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE
    val signals = PreferenceManager.getDefaultSharedPreferences(this).all
    report("PRIVACY tfua=${config.tagForUnderAgeOfConsent} tfcd=${config.tagForChildDirectedTreatment} rating=${config.maxAdContentRating} npa=$teen")
    report("PRIVACY gppPresent=${signals.keys.any { it.startsWith("IABGPP_") }} unityPersonalizationAllowed=${UnityConsentPolicy.allowsPersonalization(if (teen) "teen" else "adult", true, signals)}")
    MobileAds.getInitializationStatus()?.adapterStatusMap?.forEach { (name, adapter) ->
      report("ADAPTER $name state=${adapter.initializationState} latencyMs=${adapter.latency}")
    }
  }
  override fun onPause() {
    // Do not retain a hidden native banner/WebView while another Activity runs.
    banner?.let { it.destroy(); content.removeView(it) }
    banner = null
    loading = false
    super.onPause()
  }
  override fun onDestroy() { banner?.destroy(); banner = null; super.onDestroy() }
}
