package chat.vale.android

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Build
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import chat.vale.ValeApp
import chat.vale.core.Engine
import chat.vale.core.PlatformBridge
import chat.vale.core.NearbyLink
import chat.vale.core.TorHandle
import com.goterl.lazysodium.LazySodiumAndroid
import com.goterl.lazysodium.SodiumAndroid
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions

class MainActivity : ComponentActivity() {
    private var scanCallback: ((String?) -> Unit)? = null
    private val scanner = registerForActivityResult(ScanContract()) { result ->
        scanCallback?.invoke(result.contents)
        scanCallback = null
    }
    private var nearby: AndroidNearby? = null
    private val nearbyPermissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        val pending = nearby
        if (pending != null) {
            if (result.values.all { it }) pending.start() else pending.permissionDenied()
        }
    }
    private lateinit var engine: Engine

    private fun requiredNearbyPermissions(): Array<String> = when {
        Build.VERSION.SDK_INT >= 33 -> arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE,
            Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.NEARBY_WIFI_DEVICES)
        Build.VERSION.SDK_INT >= 31 -> arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE,
            Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION)
        else -> arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        val bridge = object : PlatformBridge {
            override val mobile = true
            override fun copyText(value: String) {
                (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
                    .setPrimaryClip(ClipData.newPlainText("Vale ID", value))
            }
            override fun scanQr(onResult: (String?) -> Unit) {
                scanCallback = onResult
                scanner.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                    .setPrompt("Наведите камеру на QR-код контакта").setBeepEnabled(false).setOrientationLocked(false))
            }
            override fun startNearby(onPacket: (String, Int) -> String?, onStatus: (Int, String) -> Unit): NearbyLink {
                val link = AndroidNearby(applicationContext, onPacket, onStatus)
                nearby?.close()
                nearby = link
                runOnUiThread {
                    val missing = requiredNearbyPermissions().filter { ContextCompat.checkSelfPermission(this@MainActivity, it) != PackageManager.PERMISSION_GRANTED }
                    if (missing.isEmpty()) link.start() else nearbyPermissions.launch(missing.toTypedArray())
                }
                return link
            }
            override fun startTor(localPort: Int, socksPort: Int, onStatus: (String, String) -> Unit): TorHandle? = try {
                AndroidTor(applicationContext, localPort, socksPort, onStatus)
            } catch (_: Throwable) { onStatus("", "Tor недоступен"); null }
            override fun openLocalPage(url: String): Boolean = try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                true
            } catch (_: Exception) { false }
            override fun clearCache() { cacheDir.deleteRecursively(); cacheDir.mkdirs() }
            override fun setDisguised(enabled: Boolean) {
                val pm = packageManager
                val normal = ComponentName(this@MainActivity, "chat.vale.android.ValeLauncher")
                val calculator = ComponentName(this@MainActivity, "chat.vale.android.CalculatorLauncher")
                pm.setComponentEnabledSetting(if (enabled) calculator else normal, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
                pm.setComponentEnabledSetting(if (enabled) normal else calculator, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
            }
        }
        engine = Engine(LazySodiumAndroid(SodiumAndroid()), bridge, { AndroidVault(applicationContext) })
        setContent { ValeApp(engine) }
    }

    override fun onDestroy() {
        if (::engine.isInitialized) engine.close()
        super.onDestroy()
    }
}
