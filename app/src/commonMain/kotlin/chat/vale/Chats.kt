package chat.vale

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AttachFile
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.Videocam
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.EmojiEmotions
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun ChatWorkspace(controller: ValeController, state: ValeState, wide: Boolean, onAdd: () -> Unit, onEdit: (ContactView) -> Unit) {
    val contact = state.contacts.firstOrNull { it.id == state.selectedContact }
    if (wide) {
        Row(Modifier.fillMaxSize()) {
            ChatList(controller, state, onAdd, Modifier.width(346.dp).fillMaxHeight())
            Box(Modifier.width(1.dp).fillMaxHeight().background(Line))
            if (contact == null) ConversationPlaceholder(onAdd, Modifier.weight(1f).fillMaxHeight())
            else Conversation(controller, state, contact, true, { onEdit(contact) }, Modifier.weight(1f).fillMaxHeight())
        }
    } else if (contact == null) {
        ChatList(controller, state, onAdd, Modifier.fillMaxSize())
    } else {
        Conversation(controller, state, contact, false, { onEdit(contact) }, Modifier.fillMaxSize())
    }
}

@Composable
private fun ChatList(controller: ValeController, state: ValeState, onAdd: () -> Unit, modifier: Modifier) {
    var search by remember { mutableStateOf("") }
    val ordered = state.contacts.filter { it.name.contains(search, ignoreCase = true) || it.id.contains(search, ignoreCase = true) }
        .sortedWith(compareByDescending<ContactView> { contact -> state.messages.lastOrNull { it.contactId == contact.id }?.createdAt ?: 0 }.thenBy { it.name })
    Column(modifier.background(Paper).padding(start = 24.dp, end = 24.dp, top = 28.dp)) {
        ScreenHeader("Чаты", "Ваши личные разговоры", controller) {
            RoundIconButton(Icons.Outlined.Add, "Добавить контакт", onAdd, filled = true)
        }
        Spacer(Modifier.height(30.dp))
        Row(
            Modifier.fillMaxWidth().height(46.dp).background(CanvasColor, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.Search, null, tint = Muted, modifier = Modifier.size(19.dp))
            Spacer(Modifier.width(9.dp))
            BasicTextField(value = search, onValueChange = { search = it }, singleLine = true,
                textStyle = androidx.compose.ui.text.TextStyle(fontSize = 13.sp, color = Ink), modifier = Modifier.weight(1f),
                decorationBox = { inner -> Box { if (search.isEmpty()) Text("Поиск", fontSize = 13.sp, color = Muted); inner() } })
        }
        Spacer(Modifier.height(28.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SectionEyebrow("ВСЕ РАЗГОВОРЫ")
            Spacer(Modifier.weight(1f))
            Text(state.contacts.size.toString().padStart(2, '0'), fontSize = 11.sp, color = Muted)
        }
        Spacer(Modifier.height(12.dp))
        if (ordered.isEmpty()) {
            Column(Modifier.fillMaxWidth().padding(top = 50.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(54.dp).background(Mist, RoundedCornerShape(19.dp)), contentAlignment = Alignment.Center) {
                    Icon(Icons.Outlined.Add, null, tint = Sage, modifier = Modifier.size(24.dp))
                }
                Spacer(Modifier.height(16.dp))
                Text(if (search.isBlank()) "Здесь пока тихо" else "Ничего не найдено", color = Ink, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Spacer(Modifier.height(7.dp))
                Text(if (search.isBlank()) "Добавьте контакт, чтобы начать\nразговор." else "Попробуйте другой запрос.", color = Muted, fontSize = 12.sp, lineHeight = 18.sp, textAlign = TextAlign.Center)
                if (search.isBlank()) {
                    Spacer(Modifier.height(14.dp))
                    TextButton(onClick = onAdd) { Text("Добавить контакт", fontSize = 12.sp) }
                }
            }
        } else {
            LazyColumn(contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                items(ordered, key = { it.id }) { contact ->
                    val last = state.messages.lastOrNull { it.contactId == contact.id }
                    ChatListItem(contact, last, contact.id == state.selectedContact, controller)
                }
            }
        }
    }
}

@Composable
private fun ChatListItem(contact: ContactView, last: MessageView?, selected: Boolean, controller: ValeController) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).background(if (selected) Mist else Color.Transparent)
            .clickable { controller.selectContact(contact.id) }.padding(horizontal = 10.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(contact.name, contact.id, 46.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(contact.name, color = Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(4.dp))
            Text(last?.let { if (it.outgoing) "Вы: ${it.text}" else it.text } ?: "Начать разговор", color = Muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (last != null) {
            Spacer(Modifier.width(8.dp))
            Text(controller.formatTime(last.createdAt), color = Muted, fontSize = 10.sp)
        }
    }
}

@Composable
private fun ConversationPlaceholder(onAdd: () -> Unit, modifier: Modifier) {
    Box(modifier.background(CanvasColor), contentAlignment = Alignment.Center) {
        Column(Modifier.widthIn(max = 400.dp).padding(35.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(100.dp).background(Mist, RoundedCornerShape(34.dp)), contentAlignment = Alignment.Center) {
                Box(Modifier.size(61.dp).border(1.dp, Color(0xFFC9D9CB), RoundedCornerShape(24.dp)), contentAlignment = Alignment.Center) {
                    ValeMark(Modifier.size(28.dp), Forest)
                }
            }
            Spacer(Modifier.height(28.dp))
            Text("Хорошо быть на связи", color = Ink, fontSize = 24.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-.5).sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(10.dp))
            Text("Выберите разговор слева или добавьте контакт, чтобы начать общение.", color = Muted, fontSize = 14.sp, lineHeight = 22.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))
            OutlinedButton(onClick = onAdd, shape = RoundedCornerShape(12.dp), border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD4DFD4))) {
                Icon(Icons.Outlined.Add, null, Modifier.size(18.dp))
                Spacer(Modifier.width(7.dp)); Text("Добавить контакт", fontSize = 13.sp)
            }
            Spacer(Modifier.height(28.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Lock, null, tint = Sage, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(6.dp))
                Text("СООБЩЕНИЯ ШИФРУЮТСЯ НА УСТРОЙСТВЕ", color = Sage, fontSize = 9.sp, letterSpacing = .8.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun Conversation(controller: ValeController, state: ValeState, contact: ContactView, wide: Boolean, onEdit: () -> Unit, modifier: Modifier) {
    var text by remember(contact.id) { mutableStateOf("") }
    var emojiOpen by remember(contact.id) { mutableStateOf(false) }
    val messages = state.messages.filter { it.contactId == contact.id }.sortedBy { it.createdAt }
    val listState = rememberLazyListState()
    LaunchedEffect(messages.size, contact.id) { if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex) }
    Column(modifier.background(CanvasColor)) {
        Row(Modifier.fillMaxWidth().background(Paper).padding(horizontal = if (wide) 28.dp else 16.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            if (!wide) {
                IconButton(onClick = { controller.selectContact(null) }, modifier = Modifier.size(34.dp)) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Назад", tint = Forest)
                }
                Spacer(Modifier.width(8.dp))
            }
            Avatar(contact.name, contact.id, 42.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(contact.name, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(2.dp))
                Text(if (state.torEnabled) "Через Tor" else if (contact.address.isBlank()) "Адрес не указан · Nearby" else "Локальное соединение", fontSize = 11.sp, color = Muted)
            }
            if (wide) StatusPill(if (state.torEnabled) (if (state.torStatus == "Tor подключён") "TOR" else "TOR · ОЖИДАНИЕ") else if (state.networkAvailable) "ЛОКАЛЬНАЯ СЕТЬ" else "СЕТЬ НЕДОСТУПНА", if (state.torEnabled) state.torStatus == "Tor подключён" else state.networkAvailable)
            Spacer(Modifier.width(4.dp))
            IconButton(onClick = { controller.startCall(false) }, modifier = Modifier.size(36.dp)) {
                Icon(Icons.Outlined.Call, "Голосовой звонок", tint = Sage, modifier = Modifier.size(20.dp))
            }
            IconButton(onClick = { controller.startCall(true) }, modifier = Modifier.size(36.dp)) {
                Icon(Icons.Outlined.Videocam, "Видеозвонок", tint = Sage, modifier = Modifier.size(21.dp))
            }
            RoundIconButton(Icons.Outlined.Edit, "Изменить контакт", onEdit)
        }
        Box(Modifier.height(1.dp).fillMaxWidth().background(Line))
        state.call?.takeIf { it.contactId == contact.id && !it.incoming }?.let { active ->
            Row(Modifier.fillMaxWidth().background(Mist).padding(horizontal = 18.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(active.status, color = Forest, fontSize = 12.sp, modifier = Modifier.weight(1f))
                TextButton(onClick = controller::endCall) { Text("Завершить", color = Forest, fontSize = 12.sp) }
            }
        }
        if (messages.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Column(Modifier.padding(30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(50.dp).background(Mist, CircleShape), contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.Lock, null, tint = Sage, modifier = Modifier.size(20.dp))
                    }
                    Spacer(Modifier.height(14.dp))
                    Text("Начните с простого «привет»", color = Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(6.dp))
                    Text("Оба собеседника должны добавить друг друга\nи открыть приложение.", color = Muted, fontSize = 12.sp, lineHeight = 18.sp, textAlign = TextAlign.Center)
                }
            }
        } else {
            LazyColumn(state = listState, modifier = Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(horizontal = if (wide) 36.dp else 16.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(messages, key = { it.id }) { message -> MessageBubble(message, controller) }
            }
        }
        Column(Modifier.fillMaxWidth().background(Paper).padding(horizontal = if (wide) 28.dp else 14.dp, vertical = 14.dp)) {
            if (emojiOpen) {
                Column(Modifier.fillMaxWidth().padding(bottom = 10.dp)) {
                    Text("ЭМОДЗИ", color = Sage, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        items(listOf("🙂", "😊", "🤍", "👍", "✨", "🌿", "❤️", "🎉")) { emoji ->
                            Text(emoji, modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable { text += emoji; emojiOpen = false }.padding(5.dp), fontSize = 20.sp)
                        }
                    }
                    Spacer(Modifier.height(5.dp))
                    Text("СТИКЕРЫ", color = Sage, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        items(listOf("🐻", "🦊", "🐈", "🐼", "🌷", "☕", "💌", "🌙")) { sticker ->
                            Text(sticker, modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable { controller.sendSticker(sticker); emojiOpen = false }.padding(5.dp), fontSize = 25.sp)
                        }
                    }
                }
            }
            Row(Modifier.fillMaxWidth().background(CanvasColor, RoundedCornerShape(15.dp)).padding(start = 6.dp, end = 7.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { emojiOpen = !emojiOpen }, modifier = Modifier.size(40.dp)) {
                    Icon(Icons.Outlined.EmojiEmotions, "Эмодзи", tint = Muted, modifier = Modifier.size(21.dp))
                }
                IconButton(onClick = controller::openMediaStudio, modifier = Modifier.size(36.dp)) {
                    Icon(Icons.Outlined.AttachFile, "Голосовое, видео или стикер", tint = Muted, modifier = Modifier.size(20.dp))
                }
                BasicTextField(value = text, onValueChange = { if (it.length <= 4000) text = it }, modifier = Modifier.weight(1f).padding(horizontal = 5.dp),
                    textStyle = androidx.compose.ui.text.TextStyle(color = Ink, fontSize = 14.sp, lineHeight = 20.sp),
                    maxLines = 4, keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { if (text.isNotBlank()) { controller.sendMessage(text); text = "" } }),
                    decorationBox = { inner -> Box { if (text.isEmpty()) Text("Написать сообщение...", color = Muted, fontSize = 13.sp); inner() } })
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(11.dp)).background(if (text.isBlank()) Color(0xFFCCD8CE) else Forest)
                    .clickable(enabled = text.isNotBlank()) { controller.sendMessage(text); text = "" }, contentAlignment = Alignment.Center) {
                    Icon(Icons.AutoMirrored.Outlined.Send, "Отправить", tint = Color.White, modifier = Modifier.size(19.dp))
                }
            }
            if (state.expirySeconds > 0) {
                Row(Modifier.padding(start = 5.dp, top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Timer, null, Modifier.size(13.dp), tint = Sage)
                    Spacer(Modifier.width(5.dp))
                    Text("Таймер: ${expiryLabel(state.expirySeconds)}", color = Sage, fontSize = 10.sp)
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(message: MessageView, controller: ValeController) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (message.outgoing) Arrangement.End else Arrangement.Start) {
        Column(
            Modifier.widthIn(max = 450.dp).fillMaxWidth(.82f).clip(RoundedCornerShape(topStart = 17.dp, topEnd = 17.dp, bottomStart = if (message.outgoing) 17.dp else 5.dp, bottomEnd = if (message.outgoing) 5.dp else 17.dp))
                .background(if (message.outgoing) Forest else Paper).padding(horizontal = 15.dp, vertical = 11.dp),
        ) {
            val textColor = if (message.outgoing) Color.White else Ink
            when (message.kind) {
                "sticker-emoji" -> Text(message.text, fontSize = 48.sp, lineHeight = 56.sp)
                "sticker" -> {
                    val image = remember(message.id) { controller.mediaBytes(message.id)?.let(::decodeSticker) }
                    if (image != null) Image(image, "Стикер", Modifier.size(145.dp).clip(RoundedCornerShape(12.dp)).clickable { controller.openMedia(message.id) })
                    else TextButton(onClick = { controller.openMedia(message.id) }) { Text("Открыть стикер", color = textColor) }
                }
                "audio", "video" -> Row(Modifier.clip(RoundedCornerShape(10.dp)).clickable { controller.openMedia(message.id) }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(38.dp).background(if (message.outgoing) Color.White.copy(alpha = .18f) else Mist, CircleShape), contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.PlayArrow, "Воспроизвести", tint = textColor)
                    }
                    Spacer(Modifier.width(10.dp))
                    Column { Text(message.text, color = textColor, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                        Text("${message.durationMs / 1000} сек · открыть", color = if (message.outgoing) Color.White.copy(alpha = .7f) else Muted, fontSize = 11.sp) }
                }
                else -> Text(message.text, color = textColor, fontSize = 14.sp, lineHeight = 21.sp)
            }
            Spacer(Modifier.height(6.dp))
            Row(Modifier.align(Alignment.End), verticalAlignment = Alignment.CenterVertically) {
                if (message.expiresAt != 0L) {
                    Icon(Icons.Outlined.Timer, null, Modifier.size(12.dp), tint = if (message.outgoing) Color.White.copy(alpha = .65f) else Sage)
                    Spacer(Modifier.width(4.dp))
                }
                Text(controller.formatTime(message.createdAt) + if (message.outgoing) { if (message.pending) "  ·  в очереди" else "  ·  передано" } else "", color = if (message.outgoing) Color.White.copy(alpha = .65f) else Muted, fontSize = 10.sp)
            }
        }
    }
}

internal fun expiryLabel(seconds: Long): String = when (seconds) {
    60L -> "1 минута"; 3600L -> "1 час"; 86400L -> "24 часа"; 604800L -> "7 дней"; else -> "выключен"
}
