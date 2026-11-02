package chat.vale

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.PhoneDisabled
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun OnboardingScreen(controller: ValeController) {
    var name by remember { mutableStateOf("") }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth >= 800.dp
        if (wide) {
            Row(Modifier.fillMaxSize().padding(22.dp)) {
                WelcomeArt(Modifier.weight(1f).fillMaxHeight())
                Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.Center) {
                    WelcomeForm(name, { name = it }, controller::createProfile, Modifier.widthIn(max = 430.dp).padding(30.dp))
                }
            }
        } else {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp)) {
                Spacer(Modifier.height(30.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BrandTile(42.dp)
                    Spacer(Modifier.width(11.dp))
                    Text("vale", fontSize = 24.sp, fontWeight = FontWeight.SemiBold, color = Ink, letterSpacing = (-1).sp)
                }
                Spacer(Modifier.height(52.dp))
                Text("МЕСТО ДЛЯ ВАЖНОГО", color = Sage, fontSize = 10.sp, letterSpacing = 2.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(15.dp))
                Text("Разговоры,\nкоторые остаются\nмежду вами.", color = Ink, fontSize = 34.sp, lineHeight = 41.sp, fontWeight = FontWeight.Medium, letterSpacing = (-1.1).sp)
                Spacer(Modifier.height(30.dp))
                WelcomeForm(name, { name = it }, controller::createProfile, Modifier.fillMaxWidth())
                Spacer(Modifier.height(32.dp))
            }
        }
    }
}

@Composable
private fun WelcomeArt(modifier: Modifier) {
    Box(modifier.clip(RoundedCornerShape(24.dp)).background(ForestDark)) {
        Canvas(Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val c = Offset(w * .50f, h * .51f)
            val radius = minOf(w, h) * .29f
            drawCircle(Color.White.copy(alpha = .06f), radius * 1.42f, c, style = Stroke(1.dp.toPx()))
            drawCircle(Color.White.copy(alpha = .10f), radius * 1.08f, c, style = Stroke(1.dp.toPx()))
            drawCircle(Color.White.copy(alpha = .08f), radius * .76f, c, style = Stroke(1.dp.toPx()))
            drawCircle(Color(0xFFAFC4B0).copy(alpha = .8f), 4.dp.toPx(), Offset(c.x + radius * 1.05f, c.y - radius * .22f))
            drawCircle(Color(0xFFAFC4B0).copy(alpha = .55f), 3.dp.toPx(), Offset(c.x - radius * .95f, c.y + radius * .50f))
            drawLine(Color.White.copy(alpha = .14f), Offset(w * .13f, h * .77f), Offset(w * .87f, h * .77f), 1.dp.toPx())
        }
        Row(Modifier.align(Alignment.TopStart).padding(34.dp), verticalAlignment = Alignment.CenterVertically) {
            BrandTile(42.dp, dark = false)
            Spacer(Modifier.width(12.dp))
            Text("vale", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-1).sp)
        }
        ValeMark(Modifier.size(88.dp).align(Alignment.Center), Color(0xFFDCE9DB))
        Column(Modifier.align(Alignment.BottomStart).padding(start = 42.dp, end = 42.dp, bottom = 45.dp)) {
            Text("МЕНЬШЕ ШУМА. БОЛЬШЕ БЛИЗОСТИ.", color = Color(0xFFADC2AE), fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.8.sp)
            Spacer(Modifier.height(16.dp))
            Text("Пространство\nдля своих.", color = Color.White, fontSize = 36.sp, lineHeight = 43.sp, fontWeight = FontWeight.Medium, letterSpacing = (-1).sp)
            Spacer(Modifier.height(12.dp))
            Text("Общение начинается с вашего устройства.", color = Color(0xFFB9CABE), fontSize = 14.sp)
        }
    }
}

@Composable
private fun WelcomeForm(name: String, setName: (String) -> Unit, create: (String) -> Unit, modifier: Modifier) {
    Column(modifier) {
        Text("ВАШЕ ПРОСТРАНСТВО", fontSize = 10.sp, letterSpacing = 1.8.sp, fontWeight = FontWeight.Bold, color = Sage)
        Spacer(Modifier.height(14.dp))
        Text("Начнём с вас", color = Ink, fontSize = 29.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-.7).sp)
        Spacer(Modifier.height(10.dp))
        Text("Создайте локальный профиль. Номер телефона и почта не понадобятся.", color = Muted, lineHeight = 22.sp, fontSize = 14.sp)
        Spacer(Modifier.height(29.dp))
        Text("КАК К ВАМ ОБРАЩАТЬСЯ", color = Ink, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        Spacer(Modifier.height(9.dp))
        OutlinedTextField(
            value = name, onValueChange = { if (it.length <= 40) setName(it) },
            placeholder = { Text("Ваше имя", color = Muted) },
            singleLine = true, keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(13.dp),
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Forest, unfocusedBorderColor = Line, focusedContainerColor = Paper, unfocusedContainerColor = Paper),
        )
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { create(name) }, enabled = name.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(56.dp), shape = RoundedCornerShape(13.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Forest, disabledContainerColor = Forest.copy(alpha = .4f)),
        ) {
            Text("Создать профиль", fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.width(10.dp))
            Icon(Icons.AutoMirrored.Outlined.ArrowForward, null, Modifier.size(18.dp))
        }
        Spacer(Modifier.height(25.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            FeatureHint(Icons.Outlined.Key, "Ключи на устройстве", Modifier.weight(1f))
            FeatureHint(Icons.Outlined.PhoneDisabled, "Без номера", Modifier.weight(.8f))
        }
        Spacer(Modifier.height(24.dp))
        Text("Экспериментальный прототип без независимого аудита. Не используйте для чувствительных данных.", fontSize = 11.sp, lineHeight = 16.sp, color = Muted)
    }
}

@Composable
private fun FeatureHint(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = Sage, modifier = Modifier.size(17.dp))
        Spacer(Modifier.width(7.dp))
        Text(title, fontSize = 11.sp, lineHeight = 15.sp, color = Muted)
    }
}
