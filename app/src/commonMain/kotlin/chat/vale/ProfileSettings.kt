package chat.vale

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material.icons.outlined.Wifi
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun ProfileScreen(controller: ValeController, state: ValeState) {
    val qr = remember(state.publicId, state.localAddress) { controller.qrGrid(controller.contactCard()) }
    var copied by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().background(CanvasColor).verticalScroll(rememberScrollState()).padding(28.dp), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.fillMaxWidth().widthIn(max = 760.dp)) {
            ScreenHeader("Профиль", "Ваш публичный ID", controller)
            Spacer(Modifier.height(30.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                Column(Modifier.widthIn(max = 470.dp).fillMaxWidth().background(Paper, RoundedCornerShape(20.dp)).padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Avatar(state.profileName.orEmpty(), state.publicId, 68.dp)
                    Spacer(Modifier.height(13.dp))
                    Text(state.profileName.orEmpty(), color = Ink, fontSize = 21.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(5.dp))
                    Text("Ваш профиль хранится на устройстве", color = Muted, fontSize = 12.sp)
                    Spacer(Modifier.height(26.dp))
                    Box(Modifier.background(Color.White, RoundedCornerShape(16.dp)).border(1.dp, Line, RoundedCornerShape(16.dp)).padding(12.dp)) {
                        QrImage(qr, Modifier.size(190.dp))
                    }
                    Spacer(Modifier.height(18.dp))
                    Text("Покажите этот код контакту", color = Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(6.dp))
                    Text("QR содержит публичный ID и локальный IP. Не публикуйте его, если не хотите делиться адресом.", color = Muted, fontSize = 11.sp, lineHeight = 17.sp, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(22.dp))
                    Column(Modifier.fillMaxWidth().background(CanvasColor, RoundedCornerShape(12.dp)).padding(14.dp)) {
                        SectionEyebrow("ПУБЛИЧНЫЙ ID")
                        Spacer(Modifier.height(8.dp))
                        Text(state.publicId, color = Forest, fontSize = 12.sp, lineHeight = 18.sp)
                    }
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(onClick = { controller.copyText(state.publicId); copied = true }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                        Icon(Icons.Outlined.ContentCopy, null, Modifier.size(17.dp)); Spacer(Modifier.width(8.dp)); Text(if (copied) "ID скопирован" else "Скопировать ID")
                    }
                    Spacer(Modifier.height(13.dp))
                    Text("Локальный IP: ${state.localAddress.ifBlank { "не найден" }}  ·  порт 45454", color = Muted, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
internal fun SettingsScreen(controller: ValeController, state: ValeState) {
    Box(Modifier.fillMaxSize().background(CanvasColor).verticalScroll(rememberScrollState()).padding(28.dp), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.fillMaxWidth().widthIn(max = 760.dp)) {
            ScreenHeader("Настройки", "Ваше пространство, ваши правила", controller)
            Spacer(Modifier.height(30.dp))
            SectionEyebrow("СООБЩЕНИЯ")
            Spacer(Modifier.height(12.dp))
            SettingsCard {
                Text("Исчезающие сообщения", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                Spacer(Modifier.height(5.dp))
                Text("Таймер применяется к новым сообщениям с момента отправки. Удаление не защищает от копирования или снимков экрана.", color = Muted, fontSize = 12.sp, lineHeight = 18.sp)
                Spacer(Modifier.height(14.dp))
                var expanded by remember { mutableStateOf(false) }
                Box {
                    OutlinedButton(onClick = { expanded = true }, shape = RoundedCornerShape(10.dp)) { Text(expiryLabel(state.expirySeconds)) }
                    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        listOf(0L, 60L, 3600L, 86400L, 604800L).forEach { seconds ->
                            DropdownMenuItem(text = { Text(expiryLabel(seconds)) }, onClick = { controller.setExpiry(seconds); expanded = false })
                        }
                    }
                }
            }
            Spacer(Modifier.height(22.dp))
            SectionEyebrow("СЕТЬ")
            Spacer(Modifier.height(12.dp))
            SettingsCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Передавать сообщения через меня", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                        Spacer(Modifier.height(5.dp))
                        Text("Только для контактов, добавленных на этом устройстве. Ретранслятор видит ID и сетевые метаданные, но не текст.", color = Muted, fontSize = 12.sp, lineHeight = 18.sp)
                    }
                    Spacer(Modifier.width(12.dp))
                    Switch(checked = state.relayEnabled, onCheckedChange = controller::setRelay)
                }
                Spacer(Modifier.height(15.dp))
                HorizontalDivider(color = Line)
                Spacer(Modifier.height(15.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Wifi, null, tint = Sage, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Локальная сеть", color = Ink, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        Text("${state.localAddress.ifBlank { "IP не найден" }} · TCP 45454", color = Muted, fontSize = 11.sp)
                    }
                    StatusPill(if (state.networkAvailable) "ВКЛЮЧЕНА" else "НЕДОСТУПНА", state.networkAvailable)
                }
            }
            Spacer(Modifier.height(22.dp))
            SectionEyebrow("ПРИВАТНОСТЬ")
            Spacer(Modifier.height(12.dp))
            SettingsCard {
                Row(verticalAlignment = Alignment.Top) {
                    Icon(Icons.Outlined.VisibilityOff, null, tint = Sage, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Быстро скрыть чаты", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                        Spacer(Modifier.height(5.dp))
                        Text(if (controller.isMobile) "Трижды нажмите на логотип. Значок Android сменится на калькулятор. Для возврата трижды нажмите «=»." else "Нажмите Ctrl + Shift + X или трижды нажмите на логотип. Для возврата трижды нажмите «=».", color = Muted, fontSize = 12.sp, lineHeight = 18.sp)
                        Spacer(Modifier.height(10.dp))
                        TextButton(onClick = controller::panic, contentPadding = PaddingValues(0.dp)) { Text("Скрыть сейчас") }
                    }
                }
            }
            Spacer(Modifier.height(22.dp))
            SectionEyebrow("ВАЖНО ЗНАТЬ")
            Spacer(Modifier.height(12.dp))
            SettingsCard {
                Row(verticalAlignment = Alignment.Top) {
                    Icon(Icons.Outlined.Info, null, tint = Sage, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(10.dp))
                    Text("Vale — экспериментальный прототип без аудита. Нет Tor/VPN, Bluetooth/Nearby, звонков, медиа и стикеров. IP и публичные ID видны участникам сети; прямое соединение не анонимно. Нет гарантии безопасного удаления или защиты от доступа к разблокированному устройству.", color = Muted, fontSize = 12.sp, lineHeight = 19.sp)
                }
            }
            Spacer(Modifier.height(32.dp))
            Text("VALE  ·  0.1.0 EXPERIMENTAL", color = Sage, fontSize = 10.sp, letterSpacing = 1.1.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(15.dp))
        }
    }
}

@Composable
private fun SettingsCard(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().background(Paper, RoundedCornerShape(17.dp)).padding(20.dp), content = content)
}
