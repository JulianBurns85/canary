package expo.modules.cellmonitor

import android.content.Context
import android.os.Build
import android.os.Bundle
import android.telephony.CellInfoLte
import android.telephony.TelephonyManager
import kotlinx.coroutines.*
import java.util.Timer
import java.util.TimerTask

private const val POLL_INTERVAL_MS = 30_000L

/**
 * CellInfoService — Tier 1 background cell monitoring.
 *
 * Two modes:
 *   start()    → 30-second polling timer (background)
 *   readOnce() → immediate single read (called on RINGING)
 */
class CellInfoService(
    private val context: Context,
    private val onEvent: (String, Bundle) -> Unit
) {
    private var timer: Timer? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // ── Polling mode ──────────────────────────────────────────────────────────

    fun start() {
        stop()
        timer = Timer("CellInfoPoller", true)
        timer?.schedule(object : TimerTask() {
            override fun run() {
                scope.launch { emitCells() }
            }
        }, 0L, POLL_INTERVAL_MS)
    }

    fun stop() {
        timer?.cancel()
        timer = null
        scope.cancel()
    }

    // ── One-shot mode ─────────────────────────────────────────────────────────

    fun readOnce() {
        // Uses a fresh scope so it works even if the polling scope was cancelled
        CoroutineScope(Dispatchers.IO).launch {
            try { emitCells() } catch (_: Exception) {}
        }
    }

    // ── Core read ─────────────────────────────────────────────────────────────

    private suspend fun emitCells() {
        val cells = readCellInfo()
        if (cells.isEmpty()) return

        val bundle = Bundle().apply {
            // Bundle list serialised as individual indexed entries for compatibility
            putInt("cell_count", cells.size)
            cells.forEachIndexed { i, cell ->
                putBundle("cell_$i", cell)
            }
        }
        onEvent("onCellInfoUpdate", bundle)
    }

    private fun readCellInfo(): List<Bundle> {
        val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
            ?: return emptyList()

        val raw = try {
            tm.allCellInfo ?: emptyList()
        } catch (_: SecurityException) {
            return emptyList()
        }

        val results = mutableListOf<Bundle>()

        for (cell in raw) {
            if (cell !is CellInfoLte) continue

            val identity = cell.cellIdentity
            val signal   = cell.cellSignalStrength
            val cid      = identity.ci

            if (cid == Int.MAX_VALUE || cid < 0) continue

            val mcc: String = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                identity.mccString ?: ""
            } else {
                @Suppress("DEPRECATION") identity.mcc.toString()
            }

            val mnc: String = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                identity.mncString ?: ""
            } else {
                @Suppress("DEPRECATION") identity.mnc.toString()
            }

            results.add(Bundle().apply {
                putString("type",       "LTE")
                putInt("cid",           cid)
                putInt("enb_id",        cid / 256)
                putInt("pci",           identity.pci)
                putInt("tac",           identity.tac)
                putString("mcc",        mcc)
                putString("mnc",        mnc)
                putInt("earfcn",        identity.earfcn)
                putInt("rsrp",          signal.rsrp)
                putInt("rsrq",          signal.rsrq)
                putBoolean("registered", cell.isRegistered)
                putLong("timestamp",    System.currentTimeMillis())
            })
        }

        return results
    }
}
