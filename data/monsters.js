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
//                 { type: "poison", damage: 8, damagePerDepth: 1, turns: 10 }
//                                                  … 攻撃が当たると毒にする(毎ターン damage、turns ターン続く)
//                 { type: "steal", fleeTurns: 8 }  … 攻撃が当たると回復薬を1個盗んで逃げる(倒すと取り返せる)
//                                                     fleeTurns 回動いたら逃げるのをやめて戻ってくる(もう盗まない)
//                 { type: "fire", range: 7, cooldown: 4, turns: 5 }
//                                                  … 射程内にいると、追いかけてくる炎を放つ(炎は turns ターン残る。
//                                                     炎のダメージはこの敵の攻撃力。cooldown ターンに1回)
//                 { type: "explode", damageMin: 70, damageMax: 100 }
//                                                  … 隣に来ると膨らみ、次の行動で爆発する(深い階ほど attackPerDepth ぶん強い)
//                 { type: "erratic", chance: 0.5 } … chance の確率で、ふらふらと適当な方向に動く
//                 { type: "alarm", radius: 20 }    … プレイヤーを見つけると一度だけ角笛を吹き、radius マス以内の敵を全員呼び寄せる
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
//                 { type: "command", radius: 5, atkUp: 0.3, escorts: 2, escortFrom: ["goblin", "archer"] }
//                                                  … 周り radius マス以内の、同じ一族の敵の攻撃力を atkUp ぶん上げる
//                                                     部屋に出るとき、escortFrom の敵から escorts 体の手下を連れてくる
//                 { type: "summon", summonId: "skeleton", cooldown: 5, maxAlive: 2, maxTotal: 4 }
//                                                  … cooldown 回の行動に1回、summonId の敵をとなりに呼び出す(同時に maxAlive 体、合計 maxTotal 体まで)
//                                                     呼ばれた敵は経験値・固有装備・書を落とさず、素材だけ落とす。呼んだ敵を倒すと崩れ落ちる(素材もなし)
//                 { type: "reach", range: 2 }      … 縦か横にまっすぐ range マス先まで、その場から突いてくる(間に壁・敵がいれば突けない)
//   pack        :(省略できる)群れで出る数 [最小, 最大]。例:pack: [2, 3] なら、同じ部屋に2〜3匹まとめて出る(エリートのときは1匹)
//   clan        :(省略できる)一族。sets.js の id を書く("goblins" / "beasts" / "undead" / "heavy" / "dragons")
//                 同じ一族の固有装備から刻んだ刻印をそろえると、セット効果が付く
//   desc        :(省略できる)図鑑の紹介文。詳細のいちばん下に出る。\n で改行できる
//                 例:desc: "森に住む小鬼。ひとりなら弱いが、群れると厄介。"
//   weight      :出やすさ。大きいほど出やすい(同じ階層で出る敵どうしで比べる)
//   minDepth    :この階層から出る
//   maxDepth    :この階層まで出る(null なら、どこまで深くても出る)

const MONSTER_DATA = [
  {
    id: "goblin", name: "ゴブリン", symbol: "g", color: "#ff5555", clan: "goblins",
    hp: 60, hpPerDepth: 10, attackMin: 10, attackMax: 30, attackPerDepth: 1.5, speed: 1,
    xp: 5, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "plant", materialAmount: 1, // 薬草を持ち歩いている
    weight: 10, minDepth: 1, maxDepth: 12,
  },
  {
    // HPは低いが、1ターンに2回動く(逃げても追いつかれる)
    id: "rat", name: "大ネズミ", symbol: "r", color: "#c8a070", clan: "beasts",
    hp: 30, hpPerDepth: 5, attackMin: 6, attackMax: 14, attackPerDepth: 1, speed: 2,
    xp: 4, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 1,
    weight: 6, minDepth: 2, maxDepth: 10,
  },
  {
    // 速いけれど、ふらふら飛ぶのでまっすぐは来ない
    id: "bat", name: "コウモリ", symbol: "v", color: "#9080a0", clan: "beasts",
    hp: 25, hpPerDepth: 4, attackMin: 6, attackMax: 12, attackPerDepth: 1, speed: 2,
    xp: 4, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 1,
    ability: { type: "erratic", chance: 0.5 },
    weight: 5, minDepth: 2, maxDepth: 9,
  },
  {
    // 見つかると角笛で仲間を呼ぶ。先に倒すか、見つからないように
    id: "caller", name: "ゴブリンの呼び子", symbol: "h", color: "#d0d060", clan: "goblins",
    hp: 50, hpPerDepth: 6, attackMin: 10, attackMax: 20, attackPerDepth: 1.5, speed: 1,
    xp: 8, xpPerDepth: 1,
    dropChance: 0.06, bookDropChance: 0.01,
    material: "plant", materialAmount: 1,
    ability: { type: "alarm", radius: 20 },
    weight: 3, minDepth: 4, maxDepth: 14,
  },
  {
    // 攻撃されると分裂する。一撃で倒せば増えない
    id: "slime", name: "スライム", symbol: "j", color: "#60d0a0", clan: "beasts",
    hp: 90, hpPerDepth: 10, attackMin: 14, attackMax: 24, attackPerDepth: 1.5, speed: 1,
    xp: 7, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "plant", materialAmount: 1,
    ability: { type: "split" },
    weight: 5, minDepth: 5, maxDepth: 16,
  },
  {
    // 縦か横にまっすぐ並ぶと矢を撃ってくる。通路で正面に立たないように
    id: "archer", name: "ゴブリンの弓兵", symbol: "a", color: "#e0a060", clan: "goblins",
    hp: 45, hpPerDepth: 6, attackMin: 12, attackMax: 22, attackPerDepth: 1.5, speed: 1,
    xp: 6, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "plant", materialAmount: 1,
    ability: { type: "ranged", range: 5 },
    weight: 6, minDepth: 3, maxDepth: 14,
  },
  {
    // 回復薬を盗んで逃げる。足が速い
    id: "thief", name: "盗賊", symbol: "t", color: "#b0b0d0",
    hp: 50, hpPerDepth: 6, attackMin: 8, attackMax: 16, attackPerDepth: 1, speed: 1.5,
    xp: 7, xpPerDepth: 1,
    dropChance: 0.06, bookDropChance: 0.01,
    material: "hide", materialAmount: 1,
    ability: { type: "steal", fleeTurns: 8 },
    weight: 4, minDepth: 3, maxDepth: 15,
  },
  {
    // 噛まれると毒。長引くほど痛い
    id: "spider", name: "大蜘蛛", symbol: "x", color: "#b060d0", clan: "beasts",
    hp: 70, hpPerDepth: 8, attackMin: 12, attackMax: 24, attackPerDepth: 1.5, speed: 1,
    xp: 9, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 1,
    ability: { type: "poison", damage: 3, damagePerDepth: 0.3, turns: 8 },
    weight: 6, minDepth: 4, maxDepth: 18,
  },
  {
    // 追いかけてくる炎を放つ。炎はぶつかれば消せる
    id: "wisp", name: "鬼火", symbol: "w", color: "#ff9040", clan: "undead",
    hp: 60, hpPerDepth: 8, attackMin: 30, attackMax: 45, attackPerDepth: 2, speed: 1,
    xp: 12, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "ore", materialAmount: 1,
    ability: { type: "fire", range: 7, cooldown: 4, turns: 5 },
    weight: 5, minDepth: 6, maxDepth: null,
  },
  {
    // 隣に来ると膨らんで、次の行動で爆発する。先に倒すか、離れる
    id: "bomber", name: "爆ぜ虫", symbol: "b", color: "#e0e040",
    hp: 60, hpPerDepth: 8, attackMin: 10, attackMax: 20, attackPerDepth: 4, speed: 1,
    xp: 10, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "ore", materialAmount: 2,
    ability: { type: "explode", damageMin: 70, damageMax: 100 },
    weight: 5, minDepth: 8, maxDepth: null,
  },
  {
    id: "orc", name: "オーク", symbol: "o", color: "#6fcf5f", clan: "heavy",
    hp: 150, hpPerDepth: 15, attackMin: 25, attackMax: 45, attackPerDepth: 2, speed: 1,
    xp: 12, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 2,
    weight: 8, minDepth: 5, maxDepth: null,
  },
  {
    id: "skeleton", name: "スケルトン", symbol: "s", color: "#e8e8e8", clan: "undead",
    hp: 110, hpPerDepth: 12, attackMin: 30, attackMax: 50, attackPerDepth: 2, speed: 1,
    xp: 15, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 2,
    weight: 8, minDepth: 8, maxDepth: null,
  },
  {
    // 鎧が硬く、普通の攻撃は半分しか通らない。会心なら貫通する
    id: "knight", name: "甲冑騎士", symbol: "K", color: "#c0c8d8", clan: "heavy",
    hp: 160, hpPerDepth: 14, attackMin: 40, attackMax: 60, attackPerDepth: 2.5, speed: 1,
    xp: 25, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "ore", materialAmount: 2,
    ability: { type: "armored", cut: 0.5 },
    weight: 5, minDepth: 10, maxDepth: null,
  },
  {
    // 毎ターン回復する。毒にすると回復が止まる
    id: "troll", name: "トロル", symbol: "T", color: "#80a060", clan: "heavy",
    hp: 260, hpPerDepth: 18, attackMin: 40, attackMax: 60, attackPerDepth: 3, speed: 1,
    xp: 30, xpPerDepth: 3,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 3,
    ability: { type: "regen", rate: 0.04 },
    weight: 4, minDepth: 12, maxDepth: null,
  },
  {
    // 触れられると力が抜ける(衰弱:しばらく ATK が下がる)
    id: "wraith", name: "怨霊", symbol: "W", color: "#a0b0ff", clan: "undead",
    hp: 150, hpPerDepth: 12, attackMin: 35, attackMax: 50, attackPerDepth: 2.5, speed: 1,
    xp: 28, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 2,
    ability: { type: "weaken", turns: 8, atkCut: 0.3 },
    weight: 4, minDepth: 14, maxDepth: null,
  },
  {
    // とても硬くて痛いが、2ターンに1回しか動かない(うまく立ち回れば一方的に殴れる)
    id: "golem", name: "ゴーレム", symbol: "G", color: "#a0a0ff", clan: "heavy",
    hp: 400, hpPerDepth: 25, attackMin: 60, attackMax: 90, attackPerDepth: 3, speed: 0.5,
    xp: 30, xpPerDepth: 3,
    dropChance: 0.08, bookDropChance: 0.01,
    material: "ore", materialAmount: 3,
    weight: 4, minDepth: 11, maxDepth: null,
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
    weight: 4, minDepth: 18, maxDepth: 35,
  },
  {
    // 2〜3匹の群れで出てくる。囲まれないように、通路で迎え撃ちたい
    id: "direwolf", name: "ダイアウルフ", symbol: "d", color: "#8c7a6a", clan: "beasts",
    hp: 110, hpPerDepth: 10, attackMin: 35, attackMax: 50, attackPerDepth: 2, speed: 1,
    xp: 18, xpPerDepth: 2,
    dropChance: 0.04, bookDropChance: 0.01,
    material: "hide", materialAmount: 1,
    pack: [2, 3],
    weight: 5, minDepth: 18, maxDepth: 40,
  },
  {
    // 槍で、2マス先からも突いてくる。こちらは届かないので、踏みこんで殴りに行く
    id: "lizardman", name: "リザードマン", symbol: "L", color: "#d05a3a", clan: "dragons",
    hp: 170, hpPerDepth: 13, attackMin: 45, attackMax: 60, attackPerDepth: 2.5, speed: 1,
    xp: 32, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 2,
    ability: { type: "reach", range: 2 },
    weight: 5, minDepth: 20, maxDepth: null,
  },
  {
    // スケルトンを呼び出す。術師を倒せば、呼ばれたスケルトンも崩れ落ちる
    id: "necromancer", name: "死霊術師", symbol: "N", color: "#9ca8e8", clan: "undead",
    hp: 180, hpPerDepth: 12, attackMin: 40, attackMax: 55, attackPerDepth: 2.5, speed: 1,
    xp: 40, xpPerDepth: 3,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 3,
    ability: { type: "summon", summonId: "skeleton", cooldown: 5, maxAlive: 2, maxTotal: 4 },
    weight: 4, minDepth: 25, maxDepth: null,
  },
  {
    // 噛まれるとやけど。竜の一族のいちばん下っぱ
    id: "salamander", name: "火蜥蜴", symbol: "f", color: "#ff7a50", clan: "dragons",
    hp: 150, hpPerDepth: 12, attackMin: 40, attackMax: 55, attackPerDepth: 2.5, speed: 1,
    xp: 30, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 2,
    ability: { type: "burn", damage: 6, damagePerDepth: 0.4, turns: 4 },
    weight: 6, minDepth: 24, maxDepth: null,
  },
  {
    // にらまれると体が重くなる(鈍足:回避率が下がる)
    id: "basilisk", name: "バジリスク", symbol: "B", color: "#c8a070", clan: "beasts",
    hp: 220, hpPerDepth: 16, attackMin: 45, attackMax: 65, attackPerDepth: 2.5, speed: 1,
    xp: 35, xpPerDepth: 3,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 3,
    ability: { type: "slow", turns: 6, aglCut: 0.4 },
    weight: 5, minDepth: 26, maxDepth: null,
  },
  {
    // 甲冑騎士より硬い。会心で鎧を貫くのが攻略の鍵
    id: "darkknight", name: "黒騎士", symbol: "D", color: "#80848a", clan: "heavy",
    hp: 260, hpPerDepth: 18, attackMin: 60, attackMax: 85, attackPerDepth: 3, speed: 1,
    xp: 45, xpPerDepth: 3,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "ore", materialAmount: 3,
    ability: { type: "armored", cut: 0.7 },
    weight: 4, minDepth: 28, maxDepth: null,
  },
  {
    // 噛みついた分だけ回復する。長引かせず、一気に倒したい
    id: "vampire", name: "吸血鬼", symbol: "V", color: "#b0b8ff", clan: "undead",
    hp: 260, hpPerDepth: 16, attackMin: 55, attackMax: 75, attackPerDepth: 3, speed: 1,
    xp: 45, xpPerDepth: 3,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 3,
    ability: { type: "drain", rate: 1 },
    weight: 4, minDepth: 35, maxDepth: null,
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
    weight: 4, minDepth: 32, maxDepth: null,
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
    weight: 3, minDepth: 40, maxDepth: null,
  },
];
