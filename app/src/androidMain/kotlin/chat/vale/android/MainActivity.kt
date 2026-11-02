package chat.vale.android

import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import chat.vale.ValeApp
import chat.vale.core.Engine
import chat.vale.core.PlatformBridge
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
    private lateinit var engine: Engine

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
