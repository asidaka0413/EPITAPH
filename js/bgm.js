// ==================== BGM ====================
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)
// 音のファイルは使わず、効果音(js/sound.js)と同じ Web Audio で、その場で曲を作る
// 楽譜は js/config.js の BGM_TRACKS。どの曲を流すかは、今の画面(screenMode)で決まる(bgmTrackForScreen)
// ブラウザは、一度もキーを押していないうちは音を鳴らさないので、最初にキー(ボタン)を押したときから流れる
// しくみ:bgmTickMs ごとに「bgmLookaheadSec 秒先までの音」を前もって予約する(こうすると音の間隔がずれない)

let bgmUnlocked = false; // 一度でもキーを押したか(押すまでは鳴らさない。js/input.js の pressKey で true にする)
let bgmTrack = null;     // 今流している曲の名前(BGM_TRACKS の名前)。止まっていれば null
let bgmGain = null;      // 今の曲の音量のつまみ。曲の音は全部ここを通る(じわっと消すときに使う)
let bgmTimer = null;     // 次の音を予約しに行くタイマー
let bgmStep = 0;         // 次に鳴らす楽譜のマス(何マス目か)
let bgmNextTime = 0;     // 次のマスを鳴らす時刻(AudioContext の時計で)
let bgmPreview = null;   // サウンドテストで選んで鳴らしている曲の名前(js/debug.js)
const bgmParsed = {};    // 曲の名前 → 楽譜をマスの並びにしたもの(最初に1回だけ作る)

// BGM が ON か
function bgmEnabled() {
  return base.settings.bgm !== false;
}

// 今の音量(BGM の設定 × 全体の大きさ)
function bgmVolumeGain() {
  return (base.settings.bgmVolume ?? BALANCE.bgmVolumeDefault) / 100 * BALANCE.bgmMasterGain;
}

// 今の画面で流す曲の名前(流さないときは null)
//   拠点 → town / キャンプ・分かれ道 → rest / 死んだあと(リザルト・刻む)→ requiem /
//   ダンジョン(持ち物・宝の地図の入れ替えも)→ 強い敵に追われていれば boss、それ以外は層の曲(BALANCE.layers の bgm)/
//   サウンドテスト → 選んで鳴らした曲(bgmPreview。js/debug.js)
function bgmTrackForScreen() {
  if (screenMode === "town") return "town";
  if (screenMode === "camp" || screenMode === "route") return "rest";
  if (screenMode === "result" || screenMode === "refine") return "requiem";
  if (screenMode === "soundtest") return bgmPreview;
  if (inRunScreen()) return bgmBossChasing() ? "boss" : layerOf(depth).bgm;
  return null;
}

// ボスの曲にする敵か(BALANCE.bgmBossIds・bgmBossClans)
function isBgmBoss(m) {
  if (BALANCE.bgmBossIds.includes(m.data.id)) return true;
  return [].concat(m.data.clan || []).some(c => BALANCE.bgmBossClans.includes(c)); // clan は1つ(文字)のことも、いくつか(並び)のこともある
}

// ボスの曲にする敵が、こちらに気づいて追いかけているか(襲ってこない龍は、怒らせるまで数えない)
function bgmBossChasing() {
  return monsters.some(m => m.hp > 0 && m.hunting && !m.calm && isBgmBoss(m));
}

// 今の画面に合わせて、曲を始める・切りかえる・止める(画面を描くたびに呼ぶ。js/screens.js の render)
function updateBGM() {
  if (!bgmUnlocked) return;
  const want = bgmEnabled() && bgmVolumeGain() > 0 ? bgmTrackForScreen() : null;
  if (want === bgmTrack) return;
  stopBGM();
  if (want) startBGM(want);
}

// 曲を始める(じわっと大きくなる)
function startBGM(name) {
  if (!BGM_TRACKS[name]) return;
  try {
    const ctx = seReady(); // 効果音と同じ音の仕組みを使う(js/sound.js)
    if (!ctx) return;
    bgmGain = ctx.createGain();
    bgmGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    bgmGain.gain.exponentialRampToValueAtTime(bgmVolumeGain(), ctx.currentTime + BALANCE.bgmFadeSec);
    bgmGain.connect(ctx.destination);
    bgmTrack = name;
    bgmStep = 0;
    bgmNextTime = ctx.currentTime + 0.1;
    bgmSchedule();
    bgmTimer = setInterval(bgmSchedule, BALANCE.bgmTickMs);
  } catch (e) {
    // 音が出せなくても、ゲームは止めない
  }
}

// 曲を止める(じわっと小さくなって消える)
function stopBGM() {
  if (bgmTimer) clearInterval(bgmTimer);
  bgmTimer = null;
  bgmTrack = null;
  if (!bgmGain || !seContext) return;
  const gain = bgmGain;
  bgmGain = null;
  try {
    const t = seContext.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + BALANCE.bgmFadeSec);
    setTimeout(() => gain.disconnect(), BALANCE.bgmFadeSec * 1000 + 200);
  } catch (e) {
    // 音が出せなくても、ゲームは止めない
  }
}

// 楽譜(文字)を、パートごとの「マスの並び」にする。マス1つ = その時に鳴らす音の高さ(Hz)の並び(休みは空)
//   「.*15」「D2*4」のように * の後ろに数があれば、そのマスを数の分くり返す
function bgmParse(name) {
  if (!bgmParsed[name]) {
    bgmParsed[name] = BGM_TRACKS[name].voices.map(v =>
      v.notes.split(/\s+/).filter(s => s && s !== "|").flatMap(word => {
        const [cell, times] = word.split("*");
        const notes = cell === "." ? [] : cell.split("+").map(bgmNoteFreq);
        return Array(times ? Number(times) : 1).fill(notes);
      }));
  }
  return bgmParsed[name];
}

// 音の名前(C4・G#3 など)→ 音の高さ(Hz)。A4 = 440Hz(雑音の「x」は高さがないので 0)
function bgmNoteFreq(note) {
  if (note === "x") return 0;
  const m = note.match(/^([A-G])(#?)(\d)$/);
  if (!m) return 440;
  const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + semi; // ピアノの鍵盤の番号のようなもの(A4 が 69)
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// bgmLookaheadSec 秒先までのマスを予約する(bgmTickMs ごとに呼ばれる)
function bgmSchedule() {
  const track = BGM_TRACKS[bgmTrack];
  if (!track || !bgmGain || !seContext) return;
  try {
    const ctx = seContext;
    const stepSec = 60 / track.bpm / 2; // 1マス = 半拍
    // 裏に回っていてタイマーが遅れたときは、今から鳴らし直す(遅れた音をまとめて鳴らさないように)
    if (bgmNextTime < ctx.currentTime) bgmNextTime = ctx.currentTime + 0.05;
    const parts = bgmParse(bgmTrack);
    while (bgmNextTime < ctx.currentTime + BALANCE.bgmLookaheadSec) {
      track.voices.forEach((v, i) => {
        const cells = parts[i];
        cells[bgmStep % cells.length].forEach(freq => playBGMNote(ctx, v, freq, bgmNextTime, v.len * stepSec));
      });
      bgmStep++;
      bgmNextTime += stepSec;
    }
  } catch (e) {
    // 音が出せなくても、ゲームは止めない
  }
}

// 音を1つ予約する。v:パート(BGM_TRACKS の voices の1つ)/ start:鳴らす時刻 / dur:鳴らす秒数
function playBGMNote(ctx, v, freq, start, dur) {
  const end = start + dur;
  let osc;
  if (v.wave === "noise") {
    osc = ctx.createBufferSource();
    osc.buffer = seNoiseBuffer; // 効果音の雑音の元を使い回す(js/sound.js)
    osc.loop = true;            // 雑音の元(0.5秒)より長く鳴らすときは、くり返す
  } else {
    osc = ctx.createOscillator();
    osc.type = v.wave;
    osc.frequency.setValueAtTime(freq, start);
  }
  // 大きさ:atk 秒かけてふくらみ、だんだん小さくなって消える
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(v.vol, start + (v.atk || 0.01));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  if (v.lp) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = v.lp;
    osc.connect(filter);
    filter.connect(gain);
  } else {
    osc.connect(gain);
  }
  gain.connect(bgmGain);
  osc.start(start);
  osc.stop(end + 0.05);
}

// ==================== 設定(拠点の設定画面から呼ぶ) ====================
function toggleBGM() {
  base.settings.bgm = !bgmEnabled();
  saveGame();
  updateBGM();
}

// 音量を変えたら、流れている曲にもすぐ反映する(0 にしたら止まり、0 から上げたら始まる)
function applyBGMVolume() {
  if (bgmGain && seContext && bgmVolumeGain() > 0) {
    bgmGain.gain.cancelScheduledValues(seContext.currentTime);
    bgmGain.gain.setValueAtTime(bgmVolumeGain(), seContext.currentTime);
  }
  saveGame();
  updateBGM();
}

// 音量を変える。d:+1 なら上げる / -1 なら下げる(端まで行ったら止まる)
function changeBGMVolume(d) {
  const v = base.settings.bgmVolume ?? BALANCE.bgmVolumeDefault;
  base.settings.bgmVolume = Math.max(0, Math.min(100, v + d * BALANCE.bgmVolumeStep));
  applyBGMVolume();
}

// 音量を1段上げる。100 の次は 0 に戻る(Enter で変えるとき。←→ がないスマホでも変えられるように)
function cycleBGMVolume() {
  const v = base.settings.bgmVolume ?? BALANCE.bgmVolumeDefault;
  base.settings.bgmVolume = v >= 100 ? 0 : Math.min(100, v + BALANCE.bgmVolumeStep);
  applyBGMVolume();
}
