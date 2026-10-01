// ゲーム全体の状態(base など)・データファイルの読み込みとチェック・セーブ
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== ゲーム全体の状態 ====================
// "dungeon"(ダンジョン) / "inventory"(持ち物) / "route"(階段の道を選ぶ) / "camp"(キャンプ) / "result"(リザルト) / "refine"(刻む) / "town"(拠点)
let screenMode = "dungeon";

let map = [];
let px = 0, py = 0;
let monsters = [];
let items = [];
let stairs = null;
let depth = 1;
let turn = 0;              // 経過ターン数(ログの色分けに使う)

let maxHP, playerHP, potions;
// 装備中の装備。枠の名前(head, ring1 など)→ 装備(何も着けていない枠は入っていない)
// 装備1個の形:{ id: "leather_helm", name: "革の兜", slot: "head",
//               stats: { hp: 56, def: 28 }, rolls: { hp: 0.12, def: -0.07 } }
//   slot は装備の種類(ITEM_TYPES のどれか)。rolls は個体差(+0.12 なら基礎値より +12%)
let equipped = {};
let runPickups = [];       // この冒険中に拾った装備の一覧(持ち物。死亡時に刻む候補でもある)
let invTab = 0;            // 持ち物画面で開いているタブの番号(INV_TABS の何番目か)
let invCursor = 0;         // 持ち物画面で選んでいる行の番号(装備タブでは枠の番号)
let invPickSlot = null;    // 装備タブで、装備を選んでいる最中の枠の名前(選んでいないときは null)
let invPickCursor = 0;     // 装備を選ぶ一覧で選んでいる行の番号
let refineCursor = 0;      // 刻む画面で選んでいる行の番号
let refineTab = 0;         // 刻む画面で開いているタブの番号(REFINE_TABS の何番目か)
let refineType = null;     // 刻む画面の持ち物タブで選んでいる部位(ITEM_TYPES の id。部位の一覧のときは null)
let refineLeft = 0;        // 刻む画面で、あと何個刻めるか
let campCursor = 0;        // キャンプ画面で選んでいる行の番号
let townPage = "menu";     // 拠点で開いている画面(TOWN_MENU の id か "menu")
let townMenuCursor = 0;    // 拠点メニューで選んでいる行の番号
let townCursor = 0;        // 拠点の各画面の中で選んでいる行の番号(プレイヤー画面では装備枠)
let townPickSlot = null;   // 刻印を選んでいる最中の枠の名前(選んでいないときは null)
let townPickCursor = 0;    // 刻印選択の一覧で選んでいる行の番号
let playerTab = 0;         // プレイヤー画面で開いているタブの番号(PLAYER_TABS の何番目か)
let townPickBook = null;   // 書を選んでいる最中の書の枠の番号(0〜2。選んでいないときは null)
let townPickTool = null;   // 持ちこむ道具を選んでいる最中の枠の番号(選んでいないときは null)
let townAllocating = false; // スキルにポイントを振っている最中か
let dexTab = 0;            // 図鑑で開いているタブの番号(DEX_TABS の何番目か)
let helpTab = 0;           // 遊び方で開いているタブの番号(help.js の HELP_PAGES の何番目か)
let craftTab = 0;          // 制作で開いているタブの番号(CRAFT_TABS の何番目か)
let craftType = null;      // 制作(強化・合成)で選んでいる刻印の種類(ITEM_TYPES の id。選んでいないときは null)
let craftPickCursor = 0;   // 制作で、種類を選んだあとの刻印の一覧で選んでいる行の番号
let fuseFirst = null;      // 合成で、1個目に選んだ刻印(選んでいないときは null)

let logLines = [];         // ログの中身。1行の形:{ text: "文章", turn: 何ターン目か }

// 今回の冒険の記録(死んだときのリザルト画面に出す)
function newRunStats() {
  return {
    turns: 0,             // 行動した回数
    kills: {},            // 倒した敵。敵の id → 数
    xpGained: 0,          // もらった経験値
    startLevel: base.level,
    damageDealt: 0,       // 与えたダメージの合計
    damageTaken: 0,       // 受けたダメージの合計
    bestHit: 0,           // いちばん大きかった一撃
    bestHitCrit: false,   // その一撃が会心だったか
    books: [],            // 手に入れた書の名前
    killedBy: null,       // 死因(倒された敵の名前)
    gutsUsed: false,      // 特性「食いしばり」をこの冒険で使ったか
    elitesKilled: 0,      // 倒したエリートの数(刻める数が増える)
    resources: {},        // 手に入れた素材。系統 → 数
  };
}
let runStats = null;       // 冒険を始めたときに newRunStats() で作る
let lastRunResult = null;  // リザルト画面に出す内容(死んだときに作る)

let equipmentList = [];    // equipment.js の装備のうち、正しく書けているもの(起動時にチェック)
let monsterList = [];      // monsters.js の敵のうち、正しく書けているもの(起動時にチェック)
let bookList = [];         // books.js の書のうち、正しく書けているもの(起動時にチェック)
let clanList = [];         // sets.js の一族のうち、正しく書けているもの(起動時にチェック)
let EFFECTS = {};          // effects.js の効果。id → 効果(kind:"bless" 良い効果 / "curse" 呪い)

// 拠点の永続データ(死んでも消えない。セーブされるのはここだけ)
//   newBase() は「はじめから」の状態を作る。セーブデータを消したときにも使う
function newBase() {
  return {
    // 刻印のストック。刻むたびに1個ずつ増えるアイテムの一覧
    // 1個の形:{ slot: "head", stats: { hp: 11, def: 6 }, effects: [], plus: 0, fused: false, purified: false }
    //   slot:どの種類の装備用か / stats:性能 / plus:強化値(+0〜+15) / fused:合成してできたものか(もう合成できない)
    //   effects:呪われた装備から引き継いだ効果 / purified:浄化して呪いを消したものか
    //   指輪・イヤリングの刻印は、1・2 どちらの枠にも使える
    materials: [],
    // 持ち帰った素材。系統(RESOURCE_TYPES)→ 数
    resources: { bone: 0, hide: 0, ore: 0, plant: 0, holy: 0 },
    // 各枠にセットしている刻印。枠の名前(head, ring1 など)→ materials の中の1個(なければ入っていない)
    //   その枠に装備を着けているときだけ、刻印の性能が足される
    materialSet: {},
    // まだ振っていないスキルポイント(Lv1 の分として、はじめから少し持っている)
    skillPoints: randInt(BALANCE.skillPointGainMin, BALANCE.skillPointGainMax),
    // 持っている書。書の id → 冊数
    books: {},
    // セットしている書(BALANCE.bookSlots 個の枠)。書の id か null
    bookSet: Array(BALANCE.bookSlots).fill(null),
    // スキルに振ったポイント。書の id → ポイント(セットしている書の分だけ入っている)
    skillAlloc: {},
    // まだ見ていない新しい書。書の id → true
    bookNew: {},
    // 設定
    settings: {
      autoEquip: true, // 装備を拾ったとき、空いている枠があれば自動で装備する
      debug: false,           // デバッグモード(画面右にデバッグ用のボタンを出す)
      debugAlwaysDrop: false, // デバッグ:敵が必ず書と固有装備を落とす
      debugInvincible: false, // デバッグ:無敵(ダメージを受けない)
    },
    // 酒場の依頼の報酬で手に入るお金(死んでもなくならない)
    gold: 0,
    // 道具屋(js/shop.js)。built:建てたか / unlocked:納品して解放した品(品の id → true)
    shop: { built: false, unlocked: {} },
    // 鍛冶屋(js/smithy.js)。built:建てたか / level:腕前(0 なら1〜5階並み、1 なら6〜10階並み …)
    smithy: { built: false, level: 0 },
    // 鍛冶屋への注文(次の冒険の最初から着けている装備)。枠の名前(head, ring1 など)→ { level: 注文したときの腕前 }
    smithOrders: {},
    // 道具の在庫(道具屋で買ったもの)。道具の id → 数(死んでもなくならない)
    toolStock: {},
    // 次の冒険に持ちこむ道具の枠(carrySlots 個)。1枠の形:{ id: 道具の id, count: 数 } か null
    //   プレイヤー画面の「道具」タブで、在庫からセットする。潜るときに持っていき、在庫から同じ道具を補充する
    carry: Array(BALANCE.carrySlots).fill(null),
    // 酒場の依頼(js/quests.js)。board:掲示板の普通の依頼(null なら次に拠点に戻ったとき作る)/ special:特殊依頼(なければ null)
    //   accepted:受けている依頼(普通は questMaxAccepted 個まで + 特殊依頼1つ。次の冒険のあいだだけ有効)
    quests: { board: null, special: null, accepted: [] },
    // 前回死んだときの墓(いちばん最近のもの1つだけ。なければ null)
    //   { depth: 死んだ階, killerId: 倒した敵の id, killerName: 死因, level, kills: 倒した数, turns, runNo: 何回目の冒険か,
    //     relic: 遺品(着けていた装備から1つ。なければ null), relicTaken: 遺品を持ち帰ったか }
    grave: null,
    // レベルと経験値も冒険をまたいで引き継ぐ
    level: 1,
    xp: 0,
    // これまでの記録(図鑑などにも使う)
    records: {
      runs: 0,        // 冒険した回数
      bestDepth: 0,   // 最高到達階
      totalKills: 0,  // 倒した敵の合計
      kills: {},      // 敵の id → 倒した数
      bestHit: 0,     // いちばん大きかった一撃
      clears: 0,      // 踏破した回数(goalDepth 階の階段を降りた回数)
      // 図鑑用
      seen: {},       // 出会った敵。敵の id → true
      equipFound: {}, // 拾ったことのある装備。装備の id → 拾った回数
      booksFound: {}, // 手に入れたことのある書。書の id → true
    },
  };
}
let base = newBase();

// ==================== データ読み込み ====================
// data/ の中のファイル(effects.js・monsters.js・equipment.js・books.js)の書き間違いをチェックし、正しいものだけを使う。見つけた間違いの一覧を返す
function loadGameData() {
  const warnings = [];

  // 効果(良い効果と呪い)。装備の effects のチェックに使うので、先に読む
  EFFECTS = {};
  const addEffects = (list, kind, file) => {
    for (const e of list) {
      if (EFFECTS[e.id]) {
        warnings.push(`⚠ ${file}:「${e.name}」の id「${e.id}」はほかの効果と同じです`);
        continue;
      }
      if (e.stat && !STAT_NAMES[e.stat]) {
        warnings.push(`⚠ ${file}:「${e.name}」の stat「${e.stat}」というステータスはありません`);
        continue;
      }
      EFFECTS[e.id] = { ...e, kind };
    }
  };
  addEffects(BLESSING_DATA, "bless", "effects.js");
  addEffects(CURSE_DATA, "curse", "effects.js");

  // 一族(敵の clan のチェックに使うので、敵より先に読む)
  clanList = [];
  for (const c of CLAN_DATA) {
    if (clanList.some(x => x.id === c.id)) {
      warnings.push(`⚠ sets.js:「${c.name}」の id「${c.id}」はほかの一族と同じです`);
      continue;
    }
    const badStat = (c.sets || []).flatMap(s => Object.keys(s.stats || {})).find(key => !STAT_NAMES[key]);
    if (badStat) {
      warnings.push(`⚠ sets.js:「${c.name}」のセット効果の「${badStat}」というステータスはありません`);
      continue;
    }
    // damageCut の種類・属性が elements.js にあるか
    const badCut = (c.sets || []).flatMap(s => s.damageCut || [])
      .find(cut => (cut.category && !DAMAGE_CATEGORIES[cut.category]) || (cut.element && !ELEMENT_DATA[cut.element]));
    if (badCut) {
      warnings.push(`⚠ sets.js:「${c.name}」の damageCut の「${badCut.category || badCut.element}」という種類・属性はありません(elements.js を見てください)`);
      continue;
    }
    clanList.push(c);
  }

  monsterList = [];
  for (const m of MONSTER_DATA) {
    if (typeof m.symbol !== "string" || m.symbol.length !== 1) {
      warnings.push(`⚠ monsters.js:「${m.name}」の symbol は1文字にしてください`);
      continue;
    }
    if (!(m.speed > 0)) {
      warnings.push(`⚠ monsters.js:「${m.name}」の speed は 0 より大きい数にしてください`);
      continue;
    }
    if (m.material && !RESOURCE_TYPES[m.material]) {
      warnings.push(`⚠ monsters.js:「${m.name}」の material「${m.material}」という素材はありません`);
      continue;
    }
    if (m.clan && !clanList.some(c => c.id === m.clan)) {
      warnings.push(`⚠ monsters.js:「${m.name}」の clan「${m.clan}」という一族はありません(sets.js の id を書いてください)`);
      continue;
    }
    if (m.ability && !MONSTER_ABILITIES[m.ability.type]) {
      warnings.push(`⚠ monsters.js:「${m.name}」の ability「${m.ability.type}」という動きはありません`);
      continue;
    }
    if (m.ability && m.ability.element && !ELEMENT_DATA[m.ability.element]) {
      warnings.push(`⚠ monsters.js:「${m.name}」の element「${m.ability.element}」という属性はありません(elements.js の id を書いてください)`);
      continue;
    }
    monsterList.push(m);
  }

  // 呼び出す敵(summonId)・連れてくる手下(escortFrom)が monsters.js にいるか(敵を全部読んでから調べる)
  for (const m of monsterList) {
    const ab = m.ability || {};
    const bad = [ab.summonId, ...(ab.escortFrom || [])].filter(id => id).find(id => !monsterList.some(x => x.id === id));
    if (bad) warnings.push(`⚠ monsters.js:「${m.name}」の呼び出し・手下の「${bad}」という敵はいません`);
  }

  equipmentList = [];
  for (const e of EQUIPMENT_DATA) {
    if (!ITEM_TYPES[e.slot]) {
      warnings.push(`⚠ equipment.js:「${e.name}」の slot「${e.slot}」という種類はありません`);
      continue;
    }
    const badKey = Object.keys(e.stats).find(key => !STAT_NAMES[key]);
    if (badKey) {
      warnings.push(`⚠ equipment.js:「${e.name}」の「${badKey}」というステータスはありません`);
      continue;
    }
    if (e.from !== "field" && !monsterList.some(m => m.id === e.from)) {
      warnings.push(`⚠ equipment.js:「${e.name}」の from「${e.from}」という敵はいません(monsters.js の id を書いてください)`);
      continue;
    }
    if (e.block !== undefined && !(e.slot === "shield" && e.block > 0 && e.block < 100)) {
      warnings.push(`⚠ equipment.js:「${e.name}」の block は盾(slot: "shield")にだけ、1〜99 の数で書いてください`);
      continue;
    }
    const badFx = (e.effects || []).find(fx => !EFFECTS[fx.id]);
    if (badFx) {
      warnings.push(`⚠ equipment.js:「${e.name}」の effects「${badFx.id}」という効果はありません(effects.js の id を書いてください)`);
      continue;
    }
    equipmentList.push(e);
  }

  bookList = [];
  for (const b of BOOK_DATA) {
    if (!STAT_NAMES[b.stat]) {
      warnings.push(`⚠ books.js:「${b.name}」の stat「${b.stat}」というステータスはありません`);
      continue;
    }
    const badFrom = bookFrom(b).find(id => !monsterList.some(m => m.id === id));
    if (badFrom) {
      warnings.push(`⚠ books.js:「${b.name}」の from「${badFrom}」という敵はいません(monsters.js の id か null を書いてください)`);
      continue;
    }
    bookList.push(b);
  }
  return warnings;
}

// 書を落とす敵の id の一覧(from は1つでも、配列でも、null でも書ける)
function bookFrom(book) {
  if (book.from === null || book.from === undefined) return [];
  if (book.from === "all") return monsterList.map(m => m.id); // 全部の敵が落とす
  return Array.isArray(book.from) ? book.from : [book.from];
}

// list の中から、階層 d で出るもの(minDepth〜maxDepth)を、weight(出やすさ)に応じて1つ選ぶ
function pickWeighted(list, d) {
  const candidates = list.filter(e =>
    d >= e.minDepth && (e.maxDepth === null || d <= e.maxDepth));
  if (candidates.length === 0) return null;
  let total = 0;
  for (const e of candidates) total += e.weight;
  let r = Math.random() * total;
  for (const e of candidates) {
    r -= e.weight;
    if (r < 0) return e;
  }
  return candidates[candidates.length - 1];
}

// ==================== セーブ ====================
// 拠点のデータ(base)だけを、ブラウザの localStorage に保存する
//   ダンジョンの途中の状態は保存しない(ページを閉じたら、その冒険はなかったことになる)
//
// ★ base の形(持ち方)を変えたときは:
//   1. SAVE_VERSION を 1 増やす
//   2. SAVE_MIGRATIONS に「古い番号 → 1つ新しい形」に直す処理を足す
//   こうしておくと、古いセーブデータも壊れずに読み込める
const SAVE_KEY = "rog-save";
const SAVE_VERSION = 3;
const SAVE_MIGRATIONS = {
  // ver.1 → ver.2:経験値の増え方とスキルポイントのもらい方が変わった(書・スキルの追加)
  //   ・xpToNext(次のレベルまでの経験値)は、レベルから計算するようになったので消す
  //   ・スキルポイントは「1レベルごとに1」から「3レベルごとに6〜9」に変わったので、今のレベルに合わせてもらい直す
  //     (もらえる回数ぶん、ふつうのレベルアップと同じく 6〜9 ポイントずつ)
  1: (data) => {
    const b = data.base || {};
    delete b.xpToNext;
    const level = typeof b.level === "number" ? b.level : 1;
    const times = Math.floor((level - 1) / BALANCE.skillPointEveryLevels) + 1; // Lv1, 4, 7, … のうち、今のレベルまでに通った回数
    b.skillPoints = 0;
    for (let i = 0; i < times; i++) b.skillPoints += randInt(BALANCE.skillPointGainMin, BALANCE.skillPointGainMax);
    data.version = 2;
    return data;
  },
  // ver.2 → ver.3:INT(魔力)をなくして、LUK(運)に作り変えた
  //   ・刻印に付いている int を luk に名前を変える
  2: (data) => {
    for (const mat of (data.base && data.base.materials) || []) {
      if (mat && mat.stats && "int" in mat.stats) {
        mat.stats.luk = mat.stats.int;
        delete mat.stats.int;
      }
    }
    data.version = 3;
    return data;
  },
};

let lastSavedAt = null; // 最後にセーブした時刻(設定パネルに表示)

// セーブする中身(バージョン・日時・base)を作る
function makeSaveData() {
  // materialSet は刻印そのものではなく「materials の何番目か」で保存する
  const materialSet = {};
  for (const slot in base.materialSet) materialSet[slot] = base.materials.indexOf(base.materialSet[slot]);
  return { version: SAVE_VERSION, savedAt: new Date().toISOString(), base: { ...base, materialSet } };
}

function saveGame() {
  try {
    const data = makeSaveData();
    lastSavedAt = new Date(data.savedAt);
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    drawSettings();
  } catch (e) {
    console.warn("セーブできませんでした", e);
  }
}

// 念のため、セーブデータを別の名前で残しておく(壊れていたとき・古い形を直す前など)
//   保存する場所がいっぱいで残せなくても、ゲームは止めない(残せなかったことだけ、開発者向けの画面に出す)
function backupSave(name, text) {
  try {
    localStorage.setItem(name, text);
  } catch (e) {
    console.warn(`セーブデータの控え(${name})を残せませんでした`, e);
  }
}

// セーブデータを読み込んで base に入れる。ログに出すメッセージを返す
function loadGame() {
  let text;
  try {
    text = localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return "⚠ このブラウザではセーブが使えません(進行状況は保存されません)";
  }
  if (!text) return "はじめから始めます";

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    backupSave(`${SAVE_KEY}-broken`, text); // 壊れたデータは念のため別の名前で残す
    return "⚠ セーブデータが壊れていたので、はじめから始めます";
  }

  // 古いバージョンなら、1つずつ新しい形に直していく
  const migrated = data.version < SAVE_VERSION;
  if (migrated) backupSave(`${SAVE_KEY}-v${data.version}`, text); // 直す前のデータも念のため残す
  while (data.version < SAVE_VERSION && SAVE_MIGRATIONS[data.version]) {
    data = SAVE_MIGRATIONS[data.version](data);
  }
  if (data.version !== SAVE_VERSION) {
    backupSave(`${SAVE_KEY}-v${data.version}`, text); // 読めないデータも念のため残す
    return `⚠ セーブデータの形式(ver.${data.version})が読み込めないので、はじめから始めます`;
  }

  // 1つずつ中身を確かめながら取り込む(足りない項目は初期値のまま)
  const b = data.base || {};
  const fresh = newBase();
  const num = (v, def) => (typeof v === "number" && isFinite(v) ? v : def);
  base = fresh;
  base.level = num(b.level, fresh.level);
  base.xp = num(b.xp, fresh.xp);
  base.skillPoints = num(b.skillPoints, fresh.skillPoints);
  base.settings = { ...fresh.settings, ...(b.settings || {}) };
  // これまでの記録
  const rec = b.records || {};
  for (const key of ["runs", "bestDepth", "totalKills", "bestHit", "clears"]) base.records[key] = num(rec[key], 0);
  for (const id in (rec.kills || {})) base.records.kills[id] = num(rec.kills[id], 0);
  for (const id in (rec.seen || {})) base.records.seen[id] = true;
  for (const id in (rec.equipFound || {})) base.records.equipFound[id] = num(rec.equipFound[id], 0);
  for (const id in (rec.booksFound || {})) base.records.booksFound[id] = true;
  // 図鑑ができる前のセーブ:倒したことのある敵・持っている書は、図鑑に登録済みにする
  for (const id in base.records.kills) base.records.seen[id] = true;
  for (const id in (b.books || {})) base.records.booksFound[id] = true;
  // 書:books.js にある書だけ取り込む
  for (const id in (b.books || {})) {
    if (bookById(id) && b.books[id] > 0) base.books[id] = num(b.books[id], 0);
  }
  for (const id in (b.bookNew || {})) {
    if (base.books[id]) base.bookNew[id] = true;
  }
  // セットしている書:持っている書だけ、同じ書は1つの枠だけ
  (Array.isArray(b.bookSet) ? b.bookSet : []).slice(0, BALANCE.bookSlots).forEach((id, i) => {
    if (id && base.books[id] && !base.bookSet.includes(id)) base.bookSet[i] = id;
  });
  // 振ったポイント:セットしている書の分だけ。上限を超えていたら上限まで(超えた分は手元に戻す)
  for (const id of base.bookSet) {
    if (!id) continue;
    const book = bookById(id);
    const pts = Math.max(0, num((b.skillAlloc || {})[id], 0));
    base.skillAlloc[id] = Math.min(pts, book.maxPoints);
    base.skillPoints += pts - base.skillAlloc[id];
  }
  for (const id in RESOURCE_TYPES) base.resources[id] = Math.max(0, num((b.resources || {})[id], 0));
  base.materials = (Array.isArray(b.materials) ? b.materials : []).filter(mat =>
    mat && ITEM_TYPES[mat.slot] && mat.stats && Object.keys(mat.stats).every(key => STAT_NAMES[key]));
  // 強化値・合成の印(強化ができる前の刻印は +0・未合成)
  for (const mat of base.materials) {
    // 名前:名前ができる前の刻印には「胴の刻印」のような名前を補う
    if (typeof mat.name !== "string" || mat.name === "") mat.name = defaultMaterialName(mat.slot);
    // 元の装備の一覧:記録がない古い刻印は空(どの一族にも入らない)
    mat.sources = (Array.isArray(mat.sources) ? mat.sources : []).filter(id => typeof id === "string");
    mat.plus = Math.max(0, Math.min(BALANCE.enhanceMax, Math.floor(num(mat.plus, 0))));
    mat.fused = !!mat.fused;
    mat.purified = !!mat.purified;
    // 呪われた装備から引き継いだ効果:effects.js にある効果だけ
    mat.effects = (Array.isArray(mat.effects) ? mat.effects : [])
      .filter(fx => fx && EFFECTS[fx.id] && typeof fx.value === "number")
      .map(fx => ({ id: fx.id, value: fx.value }));
    // 強化に使った素材の合計(解体したときの価値)。記録がない古い刻印は、今の強化値から見積もる
    if (typeof mat.spent !== "number" || mat.spent < 0) {
      let spent = 0;
      for (let p = 0; p < mat.plus; p++) spent += BALANCE.enhanceCostBase + p * BALANCE.enhanceCostPerPlus;
      mat.spent = spent * (isSpecialMaterial(mat) ? BALANCE.specialEnhanceCostMultiplier : 1);
    }
  }
  for (const slot in (b.materialSet || {})) {
    const mat = b.materials && b.materials[b.materialSet[slot]];
    const i = base.materials.indexOf(mat);
    // 枠が存在して、種類が合っているものだけセットし直す
    if (EQUIP_SLOTS[slot] && i >= 0 && ITEM_TYPES[mat.slot].slots.includes(slot)) {
      base.materialSet[slot] = base.materials[i];
    }
  }
  // 墓:階が数字で、遺品がちゃんとした装備のときだけ(おかしければ遺品なし)
  const g = b.grave;
  if (g && typeof g.depth === "number" && g.depth >= 1) {
    const r = g.relic;
    const relicOk = r && ITEM_TYPES[r.slot] && r.stats && Object.keys(r.stats).every(k => STAT_NAMES[k]);
    base.grave = {
      depth: g.depth,
      killerId: monsterList.some(m => m.id === g.killerId) ? g.killerId : null,
      killerName: String(g.killerName || "何か"),
      level: num(g.level, 1), kills: num(g.kills, 0), turns: num(g.turns, 0), runNo: num(g.runNo, 0),
      // 遺品は強化前の性能(+0)に戻す(遺品が強化を持ち越していた頃のセーブも直す)
      relic: relicOk ? makeRelic({ ...r, effects: (r.effects || []).filter(fx => EFFECTS[fx.id]) }) : null,
      relicTaken: !!g.relicTaken,
    };
  }
  // 鍛冶屋と、注文(枠が存在するものだけ)
  const sm = b.smithy || {};
  base.smithy.built = !!sm.built;
  base.smithy.level = Math.max(0, Math.min(SMITH_LEVELS.length, Math.floor(num(sm.level, 0))));
  for (const slot in (b.smithOrders || {})) {
    if (EQUIP_SLOTS[slot]) base.smithOrders[slot] = { level: Math.max(0, Math.floor(num((b.smithOrders[slot] || {}).level, 0))) };
  }
  // 道具屋と、持ちこむ道具(道具が shop.js にあるものだけ)
  const sh = b.shop || {};
  base.shop.built = !!sh.built;
  for (const id in (sh.unlocked || {})) base.shop.unlocked[id] = true;
  for (const id in (b.toolStock || {})) {
    if (TOOL_DATA[id]) base.toolStock[id] = Math.max(0, Math.floor(num(b.toolStock[id], 0)));
  }
  const oldCarry = Array.isArray(b.carry) ? b.carry : [];
  base.carry = Array(BALANCE.carrySlots).fill(null).map((_, i) => {
    const c = oldCarry[i];
    return c && TOOL_DATA[c.id] && typeof c.count === "number" && c.count > 0 ? { id: c.id, count: c.count } : null;
  });
  // ゴールドと酒場の依頼(依頼の型が quests.js にあるものだけ)
  base.gold = Math.max(0, num(b.gold, 0));
  const qs = b.quests || {};
  const okQuest = q => q && typeof q === "object" && QUEST_TYPES[q.type] && typeof q.uid === "string";
  base.quests.board = Array.isArray(qs.board) ? qs.board.filter(okQuest) : null;
  base.quests.special = okQuest(qs.special) ? qs.special : null;
  base.quests.accepted = Array.isArray(qs.accepted) ? qs.accepted.filter(okQuest) : [];
  if (data.savedAt) lastSavedAt = new Date(data.savedAt);
  checkLevelUp(); // 経験値の計算方法が変わって、もうレベルが上がれる分たまっていたら上げる
  if (migrated) saveGame(); // 新しい形に直したら、すぐ保存しておく(次に読むとき直し直さないように)
  return `セーブデータを読み込みました(Lv.${base.level}、刻印 ${base.materials.length}個)`;
}

// ==================== セーブデータの書き出し・読み込み ====================
// ブラウザのセーブ(localStorage)は、ゲームを開いた場所ごとに別々になる
//   (ダブルクリックで開いたゲームと、GitHub Pages で開いたゲームは、セーブを共有しない)
//   なので、セーブデータをファイルにして持ち運べるようにする

// 今のセーブデータを .json ファイルとしてダウンロードする
function exportSave() {
  saveGame(); // 最新の状態にしてから
  const text = JSON.stringify(makeSaveData());
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const name = `epitaph-save-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // ダウンロードが始まってから片付ける
  addLog(`セーブデータを「${name}」として書き出した(ダウンロードフォルダに入っています)`);
}

// ファイルを選んでもらい、そのセーブデータを読み込む
function importSave() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importSaveText(String(reader.result));
    reader.readAsText(file);
  };
  input.click();
}

// 読み込んだファイルの中身(text)を確かめて、今のセーブデータと入れ替える
//   今のセーブデータは、念のため rog-save-before-import という名前で残しておく
function importSaveText(text) {
  let data = null;
  try { data = JSON.parse(text); } catch (e) { /* 下でまとめて調べる */ }
  if (!data || typeof data.version !== "number" || !data.base || typeof data.base !== "object") {
    addLog("⚠ このファイルは EPITAPH のセーブデータではないようです");
    render();
    return;
  }
  if (data.version > SAVE_VERSION) {
    addLog(`⚠ このセーブデータ(ver.${data.version})は、このゲームより新しい版で作られているので読み込めません`);
    render();
    return;
  }
  const level = typeof data.base.level === "number" ? data.base.level : "?";
  const when = data.savedAt ? new Date(data.savedAt).toLocaleString() : "日時不明";
  if (!confirm(`このセーブデータ(Lv.${level}、${when} にセーブ)を読み込みますか？\n今のセーブデータは上書きされます`)) return;
  try {
    const old = localStorage.getItem(SAVE_KEY);
    if (old) localStorage.setItem(`${SAVE_KEY}-before-import`, old);
    localStorage.setItem(SAVE_KEY, text);
  } catch (e) {
    addLog("⚠ このブラウザではセーブが使えないので、読み込めません");
    render();
    return;
  }
  addLog(loadGame());
  render();
}

// セーブデータを消して、はじめからにする
function deleteSave() {
  if (!confirm("セーブデータを消して、はじめからにしますか？(元に戻せません)")) return;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) { /* セーブが使えない環境なら何もしない */ }
  base = newBase();
  lastSavedAt = null;
  goToTown();
  clearLog();
  addLog("セーブデータを消しました。はじめからです");
  render();
}
