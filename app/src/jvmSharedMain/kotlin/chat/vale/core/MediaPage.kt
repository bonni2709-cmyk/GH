package chat.vale.core

// No remote assets, analytics or requests. The bridge is available on loopback only.
internal const val MEDIA_PAGE = """<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vale · медиа</title><style>
:root{color-scheme:light;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;color:#28312c;background:#f5f5f0}
*{box-sizing:border-box}body{margin:0;min-height:100vh}.wrap{max-width:720px;margin:auto;padding:32px 20px 56px}
header{display:flex;align-items:center;gap:12px;margin-bottom:42px}.mark{width:38px;height:38px;border-radius:13px;background:#273d32;color:white;display:grid;place-items:center;font-size:22px}
.brand{font-size:22px;font-weight:650;letter-spacing:-1px}.eyebrow{font-size:10px;letter-spacing:.17em;font-weight:700;color:#78917d;text-transform:uppercase}
h1{font-size:30px;letter-spacing:-1px;margin:10px 0 10px}p{color:#78837b;font-size:14px;line-height:1.65;margin:0 0 14px}
.card{background:#fff;border:1px solid #e4e9e3;border-radius:22px;padding:26px;margin-top:18px;box-shadow:0 14px 48px #263e3010}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}button,.file{border:0;border-radius:12px;background:#304b39;color:#fff;font:600 13px/1.2 system-ui,sans-serif;padding:13px 16px;cursor:pointer}
button.secondary,.file{color:#304b39;background:#edf2ec}button:disabled{opacity:.45;cursor:not-allowed}button:hover:not(:disabled),.file:hover{filter:brightness(.95)}
.status{min-height:22px;margin-top:16px;color:#65796a;font-size:13px}.error{color:#aa534d}.preview{display:block;width:min(270px,75vw);height:min(270px,75vw);border-radius:50%;object-fit:cover;background:#e6ece5;margin:22px auto}
audio{width:100%;margin:15px 0}video.remote{max-height:60vh}.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.small{font-size:11px}.badge{display:inline-block;border-radius:999px;background:#edf3ec;color:#607b64;font-size:10px;font-weight:700;padding:7px 10px;letter-spacing:.08em}
[hidden]{display:none!important}input[type=file]{display:none}.note{border-left:2px solid #cbdacb;padding-left:12px;margin-top:20px}
</style></head><body><main class="wrap"><header><div class="mark">⌁</div><div class="brand">vale</div></header>
<div class="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</div><h1 id="title">Медиа</h1><p id="intro"></p>
<section class="card" id="studio" hidden><span class="badge">ЗАПИСЬ И СТИКЕРЫ</span><p style="margin-top:15px">Запись остаётся на этом устройстве до отправки. Браузер попросит доступ к камере или микрофону.</p>
<video id="preview" class="preview" muted playsinline hidden></video><audio id="audioPreview" controls hidden></audio><img id="imagePreview" class="preview" alt="Стикер" hidden>
<div class="actions"><button id="recordAudio">Голосовое · Opus</button><button id="recordVideo" class="secondary">Видеокружок · H.264</button><label class="file">Добавить стикер<input id="sticker" type="file" accept="image/png,image/webp,image/jpeg"></label></div>
<div class="actions"><button id="stopRecording" class="secondary" hidden>Остановить запись</button><button id="sendMedia" hidden>Отправить</button><button id="discard" class="secondary" hidden>Отменить</button></div>
<p class="small note">До 60 секунд аудио или 15 секунд видео, не более 768 КБ. H.264 доступен не во всех браузерах и на не всех устройствах.</p></section>
<section class="card" id="play" hidden><span class="badge">ПРОСМОТР</span><audio id="audioPlayer" controls hidden></audio><video id="videoPlayer" class="preview" controls playsinline hidden></video><img id="stickerPlayer" class="preview" alt="Стикер" hidden></section>
<section class="card" id="call" hidden><span class="badge">WEBRTC · НАПРЯМУЮ</span><p style="margin-top:15px">Звонок устанавливается напрямую между устройствами без STUN/TURN-сервера. Собеседник увидит ваши сетевые адреса; Tor для звонков не используется.</p>
<div class="row"><video id="remoteVideo" class="preview remote" autoplay muted playsinline hidden></video><video id="localVideo" class="preview" autoplay muted playsinline hidden style="width:100px;height:100px"></video></div><audio id="remoteAudio" autoplay></audio>
<div class="actions"><button id="beginCall">Разрешить и подключиться</button><button id="hangup" class="secondary">Завершить</button></div></section>
<div id="status" class="status" role="status"></div><p class="small">Страница работает только на вашем устройстве и закроется вместе с Vale.</p>
</main><script>
'use strict';
const token=location.hash.substring(1); history.replaceState(null,'',location.pathname);
const byId=(id)=>document.getElementById(id), status=byId('status');
const setStatus=(text,err=false)=>{status.textContent=text;status.classList.toggle('error',err)};
const headers={'X-Vale-Token':token};
async function api(path,method='GET',body=null){
  const h=Object.assign({},headers);if(body!==null)h['Content-Type']='application/json';
  const response=await fetch(path,{method,headers:h,body:body===null?null:JSON.stringify(body),cache:'no-store',credentials:'omit'});
  if(!response.ok)throw new Error('Операция не выполнена ('+response.status+')');return response;
}
async function action(body){return api('/action','POST',body)}
function toBase64Url(bytes){let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+16384));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
let config, recorder=null, stream=null, chunks=[], blob=null, mediaKind='', mediaMime='', duration=0, started=0, timer=null, objectUrl=null, pc=null, callTimer=null, closing=false;
function releaseStream(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}byId('preview').srcObject=null}
function showPreview(b,kind){
  if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(b);
  byId('preview').hidden=kind!=='video';byId('audioPreview').hidden=kind!=='audio';byId('imagePreview').hidden=kind!=='sticker';
  if(kind==='video'){byId('preview').src=objectUrl;byId('preview').controls=true;byId('preview').muted=false}
  if(kind==='audio')byId('audioPreview').src=objectUrl;
  if(kind==='sticker')byId('imagePreview').src=objectUrl;
  byId('sendMedia').hidden=false;byId('discard').hidden=false;
}
function discard(){blob=null;mediaKind='';if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;['preview','audioPreview','imagePreview','sendMedia','discard'].forEach(id=>byId(id).hidden=true);setStatus('')}
async function startRecording(kind){
  discard();if(!navigator.mediaDevices||!window.MediaRecorder){setStatus('Браузер не поддерживает запись.',true);return}
  const choices=kind==='audio'?['audio/webm;codecs=opus']:['video/webm;codecs=h264,opus','video/webm;codecs=avc1,opus','video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2'];
  const mime=choices.find(x=>MediaRecorder.isTypeSupported(x));if(!mime){setStatus(kind==='video'?'В этом браузере недоступна запись H.264. Попробуйте Chrome или Edge с аппаратным кодеком.':'В этом браузере недоступна запись Opus.',true);return}
  try{
    stream=await navigator.mediaDevices.getUserMedia(kind==='audio'?{audio:true}:{audio:true,video:{width:{ideal:360},height:{ideal:360},frameRate:{ideal:15,max:20},facingMode:'user'}});
    if(kind==='video'){const p=byId('preview');p.hidden=false;p.controls=false;p.muted=true;p.srcObject=stream;await p.play().catch(()=>{})}
    chunks=[];mediaKind=kind;mediaMime=mime;started=Date.now();recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:32000,videoBitsPerSecond:260000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    recorder.onerror=()=>{releaseStream();setStatus('Ошибка записи.',true)};
    recorder.onstop=()=>{clearTimeout(timer);duration=Math.min(Date.now()-started,60000);blob=new Blob(chunks,{type:mediaMime});releaseStream();byId('stopRecording').hidden=true;if(blob.size>config.maxBytes){discard();setStatus('Запись слишком большая. Запишите короче.',true)}else if(blob.size){showPreview(blob,mediaKind);setStatus('Проверьте запись перед отправкой.')}else setStatus('Пустая запись.',true)};
    recorder.start(300);byId('stopRecording').hidden=false;setStatus('Идёт запись…');timer=setTimeout(()=>{if(recorder&&recorder.state!=='inactive')recorder.stop()},kind==='audio'?60000:15000);
  }catch(e){releaseStream();setStatus('Не удалось начать запись: проверьте разрешения и доступность устройства.',true)}
}
function stopRecording(){if(recorder&&recorder.state!=='inactive')recorder.stop()}
async function chooseSticker(event){const f=event.target.files[0];if(!f)return;discard();if(!['image/png','image/webp','image/jpeg'].includes(f.type)||f.size>config.maxBytes){setStatus('Выберите PNG, WebP или JPEG до 768 КБ.',true);return}blob=f;mediaKind='sticker';mediaMime=f.type;duration=0;showPreview(blob,mediaKind);setStatus('Стикер готов к отправке.')}
async function sendMedia(){if(!blob)return;try{byId('sendMedia').disabled=true;const data=toBase64Url(new Uint8Array(await blob.arrayBuffer()));await action({action:'submit',kind:mediaKind,mime:mediaMime,media:data,durationMs:duration});discard();setStatus('Отправлено в очередь Vale. Можно вернуться в приложение.')}catch(e){setStatus('Не удалось передать медиа в Vale.',true)}finally{byId('sendMedia').disabled=false}}
async function waitGathering(peer){if(peer.iceGatheringState==='complete')return;await new Promise(resolve=>{const done=()=>{if(peer.iceGatheringState==='complete'){peer.removeEventListener('icegatheringstatechange',done);resolve()}};peer.addEventListener('icegatheringstatechange',done);setTimeout(()=>{peer.removeEventListener('icegatheringstatechange',done);resolve()},6500)})}
async function callAction(kind,sdp=''){await action({action:kind,sdp:sdp})}
function stopCallMedia(){if(callTimer)clearInterval(callTimer);callTimer=null;if(pc){pc.close();pc=null}releaseStream();['localVideo','remoteVideo','remoteAudio'].forEach(id=>{byId(id).srcObject=null})}
async function startCall(){
  if(pc)return;byId('beginCall').disabled=true;
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true,video:config.video});
    if(config.video){byId('localVideo').hidden=false;byId('localVideo').srcObject=stream}
    pc=new RTCPeerConnection({iceServers:[]});stream.getTracks().forEach(track=>pc.addTrack(track,stream));
    pc.ontrack=e=>{const remote=e.streams[0]||new MediaStream([e.track]);if(e.track.kind==='video'){byId('remoteVideo').hidden=false;byId('remoteVideo').srcObject=remote}else byId('remoteAudio').srcObject=remote};
    pc.onconnectionstatechange=()=>{if(!pc)return;const state=pc.connectionState;if(state==='connected'){setStatus('Соединение установлено.');callAction('connected').catch(()=>{})}else if(state==='failed'||state==='disconnected')setStatus('Соединение прервано. Проверьте сеть.',true)};
    if(config.role==='answer'){await pc.setRemoteDescription({type:'offer',sdp:config.offer});await pc.setLocalDescription(await pc.createAnswer())}
    else await pc.setLocalDescription(await pc.createOffer());
    await waitGathering(pc);await callAction(config.role==='answer'?'answer':'offer',pc.localDescription.sdp);setStatus(config.role==='answer'?'Подключаемся…':'Ожидаем ответа собеседника…');
    callTimer=setInterval(async()=>{try{const events=await (await api('/events')).json();for(const ev of events){if(ev.kind==='answer'&&pc)await pc.setRemoteDescription({type:'answer',sdp:ev.sdp});if(ev.kind==='end'){stopCallMedia();closing=true;await callAction('hangup').catch(()=>{});setStatus('Звонок завершён.')}}}catch(e){stopCallMedia();setStatus('Vale недоступен.',true)}},1200);
  }catch(e){stopCallMedia();byId('beginCall').disabled=false;setStatus('Не удалось начать звонок: проверьте разрешения и сеть.',true)}
}
async function hangup(){if(closing)return;closing=true;stopCallMedia();try{await callAction('hangup')}catch(e){}setStatus('Звонок завершён.')}
window.addEventListener('pagehide',()=>{if((!config||config.mode==='call')&&!closing){closing=true;stopCallMedia();fetch('/action',{method:'POST',headers:{'X-Vale-Token':token,'Content-Type':'application/json'},body:JSON.stringify({action:'hangup'}),keepalive:true}).catch(()=>{})}});
async function init(){
  try{config=await (await api('/config')).json();byId('intro').textContent=config.contact?'Разговор с '+config.contact:'';
    if(config.mode==='studio'){byId('title').textContent='Поделиться моментом';byId('studio').hidden=false}
    else if(config.mode==='play'){byId('title').textContent='Сообщение';byId('play').hidden=false;const response=await api('/media');const b=await response.blob();objectUrl=URL.createObjectURL(b);const id=config.mediaType==='audio'?'audioPlayer':config.mediaType==='video'?'videoPlayer':'stickerPlayer';byId(id).hidden=false;byId(id).src=objectUrl}
    else if(config.mode==='call'){byId('title').textContent=config.video?'Видеозвонок':'Голосовой звонок';byId('call').hidden=false}
    else throw new Error('mode');
  }catch(e){setStatus('Не удалось подключиться к Vale. Откройте страницу из приложения.',true)}
}
byId('recordAudio').onclick=()=>startRecording('audio');byId('recordVideo').onclick=()=>startRecording('video');byId('stopRecording').onclick=stopRecording;byId('sendMedia').onclick=sendMedia;byId('discard').onclick=discard;byId('sticker').onchange=chooseSticker;byId('beginCall').onclick=startCall;byId('hangup').onclick=hangup;init();
</script></body></html>"""
