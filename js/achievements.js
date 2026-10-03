// 実績(称号):取れたかを調べる・数える記録・データのチェック(実績の中身は data/achievements.js)
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 数える記録 ====================
// 冒険の記録(runStats)は、冒険が終わったときに base.records にまとめて足す
// 冒険中も進み具合が分かるように、「これまでの記録 + 今の冒険の分」で数える
function runLive() {
  return !!runStats && inRunScreen();
}

// data/achievements.js の stat に書ける名前 → 今の数
//   ここに足せば、データの stat で使えるようになる
const ACHIEVEMENT_STATS = {
  depth:       () => Math.max(base.records.bestDepth, runLive() ? depth : 0),
  kills:       () => base.records.totalKills + (runLive() ? Object.values(runStats.kills).reduce((a, b) => a + b, 0) : 0),
  damageDealt: () => base.records.damageDealt + (runLive() ? runStats.damageDealt : 0),
  damageTaken: () => base.records.damageTaken + (runLive() ? runStats.damageTaken : 0),
  crits:       () => base.records.crits + (runLive() ? runStats.crits : 0),
  bestHit:     () => Math.max(base.records.bestHit, runLive() ? runStats.bestHit : 0),
  runs:        () => base.records.runs,
  clears:      () => base.records.clears,
  engraved:    () => base.records.engraved,
  maxPlus:     () => Math.max(0, ...base.materials.map(mat => mat.plus)),
};

// その敵(monsters.js の id)を倒した数
function killsOf(id) {
  return (base.records.kills[id] || 0) + (runLive() ? runStats.kills[id] || 0 : 0);
}

// その一族(sets.js の id)の敵を倒した数(2つの一族に入っている敵は、両方に数える)
function clanKills(clanId) {
  return monsterList.filter(m => monsterClans(m).some(c => c.id === clanId))
    .reduce((sum, m) => sum + killsOf(m.id), 0);
}

// ==================== 実績の判定 ====================
let achievementList = []; // achievements.js の実績のうち、正しく書けているもの(起動時にチェック)

// achievements.js の書き間違いをチェックして、正しいものだけ使う。見つけた間違いの一覧を返す(loadGameData から呼ぶ)
function loadAchievementData() {
  const warnings = [];
  achievementList = [];
  for (const a of ACHIEVEMENT_DATA) {
    if (achievementList.some(x => x.id === a.id)) {
      warnings.push(`⚠ achievements.js:「${a.name}」の id「${a.id}」はほかの実績と同じです`);
      continue;
    }
    if (!ACHIEVEMENT_TABS.some(t => t.id === a.tab)) {
      warnings.push(`⚠ achievements.js:「${a.name}」の tab「${a.tab}」というタブはありません`);
      continue;
    }
    if (typeof a.stat === "string" && !ACHIEVEMENT_STATS[a.stat]) {
      warnings.push(`⚠ achievements.js:「${a.name}」の stat「${a.stat}」という記録はありません`);
      continue;
    }
    if (!a.stat && typeof a.check !== "function") {
      warnings.push(`⚠ achievements.js:「${a.name}」に条件(stat と goal、または check)がありません`);
      continue;
    }
    achievementList.push(a);
  }
  return warnings;
}

// 数える実績の、今の数と目標の数({ now, goal })。数えない実績(check)・数えられなかったときは null
//   条件の書き間違いでエラーになっても、ゲームは止めない
function achievementProgress(a) {
  if (!a.stat) return null;
  try {
    const now = typeof a.stat === "function" ? a.stat() : ACHIEVEMENT_STATS[a.stat]();
    const goal = typeof a.goal === "function" ? a.goal() : a.goal;
    return typeof now === "number" && typeof goal === "number" ? { now, goal } : null;
  } catch (e) {
    console.warn(`実績「${a.name}」の数を数えられませんでした`, e);
    return null;
  }
}

// 条件を満たしているか
function achievementMet(a) {
  if (a.stat) {
    const p = achievementProgress(a);
    return !!p && p.goal > 0 && p.now >= p.goal;
  }
  try {
    return !!a.check();
  } catch (e) {
    console.warn(`実績「${a.name}」の条件を調べられませんでした`, e);
    return false;
  }
}

// まだ取っていない実績の条件を調べて、満たしていれば取る(キーを押すたび・冒険が終わったとき)
//   取った実績は base.achievements に「取った日」で残す
//   デバッグモードが効いているあいだは取れない(js/debug.js の debugOn。OFF に戻せばまた取れる)
//   セーブデータに書きかえた跡があるときも取れない(base.tampered。js/state.js の「セーブデータの形」)
function checkAchievements() {
  if (debugOn() || base.tampered) return;
  const got = [];
  for (const a of achievementList) {
    if (base.achievements[a.id] || !achievementMet(a)) continue;
    base.achievements[a.id] = new Date().toISOString().slice(0, 10); // 「2026-10-02」の形
    addLog(`★ 実績「${a.name}」を達成した！`);
    got.push(a.name);
  }
  if (got.length > 0) {
    saveGame();
    render(); // 拠点のメニューの「達成 〇/〇」も描き直す
    showAchievementToast(got); // 演出:画面の上から「実績解除！」の帯(js/screens.js)
  }
}

// 取った実績の数
function achievementCount() {
  return achievementList.filter(a => base.achievements[a.id]).length;
}
