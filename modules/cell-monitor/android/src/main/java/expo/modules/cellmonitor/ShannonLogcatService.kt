package expo.modules.cellmonitor

import android.os.Bundle
import kotlinx.coroutines.*
import java.io.BufferedReader
import java.io.InputStreamReader

class ShannonLogcatService(
    private val onEvent: (String, Bundle) -> Unit
) {
    private var process: Process? = null
    private var job: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        private val ROGUE_CIDS = setOf(
            "137713155", "137713165", "137713175", "137713195"
        )
        private val ROGUE_ENBS = setOf("537942", "32849")
        private val SHANNON_FILTERS = arrayOf(
            "com.shannon.imsservice:V",
            "ShannonImsService:V",
            "shannonIMS:V",
            "*:S"
        )
        private val IMS_PATTERNS = listOf(
            "RILC_UNSOL_IMS_SUPPORT_SERVICE",
            "IMS_SUPPORT_SERVICE",
            "identity_request",
            "IDENTITY_REQUEST",
            "IdentityRequest",
            "RRC_RRCCONNECTIONREQUEST",
            "NAS_ATTACH_REQUEST"
        )
    }

    fun start() {
        stop()
        job = scope.launch {
            try {
                val command = arrayOf("logcat", "-v", "threadtime", *SHANNON_FILTERS)
                process = Runtime.getRuntime().exec(command)
                val reader = BufferedReader(InputStreamReader(process!!.inputStream))
                while (isActive) {
                    val line = reader.readLine() ?: break
                    parseLine(line)
                }
            } catch (_: SecurityException) {
            } catch (_: Exception) {
            }
        }
    }

    fun stop() {
        job?.cancel()
        try { process?.destroy() } catch (_: Exception) { }
        process = null
    }

    private fun parseLine(line: String) {
        val ts = System.currentTimeMillis()
        val matchedCid = ROGUE_CIDS.firstOrNull { line.contains(it) }
        if (matchedCid != null) {
            onEvent("onShannonEvent", Bundle().apply {
                putString("raw_line", line)
                putInt("cid", matchedCid.toInt())
                putString("event_type", "ROGUE_CID_DETECTED")
                putBoolean("threat", true)
                putLong("timestamp", ts)
                putInt("tier", 2)
            })
            return
        }
        val matchedEnb = ROGUE_ENBS.firstOrNull { line.contains(it) }
        if (matchedEnb != null) {
            onEvent("onShannonEvent", Bundle().apply {
                putString("raw_line", line)
                putString("event_type", "ROGUE_ENB_DETECTED")
                putBoolean("threat", true)
                putLong("timestamp", ts)
                putInt("tier", 2)
            })
            return
        }
        val matchedPattern = IMS_PATTERNS.firstOrNull { line.contains(it) }
        if (matchedPattern != null) {
            onEvent("onShannonEvent", Bundle().apply {
                putString("raw_line", line)
                putString("event_type", matchedPattern)
                putBoolean("threat", false)
                putLong("timestamp", ts)
                putInt("tier", 2)
            })
        }
    }
}
