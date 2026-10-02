// ==================== 敵データ ====================
// 敵の種類をここに並べる。index.html から読み込まれる
// 新しい敵を増やしたいときは、{ ... }, のかたまりをコピーして書き換えればOK
//
//   id          :敵を区別するための名前(半角英数字。equipment.js・books.js の from でも使う)
//   name        :画面に出る名前
//   symbol      :マップ上の記号(1文字)
//   color       :マップ上の色(CSS の色。"#ff5555" など)。一族(clan)がある敵は、sets.js の一族の色が使われる
//   hp          :地下1階でのHP
//   hpPerDepth  :1階深くなるごとに増えるHP
//   attackMin / attackMax :地下1階での攻撃力の範囲(この間のランダム)
//   attackPerDepth :1階深くなるごとに増える攻撃力
//   speed       :速さ。1 が普通、2 なら1ターンに2回動く、0.5 なら2ターンに1回だけ動く
//   xp          :地下1階で倒したときにもらえる経験値
//   xpPerDepth  :1階深くなるごとに増える経験値
//   dropChance  :倒したときに固有装備を落とす確率(0.05 なら 5%)
//                 何を落とすかは equipment.js で from にこの敵の id を書いた装備から選ばれる
//   bookDropChance :倒したときに書を落とす確率
//                 何を落とすかは books.js で from にこの敵の id を書いた書から選ばれる
//   material    :倒したときに落とす素材の系統("bone" 骨 / "hide" 皮 / "ore" 鉱石 / "plant" 植物)
//   materialAmount :1体で落とす素材の数(エリートはこの10倍)
//   ability     :特殊な動き(省略すると「近づいて殴る」だけ)。type で種類を決める
//                 { type: "ranged", range: 5 }     … 縦か横にまっすぐ並ぶと、射程内なら矢を撃つ
//                                                     shot: "毒針" と書くと、矢の代わりにその名前で出る
//                 { type: "poison", damage: 8, damagePerDepth: 1, turns: 10 }
//                                                  … 攻撃が当たると毒にする(毎ターン damage、turns ターン続く)
//                 { type: "steal", fleeTurns: 8 }  … 攻撃が当たると回復薬を1個盗んで逃げる(倒すと取り返せる)
//                                                     fleeTurns 回動いたら逃げるのをやめて戻ってくる(もう盗まない)
//                 { type: "stealTool", fleeTurns: 10 } … 攻撃が当たると、持ちこんだ道具(宝の地図もふくむ)を1つ盗んで逃げる(盗賊頭)
//                                                     逃げ方・戻り方は steal と同じ。倒すと取り返せる
//                 { type: "fire", range: 7, cooldown: 4, turns: 5 }
//                                                  … 射程内にいると、追いかけてくる炎を放つ(炎は turns ターン残る。
//                                                     炎のダメージはこの敵の攻撃力。cooldown ターンに1回)
//                 { type: "explode", damageMin: 70, damageMax: 100 }
//                                                  … 隣に来ると膨らみ、次の行動で爆発する(深い階ほど attackPerDepth ぶん強い)
//                 { type: "erratic", chance: 0.5 } … chance の確率で、ふらふらと適当な方向に動く
//                 { type: "alarm", radius: 20 }    … プレイヤーを見つけると一度だけ角笛を吹き、radius マス以内の敵を全員呼び寄せる
//                                                     sound: "叫び声をあげて" と書くと、角笛の代わりにそれで呼ぶ(「〜て」で終わるように書く)
//                                                     ゴブリン一族のセット効果で防げるのは、ゴブリン一族の角笛だけ
//                 { type: "split" }                … 攻撃されて生き残ると、HPを半分ずつに分けて2体に分裂する(1回だけ)
//                 { type: "armored", cut: 0.5 }    … 普通の攻撃のダメージを cut だけ減らす(会心は減らせない)
//                 { type: "regen", rate: 0.05 }    … 毎ターン、最大HPの rate ぶん回復する(毒のあいだは回復しない)
//                 { type: "weaken", turns: 8, atkCut: 0.3 }
//                                                  … 攻撃が当たると「衰弱」にする(turns ターン、ATK が atkCut ぶん下がる)
//                 { type: "slow", turns: 6, aglCut: 0.4 }
//                                                  … 攻撃が当たると「鈍足」にする(turns ターン、回避率が aglCut ぶん下がる)
//                 { type: "drain", rate: 1 }       … 攻撃が当たると、与えたダメージ × rate だけ自分が回復する
//                 { type: "burn", damage: 6, damagePerDepth: 0.4, turns: 4 }
//                                                  … 攻撃が当たると「やけど」にする(毒と同じく毎ターン damage。回復薬・キャンプで治る)
//                 { type: "dragon", element: "fire", ballCooldown: 4, breathRange: 5, breathCooldown: 8, breathChance: 0.3,
//                   breathPower: 2, dot: { damage: 10, damagePerDepth: 0.6, turns: 3 } }
//                                                  … ドラゴン。となりなら「ひっかき」。縦か横にまっすぐ並ぶと属性の球を飛ばす(ballCooldown 回の行動に1回)
//                                                     ときどき(breathChance)前方 breathRange マスの扇形にブレスを溜めて、次の行動で吐く
//                                                     ブレスの威力は攻撃力 × breathPower(口から遠いほど弱い)。breathCooldown 回の行動に1回まで
//                                                     element は elements.js の属性。球・ブレスが当たると、その属性の状態異常(dot)が付く
//                                                     (ドラゴンゾンビだけ、さらに書き足している)
//                                                     absorb: { id: "ghoul", radius: 4, below: 0.7, healRate: 0.15, cooldown: 5 }
//                                                       … HP が最大の below 未満なら、周り radius マスの id の敵を1体吸いこんで、最大HPの healRate 回復(cooldown 回の行動に1回)
//                                                     deathBlast: { damageMin: 150, damageMax: 200, radius: 1, delay: 1, poolRadius: 2, poolTurns: 10 }
//                                                       … 倒されると、プレイヤーが delay 回動いたあとに死骸が爆発(周り radius マス。範囲が赤く光る)
//                                                         そのあと周り poolRadius マスに、poolTurns ターンで消える毒沼が広がる(delay: 0 ならすぐ爆発)
//                 { type: "command", radius: 5, atkUp: 0.3, escorts: 2, escortFrom: ["goblin", "archer"] }
//                                                  … 周り radius マス以内の、同じ一族の敵の攻撃力を atkUp ぶん上げる
//                                                     部屋に出るとき、escortFrom の敵から escorts 体の手下を連れてくる
//                 { type: "summon", summonId: "skeleton", cooldown: 5, maxAlive: 2, maxTotal: 4 }
//                                                  … cooldown 回の行動に1回、summonId の敵をとなりに呼び出す(同時に maxAlive 体、合計 maxTotal 体まで)
//                                                     呼ばれた敵は経験値・固有装備・書を落とさず、素材だけ落とす。呼んだ敵を倒すと崩れ落ちる(素材もなし)
//                 { type: "reach", range: 2 }      … 縦か横にまっすぐ range マス先まで、その場から突いてくる(間に壁・敵がいれば突けない)
//                                                     shot: "大鎌" と書くと、槍の代わりにその名前で出る
//                 { type: "sweep", chance: 0.35, cooldown: 4, sweepPower: 1.5, spinPower: 1.3 }
//                                                  … となり(ななめもふくむ)にいると、chance の確率で構えて、次の行動で大技を放つ(範囲が赤く光る。かわせない)
//                                                     薙ぎ払い:前の3マスに攻撃力 × sweepPower / 回転切り:周り8マスに攻撃力 × spinPower
//                                                     cooldown 回の行動に1回まで
//                 { type: "rush", range: 6, chance: 0.4, cooldown: 4, rushPower: 1.8, stunTurns: 2 }
//                                                  … 縦か横にまっすぐ並び、2〜range マス離れていると、chance の確率で溜めて、次の行動で一直線に突進する
//                                                     (通る線が赤く光る。かわせない)。当たると攻撃力 × rushPower。外れると stunTurns 回動けない
//                                                     cooldown 回の行動に1回まで
//                 { type: "mimic" }              … 宝箱に化けている(ミミック専用。出し方は js/treasure.js の「宝箱」)
//                 { type: "blind", turns: 8, erratic: 0.4 }
//                                                  … 攻撃が当たると「盲目」にする(turns ターン、周りしか見えない。回復薬・キャンプで治る)
//                                                     erratic を書くと、その確率でふらふらと適当な方向に飛ぶ(コウモリと同じ)
//   pack        :(省略できる)群れで出る数 [最小, 最大]。例:pack: [2, 3] なら、同じ部屋に2〜3匹まとめて出る(エリートのときは1匹)
//   clan        :(省略できる)一族。sets.js の id を書く("goblins" / "beasts" / "undead" / "heavy" / "dragons" / "outcasts")
//                 同じ一族の固有装備から刻んだ刻印をそろえると、セット効果が付く
//                 2つの一族を持たせるときは ["undead", "dragons"] のように書く(刻印は両方に数える。マップの色は最初の一族)
//   desc        :(省略できる)図鑑の紹介文。詳細のいちばん下に出る。\n で改行できる
//                 例:desc: "森に住む小鬼。ひとりなら弱いが、群れると厄介。"
//   weight      :出やすさ。大きいほど出やすい(同じ階層で出る敵どうしで比べる)
//   minDepth    :この階層から出る
//   maxDepth    :この階層まで出る(null なら、どこまで深くても出る)
//                 決まり:出番はどの敵も20階分(maxDepth = minDepth + 19)。出始める階は層の中でだいたい等間隔に並べる
//                 100階を越える敵は、深層を作るまで null のまま

const MONSTER_DATA = [
  {
    id: "goblin", name: "ゴブリン", symbol: "g", color: "#ff5555", clan: "goblins",
    hp: 60, hpPerDepth: 10, attackMin: 10, attackMax: 30, attackPerDepth: 1.5, speed: 1,
    xp: 5, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "plant", materialAmount: 1, // 薬草を持ち歩いている
    weight: 10, minDepth: 1, maxDepth: 20,
  },
  {
    // HPは低いが、1ターンに2回動く(逃げても追いつかれる)
    id: "rat", name: "大ネズミ", symbol: "r", color: "#c8a070", clan: "beasts",
    hp: 30, hpPerDepth: 5, attackMin: 6, attackMax: 14, attackPerDepth: 1, speed: 2,
    xp: 4, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 1,
    weight: 6, minDepth: 2, maxDepth: 21,
  },
  {
    // 速いけれど、ふらふら飛ぶのでまっすぐは来ない
    id: "bat", name: "コウモリ", symbol: "v", color: "#9080a0", clan: "beasts",
    hp: 25, hpPerDepth: 4, attackMin: 6, attackMax: 12, attackPerDepth: 1, speed: 2,
    xp: 4, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 1,
    ability: { type: "erratic", chance: 0.5 },
    weight: 5, minDepth: 4, maxDepth: 23,
  },
  {
    // 見つかると角笛で仲間を呼ぶ。先に倒すか、見つからないように
    id: "caller", name: "ゴブリンの呼び子", symbol: "h", color: "#d0d060", clan: "goblins",
    hp: 50, hpPerDepth: 6, attackMin: 10, attackMax: 20, attackPerDepth: 1.5, speed: 1,
    xp: 8, xpPerDepth: 1,
    dropChance: 0.06, bookDropChance: 0.01,
    material: "plant", materialAmount: 1,
    ability: { type: "alarm", radius: 20 },
    weight: 3, minDepth: 9, maxDepth: 28,
  },
  {
    // 攻撃されると分裂する。一撃で倒せば増えない
    id: "slime", name: "スライム", symbol: "j", color: "#60d0a0", clan: "beasts",
    hp: 90, hpPerDepth: 10, attackMin: 14, attackMax: 24, attackPerDepth: 1.5, speed: 1,
    xp: 7, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "plant", materialAmount: 1,
    ability: { type: "split" },
    weight: 5, minDepth: 13, maxDepth: 32,
  },
  {
    // 縦か横にまっすぐ並ぶと矢を撃ってくる。通路で正面に立たないように
    id: "archer", name: "ゴブリンの弓兵", symbol: "a", color: "#e0a060", clan: "goblins",
    hp: 45, hpPerDepth: 6, attackMin: 12, attackMax: 22, attackPerDepth: 1.5, speed: 1,
    xp: 6, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "plant", materialAmount: 1,
    ability: { type: "ranged", range: 5 },
    weight: 6, minDepth: 6, maxDepth: 25,
  },
  {
    // 回復薬を盗んで逃げる。足が速い
    id: "thief", name: "盗賊", symbol: "t", color: "#b0b0d0", clan: "outcasts",
    hp: 50, hpPerDepth: 6, attackMin: 8, attackMax: 16, attackPerDepth: 1, speed: 1.5,
    xp: 7, xpPerDepth: 1,
    dropChance: 0.06, bookDropChance: 0.01,
    material: "hide", materialAmount: 1,
    ability: { type: "steal", fleeTurns: 8 },
    weight: 4, minDepth: 8, maxDepth: 27,
  },
  {
    // 噛まれると毒。長引くほど痛い
    id: "spider", name: "大蜘蛛", symbol: "x", color: "#b060d0", clan: "beasts",
    hp: 70, hpPerDepth: 8, attackMin: 12, attackMax: 24, attackPerDepth: 1.5, speed: 1,
    xp: 9, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 1,
    ability: { type: "poison", damage: 3, damagePerDepth: 0.3, turns: 8 },
    weight: 6, minDepth: 11, maxDepth: 30,
  },
  {
    // 追いかけてくる炎を放つ。炎はぶつかれば消せる
    id: "wisp", name: "鬼火", symbol: "w", color: "#ff9040", clan: "undead",
    hp: 60, hpPerDepth: 8, attackMin: 30, attackMax: 45, attackPerDepth: 2, speed: 1,
    xp: 12, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "ore", materialAmount: 1,
    ability: { type: "fire", range: 7, cooldown: 4, turns: 5 },
    weight: 5, minDepth: 16, maxDepth: 35,
  },
  {
    // 影の中を飛ぶコウモリ。噛まれると目がくらむ(盲目:しばらく周りしか見えない)
    //   固有装備の「影の衣」は、とてもまれ(隠し装備)
    id: "shadowbat", name: "影蝙蝠", symbol: "u", color: "#6e5a4a", clan: "beasts",
    hp: 70, hpPerDepth: 6, attackMin: 15, attackMax: 25, attackPerDepth: 1.5, speed: 2,
    xp: 14, xpPerDepth: 2,
    dropChance: 0.005, bookDropChance: 0.01,
    material: "hide", materialAmount: 1,
    ability: { type: "blind", turns: 8, erratic: 0.4 },
    weight: 4, minDepth: 21, maxDepth: 40,
  },
  {
    // 宝箱に化けている(マウスを合わせると、名前が少しおかしい)。乗ろうとすると正体を現して噛みつく。倒すと宝箱の中身を落とす
    //   ふつうの部屋には出ない(weight: 0)。宝箱を置くとき、BALANCE.mimicChance の確率でミミックになる(js/treasure.js の「宝箱」)
    id: "mimic", name: "ミミック", symbol: "&", color: "#e0a84a",
    hp: 120, hpPerDepth: 12, attackMin: 30, attackMax: 45, attackPerDepth: 2.5, speed: 1,
    xp: 30, xpPerDepth: 2,
    dropChance: 0, bookDropChance: 0.01,
    material: "ore", materialAmount: 2,
    ability: { type: "mimic" },
    weight: 0, minDepth: 5, maxDepth: null, // minDepth:この階から、宝箱がミミックになることがある
  },
  {
    // 隣に来ると膨らんで、次の行動で爆発する。先に倒すか、離れる
    id: "bomber", name: "爆ぜ虫", symbol: "b", color: "#e0e040", clan: "outcasts",
    hp: 60, hpPerDepth: 8, attackMin: 10, attackMax: 20, attackPerDepth: 4, speed: 1,
    xp: 10, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "ore", materialAmount: 2,
    ability: { type: "explode", damageMin: 70, damageMax: 100 },
    weight: 5, minDepth: 18, maxDepth: 37,
  },
  {
    id: "orc", name: "オーク", symbol: "o", color: "#6fcf5f", clan: "heavy",
    hp: 150, hpPerDepth: 15, attackMin: 25, attackMax: 45, attackPerDepth: 2, speed: 1,
    xp: 12, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 2,
    weight: 8, minDepth: 14, maxDepth: 33,
  },
  {
    id: "skeleton", name: "スケルトン", symbol: "s", color: "#e8e8e8", clan: "undead",
    hp: 110, hpPerDepth: 12, attackMin: 30, attackMax: 50, attackPerDepth: 2, speed: 1,
    xp: 15, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 2,
    weight: 8, minDepth: 20, maxDepth: 39,
  },
  {
    // 鎧が硬く、普通の攻撃は半分しか通らない。会心なら貫通する
    id: "knight", name: "甲冑騎士", symbol: "K", color: "#c0c8d8", clan: "heavy",
    hp: 160, hpPerDepth: 14, attackMin: 40, attackMax: 60, attackPerDepth: 2.5, speed: 1,
    xp: 25, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "ore", materialAmount: 2,
    ability: { type: "armored", cut: 0.5 },
    weight: 5, minDepth: 23, maxDepth: 42,
  },
  {
    // 毎ターン回復する。毒にすると回復が止まる
    id: "troll", name: "トロル", symbol: "T", color: "#80a060", clan: "heavy",
    hp: 260, hpPerDepth: 18, attackMin: 40, attackMax: 60, attackPerDepth: 3, speed: 1,
    xp: 30, xpPerDepth: 3,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 3,
    ability: { type: "regen", rate: 0.04 },
    weight: 4, minDepth: 26, maxDepth: 45,
  },
  {
    // 触れられると力が抜ける(衰弱:しばらく ATK が下がる)
    id: "wraith", name: "怨霊", symbol: "W", color: "#a0b0ff", clan: "undead",
    hp: 150, hpPerDepth: 12, attackMin: 35, attackMax: 50, attackPerDepth: 2.5, speed: 1,
    xp: 28, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 2,
    ability: { type: "weaken", turns: 8, atkCut: 0.3 },
    weight: 4, minDepth: 28, maxDepth: 47,
  },
  {
    // とても硬くて痛いが、2ターンに1回しか動かない(うまく立ち回れば一方的に殴れる)
    id: "golem", name: "ゴーレム", symbol: "G", color: "#a0a0ff", clan: "heavy",
    hp: 400, hpPerDepth: 25, attackMin: 60, attackMax: 90, attackPerDepth: 3, speed: 0.5,
    xp: 30, xpPerDepth: 3,
    dropChance: 0.08, bookDropChance: 0.01,
    material: "ore", materialAmount: 3,
    weight: 4, minDepth: 25, maxDepth: 44,
  },

  // ---------- 低層の後半(20階あたり〜)の敵 ----------
  {
    // 手下を連れて出てくる。近くのゴブリン一族は号令で強くなる。族長から先に倒したい
    id: "chieftain", name: "ゴブリンの族長", symbol: "H", color: "#a0f070", clan: "goblins",
    hp: 200, hpPerDepth: 14, attackMin: 45, attackMax: 60, attackPerDepth: 2.5, speed: 1,
    xp: 35, xpPerDepth: 3,
    dropChance: 0.06, bookDropChance: 0.01,
    material: "plant", materialAmount: 3,
    ability: { type: "command", radius: 5, atkUp: 0.3, escorts: 2, escortFrom: ["goblin", "archer"] },
    weight: 4, minDepth: 30, maxDepth: 49,
  },
  {
    // 2〜3匹の群れで出てくる。囲まれないように、通路で迎え撃ちたい
    id: "direwolf", name: "ダイアウルフ", symbol: "d", color: "#8c7a6a", clan: "beasts",
    hp: 110, hpPerDepth: 10, attackMin: 35, attackMax: 50, attackPerDepth: 2, speed: 1,
    xp: 18, xpPerDepth: 2,
    dropChance: 0.04, bookDropChance: 0.01,
    material: "hide", materialAmount: 1,
    pack: [2, 3],
    weight: 5, minDepth: 31, maxDepth: 50,
  },
  {
    // 槍で、2マス先からも突いてくる。こちらは届かないので、踏みこんで殴りに行く
    id: "lizardman", name: "リザードマン", symbol: "L", color: "#d05a3a", clan: "dragons",
    hp: 170, hpPerDepth: 13, attackMin: 45, attackMax: 60, attackPerDepth: 2.5, speed: 1,
    xp: 32, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 2,
    ability: { type: "reach", range: 2 },
    weight: 5, minDepth: 33, maxDepth: 52,
  },
  {
    // スケルトンを呼び出す。術師を倒せば、呼ばれたスケルトンも崩れ落ちる
    id: "necromancer", name: "死霊術師", symbol: "N", color: "#9ca8e8", clan: "undead",
    hp: 180, hpPerDepth: 12, attackMin: 40, attackMax: 55, attackPerDepth: 2.5, speed: 1,
    xp: 40, xpPerDepth: 3,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 3,
    ability: { type: "summon", summonId: "skeleton", cooldown: 5, maxAlive: 2, maxTotal: 4 },
    weight: 4, minDepth: 36, maxDepth: 55,
  },
  {
    // 噛まれるとやけど。竜の一族のいちばん下っぱ
    id: "salamander", name: "火蜥蜴", symbol: "f", color: "#ff7a50", clan: "dragons",
    hp: 150, hpPerDepth: 12, attackMin: 40, attackMax: 55, attackPerDepth: 2.5, speed: 1,
    xp: 30, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 2,
    ability: { type: "burn", damage: 6, damagePerDepth: 0.4, turns: 4 },
    weight: 6, minDepth: 35, maxDepth: 54,
  },
  {
    // にらまれると体が重くなる(鈍足:回避率が下がる)
    id: "basilisk", name: "バジリスク", symbol: "B", color: "#c8a070", clan: "beasts",
    hp: 220, hpPerDepth: 16, attackMin: 45, attackMax: 65, attackPerDepth: 2.5, speed: 1,
    xp: 35, xpPerDepth: 3,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 3,
    ability: { type: "slow", turns: 6, aglCut: 0.4 },
    weight: 5, minDepth: 38, maxDepth: 57,
  },
  {
    // 甲冑騎士より硬い。会心で鎧を貫くのが攻略の鍵
    id: "darkknight", name: "黒騎士", symbol: "D", color: "#80848a", clan: "heavy",
    hp: 260, hpPerDepth: 18, attackMin: 60, attackMax: 85, attackPerDepth: 3, speed: 1,
    xp: 45, xpPerDepth: 3,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "ore", materialAmount: 3,
    ability: { type: "armored", cut: 0.7 },
    weight: 4, minDepth: 40, maxDepth: 59,
  },
  {
    // 噛みついた分だけ回復する。長引かせず、一気に倒したい
    id: "vampire", name: "吸血鬼", symbol: "V", color: "#b0b8ff", clan: "undead",
    hp: 260, hpPerDepth: 16, attackMin: 55, attackMax: 75, attackPerDepth: 3, speed: 1,
    xp: 45, xpPerDepth: 3,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 3,
    ability: { type: "drain", rate: 1 },
    weight: 4, minDepth: 45, maxDepth: 64,
  },
  {
    // 足が速い。毒の球と、小さい扇形の毒のブレスをよく使う(よけ方を覚える敵)
    id: "wyvern", name: "ワイバーン", symbol: "Y", color: "#f09060", clan: "dragons",
    hp: 240, hpPerDepth: 16, attackMin: 50, attackMax: 70, attackPerDepth: 3, speed: 1.5,
    xp: 45, xpPerDepth: 3,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 3,
    ability: { type: "dragon", element: "poison", ballCooldown: 3, breathRange: 3, breathCooldown: 5, breathChance: 0.5,
               breathPower: 1.3, dot: { damage: 8, damagePerDepth: 0.5, turns: 2 } },
    weight: 4, minDepth: 43, maxDepth: 62,
  },
  {
    // 火球と、大きい扇形の炎のブレス。めったに吐かないが、口の近くで浴びると大ダメージ
    id: "drake", name: "ドレイク", symbol: "R", color: "#ff4a3a", clan: "dragons",
    hp: 400, hpPerDepth: 24, attackMin: 70, attackMax: 95, attackPerDepth: 3.5, speed: 1,
    xp: 60, xpPerDepth: 4,
    dropChance: 0.06, bookDropChance: 0.01,
    material: "hide", materialAmount: 4,
    ability: { type: "dragon", element: "fire", ballCooldown: 4, breathRange: 5, breathCooldown: 8, breathChance: 0.3,
               breathPower: 2, dot: { damage: 10, damagePerDepth: 0.6, turns: 3 } },
    weight: 3, minDepth: 47, maxDepth: 66,
  },

  // ---------- 中層(51階〜)の敵 ----------
  //   低層の敵は、弱めのものが60階、強めのものが75階で出なくなり、ここの敵に入れかわる(ドレイクは100階まで)
  {
    // 3〜4匹の群れで出てくる、大柄なゴブリン。囲まれる前に通路へ
    id: "hobgoblin", name: "ホブゴブリン", symbol: "h", color: "#5aa850", clan: "goblins",
    hp: 300, hpPerDepth: 16, attackMin: 60, attackMax: 80, attackPerDepth: 3, speed: 1,
    xp: 40, xpPerDepth: 3,
    dropChance: 0.04, bookDropChance: 0.01,
    material: "plant", materialAmount: 2,
    pack: [3, 4],
    weight: 6, minDepth: 51, maxDepth: 70,
  },
  {
    // 足が速く(1.5倍)、とても痛い。逃げても追いつかれる
    id: "minotaur", name: "ミノタウロス", symbol: "M", color: "#a0a0a0", clan: "heavy",
    hp: 500, hpPerDepth: 26, attackMin: 90, attackMax: 120, attackPerDepth: 4, speed: 1.5,
    xp: 70, xpPerDepth: 4,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 4,
    weight: 4, minDepth: 53, maxDepth: 72,
  },
  {
    // 目つぶしの粉をまいてくる(盲目:しばらく周りしか見えない)
    id: "assassin", name: "暗殺者", symbol: "A", color: "#c9a227", clan: "outcasts",
    hp: 260, hpPerDepth: 14, attackMin: 70, attackMax: 95, attackPerDepth: 3.5, speed: 1.5,
    xp: 55, xpPerDepth: 3,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 3,
    ability: { type: "blind", turns: 6 },
    weight: 4, minDepth: 56, maxDepth: 75,
  },
  {
    // 尾の毒針を、まっすぐ遠くまで飛ばしてくる。正面に立たないように
    id: "manticore", name: "マンティコア", symbol: "m", color: "#c8a070", clan: "beasts",
    hp: 420, hpPerDepth: 22, attackMin: 75, attackMax: 100, attackPerDepth: 3.5, speed: 1,
    xp: 60, xpPerDepth: 4,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 4,
    ability: { type: "ranged", range: 5, shot: "毒針" },
    weight: 5, minDepth: 58, maxDepth: 77,
  },
  {
    // 見つかると叫んで、周りの敵を呼び寄せる(ゴブリン一族の刻印では防げない)。弱いので、気づかれる前に倒したい
    id: "banshee", name: "バンシー", symbol: "S", color: "#b8d0ff", clan: "undead",
    hp: 200, hpPerDepth: 12, attackMin: 55, attackMax: 75, attackPerDepth: 3, speed: 1,
    xp: 50, xpPerDepth: 3,
    dropChance: 0.06, bookDropChance: 0.01,
    material: "bone", materialAmount: 2,
    ability: { type: "alarm", radius: 20, sound: "金切り声をあげて" },
    weight: 3, minDepth: 60, maxDepth: 79,
  },
  {
    // 爆ぜ虫の大きいもの。爆発はずっと痛い。となりに来られる前に倒すか、すぐ離れる
    id: "bigbomber", name: "大爆ぜ虫", symbol: "e", color: "#e8c020", clan: "outcasts",
    hp: 260, hpPerDepth: 14, attackMin: 30, attackMax: 50, attackPerDepth: 6, speed: 1,
    xp: 45, xpPerDepth: 3,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "ore", materialAmount: 3,
    ability: { type: "explode", damageMin: 150, damageMax: 200 },
    weight: 4, minDepth: 63, maxDepth: 82,
  },
  {
    // 2〜3匹の群れで出てくる、地獄の猟犬。噛まれるとやけど
    id: "hellhound", name: "ヘルハウンド", symbol: "c", color: "#8c5a4a", clan: "beasts",
    hp: 280, hpPerDepth: 16, attackMin: 65, attackMax: 85, attackPerDepth: 3, speed: 1,
    xp: 40, xpPerDepth: 3,
    dropChance: 0.04, bookDropChance: 0.01,
    material: "hide", materialAmount: 2,
    ability: { type: "burn", damage: 12, damagePerDepth: 0.5, turns: 4 },
    pack: [2, 3],
    weight: 5, minDepth: 65, maxDepth: 84,
  },
  {
    // 怨霊を呼び出す。リッチを倒せば、呼ばれた怨霊も崩れ落ちる
    id: "lich", name: "リッチ", symbol: "Z", color: "#9ca8e8", clan: "undead",
    hp: 380, hpPerDepth: 18, attackMin: 70, attackMax: 90, attackPerDepth: 3.5, speed: 1,
    xp: 70, xpPerDepth: 4,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 4,
    ability: { type: "summon", summonId: "wraith", cooldown: 6, maxAlive: 2, maxTotal: 4 },
    weight: 4, minDepth: 67, maxDepth: 86,
  },
  {
    // ホブゴブリンを連れて出てくる。近くのゴブリン一族は号令で強くなる。王から先に倒したい
    id: "goblinking", name: "ゴブリンの王", symbol: "k", color: "#a0f070", clan: "goblins",
    hp: 450, hpPerDepth: 20, attackMin: 85, attackMax: 105, attackPerDepth: 3.5, speed: 1,
    xp: 75, xpPerDepth: 4,
    dropChance: 0.06, bookDropChance: 0.01,
    material: "plant", materialAmount: 4,
    ability: { type: "command", radius: 5, atkUp: 0.3, escorts: 2, escortFrom: ["hobgoblin"] },
    weight: 3, minDepth: 70, maxDepth: 89,
  },
  {
    // とても硬い鉄の巨人。2ターンに1回しか動かないが、会心でないとなかなか削れない
    id: "irongiant", name: "鉄巨人", symbol: "I", color: "#b4bccc", clan: "heavy",
    hp: 700, hpPerDepth: 32, attackMin: 110, attackMax: 140, attackPerDepth: 4.5, speed: 0.5,
    xp: 80, xpPerDepth: 4,
    dropChance: 0.06, bookDropChance: 0.01,
    material: "ore", materialAmount: 5,
    ability: { type: "armored", cut: 0.6 },
    weight: 3, minDepth: 72, maxDepth: 91,
  },

  // ---------- 中層の後半(70階〜)の敵 ----------
  {
    // 呪いをかけて、体を重くする(鈍足:回避率が下がる)
    id: "goblinshaman", name: "ゴブリンの祈祷師", symbol: "p", color: "#80e0a0", clan: "goblins",
    hp: 340, hpPerDepth: 16, attackMin: 75, attackMax: 95, attackPerDepth: 3.5, speed: 1,
    xp: 60, xpPerDepth: 4,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "plant", materialAmount: 3,
    ability: { type: "slow", turns: 6, aglCut: 0.4 },
    weight: 4, minDepth: 74, maxDepth: 93,
  },
  {
    // 盗賊のかしら。持ちこんだ道具を盗んで逃げる。足が速い
    id: "banditboss", name: "盗賊頭", symbol: "U", color: "#c9a227", clan: "outcasts",
    hp: 320, hpPerDepth: 16, attackMin: 80, attackMax: 100, attackPerDepth: 3.5, speed: 1.5,
    xp: 65, xpPerDepth: 4,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 3,
    ability: { type: "stealTool", fleeTurns: 10 },
    weight: 4, minDepth: 77, maxDepth: 96,
  },
  {
    // とても遠く(10マス)から矢を撃ってくる。見つかったら、まっすぐ並ばないように近づく
    id: "goblinsniper", name: "ゴブリンの狙撃兵", symbol: "n", color: "#5fd0a0", clan: "goblins",
    hp: 300, hpPerDepth: 14, attackMin: 80, attackMax: 100, attackPerDepth: 3.5, speed: 1,
    xp: 60, xpPerDepth: 4,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "plant", materialAmount: 3,
    ability: { type: "ranged", range: 10 },
    weight: 4, minDepth: 79, maxDepth: 98,
  },
  {
    // 首のない騎士。大鎌で、2マス先からも斬ってくる
    id: "dullahan", name: "デュラハン", symbol: "Q", color: "#b8d0ff", clan: "undead",
    hp: 520, hpPerDepth: 24, attackMin: 95, attackMax: 120, attackPerDepth: 4, speed: 1,
    xp: 80, xpPerDepth: 4,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 4,
    ability: { type: "reach", range: 2, shot: "大鎌" },
    weight: 4, minDepth: 81, maxDepth: 100,
  },
  {
    // 動く石像。となりにいると、ときどき構えて大技(薙ぎ払い・回転切り)。赤く光ったら範囲の外へ
    id: "gargoyle", name: "ガーゴイル", symbol: "X", color: "#a8acb4", clan: "heavy",
    hp: 540, hpPerDepth: 24, attackMin: 95, attackMax: 120, attackPerDepth: 4, speed: 1,
    xp: 80, xpPerDepth: 4,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "ore", materialAmount: 4,
    ability: { type: "sweep", chance: 0.35, cooldown: 4, sweepPower: 1.5, spinPower: 1.3 },
    weight: 4, minDepth: 84, maxDepth: null,
  },
  {
    // 竜の血を引く戦士。まっすぐ並ぶと、溜めてから一直線に突進してくる。横へよければ、体勢を崩したところを殴れる
    id: "dragonkin", name: "竜人", symbol: "F", color: "#e07848", clan: "dragons",
    hp: 500, hpPerDepth: 22, attackMin: 95, attackMax: 120, attackPerDepth: 4, speed: 1,
    xp: 80, xpPerDepth: 4,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 4,
    ability: { type: "rush", range: 6, chance: 0.4, cooldown: 4, rushPower: 1.8, stunTurns: 2 },
    weight: 4, minDepth: 86, maxDepth: null,
  },
  {
    // 獅子・山羊・蛇の頭を持つ獣。追いかけてくる炎を吐く
    id: "chimera", name: "キマイラ", symbol: "C", color: "#c8a070", clan: "beasts",
    hp: 560, hpPerDepth: 26, attackMin: 100, attackMax: 125, attackPerDepth: 4, speed: 1,
    xp: 85, xpPerDepth: 5,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 4,
    ability: { type: "fire", range: 7, cooldown: 4, turns: 5 },
    weight: 4, minDepth: 88, maxDepth: null,
  },
  {
    // 殴った分の半分だけ回復する。長引かせず、一気に倒したい
    id: "berserker", name: "狂戦士", symbol: "E", color: "#c9a227", clan: "outcasts",
    hp: 480, hpPerDepth: 22, attackMin: 110, attackMax: 140, attackPerDepth: 4.5, speed: 1,
    xp: 80, xpPerDepth: 4,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 3,
    ability: { type: "drain", rate: 0.5 },
    weight: 4, minDepth: 91, maxDepth: null,
  },
  {
    // 2〜3匹の群れで出てくる屍食い。噛まれると毒
    id: "ghoul", name: "グール", symbol: "z", color: "#8890b8", clan: "undead",
    hp: 380, hpPerDepth: 18, attackMin: 90, attackMax: 115, attackPerDepth: 4, speed: 1,
    xp: 55, xpPerDepth: 3,
    dropChance: 0.04, bookDropChance: 0.01,
    material: "bone", materialAmount: 2,
    ability: { type: "poison", damage: 12, damagePerDepth: 0.5, turns: 6 },
    pack: [2, 3],
    weight: 5, minDepth: 93, maxDepth: null,
  },
  {
    // いくつも頭のある大蛇。噛まれると強い毒
    id: "hydra", name: "ヒュドラ", symbol: "y", color: "#b060d0", clan: "beasts",
    hp: 650, hpPerDepth: 28, attackMin: 100, attackMax: 130, attackPerDepth: 4, speed: 1,
    xp: 95, xpPerDepth: 5,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 5,
    ability: { type: "poison", damage: 15, damagePerDepth: 0.6, turns: 8 },
    weight: 3, minDepth: 95, maxDepth: null,
  },
  {
    // とても大きな獣。毎ターン回復する。毒にすると回復が止まる
    id: "behemoth", name: "ベヒーモス", symbol: "J", color: "#a8acb4", clan: "heavy",
    hp: 900, hpPerDepth: 40, attackMin: 130, attackMax: 160, attackPerDepth: 5, speed: 1,
    xp: 120, xpPerDepth: 6,
    dropChance: 0.06, bookDropChance: 0.01,
    material: "hide", materialAmount: 6,
    ability: { type: "regen", rate: 0.03 },
    weight: 3, minDepth: 98, maxDepth: null,
  },
  {
    // 腐り果てた竜。毒の球とブレス。弱るとグールを吸いこんで回復し、倒すと死骸が爆発して毒沼が広がる
    //   不死と竜の両方の一族(固有装備を刻むと、どちらのセット効果にも数える)
    id: "dragonzombie", name: "ドラゴンゾンビ", symbol: "O", color: "#9cb89c", clan: ["undead", "dragons"],
    hp: 1000, hpPerDepth: 42, attackMin: 130, attackMax: 165, attackPerDepth: 5, speed: 1,
    xp: 130, xpPerDepth: 6,
    dropChance: 0.06, bookDropChance: 0.01,
    material: "bone", materialAmount: 6,
    ability: { type: "dragon", element: "poison", ballCooldown: 4, breathRange: 5, breathCooldown: 7, breathChance: 0.35,
               breathPower: 1.8, dot: { damage: 16, damagePerDepth: 0.6, turns: 3 },
               absorb: { id: "ghoul", radius: 4, below: 0.7, healRate: 0.15, cooldown: 5 },
               deathBlast: { damageMin: 150, damageMax: 200, radius: 1, delay: 1, poolRadius: 2, poolTurns: 10 } },
    weight: 2, minDepth: 100, maxDepth: null,
  },
];
