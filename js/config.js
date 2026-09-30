// ゲームバランスの数値(BALANCE)と、装備枠・素材・ステータスの定義
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== ゲームバランス設定 ====================
const BALANCE = {
  // ダンジョンの階層。until 階までがその層。goalDepth 階の階段を降りると踏破(ゴール)
  layers: [
    { name: "低層",   until: 50 },
    { name: "中層",   until: 100 },
    { name: "深層",   until: 150 },
    { name: "最深層", until: 200 },
  ],
  goalDepth: 200,

  mapWidth: 60,
  mapHeight: 30,
  roomAttempts: 60,
  roomMinW: 5, roomMaxW: 12,
  roomMinH: 4, roomMaxH: 7,

  startPotions: 1,        // 冒険開始時に持っている回復薬

  // プレイヤーの素のステータス(装備なしの状態)
  playerBaseStats: { hp: 200, atk: 35, def: 0, luk: 0, agl: 50, crt: 50 },

  damageSpread: 0.2,        // ダメージのブレ幅(0.2 なら ±20%)
  critMultiplier: 1.5,      // 会心のダメージ倍率

  // 敵の会心(痛恨の一撃)
  enemyCritBase: 3,         // 地下1階での敵の会心率(%)
  enemyCritPerDepth: 0.1,   // 1階深くなるごとに上がる会心率(%)
  enemyCritMultiplier: 1.5, // 敵の会心のダメージ倍率

  // DEF(軽減率)・AGL(回避率)・CRT(会心率)・LUK(運)の、ポイント → % の換算
  // CRT・LUK の形:
  //   0 〜 softPts        :まっすぐ上がって softPercent に届く(ソフトキャップ)
  //   softPts 〜 hardPts  :だんだん伸びが鈍り、hardPts で hardPercent にぴったり届く(ハードキャップ)
  //   hardPts 以上        :それ以上は上がらない
  // DEF・AGL は強くなりすぎたので、別の形の換算にした(stepPercent を書くとこちらになる)
  //   0 〜 softPts        :まっすぐ上がって softPercent に届く
  //   そこから先          :stepPercent 上がるごとに、必要なポイントの合計が stepRate 倍になる。maxPercent で止まる
  //   DEF なら 30% = 360pt、40% = 720pt、50% = 1440pt、60% = 2880pt、70% = 5760pt、80% = 11520pt(間はまっすぐ上がる)
  defCurve: { softPts: 360, softPercent: 30, stepPercent: 10, stepRate: 2, maxPercent: 80 },
  aglCurve: { softPts: 300, softPercent: 30, stepPercent: 10, stepRate: 2, maxPercent: 80 },
  crtCurve: { softPts: 1200, softPercent: 60, hardPts: 3000, hardPercent: 90 }, // 会心が出すぎるので、必要ポイントを当初の2倍に
  // LUK(運)の%の効果:その確率で装備の個体差を2回引いて良いほうを採用 / 固有装備・書のドロップ率が % ぶん増える
  lukCurve: { softPts: 300, softPercent: 30, hardPts: 1000, hardPercent: 50 },

  // レベル・経験値
  xpBase: 10,             // Lv1 → Lv2 に必要な経験値
  xpPerLevel: 5,          // レベルが1上がるごとに、次のレベルまでに必要な経験値が増える量

  // スキルポイント(拠点にずっと貯まる)
  skillPointEveryLevels: 3,              // 何レベルごとにもらえるか(Lv1, 4, 7, 10 …)
  skillPointGainMin: 6, skillPointGainMax: 9, // 1回にもらえるポイント(この間のランダム)

  // 書(書の種類は books.js に書く)
  bookSlots: 3,           // 書を同時にセットできる数
  bookTierFirst: 5,       // 最初の段階に必要なポイント
  bookTierStep: 10,       // 2段階目からは、このポイントごとに1段階上がる(5, 15, 25, …)
  bookExchangeCost: 3,    // 1つ上のレベルの書と交換するのに必要な冊数

  // 敵の種類・強さは monsters.js に書く
  // 敵の強さの段階的な上乗せ(monsters.js の hpPerDepth / attackPerDepth とは別に、掛け算でかかる)
  //   enemyGrowthFromFloor 階から、enemyTierFloors 階ごとに一段階強くなる(11〜15階は段階1、16〜20階は段階2 …)
  //   装備やキャンプ強化・刻印でプレイヤーが強くなりすぎるので、深い階の敵が追いつけるようにするため
  enemyGrowthFromFloor: 11,
  enemyTierFloors: 5,
  enemyHpGrowthPerTier: 0.2,     // 一段階ごとに、敵のHPが +20% ずつ増える
  enemyAttackGrowthPerTier: 0.3, // 一段階ごとに、敵の攻撃力が +30% ずつ増える(矢・炎・爆発・毒も)
  monsterSightRange: 8,     // この距離(マス数)以内にプレイヤーがいると追いかけてくる
  monsterWanderChance: 0.3, // プレイヤーが遠いとき、1ターンにうろつく確率

  monsterSpawnChance: 0.8,  // 1部屋に敵がいる確率(スタートと階段の部屋にはいない)
  fieldItemsMin: 1, fieldItemsMax: 2, // 1フロアに落ちている装備の数(回復薬は床には落ちていない)
  potionHeal: 100,          // 回復薬1個で回復する量の最低値
  potionHealRatio: 0.3,     // 回復薬1個で、最大HPのこの割合だけ回復する(potionHeal より少なければ potionHeal)

  // キャンプ(階段を降りるたびに1つ選べる)
  campHealRatio: 0.5,     // 「休む」で回復するHP(最大HPに対する割合)
  campPotionGain: 2,      // 「回復薬を補充」でもらえる個数

  // 装備の強さ(装備の種類・基礎値は equipment.js に書く)
  equipTierFloors: 5,       // 何階ごとに装備が一段階強くなるか(1〜5階、6〜10階、…)
  equipGrowthPerTier: 0.5,  // 一段階ごとに、基礎値が +50% ずつ増える
  equipVariance: 0.2,       // ドロップ時の個体差(±20%)。ステータスごとに別々にかかる

  // 呪われた装備(効果の種類は effects.js に書く)
  cursedChance: 0.05,       // 拾う装備が呪われている確率(床の装備・敵が落とす装備どちらも)
  cursedStatBonus: 0.5,     // 呪われた装備の基礎値の上乗せ(0.5 なら +50%)
  cursedRollSpread: 0.3,    // 呪いの重さのブレ。良い効果の強さに近い重さになるが、この幅だけずれる

  materialRatio: 1 / 5,   // 刻んだとき、装備の性能のうち刻印になる割合
  refineBase: 1,          // 死んだときに刻める数(エリートを倒すと1体につき+1)

  // 刻印の強化(拠点の「制作」。素材を使う)
  enhanceMax: 15,           // 強化できる上限(+15)
  enhanceMinPercent: 5,     // 1回の強化で上がる量の最小(今の性能に対する%)
  enhanceMaxPercent: 15,    // 1回の強化で上がる量の最大。上に行くほど出にくい(運が高いと出やすくなる)
  enhanceCostBase: 3,       // +0 → +1 に必要な素材の数
  enhanceCostPerPlus: 2,    // +1 上がるごとに増える、必要な素材の数(+0→+1 は 3個、+1→+2 は 5個 …)
  specialEnhanceCostMultiplier: 2, // 効果つき(呪い・浄化)の刻印は、強化に使う素材がこの倍

  // 浄化(刻印の呪いを消す。呪い1つにつき聖水1個)
  holyWaterDropChance: 0.05, // エリートを倒したときに聖水を落とす確率(運で少し上がる)

  lifeStealCapPerPercent: 3, // 効果「吸血」の1回の回復の上限。吸血1%につきこれだけ(吸血5%なら15まで。変えたら effects.js の説明文の「3」も直す)
  poisonHitTurns: 5,       // 効果「毒刃」で敵が毒になるターン数
  poisonHitChance: 0.2,     // 効果「毒刃」が発動する確率(変えたら effects.js の説明文の「20%」も直す)

  // エリート(決まった階ごとに、階段の部屋に1体だけ出る。倒すまで階段は封印される)
  eliteEveryFloors: 10,     // 何階ごとに出るか(10, 20, 30 …階)
  eliteHpMultiplier: 3,     // 元の敵に対するHPの倍率
  eliteAttackMultiplier: 1.5, // 攻撃力の倍率
  eliteXpMultiplier: 5,     // 経験値の倍率
  eliteDropMultiplier: 10,  // 固有装備を落とす確率の倍率(元の確率 × これ)
  eliteColor: "#ffd700",    // マップ上の色(金色)
  eliteMaterialMultiplier: 10, // 素材を落とす数の倍率
  eliteMinFloorsSeen: 2,    // 出始めてからこの階数たっていない敵は、エリートにならない(10階なら8階までに出始めた敵だけ)
  // エリートがいる階段の部屋は、ふつうの部屋より大きい
  eliteRoomMinW: 14, eliteRoomMaxW: 18,
  eliteRoomMinH: 8,  eliteRoomMaxH: 10,

  logMaxLines: 50,        // ログに残しておく行数
  moveRepeatMs: 60,       // 移動キーを押しっぱなしにしたとき、何ミリ秒に1回動くか(大きいほどゆっくり)
  giveUpHoldMs: 1500,     // X キーを何ミリ秒押し続けると自害するか
};

// ==================== スロット・ステータス定義 ====================
// 装備の種類(equipment.js の slot に書くもの)
//   name:表示名 / symbol:マップ上の記号 / cls:マップ上の色(CSS のクラス名) / slots:着けられる枠
//   resource:その種類の刻印を強化するときに使う素材(RESOURCE_TYPES のどれか)
//   指輪とイヤリングは枠が2つあり、どちらにでも着けられる
//   ここに書いた順番が、制作・図鑑などで並ぶ順番になる(武器が一番上)
const ITEM_TYPES = {
  weapon:  { name: "武器",       symbol: "/", cls: "weapon",  slots: ["weapon"],               resource: "ore" },
  shield:  { name: "盾",         symbol: ")", cls: "shield",  slots: ["shield"],               resource: "ore" },
  head:    { name: "頭",         symbol: "[", cls: "armor",   slots: ["head"],                 resource: "bone" },
  body:    { name: "胴",         symbol: "[", cls: "armor",   slots: ["body"],                 resource: "hide" },
  waist:   { name: "腰",         symbol: "[", cls: "armor",   slots: ["waist"],                resource: "hide" },
  feet:    { name: "足",         symbol: "[", cls: "armor",   slots: ["feet"],                 resource: "plant" },
  ring:    { name: "指輪",       symbol: "=", cls: "ring",    slots: ["ring1", "ring2"],       resource: "ore" },
  earring: { name: "イヤリング", symbol: '"', cls: "earring", slots: ["earring1", "earring2"], resource: "plant" },
};

// 素材の系統(monsters.js の material に書くもの)。死んでも拠点に持ち帰れる
//   聖水だけは敵の系統ではなく、エリートがまれに落とす(刻印の浄化に使う)
const RESOURCE_TYPES = {
  bone:  { name: "骨",   color: "#e8e8e8" },
  hide:  { name: "皮",   color: "#c8a070" },
  ore:   { name: "鉱石", color: "#a0a0ff" },
  plant: { name: "植物", color: "#6fcf5f" },
  holy:  { name: "聖水", color: "#9fe0ff" },
};

// 装備枠(10個)の表示名。ここに書いた順番が、装備欄・刻印・持ち物などで並ぶ順番になる(武器が一番上)
const EQUIP_SLOTS = {
  weapon: "武器", shield: "盾",
  head: "頭", body: "胴", waist: "腰", feet: "足",
  ring1: "指輪1", ring2: "指輪2", earring1: "イヤリング1", earring2: "イヤリング2",
};

// 持ち物画面のタブ
const INV_TABS = [
  { id: "tool",     name: "道具" },
  { id: "equip",    name: "装備" },
  { id: "status",   name: "ステータス" }, // 見るだけ
  { id: "trait",    name: "特性" },       // 見るだけ
  { id: "material", name: "素材" },   // 素材(拠点に持ち帰っている数を見るだけ)
  { id: "other",    name: "その他" }, // まだ何もない(今後追加予定)
];

const STAT_NAMES = { hp: "HP", atk: "ATK", def: "DEF", luk: "LUK", agl: "AGL", crt: "CRT" };
