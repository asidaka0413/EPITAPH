// ==================== 敵データ ====================
// 敵の種類をここに並べる。index.html から読み込まれる
// 新しい敵を増やしたいときは、{ ... }, のかたまりをコピーして書き換えればOK
//
//   id          :敵を区別するための名前(半角英数字。equipment.js・books.js の from でも使う)
//   name        :画面に出る名前
//   symbol      :マップ上の記号(1文字)
//   color       :マップ上の色(CSS の色。"#ff5555" など)
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
//   weight      :出やすさ。大きいほど出やすい(同じ階層で出る敵どうしで比べる)
//   minDepth    :この階層から出る
//   maxDepth    :この階層まで出る(null なら、どこまで深くても出る)

const MONSTER_DATA = [
  {
    id: "goblin", name: "ゴブリン", symbol: "g", color: "#ff5555",
    hp: 60, hpPerDepth: 10, attackMin: 10, attackMax: 30, attackPerDepth: 1.5, speed: 1,
    xp: 5, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "plant", materialAmount: 1, // 薬草を持ち歩いている
    weight: 10, minDepth: 1, maxDepth: 12,
  },
  {
    // HPは低いが、1ターンに2回動く(逃げても追いつかれる)
    id: "rat", name: "大ネズミ", symbol: "r", color: "#c8a070",
    hp: 30, hpPerDepth: 5, attackMin: 6, attackMax: 14, attackPerDepth: 1, speed: 2,
    xp: 4, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 1,
    weight: 6, minDepth: 2, maxDepth: 10,
  },
  {
    // 速いけれど、ふらふら飛ぶのでまっすぐは来ない
    id: "bat", name: "コウモリ", symbol: "v", color: "#9080a0",
    hp: 25, hpPerDepth: 4, attackMin: 6, attackMax: 12, attackPerDepth: 1, speed: 2,
    xp: 4, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 1,
    ability: { type: "erratic", chance: 0.5 },
    weight: 5, minDepth: 2, maxDepth: 9,
  },
  {
    // 見つかると角笛で仲間を呼ぶ。先に倒すか、見つからないように
    id: "caller", name: "ゴブリンの呼び子", symbol: "h", color: "#d0d060",
    hp: 50, hpPerDepth: 6, attackMin: 10, attackMax: 20, attackPerDepth: 1.5, speed: 1,
    xp: 8, xpPerDepth: 1,
    dropChance: 0.06, bookDropChance: 0.01,
    material: "plant", materialAmount: 1,
    ability: { type: "alarm", radius: 20 },
    weight: 3, minDepth: 4, maxDepth: 14,
  },
  {
    // 攻撃されると分裂する。一撃で倒せば増えない
    id: "slime", name: "スライム", symbol: "j", color: "#60d0a0",
    hp: 90, hpPerDepth: 10, attackMin: 14, attackMax: 24, attackPerDepth: 1.5, speed: 1,
    xp: 7, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "plant", materialAmount: 1,
    ability: { type: "split" },
    weight: 5, minDepth: 5, maxDepth: 16,
  },
  {
    // 縦か横にまっすぐ並ぶと矢を撃ってくる。通路で正面に立たないように
    id: "archer", name: "ゴブリンの弓兵", symbol: "a", color: "#e0a060",
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
    id: "spider", name: "大蜘蛛", symbol: "x", color: "#b060d0",
    hp: 70, hpPerDepth: 8, attackMin: 12, attackMax: 24, attackPerDepth: 1.5, speed: 1,
    xp: 9, xpPerDepth: 1,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 1,
    ability: { type: "poison", damage: 3, damagePerDepth: 0.3, turns: 8 },
    weight: 6, minDepth: 4, maxDepth: 18,
  },
  {
    // 追いかけてくる炎を放つ。炎はぶつかれば消せる
    id: "wisp", name: "鬼火", symbol: "w", color: "#ff9040",
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
    id: "orc", name: "オーク", symbol: "o", color: "#6fcf5f",
    hp: 150, hpPerDepth: 15, attackMin: 25, attackMax: 45, attackPerDepth: 2, speed: 1,
    xp: 12, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 2,
    weight: 8, minDepth: 5, maxDepth: null,
  },
  {
    id: "skeleton", name: "スケルトン", symbol: "s", color: "#e8e8e8",
    hp: 110, hpPerDepth: 12, attackMin: 30, attackMax: 50, attackPerDepth: 2, speed: 1,
    xp: 15, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 2,
    weight: 8, minDepth: 8, maxDepth: null,
  },
  {
    // 鎧が硬く、普通の攻撃は半分しか通らない。会心なら貫通する
    id: "knight", name: "甲冑騎士", symbol: "K", color: "#c0c8d8",
    hp: 160, hpPerDepth: 14, attackMin: 40, attackMax: 60, attackPerDepth: 2.5, speed: 1,
    xp: 25, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "ore", materialAmount: 2,
    ability: { type: "armored", cut: 0.5 },
    weight: 5, minDepth: 10, maxDepth: null,
  },
  {
    // 毎ターン回復する。毒にすると回復が止まる
    id: "troll", name: "トロル", symbol: "T", color: "#80a060",
    hp: 260, hpPerDepth: 18, attackMin: 40, attackMax: 60, attackPerDepth: 3, speed: 1,
    xp: 30, xpPerDepth: 3,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "hide", materialAmount: 3,
    ability: { type: "regen", rate: 0.04 },
    weight: 4, minDepth: 12, maxDepth: null,
  },
  {
    // 触れられると力が抜ける(衰弱:しばらく ATK が下がる)
    id: "wraith", name: "怨霊", symbol: "W", color: "#a0b0ff",
    hp: 150, hpPerDepth: 12, attackMin: 35, attackMax: 50, attackPerDepth: 2.5, speed: 1,
    xp: 28, xpPerDepth: 2,
    dropChance: 0.05, bookDropChance: 0.01,
    material: "bone", materialAmount: 2,
    ability: { type: "weaken", turns: 8, atkCut: 0.3 },
    weight: 4, minDepth: 14, maxDepth: null,
  },
  {
    // とても硬くて痛いが、2ターンに1回しか動かない(うまく立ち回れば一方的に殴れる)
    id: "golem", name: "ゴーレム", symbol: "G", color: "#a0a0ff",
    hp: 400, hpPerDepth: 25, attackMin: 60, attackMax: 90, attackPerDepth: 3, speed: 0.5,
    xp: 30, xpPerDepth: 3,
    dropChance: 0.08, bookDropChance: 0.01,
    material: "ore", materialAmount: 3,
    weight: 4, minDepth: 11, maxDepth: null,
  },
];
