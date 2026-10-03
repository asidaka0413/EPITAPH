// ==================== 実績データ ====================
// 拠点の「実績」に並ぶ実績(称号)。index.html から読み込まれる
// 取っても強さは変わらない(見た目だけ)。取った実績は、拠点の「実績」で眺められる
// ★ 実績を増やすときは、ACHIEVEMENT_DATA に1行足すだけ(プログラムを書き換えなくてよい)
//
//   id    :実績を区別するための名前(半角英数字。ほかと同じにしない。一度決めたら変えない=変えると取ったものが消える)
//   name  :称号(画面に出る名前)
//   desc  :取り方の説明
//   tab   :どのタブに並べるか(下の ACHIEVEMENT_TABS の id)
//   secret:(省略できる)true なら、取るまで名前と説明を「？？？」にする
//
//   取れる条件の書き方は2つ
//   ① 数を数える:stat と goal を書く。拠点の一覧に「37/100」のように進み具合が出る
//        stat:数える記録の名前(下の一覧から選ぶ) / goal:目標の数
//        例:{ ..., stat: "kills", goal: 100 }  … 合計100体倒したら
//
//        stat に使える名前(冒険中の分も、その場で数える)
//          depth       … いちばん深く潜った階
//          kills       … 倒した敵の合計
//          damageDealt … 与えたダメージの合計
//          damageTaken … 受けたダメージの合計
//          crits       … 会心の一撃の回数
//          bestHit     … いちばん大きかった一撃
//          runs        … 冒険した回数(冒険が終わったときに増える)
//          clears      … 踏破した回数
//          engraved    … 刻んだ回数(刻印を手に入れた回数)
//          maxPlus     … いちばん強化した刻印の強化値(+15 なら 15)
//
//        敵の種類・一族で数えるときは、stat に関数を書く
//          stat: () => killsOf("drake")      … ドレイクを倒した数(monsters.js の id)
//          stat: () => clanKills("undead")   … 不死の一族を倒した数(sets.js の id)
//        goal も関数にできる(数がデータで変わるとき)
//          goal: () => monsterList.length    … 敵の数(図鑑の敵を全部、など)
//
//   ② それ以外:check に「条件」を書く。true になったら取れる(進み具合は出ない)
//        例:check: () => runStats.turns >= 10000
//        冒険中かどうかは inRunScreen()(true なら冒険中)、今の階は depth、今の冒険の記録は runStats で分かる
//
//   条件は、キーを押すたび(と、冒険が終わったとき)に調べる。数値はすべて仮

// 実績のタブ(拠点の「実績」画面の上に並ぶ)
const ACHIEVEMENT_TABS = [
  { id: "depth",   name: "深さ" },
  { id: "hunt",    name: "討伐" },
  { id: "battle",  name: "戦い" },
  { id: "collect", name: "収集" },
  { id: "secret",  name: "ひみつ" },
];

const ACHIEVEMENT_DATA = [
  // ---------- 深さ ----------(中層・深層は、作ったときに足す)
  { id: "depth5",  name: "はじめの一歩", desc: "地下5階に着く",  tab: "depth", stat: "depth", goal: 5 },
  { id: "depth10", name: "暗がりの先へ", desc: "地下10階に着く", tab: "depth", stat: "depth", goal: 10 },
  { id: "depth25", name: "地底の旅人",   desc: "地下25階に着く", tab: "depth", stat: "depth", goal: 25 },
  { id: "depth50", name: "低層踏破",     desc: "地下50階に着く", tab: "depth", stat: "depth", goal: 50 },

  // ---------- 討伐 ----------
  { id: "kills100",   name: "狩人",     desc: "敵を合計100体倒す",   tab: "hunt", stat: "kills", goal: 100 },
  { id: "kills1000",  name: "歴戦",     desc: "敵を合計1000体倒す",  tab: "hunt", stat: "kills", goal: 1000 },
  { id: "kills10000", name: "千の屍",   desc: "敵を合計10000体倒す", tab: "hunt", stat: "kills", goal: 10000 },
  // 一族ごと
  { id: "clanGoblins",  name: "小鬼退治",     desc: "ゴブリン一族を100体倒す", tab: "hunt", stat: () => clanKills("goblins"),  goal: 100 },
  { id: "clanBeasts",   name: "獣狩り",       desc: "獣の一族を100体倒す",     tab: "hunt", stat: () => clanKills("beasts"),   goal: 100 },
  { id: "clanUndead",   name: "鎮魂の手",     desc: "不死の一族を100体倒す",   tab: "hunt", stat: () => clanKills("undead"),   goal: 100 },
  { id: "clanHeavy",    name: "鎧砕き",       desc: "重装の一族を100体倒す",   tab: "hunt", stat: () => clanKills("heavy"),    goal: 100 },
  { id: "clanDragons",  name: "竜狩り",       desc: "竜の一族を100体倒す",     tab: "hunt", stat: () => clanKills("dragons"),  goal: 100 },
  { id: "clanOutcasts", name: "はぐれ者狩り", desc: "はぐれ者の一族を100体倒す", tab: "hunt", stat: () => clanKills("outcasts"), goal: 100 },
  // 強い敵
  { id: "killVampire", name: "夜明けをもたらす者", desc: "吸血鬼を倒す", tab: "hunt", stat: () => killsOf("vampire"), goal: 1 },
  { id: "killDrake",   name: "竜殺し",             desc: "ドレイクを倒す", tab: "hunt", stat: () => killsOf("drake"), goal: 1 },

  // ---------- 戦い ----------
  { id: "hit100",      name: "重い一撃", desc: "一撃で100ダメージを与える",  tab: "battle", stat: "bestHit", goal: 100 },
  { id: "hit1000",     name: "破壊者",   desc: "一撃で1000ダメージを与える", tab: "battle", stat: "bestHit", goal: 1000 },
  { id: "dealt100k",   name: "積み重ね", desc: "与えたダメージが合計10万",   tab: "battle", stat: "damageDealt", goal: 100000 },
  { id: "dealt1m",     name: "百万の刃", desc: "与えたダメージが合計100万",  tab: "battle", stat: "damageDealt", goal: 1000000 },
  { id: "taken10k",    name: "傷だらけ", desc: "受けたダメージが合計1万",    tab: "battle", stat: "damageTaken", goal: 10000 },
  { id: "taken100k",   name: "不屈",     desc: "受けたダメージが合計10万",   tab: "battle", stat: "damageTaken", goal: 100000 },
  { id: "crits100",    name: "急所狙い", desc: "会心の一撃を100回出す",      tab: "battle", stat: "crits", goal: 100 },
  { id: "crits1000",   name: "必殺の目", desc: "会心の一撃を1000回出す",     tab: "battle", stat: "crits", goal: 1000 },

  // ---------- 収集 ----------
  { id: "dexMonster",  name: "図鑑の虫",       desc: "図鑑の敵を全部埋める",   tab: "collect", stat: () => dexCount("monster"), goal: () => dexEntries("monster").length },
  { id: "dexBook",     name: "書の守り人",     desc: "図鑑の書を全部埋める",   tab: "collect", stat: () => dexCount("book"),    goal: () => dexEntries("book").length },
  { id: "engraved50",  name: "刻む者",         desc: "刻印を50個刻む",          tab: "collect", stat: "engraved", goal: 50 },
  { id: "plus15",      name: "鍛え抜かれた刻印", desc: "刻印を+15まで強化する",  tab: "collect", stat: "maxPlus", goal: 15 },
  { id: "shadowRobe",  name: "影をまとう者",   desc: "隠し装備「影の衣」を拾う", tab: "collect", secret: true, check: () => !!base.records.equipFound.shadow_robe },
  { id: "gemCarapace", name: "宝石の目利き", desc: "隠し装備「宝石虫の甲殻」を拾う", tab: "collect", secret: true, check: () => !!base.records.equipFound.gem_carapace },
  { id: "pixieWing",   name: "妖精の友",     desc: "隠し装備「妖精の羽飾り」を拾う", tab: "collect", secret: true, check: () => !!base.records.equipFound.pixie_wing },

  // ---------- ひみつ(変わった遊び方。取るまで名前も条件も分からない) ----------
  { id: "earlyGrave", name: "早すぎた墓", desc: "地下1階で冒険を終える", tab: "secret", secret: true,
    check: () => !!lastRunResult && !lastRunResult.cleared && lastRunResult.depth === 1 },
  { id: "naked10",    name: "裸一貫",     desc: "何も装備せずに地下10階に着く", tab: "secret", secret: true,
    check: () => inRunScreen() && depth >= 10 && Object.keys(equipped).length === 0 },
  { id: "longRun",    name: "長い冒険",   desc: "1回の冒険で10000ターン動く", tab: "secret", secret: true,
    check: () => inRunScreen() && runStats.turns >= 10000 },
  { id: "untouched5", name: "かすり傷ひとつなく", desc: "1度もダメージを受けずに地下5階に着く", tab: "secret", secret: true,
    check: () => inRunScreen() && depth >= 5 && runStats.damageTaken === 0 },
];
