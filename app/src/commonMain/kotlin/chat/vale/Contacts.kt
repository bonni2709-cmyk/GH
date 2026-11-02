package chat.vale

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun ContactsScreen(controller: ValeController, state: ValeState, onAdd: () -> Unit, onEdit: (ContactView) -> Unit, onOpen: () -> Unit) {
    Column(Modifier.fillMaxSize().background(CanvasColor).padding(horizontal = 28.dp, vertical = 28.dp)) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Column(Modifier.fillMaxWidth().widthIn(max = 760.dp)) {
                ScreenHeader("Контакты", "Люди, которым вы доверяете", controller) {
                    RoundIconButton(Icons.Outlined.Add, "Добавить контакт", onAdd, true)
                }
                Spacer(Modifier.height(30.dp))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    SectionEyebrow("ВАШ КРУГ")
                    Spacer(Modifier.weight(1f))
                    Text("${state.contacts.size} контактов", color = Muted, fontSize = 12.sp)
                }
                Spacer(Modifier.height(14.dp))
                if (state.contacts.isEmpty()) {
                    Column(Modifier.fillMaxWidth().background(Paper, RoundedCornerShape(18.dp)).padding(30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.size(56.dp).background(Mist, RoundedCornerShape(19.dp)), contentAlignment = Alignment.Center) {
                            Icon(Icons.Outlined.QrCodeScanner, null, tint = Sage, modifier = Modifier.size(25.dp))
                        }
                        Spacer(Modifier.height(18.dp))
                        Text("Всё начинается со знакомства", color = Ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(7.dp))
                        Text("Обменяйтесь QR-кодами или публичными ID лично.", color = Muted, fontSize = 12.sp)
                        Spacer(Modifier.height(15.dp))
                        TextButton(onClick = onAdd) { Text("Добавить контакт") }
                    }
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
                        items(state.contacts.sortedBy { it.name }, key = { it.id }) { contact ->
                            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).background(Paper)
                                .clickable { controller.selectContact(contact.id); onOpen() }.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Avatar(contact.name, contact.id, 48.dp)
                                Spacer(Modifier.width(13.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(contact.name, color = Ink, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                    Spacer(Modifier.height(4.dp))
                                    Text("ID ${contact.id.take(12)}…  ·  ${contact.address.ifBlank { "без адреса" }}", color = Muted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                                IconButton(onClick = { onEdit(contact) }) { Icon(Icons.Outlined.Edit, "Изменить", tint = Sage, modifier = Modifier.size(19.dp)) }
                                Icon(Icons.AutoMirrored.Outlined.ArrowForward, null, tint = Sage, modifier = Modifier.size(19.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun AddContactDialog(controller: ValeController, existing: ContactView?, onClose: () -> Unit) {
    var name by remember(existing?.id) { mutableStateOf(existing?.name.orEmpty()) }
    var id by remember(existing?.id) { mutableStateOf(existing?.id.orEmpty()) }
    var address by remember(existing?.id) { mutableStateOf(existing?.address.orEmpty()) }
    var scanning by remember { mutableStateOf(false) }
    var scanFailed by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = { if (!scanning) onClose() },
        title = { Text(if (existing == null) "Новый контакт" else "Изменить контакт", fontSize = 21.sp, fontWeight = FontWeight.SemiBold, color = Ink) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Добавьте друг друга и проверьте ID при личной встрече. Используйте локальный IP, onion-адрес или Nearby на Android.", color = Muted, fontSize = 12.sp, lineHeight = 18.sp)
                OutlinedTextField(name, { if (it.length <= 40) name = it }, label = { Text("Имя") }, singleLine = true, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp))
                OutlinedTextField(id, { if (it.length <= 220) id = it }, label = { Text("Публичный ID или QR-код") }, modifier = Modifier.fillMaxWidth(), minLines = 2, maxLines = 3, shape = RoundedCornerShape(12.dp), readOnly = existing != null)
                OutlinedTextField(address, { if (it.length <= 100) address = it }, label = { Text("Локальный IP или .onion") }, placeholder = { Text("192.168.1.20 или адрес.onion") }, singleLine = true, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp))
                if (existing == null) {
                    OutlinedButton(onClick = {
                        scanning = true; scanFailed = false
                        controller.scanQr { result ->
                            scanning = false
                            if (result != null) { id = result; address = "" } else scanFailed = true
                        }
                    }, enabled = !scanning, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                        Icon(Icons.Outlined.QrCodeScanner, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp))
                        Text(if (scanning) "Поиск QR-кода…" else "Сканировать QR-код")
                    }
                    if (scanFailed) Text("Камера недоступна или код не найден. Можно вставить ID вручную.", color = Red, fontSize = 11.sp)
                } else {
                    TextButton(onClick = { confirmDelete = true }) { Icon(Icons.Outlined.DeleteOutline, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("Удалить контакт и переписку") }
                }
            }
        },
        confirmButton = { Button(onClick = { controller.addContact(name, id, address); onClose() }, enabled = id.isNotBlank() && !scanning, shape = RoundedCornerShape(10.dp)) { Text("Сохранить") } },
        dismissButton = { TextButton(onClick = onClose, enabled = !scanning) { Text("Отмена") } },
        containerColor = Paper,
    )
    if (confirmDelete && existing != null) {
        AlertDialog(onDismissRequest = { confirmDelete = false }, title = { Text("Удалить контакт?") }, text = { Text("История и неотправленные сообщения для этого контакта будут удалены с этого устройства.") },
            confirmButton = { TextButton(onClick = { controller.removeContact(existing.id); confirmDelete = false; onClose() }) { Text("Удалить", color = Red) } },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Отмена") } }, containerColor = Paper)
    }
}
