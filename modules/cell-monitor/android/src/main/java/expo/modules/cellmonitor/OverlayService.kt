package expo.modules.cellmonitor

import android.content.Context
import android.graphics.PixelFormat
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager

/**
 * OverlayService — draws OverlayView over any screen using TYPE_APPLICATION_OVERLAY.
 *
 * Requires SYSTEM_ALERT_WINDOW permission.
 * User grants via: Settings → Apps → Special app access → Display over other apps → Canary
 *
 * All operations must run on the main thread — enforced via Handler.
 * Silent fail if permission not granted; never crashes the app.
 */
class OverlayService(
    private val context: Context,
    private val onEvent: (String, Bundle) -> Unit
) {
    private var windowManager: WindowManager? = null
    private var overlayView: OverlayView? = null
    private var isShowing = false
    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        private const val OVERLAY_WIDTH_DP = 320
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    fun showClearOverlay() {
        mainHandler.post {
            if (!Settings.canDrawOverlays(context)) return@post
            runCatching {
                removeCurrentView()
                val view = createView()
                view.showClear()
                addViewToWindow(view, touchable = false)
            }
        }
    }

    fun showThreatOverlay(confidence: Float, detectors: String) {
        mainHandler.post {
            if (!Settings.canDrawOverlays(context)) return@post
            runCatching {
                removeCurrentView()
                val view = createView()
                view.showThreat(confidence, detectors)
                addViewToWindow(view, touchable = true)
            }
        }
    }

    fun dismiss() {
        mainHandler.post {
            runCatching { removeCurrentView() }
        }
    }

    fun isPermissionGranted(): Boolean = Settings.canDrawOverlays(context)

    // ── Internal ───────────────────────────────────────────────────────────────

    private fun createView(): OverlayView {
        return OverlayView(
            context       = context,
            onDefendAfter = {
                emitAction("DEFEND_AFTER_CALL")
                dismiss()
            },
            onDefendNow   = {
                emitAction("DEFEND_NOW")
                dismiss()
            },
            onDismiss     = { dismiss() }
        ).also { overlayView = it }
    }

    private fun addViewToWindow(view: OverlayView, touchable: Boolean) {
        val baseFlags = if (touchable) {
            // Allow touch on the overlay but don't steal focus from dialer
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
        } else {
            // CLEAR pill: completely non-interactive, touches pass through
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
        }

        val params = WindowManager.LayoutParams(
            dpToPx(OVERLAY_WIDTH_DP),
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            baseFlags,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = dpToPx(90) // clear status bar + notification shade
        }

        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        wm.addView(view, params)
        windowManager = wm
        isShowing = true
    }

    private fun removeCurrentView() {
        overlayView?.cleanup()
        try {
            if (isShowing && overlayView != null) {
                windowManager?.removeView(overlayView)
            }
        } catch (_: Exception) {
            // View may already be detached — safe to ignore
        } finally {
            overlayView = null
            windowManager = null
            isShowing = false
        }
    }

    private fun emitAction(action: String) {
        val bundle = Bundle().apply {
            putString("action", action)
            putLong("timestamp", System.currentTimeMillis())
        }
        onEvent("onOverlayAction", bundle)
    }

    private fun dpToPx(dp: Int): Int =
        (dp * context.resources.displayMetrics.density).toInt()
}
