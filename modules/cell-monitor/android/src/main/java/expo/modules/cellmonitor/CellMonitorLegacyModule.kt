package expo.modules.cellmonitor

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class CellMonitorLegacyModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CellMonitor"

    private var cellInfoService: CellInfoService? = null
    private var shannonLogcatService: ShannonLogcatService? = null
    private var callStateService: CallStateService? = null
    private var overlayService: OverlayService? = null

    private fun sendEvent(name: String, data: Bundle) {
        val params = Arguments.fromBundle(data)
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, params)
    }

    @ReactMethod
    fun startMonitoring(promise: Promise) {
        try {
            cellInfoService?.stop()
            cellInfoService = CellInfoService(reactApplicationContext) { name, data -> sendEvent(name, data) }
            cellInfoService?.start()
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERR", e) }
    }

    @ReactMethod
    fun stopMonitoring(promise: Promise) {
        cellInfoService?.stop(); cellInfoService = null; promise.resolve(null)
    }

    @ReactMethod
    fun triggerImmediateScan(promise: Promise) {
        try {
            CellInfoService(reactApplicationContext) { name, data -> sendEvent(name, data) }.readOnce()
            promise.resolve(null)
        } catch (e: Exception) { promise.reject("ERR", e) }
    }

    @ReactMethod
    fun startShannonStream(promise: Promise) {
        shannonLogcatService?.stop()
        shannonLogcatService = ShannonLogcatService { name, data -> sendEvent(name, data) }
        shannonLogcatService?.start()
        promise.resolve(null)
    }

    @ReactMethod
    fun stopShannonStream(promise: Promise) {
        shannonLogcatService?.stop(); shannonLogcatService = null; promise.resolve(null)
    }

    @ReactMethod
    fun startCallMonitoring(promise: Promise) {
        try {
            val context = reactApplicationContext
            callStateService?.stop()
            callStateService = CallStateService(
                context = context,
                onEvent = { name, data -> sendEvent(name, data) },
                onImmediateScan = {
                    CellInfoService(context) { name, data -> sendEvent(name, data) }.readOnce()
                }
            )
            callStateService?.start()
            promise.resolve(null)
        } catch (e: Exception) { promise.reject("ERR", e) }
    }

    @ReactMethod
    fun stopCallMonitoring(promise: Promise) {
        callStateService?.stop(); callStateService = null; promise.resolve(null)
    }

    @ReactMethod
    fun getCurrentCallState(promise: Promise) {
        promise.resolve(callStateService?.getCurrentCallState() ?: 0)
    }

    @ReactMethod
    fun showClearOverlay(promise: Promise) {
        try { getOrCreateOverlay().showClearOverlay(); promise.resolve(null) }
        catch (e: Exception) { promise.reject("ERR", e) }
    }

    @ReactMethod
    fun showThreatOverlay(confidence: Double, detectors: String, promise: Promise) {
        try { getOrCreateOverlay().showThreatOverlay(confidence.toFloat(), detectors); promise.resolve(null) }
        catch (e: Exception) { promise.reject("ERR", e) }
    }

    @ReactMethod
    fun dismissOverlay(promise: Promise) {
        overlayService?.dismiss(); promise.resolve(null)
    }

    @ReactMethod
    fun isOverlayPermissionGranted(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
    }

    @ReactMethod
    fun isReadLogsGranted(promise: Promise) {
        try {
            val process = Runtime.getRuntime().exec(arrayOf("logcat", "-d", "-t", "1", "-v", "brief"))
            val exitCode = process.waitFor()
            process.destroy()
            promise.resolve(exitCode == 0)
        } catch (e: Exception) { promise.resolve(false) }
    }

    @ReactMethod
    fun requestTier1Permissions(promise: Promise) {
        val ctx = reactApplicationContext
        val loc = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val ph  = ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
        promise.resolve(loc && ph)
    }

    private fun getOrCreateOverlay(): OverlayService {
        return overlayService ?: OverlayService(reactApplicationContext) { name, data ->
            sendEvent(name, data)
        }.also { overlayService = it }
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
