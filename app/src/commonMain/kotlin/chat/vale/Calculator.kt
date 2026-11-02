package chat.vale

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/** A functional decoy, not an authentication boundary. */
@Composable
internal fun CalculatorScreen(onRestore: () -> Unit) {
    var display by remember { mutableStateOf("0") }
    var accumulator by remember { mutableStateOf<Double?>(null) }
    var operation by remember { mutableStateOf<String?>(null) }
    var newEntry by remember { mutableStateOf(false) }
    var equalsTaps by remember { mutableIntStateOf(0) }
    LaunchedEffect(equalsTaps) { if (equalsTaps > 0) { delay(900); equalsTaps = 0 } }
    fun calculate(): Double {
        val right = display.toDoubleOrNull() ?: 0.0
        val left = accumulator ?: return right
        return when (operation) { "+" -> left + right; "−" -> left - right; "×" -> left * right; "÷" -> if (right == 0.0) Double.NaN else left / right; else -> right }
    }
    fun render(number: Double): String = when {
        !number.isFinite() -> "Ошибка"
        number == number.toLong().toDouble() -> number.toLong().toString()
        else -> number.toString().take(14)
    }
    Box(Modifier.fillMaxSize().background(Color(0xFFF2F3F4)).padding(24.dp), contentAlignment = Alignment.Center) {
        Column(Modifier.fillMaxWidth().widthIn(max = 360.dp)) {
            Text("Calculator", color = Color(0xFF49525A), fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(50.dp))
            Text(display, Modifier.fillMaxWidth().padding(vertical = 18.dp), textAlign = TextAlign.End, color = Color(0xFF222A30), fontSize = 48.sp, maxLines = 1)
            Spacer(Modifier.height(14.dp))
            listOf(listOf("C", "±", "%", "÷"), listOf("7", "8", "9", "×"), listOf("4", "5", "6", "−"), listOf("1", "2", "3", "+"), listOf("0", ".", "⌫", "=")).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { key ->
                        val accent = key in listOf("÷", "×", "−", "+", "=")
                        Box(Modifier.weight(1f).padding(bottom = 8.dp).height(62.dp).clip(RoundedCornerShape(15.dp))
                            .background(if (accent) Color(0xFF687C72) else Color.White).clickable {
                                when (key) {
                                    "C" -> { display = "0"; accumulator = null; operation = null; newEntry = false }
                                    "±" -> display = render(-(display.toDoubleOrNull() ?: 0.0))
                                    "%" -> display = render((display.toDoubleOrNull() ?: 0.0) / 100)
                                    "⌫" -> display = display.dropLast(1).ifEmpty { "0" }
                                    in listOf("+", "−", "×", "÷") -> { accumulator = calculate(); operation = key; newEntry = true }
                                    "=" -> {
                                        equalsTaps++
                                        if (equalsTaps >= 3) { equalsTaps = 0; onRestore() }
                                        else { display = render(calculate()); accumulator = null; operation = null; newEntry = true }
                                    }
                                    else -> {
                                        if (newEntry || display == "Ошибка") { display = "0"; newEntry = false }
                                        if (key == ".") { if (!display.contains('.')) display += "." }
                                        else if (display.length < 14) display = if (display == "0") key else display + key
                                    }
                                }
                            }, contentAlignment = Alignment.Center) {
                            Text(key, color = if (accent) Color.White else Color(0xFF354139), fontSize = 22.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }
        }
    }
}
