// ==================== 書データ ====================
// 書の種類をここに並べる。index.html から読み込まれる
// 新しい書を増やしたいときは、{ ... }, のかたまりをコピーして書き換えればOK
//
//   id        :書を区別するための名前(半角英数字。ほかとかぶらないように)
//   name      :画面に出る名前
//   group     :同じ系統の書をまとめる名前。同じ group で level が1つ上の書と交換できる
//   level     :書レベル(1〜3)
//   stat      :ポイントを振ると上がるステータス(hp / atk / def / luk / agl / crt)
//   perTier   :1段階ごとに上がる量
//   maxPoints :振れるポイントの上限。ここまで振り切ると特性(trait)が解放される
//   trait     :特性。name:名前 / desc:説明 / 効果(下のどれか)
//                critRolls      … 会心の抽選回数(2 なら2回抽選して、どちらかが当たれば会心)
//                critMultiplier … 会心のダメージ倍率
//                healBoost      … HP回復効果の強化(0.1 なら回復量 +10%。回復薬・キャンプの「休む」)
//                guts           … 食いしばり(true なら、1回の冒険で1度だけ、死ぬダメージを HP1 で耐える)
//                bonusHp        … 最大HPが増える
//                critTakenDown  … 敵の会心で受けるダメージを減らす(0.3 なら会心のダメージが -30%)
//                noBadRoll      … 拾う装備の個体差がマイナスにならない(true)
//                bonusMaterial  … 敵が落とす素材が増える(1 なら +1個)
//                holyWaterRate  … 聖水が出る確率の倍率(2 なら2倍)
//                campRestBoost  … キャンプの「休む」の回復量アップ(0.2 なら +20%)
//                campPotionBonus… キャンプの「回復薬を補充」でもらえる数が増える(1 なら +1個)
//                campEnhanceTimes… キャンプの「装備を強化」の回数(2 なら2回強化する)
//                includeLower   … true なら、振り切ったとき同じ系統の下のレベルの書の特性もすべて発動する
//              同じ種類の効果が2つ解放されているときは、大きいほうだけが効く
//   from      :どの敵が落とすか(monsters.js の id)。複数なら ["goblin", "orc"] のように並べる
//                "all" なら全部の敵が落とす / null なら落とさない(交換でしか手に入らない)
//   desc      :(省略できる)図鑑の紹介文。詳細のいちばん下に出る。\n で改行できる
//   weight    :出やすさ(同じ敵が落とす書どうしで比べる)
//   minDepth / maxDepth :この階層の間で落とす(maxDepth が null なら、どこまで深くても)
//
// 段階の区切り(何ポイントで1段階上がるか)は js/config.js の BALANCE で決める

const BOOK_DATA = [
  // ---------- 攻撃力アップの書 ----------
  {
    id: "atk1", name: "攻撃力アップの書1", group: "atk", level: 1,
    stat: "atk", perTier: 5, maxPoints: 150,
    trait: { name: "会心出やすい", desc: "会心の抽選が2回になる", critRolls: 2 },
    from: "all", weight: 10, minDepth: 1, maxDepth: null,
  },
  {
    id: "atk2", name: "攻撃力アップの書2", group: "atk", level: 2,
    stat: "atk", perTier: 5, maxPoints: 200,
    trait: { name: "会心出やすい+", desc: "会心の抽選が3回になる", critRolls: 3 },
    from: null, weight: 10, minDepth: 1, maxDepth: null,
  },
  {
    id: "atk3", name: "攻撃力アップの書3", group: "atk", level: 3,
    stat: "atk", perTier: 5, maxPoints: 250,
    trait: { name: "会心ダメージUP", desc: "会心のダメージが1.5倍 → 1.8倍になる", critMultiplier: 1.8 },
    from: null, weight: 10, minDepth: 1, maxDepth: null,
  },

  // ---------- 体力アップの書 ----------
  {
    id: "hp1", name: "体力アップの書1", group: "hp", level: 1,
    stat: "hp", perTier: 20, maxPoints: 150,
    trait: { name: "回復強化", desc: "回復薬・キャンプで回復する量が10%増える", healBoost: 0.1 },
    from: "all", weight: 10, minDepth: 1, maxDepth: null,
  },
  {
    id: "hp2", name: "体力アップの書2", group: "hp", level: 2,
    stat: "hp", perTier: 20, maxPoints: 200,
    trait: { name: "回復強化+", desc: "回復薬・キャンプで回復する量が20%増える", healBoost: 0.2 },
    from: null, weight: 10, minDepth: 1, maxDepth: null,
  },
  {
    id: "hp3", name: "体力アップの書3", group: "hp", level: 3,
    stat: "hp", perTier: 20, maxPoints: 250,
    trait: { name: "食いしばり", desc: "1回の冒険で1度だけ、死ぬダメージを受けてもHP1で耐える", guts: true },
    from: null, weight: 10, minDepth: 1, maxDepth: null,
  },

  // ---------- 守備力アップの書 ----------
  {
    id: "def1", name: "守備力アップの書1", group: "def", level: 1,
    stat: "def", perTier: 10, maxPoints: 150,
    trait: { name: "頑丈", desc: "最大HPが200増える", bonusHp: 200 },
    from: "all", weight: 10, minDepth: 1, maxDepth: null,
  },
  {
    id: "def2", name: "守備力アップの書2", group: "def", level: 2,
    stat: "def", perTier: 10, maxPoints: 200,
    trait: { name: "頑丈+", desc: "最大HPが500増える", bonusHp: 500 },
    from: null, weight: 10, minDepth: 1, maxDepth: null,
  },
  {
    id: "def3", name: "守備力アップの書3", group: "def", level: 3,
    stat: "def", perTier: 10, maxPoints: 250,
    trait: { name: "急所守り", desc: "敵の会心で受けるダメージが30%減る", critTakenDown: 0.3 },
    from: null, weight: 10, minDepth: 1, maxDepth: null,
  },

  // ---------- 運の書(書3を振り切ると、書1・書2の特性もすべて発動) ----------
  {
    id: "luk1", name: "運の書1", group: "luk", level: 1,
    stat: "luk", perTier: 10, maxPoints: 150,
    trait: { name: "目利き", desc: "拾う装備の個体差がマイナスにならない", noBadRoll: true },
    from: "all", weight: 10, minDepth: 1, maxDepth: null,
  },
  {
    id: "luk2", name: "運の書2", group: "luk", level: 2,
    stat: "luk", perTier: 10, maxPoints: 200,
    trait: { name: "拾い上手", desc: "敵が落とす素材が1個増える", bonusMaterial: 1 },
    from: null, weight: 10, minDepth: 1, maxDepth: null,
  },
  {
    id: "luk3", name: "運の書3", group: "luk", level: 3,
    stat: "luk", perTier: 10, maxPoints: 250,
    trait: { name: "強運", desc: "聖水が出る確率が2倍になる。目利き・拾い上手もすべて発動する", holyWaterRate: 2, includeLower: true },
    from: null, weight: 10, minDepth: 1, maxDepth: null,
  },

  // ---------- 旅の書(キャンプ向け。書3を振り切ると、書1・書2の特性もすべて発動) ----------
  {
    id: "trv1", name: "旅の書1", group: "trv", level: 1,
    stat: "hp", perTier: 10, maxPoints: 150,
    trait: { name: "野営上手", desc: "キャンプの「休む」で回復する量が20%増える", campRestBoost: 0.2 },
    from: "all", weight: 10, minDepth: 1, maxDepth: null,
  },
  {
    id: "trv2", name: "旅の書2", group: "trv", level: 2,
    stat: "hp", perTier: 10, maxPoints: 200,
    trait: { name: "行商の知恵", desc: "キャンプの「回復薬を補充」でもらえる数が1個増える", campPotionBonus: 1 },
    from: null, weight: 10, minDepth: 1, maxDepth: null,
  },
  {
    id: "trv3", name: "旅の書3", group: "trv", level: 3,
    stat: "hp", perTier: 10, maxPoints: 250,
    trait: { name: "鍛冶の心得", desc: "キャンプの「装備を強化」が2回になる。野営上手・行商の知恵もすべて発動する", campEnhanceTimes: 2, includeLower: true },
    from: null, weight: 10, minDepth: 1, maxDepth: null,
  },
];
