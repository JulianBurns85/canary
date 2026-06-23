package expo.modules.cellmonitor

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * OverlayView — programmatic view drawn over the system dialer.
 * No XML layout required.
 *
 * Two states:
 *   CLEAR  → green pill, auto-dismisses after 4 seconds, no interaction
 *   THREAT → red card with two action buttons, stays until acted on or call ends
 */
class OverlayView(
    context: Context,
    private val onDefendAfter: () -> Unit,
    private val onDefendNow: () -> Unit,
    private val onDismiss: () -> Unit
) : LinearLayout(context) {

    private val handler = Handler(Looper.getMainLooper())
    private var autoDismissRunnable: Runnable? = null
    private val mono = Typeface.MONOSPACE

    init {
        orientation = VERTICAL
        setPadding(dp(16), dp(14), dp(16), dp(14))
        elevation = dp(8).toFloat()
    }

    // ── CLEAR state ────────────────────────────────────────────────────────────

    fun showClear() {
        removeAllViews()
        cancelAutoDismiss()

        background = roundedBg(
            fill   = Color.parseColor("#0D1A0D"),
            stroke = Color.parseColor("#00D68F"),
            strokeW = 2
        )

        addView(TextView(context).apply {
            text = "✓  CANARY CLEAR"
            setTextColor(Color.parseColor("#00D68F"))
            textSize = 13f
            gravity = Gravity.CENTER
            typeface = mono
        })

        // Auto-dismiss after 4 seconds — no interaction needed
        autoDismissRunnable = Runnable { onDismiss() }
        handler.postDelayed(autoDismissRunnable!!, 4_000)
    }

    // ── THREAT state ───────────────────────────────────────────────────────────

    fun showThreat(confidence: Float, detectorSummary: String) {
        removeAllViews()
        cancelAutoDismiss()

        background = roundedBg(
            fill   = Color.parseColor("#150505"),
            stroke = Color.parseColor("#EF233C"),
            strokeW = 2
        )

        // Title
        addView(TextView(context).apply {
            text = "⚠  THREAT ACTIVE"
            setTextColor(Color.parseColor("#EF233C"))
            textSize = 15f
            gravity = Gravity.CENTER
            typeface = Typeface.create(mono, Typeface.BOLD)
        })

        // Confidence line
        addView(TextView(context).apply {
            text = "Rogue tower · ${(confidence * 100).toInt()}% confidence"
            setTextColor(Color.parseColor("#AA5555"))
            textSize = 11f
            gravity = Gravity.CENTER
            typeface = mono
            setPadding(0, dp(4), 0, dp(2))
        })

        // Detector summary (truncated)
        if (detectorSummary.isNotEmpty()) {
            addView(TextView(context).apply {
                text = detectorSummary
                setTextColor(Color.parseColor("#663333"))
                textSize = 10f
                gravity = Gravity.CENTER
                typeface = mono
                setPadding(0, 0, 0, dp(12))
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
            })
        } else {
            (getChildAt(childCount - 1) as? TextView)?.setPadding(0, dp(4), 0, dp(14))
        }

        // Primary: Answer — Defend After (recommended)
        addView(makeButton(
            label  = "Answer — Defend After",
            fill   = Color.parseColor("#001A0D"),
            stroke = Color.parseColor("#00D68F"),
            color  = Color.parseColor("#00D68F"),
            action = onDefendAfter
        ), LayoutParams(LayoutParams.MATCH_PARENT, dp(46)).apply {
            bottomMargin = dp(8)
        })

        // Secondary: Defend Now
        addView(makeButton(
            label  = "Defend Now",
            fill   = Color.parseColor("#150505"),
            stroke = Color.parseColor("#EF233C"),
            color  = Color.parseColor("#EF233C"),
            action = onDefendNow
        ), LayoutParams(LayoutParams.MATCH_PARENT, dp(42)))

        // Disclaimer
        addView(TextView(context).apply {
            text = "Defend Now may affect call quality"
            setTextColor(Color.parseColor("#663333"))
            textSize = 9f
            gravity = Gravity.CENTER
            typeface = mono
            setPadding(0, dp(6), 0, 0)
        })
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private fun makeButton(
        label: String,
        fill: Int,
        stroke: Int,
        color: Int,
        action: () -> Unit
    ): Button = Button(context).apply {
        text = label
        setTextColor(color)
        background = roundedBg(fill, stroke, 1)
        textSize = 12f
        typeface = mono
        isAllCaps = false
        setOnClickListener { action() }
    }

    private fun roundedBg(fill: Int, stroke: Int, strokeW: Int): GradientDrawable =
        GradientDrawable().apply {
            setColor(fill)
            cornerRadius = dp(10).toFloat()
            setStroke(dp(strokeW), stroke)
        }

    private fun dp(value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    fun cleanup() {
        cancelAutoDismiss()
    }

    private fun cancelAutoDismiss() {
        autoDismissRunnable?.let { handler.removeCallbacks(it) }
        autoDismissRunnable = null
    }
}
