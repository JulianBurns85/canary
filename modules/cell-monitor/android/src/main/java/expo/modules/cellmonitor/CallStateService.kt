package expo.modules.cellmonitor

import android.content.Context
import android.os.Bundle
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager

/**
 * CallStateService — monitors phone call state and emits events to JS.
 *
 * IDLE    (0) → normal operation, fire any queued defender
 * RINGING (1) → incoming call, trigger immediate scan, show overlay
 * OFFHOOK (2) → call in progress, suppress auto-defender
 *
 * Requires READ_PHONE_STATE permission (already in manifest).
 */
class CallStateService(
    private val context: Context,
    private val onEvent: (String, Bundle) -> Unit,
    private val onImmediateScan: () -> Unit
) {
    private var telephonyManager: TelephonyManager? = null
    private var phoneStateListener: PhoneStateListener? = null
    private var lastState: Int = TelephonyManager.CALL_STATE_IDLE

    fun start() {
        stop()
        telephonyManager =
            context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager

        @Suppress("DEPRECATION")
        phoneStateListener = object : PhoneStateListener() {
            @Deprecated("Deprecated in API 31, still required for API < 31")
            override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                handleStateChange(state)
            }
        }

        @Suppress("DEPRECATION")
        telephonyManager?.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE)
    }

    fun stop() {
        @Suppress("DEPRECATION")
        telephonyManager?.listen(phoneStateListener, PhoneStateListener.LISTEN_NONE)
        telephonyManager = null
        phoneStateListener = null
    }

    fun getCurrentCallState(): Int {
        return try {
            (context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager)
                ?.callState ?: TelephonyManager.CALL_STATE_IDLE
        } catch (_: SecurityException) {
            TelephonyManager.CALL_STATE_IDLE
        }
    }

    private fun handleStateChange(state: Int) {
        if (state == lastState) return
        lastState = state

        val label = when (state) {
            TelephonyManager.CALL_STATE_IDLE    -> "IDLE"
            TelephonyManager.CALL_STATE_RINGING -> "RINGING"
            TelephonyManager.CALL_STATE_OFFHOOK -> "OFFHOOK"
            else                                 -> "UNKNOWN"
        }

        // On RINGING: fire immediate cell scan so overlay has fresh data
        if (state == TelephonyManager.CALL_STATE_RINGING) {
            onImmediateScan()
        }

        val bundle = Bundle().apply {
            putInt("call_state", state)
            putString("call_state_label", label)
            putLong("timestamp", System.currentTimeMillis())
        }

        onEvent("onCallStateChange", bundle)
    }
}
