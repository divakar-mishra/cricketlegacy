package cricketlegacy.commerce

import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.QueryPurchasesParams
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean

/** Read-only inventory probe. RevenueCat remains the only checkout/receipt owner.
 * Never launches checkout, acknowledges, consumes or grants any purchase.
 * Pending AND purchased-but-not-yet-consumed orders prevent an unpaid resolution.
 */
class PlayCheckoutStatusModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PlayCheckoutStatusModule")

    AsyncFunction("hasUnfinishedPurchase") { productId: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null || productId.isBlank()) {
        promise.reject("PLAY_UNAVAILABLE", "Google Play inventory unavailable", null)
        return@AsyncFunction
      }
      val handler = Handler(Looper.getMainLooper())
      handler.post {
        val finished = AtomicBoolean(false)
        val client = BillingClient.newBuilder(context)
          // This short-lived secondary connection is a probe only. Ignore its
          // update callbacks so RevenueCat alone processes/finishes transactions.
          .setListener { _, _ -> }
          .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
          .build()
        lateinit var timeout: Runnable
        fun finish(value: Boolean?, error: String? = null) {
          if (!finished.compareAndSet(false, true)) return
          handler.removeCallbacks(timeout)
          client.endConnection()
          if (value != null) promise.resolve(value)
          else promise.reject("PLAY_UNAVAILABLE", error ?: "Google Play inventory unavailable", null)
        }
        // A request timeout is an unavailable result, NEVER an expired payment.
        timeout = Runnable { finish(null) }
        handler.postDelayed(timeout, 15_000)
        try {
          client.startConnection(object : BillingClientStateListener {
            override fun onBillingServiceDisconnected() { finish(null) }
            override fun onBillingSetupFinished(result: BillingResult) {
              if (finished.get()) return
              if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                finish(null)
                return
              }
              try {
                client.queryPurchasesAsync(
                  QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()
                ) { queryResult, purchases ->
                  if (queryResult.responseCode != BillingClient.BillingResponseCode.OK) finish(null)
                  else finish(purchases.any { purchase ->
                    purchase.products.any { it.substringBefore(':') == productId }
                  })
                }
              } catch (_: Exception) { finish(null) }
            }
          })
        } catch (_: Exception) { finish(null) }
      }
    }
  }
}
