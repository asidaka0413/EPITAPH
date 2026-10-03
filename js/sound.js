// ==================== 効果音 ====================
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)
// 音のファイルは使わず、Web Audio(ブラウザに入っている音を作る仕組み)で、その場で音を作る
// 音の形は js/config.js の SE_SOUNDS。鳴らすときは playSE("hit") のように名前で呼ぶ
// スマホ(とくに iPhone)は、画面に触るかキーを押すまで音が出ない決まりがあるので、
// 最初に音を鳴らすときに音の仕組みを用意する(キーを押したときに呼ばれるので、そのときは鳴らせる)

let seContext = null;   // 音を作る仕組み(AudioContext)。最初に鳴らすときに作る
let seNoiseBuffer = null; // 「ザッ」という雑音の元(1回だけ作って使い回す)
const seLastPlayed = {}; // 音の名前 → 最後に鳴らした時刻(同じ音が重なりすぎないように)

// 効果音が ON か
function seEnabled() {
  return base.settings.se !== false;
}

// 音の仕組みを用意する(ブラウザが Web Audio を使えなければ null)
function seReady() {
  if (!seContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    seContext = new Ctx();
    // 雑音の元:0.5秒ぶんのでたらめな波
    const len = Math.floor(seContext.sampleRate * 0.5);
    seNoiseBuffer = seContext.createBuffer(1, len, seContext.sampleRate);
    const data = seNoiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  if (seContext.state === "suspended") seContext.resume(); // スマホで止まっていたら動かす
  return seContext;
}

// 効果音を鳴らす。name:SE_SOUNDS の名前
function playSE(name) {
  if (!seEnabled()) return;
  const parts = SE_SOUNDS[name];
  if (!parts) return;
  const now = performance.now();
  if (seLastPlayed[name] && now - seLastPlayed[name] < BALANCE.seRepeatGapMs) return;
  seLastPlayed[name] = now;
  try {
    const ctx = seReady();
    if (!ctx) return;
    const volume = (base.settings.seVolume ?? BALANCE.seVolumeDefault) / 100 * BALANCE.seMasterGain;
    if (volume <= 0) return;
    parts.forEach(p => playSEPart(ctx, p, volume));
  } catch (e) {
    // 音が出せなくても、ゲームは止めない
  }
}

// 音のかけら1つを鳴らす(形は js/config.js の SE_SOUNDS の説明)
function playSEPart(ctx, p, volume) {
  const start = ctx.currentTime + p.at;
  const end = start + p.dur;
  let src;
  if (p.wave === "noise") {
    src = ctx.createBufferSource();
    src.buffer = seNoiseBuffer;
    src.loop = true; // 雑音の元(0.5秒)より長く鳴らすときは、くり返す
  } else {
    src = ctx.createOscillator();
    src.type = p.wave;
    src.frequency.setValueAtTime(p.freq, start);
    if (p.to) src.frequency.exponentialRampToValueAtTime(p.to, end);
  }
  // 大きさ:すぐ立ち上がって、だんだん小さくなって消える(ブツッという音が出ないように)
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(p.vol * volume, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  // lp があれば、その高さより上の音を削って、こもった音にする(ローパスフィルター)
  if (p.lp) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = p.lp;
    src.connect(filter);
    filter.connect(gain);
  } else {
    src.connect(gain);
  }
  gain.connect(ctx.destination);
  src.start(start);
  src.stop(end + 0.02);
}

// ==================== 設定(拠点の設定画面から呼ぶ) ====================
function toggleSE() {
  base.settings.se = !seEnabled();
  saveGame();
  playSE("test");
}

// 音量を変える。d:+1 なら上げる / -1 なら下げる(端まで行ったら止まる)
function changeSEVolume(d) {
  const v = base.settings.seVolume ?? BALANCE.seVolumeDefault;
  base.settings.seVolume = Math.max(0, Math.min(100, v + d * BALANCE.seVolumeStep));
  saveGame();
  playSE("test");
}

// 音量を1段上げる。100 の次は 0 に戻る(Enter で変えるとき。←→ がないスマホでも変えられるように)
function cycleSEVolume() {
  const v = base.settings.seVolume ?? BALANCE.seVolumeDefault;
  base.settings.seVolume = v >= 100 ? 0 : Math.min(100, v + BALANCE.seVolumeStep);
  saveGame();
  playSE("test");
}
