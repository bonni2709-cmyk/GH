package chat.vale

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.outlined.Contacts
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

private enum class Section(val title: String, val icon: ImageVector) {
    CHATS("Чаты", Icons.AutoMirrored.Outlined.Chat),
    CONTACTS("Контакты", Icons.Outlined.Contacts),
    PROFILE("Профиль", Icons.Outlined.PersonOutline),
    SETTINGS("Настройки", Icons.Outlined.Settings),
}

@Composable
fun ValeApp(controller: ValeController) {
    val state by controller.state.collectAsState()
    ValeTheme {
        Box(Modifier.fillMaxSize().background(CanvasColor).windowInsetsPadding(WindowInsets.safeDrawing)) {
            when {
                state.loading -> LoadingScreen()
                state.fatalError != null -> FatalScreen(state.fatalError!!)
                state.panic -> CalculatorScreen(controller::restore)
                state.profileName == null -> OnboardingScreen(controller)
                else -> Workspace(controller, state)
            }
            state.error?.let { message ->
                AlertDialog(
                    onDismissRequest = controller::dismissError,
                    title = { Text("Не получилось", fontWeight = FontWeight.SemiBold) },
                    text = { Text(message) },
                    confirmButton = { TextButton(onClick = controller::dismissError) { Text("Понятно") } },
                    containerColor = Paper,
                )
            }
        }
    }
}

@Composable
private fun LoadingScreen() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            BrandTile(56.dp)
            Spacer(Modifier.height(20.dp))
            CircularProgressIndicator(Modifier.size(22.dp), color = Forest, strokeWidth = 2.dp)
        }
    }
}

@Composable
private fun FatalScreen(message: String) {
    Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Column(Modifier.widthIn(max = 430.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            BrandTile(56.dp)
            Spacer(Modifier.height(24.dp))
            Text("Хранилище недоступно", fontSize = 24.sp, fontWeight = FontWeight.SemiBold, color = Ink)
            Spacer(Modifier.height(12.dp))
            Text(message, color = Muted, lineHeight = 22.sp)
        }
    }
}

@Composable
private fun Workspace(controller: ValeController, state: ValeState) {
    var section by remember { mutableStateOf(Section.CHATS) }
    var showAdd by remember { mutableStateOf(false) }
    var editContact by remember { mutableStateOf<ContactView?>(null) }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth >= 850.dp
        if (wide) {
            Row(Modifier.fillMaxSize()) {
                DesktopRail(section, { section = it }, controller::panic)
                when (section) {
                    Section.CHATS -> ChatWorkspace(controller, state, true, onAdd = { showAdd = true }, onEdit = { editContact = it })
                    Section.CONTACTS -> ContactsScreen(controller, state, onAdd = { showAdd = true }, onEdit = { editContact = it }, onOpen = { section = Section.CHATS })
                    Section.PROFILE -> ProfileScreen(controller, state)
                    Section.SETTINGS -> SettingsScreen(controller, state)
                }
            }
        } else {
            Column(Modifier.fillMaxSize()) {
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    when (section) {
                        Section.CHATS -> ChatWorkspace(controller, state, false, onAdd = { showAdd = true }, onEdit = { editContact = it })
                        Section.CONTACTS -> ContactsScreen(controller, state, onAdd = { showAdd = true }, onEdit = { editContact = it }, onOpen = { section = Section.CHATS })
                        Section.PROFILE -> ProfileScreen(controller, state)
                        Section.SETTINGS -> SettingsScreen(controller, state)
                    }
                }
                if (!(section == Section.CHATS && state.selectedContact != null)) {
                    MobileNavigation(section, { section = it }, controller::panic)
                }
            }
        }
    }
    if (showAdd || editContact != null) {
        AddContactDialog(controller, editContact) { showAdd = false; editContact = null }
    }
}

@Composable
private fun DesktopRail(selected: Section, onSelect: (Section) -> Unit, onPanic: () -> Unit) {
    Column(
        Modifier.fillMaxHeight().width(82.dp).background(ForestDark).padding(vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PanicBrand(onPanic, light = true)
        Spacer(Modifier.height(52.dp))
        Section.entries.forEach { item ->
            val active = item == selected
            Box(
                Modifier.padding(bottom = 14.dp).size(48.dp).clip(RoundedCornerShape(15.dp))
                    .background(if (active) Color.White.copy(alpha = .13f) else Color.Transparent)
                    .clickable { onSelect(item) }, contentAlignment = Alignment.Center,
            ) { Icon(item.icon, item.title, tint = if (active) Color.White else Color(0xFF9FB1A3), modifier = Modifier.size(23.dp)) }
        }
        Spacer(Modifier.weight(1f))
        Box(Modifier.size(7.dp).background(Color(0xFF95AE99), CircleShape))
    }
}

@Composable
internal fun PanicBrand(onPanic: () -> Unit, light: Boolean = false) {
    var taps by remember { mutableIntStateOf(0) }
    LaunchedEffect(taps) { if (taps > 0) { delay(900); taps = 0 } }
    BrandTile(42.dp, Modifier.clickable {
        taps++
        if (taps >= 3) { taps = 0; onPanic() }
    }, dark = !light)
}

@Composable
private fun MobileNavigation(selected: Section, onSelect: (Section) -> Unit, onPanic: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(Paper).navigationBarsPadding().padding(horizontal = 12.dp, vertical = 9.dp),
        horizontalArrangement = Arrangement.SpaceAround,
    ) {
        Section.entries.forEach { item ->
            val active = selected == item
            Column(
                Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).clickable { onSelect(item) }.padding(vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(item.icon, item.title, tint = if (active) Forest else Muted, modifier = Modifier.size(22.dp))
                Spacer(Modifier.height(3.dp))
                Text(item.title, color = if (active) Forest else Muted, fontSize = 10.sp, fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal)
            }
        }
    }
}
