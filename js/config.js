// ゲームバランスの数値(BALANCE)と、装備枠・素材・ステータスの定義
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== ゲームバランス設定 ====================
const BALANCE = {
  // ダンジョンの階層。until 階までがその層。goalDepth 階の階段を降りると踏破(ゴール)
  //   enemySlope:その層での、敵の「1階ごとの上がり幅」の倍率(深い層ほど、1階降りるごとに強くなる量が大きい)
  //   enemyBoost:その層の敵のHP・攻撃力にかける倍率(層に入った瞬間に、一段強くなる)
  //   深い層は、やりこんだ前提の強さにするため(中層から下の数値は仮)
  layers: [
    { name: "低層",   until: 50,  enemySlope: 1,   enemyBoost: 1 },
    { name: "中層",   until: 100, enemySlope: 1.5, enemyBoost: 1.2 },
    { name: "深層",   until: 150, enemySlope: 2,   enemyBoost: 1.4 },
    { name: "最深層", until: 200, enemySlope: 3,   enemyBoost: 1.6 },
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
  // 敵の強さの伸び方:1階深くなるごとに、monsters.js の hpPerDepth / attackPerDepth ずつ足していく(まっすぐ伸びる)
  //   enemySteepFromFloor 階からは、1階ごとの上がり幅が大きくなる(装備やキャンプ強化・刻印で強くなるプレイヤーに追いつくため)
  //   さらに層ごとに、上がり幅の倍率(layers の enemySlope)と、層に入ったときの段差(enemyBoost)がかかる
  //   いまの値は「40階で、前の作り(5階ごとに掛け算で強くなる形)とだいたい同じ強さ」になるようにしてある
  enemySteepFromFloor: 11,
  enemySteepHp: 2.8,      // その階からの、HPの上がり幅の倍率(hpPerDepth の何倍ずつ増えるか)
  enemySteepAttack: 4.1,  // その階からの、攻撃力の上がり幅の倍率(矢・炎・爆発・毒も)
  // ドラゴンの攻撃(どの敵がどう使うかは monsters.js の ability: { type: "dragon", … })
  breathFalloff: 0.15,      // ブレスのダメージが、口から1マス離れるごとに下がる割合(1マス目100% → 2マス目85% …)
  ballSpeed: 2,             // 属性の球が1ターンに進むマス数
  monsterSightRange: 8,     // この距離(マス数)以内にプレイヤーがいると追いかけてくる
  blindSightRadius: 2,      // 盲目のとき、プレイヤーが見える範囲(マス数)。その外の敵・物は見えず、一度見た地形だけ薄く残る
  confuseStumbleChance: 0.5, // 混乱のとき、動く(殴る)方向が、ほかの3方向のどれかにずれる確率
  bindGuardTurns: 3,         // 拘束が解けたあと、このターン数は、また拘束されない(ずっと動けないのを防ぐ)
  lowHpRate: 0.2,            // HP がこの割合以下になると、画面のふちが赤く脈打つ(演出)
  // エクリプスメテオが落ちたあとに続く爆発の演出(効果音 SE_SOUNDS.meteor の「続く爆発」と時刻を合わせる)
  //   at:落ちてから何ミリ秒後か / shake:揺れの大きさ(small / mid / big / rumble=だんだん弱まる長い地鳴り)/ flash:オレンジの光の強さ(0〜1)
  meteorAftershocks: [{ at: 600, shake: "mid", flash: 0.55 },
                      { at: 1300, shake: "mid", flash: 0.4 },
                      { at: 2200, shake: "rumble", flash: 0.25 }],
  chillEnemySpeed: 2,        // 凍えている(氷)あいだ、敵の速さが何倍になるか(2 なら、こちらが1回動くあいだに敵が2回動く)
  shockStunChance: 0.3,      // しびれている(雷)あいだ、行動したあとに体がしびれて、1ターン動けなくなる確率
  fairyWarpMinDistance: 15,  // いたずら妖精に飛ばされる先は、なるべく今いるところからこのマス数(縦+横)以上離れたところ
  monsterWanderChance: 0.3, // プレイヤーが遠いとき、1ターンにうろつく確率

  monsterSpawnChance: 0.8,  // 1部屋に敵がいる確率(スタートと階段の部屋にはいない)
  fieldItemsMin: 1, fieldItemsMax: 2, // 1フロアに落ちている装備の数(回復薬は床には落ちていない)
  chestChance: 0.35,            // 1フロアに宝箱が1つ出る確率(0.35 なら3階に1つくらい)
  chestDoubleChance: 0.15,      // 宝箱から装備が2個出る確率
  mimicChance: 0.15,            // 宝箱を置くとき、ミミック(宝箱に化けた敵)になる確率(出始める階は monsters.js の mimic の minDepth)

  // ダメージ床(罠。種類は js/hazard.js の HAZARD_TYPES)。部屋の中に小さな水たまりの形で置く。敵は平気
  //   上にいるあいだ、行動するたびにダメージ + 短い状態異常(回避できない。DEF・種類「地形」と属性の軽減は効く)
  hazardPoolsMin: 0, hazardPoolsMax: 2, // 1フロアのかたまりの数
  hazardPoolMin: 3,  hazardPoolMax: 6,  // 1つのかたまりのマス数
  // 種類ごと:出始める階 / ダメージ(1階の値と、1階ごとの上がり幅。敵の攻撃と同じ伸び方)/ 状態異常の毎ターンのダメージ(同じく)/ 状態異常のターン数
  hazards: {
    poison: { minDepth: 5,  damage: 8,  damagePerDepth: 0.8, dotDamage: 3, dotDamagePerDepth: 0.3, dotTurns: 2 },
    magma:  { minDepth: 15, damage: 25, damagePerDepth: 1.5, dotDamage: 6, dotDamagePerDepth: 0.4, dotTurns: 2 },
    ice:    { ailTurns: 2 }, // 凍った床(凛龍のブレスの跡。部屋には置かない):上にいるあいだ凍えが切れない。出たら ailTurns ターンで抜ける
    fog:    { dotDamage: 12, dotDamagePerDepth: 0.5, dotTurns: 3, blindTurns: 2 }, // 毒の霧(瘴龍の球の跡):中にいるあいだ盲目と毒(ダメージは毒だけ)
  },
  chestMonsterGearChance: 0.25, // 宝箱の中身が、床の装備ではなく「この階に出る敵の固有装備」になる確率
  potionHeal: 100,          // 回復薬1個で回復する量の最低値
  potionHealRatio: 0.3,     // 回復薬1個で、最大HPのこの割合だけ回復する(potionHeal より少なければ potionHeal)

  // 階段の道(階段を降りるたびに選ぶ。道の種類は route.js の STAIR_ROUTES)。効果は次の1階だけ
  routeExtraMin: 1, routeExtraMax: 2, // 「ふつうの道」のほかに出る道の数(この間のランダム)
  // 険しい道:敵のHP・攻撃力の倍率 / 敵がいる確率の倍率 / 素材の倍率 / 固有装備のドロップ率の倍率
  routeRough: { enemyHp: 1.3, enemyAttack: 1.3, spawnRate: 1.25, materialRate: 2, dropRate: 2 },
  // 静かな道:敵がいる確率の倍率 / 床に落ちている装備の数
  routeQuiet: { spawnRate: 0.5, itemsMin: 0, itemsMax: 1 },
  // 暗闇の道:部屋を作る回数の倍率(部屋が少なくなる)/ 1部屋に出る敵の最大数 / 宝箱が出る確率(1 なら必ず)/ 見える範囲(マス数)
  routeDark: { roomRate: 0.5, monstersPerRoom: 2, chestChance: 1, sightRadius: 5 },
  routeHoleFloors: 3,     // 深い穴で一気に落ちる階数(途中にエリートの階があれば、そこで止まる)

  // 酒場の依頼(依頼の型は js/quests.js の QUEST_TYPES)。報酬はゴールド
  questBoardSize: 5,        // 掲示板に並ぶ普通の依頼の数
  questMaxAccepted: 3,      // 同時に受けられる普通の依頼の数(特殊依頼は別にもう1つ)
  specialQuestChance: 0.35, // 掲示板が新しくなるとき、特殊依頼が1つ出る確率
  questBigChance: 0.2,      // 普通の依頼が「大口」になる確率(数が多い・階が深い代わりに、報酬が多い)
  questBigCount: 1.5,       // 大口の討伐数の倍率
  questBigDepth: 5,         // 大口の到達の階の上乗せ
  questBigReward: 1.5,      // 大口の報酬の倍率
  questSpecialReward: 2,    // 特殊依頼の報酬の倍率
  questGoldPerDepth: 0.1,   // 報酬が、依頼の階が1階深いごとに増える割合
  questGoldSpread: 0.15,    // 報酬のブレ(±15%)
  // 依頼の型ごとの報酬のもと(これ × 数や階 × 深さの倍率)
  questGold: { kill: 10, clanKill: 8, reach: 12, elite: 150, noPotion: 20, sneak: 15, rough: 100 },

  // 道具屋(品ぞろえと道具の効果は js/shop.js)
  shopBuildCost: { plant: 40, hide: 25, bone: 5 }, // 道具屋を建てる素材(5階までに出る敵から集まるもの)
  carrySlots: 3,            // 冒険に持ちこめる道具の枠の数(投げナイフ10本で1枠)
  smokeRadius: 5,           // 煙玉:この距離(マス)以内の敵がこちらを見失う
  smokeBlindTurns: 3,       // 煙玉:見失った敵が、また気づけるようになるまでの行動回数
  knifeRange: 8,            // 投げナイフ:届く距離(マス)
  knifePowerRate: 0.6,      // 投げナイフ:ATK に対するダメージの割合(気づいていない敵には不意打ちで2倍)
  whetstoneAtk: 0.2,        // 砥石:その階のあいだ ATK がこの割合だけ上がる
  frenzyAtk: 1.3,           // 狂熱の香薬:その階のあいだの攻撃力の倍率
  frenzyTaken: 1.25,        // 狂熱の香薬:その階のあいだの、受けるダメージの倍率
  stealthFloorsMin: 1, stealthFloorsMax: 3, // 忍び足の香:効く階の数(使うたびにこの間のランダム)
  stealthSightRate: 0.5,    // 忍び足の香:効いているあいだの、敵の見える距離の倍率
  firebombRange: 8,         // 火炎瓶:届く距離(マス)
  firebombPowerRate: 0.8,   // 火炎瓶:ATK に対するダメージの割合(当たった場所の周り3×3の敵全部に)

  // 鍛冶屋(作れる装備・腕前の段階は js/smithy.js)
  smithBuildCost: { hide: 40, bone: 20, ore: 20 }, // 鍛冶屋を建てる素材(10階くらいまでに集まる素材)
  smithQuality: 0.6,        // 鍛冶屋の装備の性能(1〜5階の床の装備のもとの何割か)
  smithGrowthPerLevel: 0.15, // 腕前が1段階上がるごとに、性能が「もとの何割」ぶん増えるか(最後まで上げても 0.6 + 0.15×4 = 0.96。上がりすぎないように)
  smithOrderGold: 30,       // 1つ注文するのに使うゴールド(腕前が1段階上がるごとに、この分ずつ増える)
  smithOrderResource: 3,    // 1つ注文するのに使う、その部位の素材(腕前が1段階上がるごとに +2)

  // キャンプ(階段を降りるたびに1つ選べる)
  campHealRatio: 0.5,     // 「休む」で回復するHP(最大HPに対する割合)
  campPotionGain: 2,      // 「回復薬を補充」でもらえる個数

  // 装備の強さ(装備の種類・基礎値は equipment.js に書く)
  equipTierFloors: 5,       // 何階ごとに装備が一段階強くなるか(1〜5階、6〜10階、…)
  equipGrowthPerTier: 0.5,  // 一段階ごとに、基礎値が +50% ずつ増える
  equipVariance: 0.2,       // ドロップ時の個体差(±20%)。ステータスごとに別々にかかる

  // 謎の塊(敵がまれに落とす。キャンプに入ると鑑定されて、レア度つきの装備になる。鑑定前に死ぬとなくなる)
  lumpDropChance: 0.01,     // 倒した敵が謎の塊を落とす確率(エリートは eliteDropMultiplier 倍。運で少し上がる)
  lumpCursedChance: 0.05,   // 謎の塊を鑑定した装備が呪われている確率(レア度の性能に、呪いの基礎値と良い効果1+呪い1が上乗せ)

  // 宝の地図(敵がまれに落とす。道具の枠を1つ使う。書かれた階に印 X があり、乗ると宝を掘り出せる。死ぬとなくなる)
  mapDropChance: 0.005,     // 倒した敵が宝の地図を落とす確率(エリートは eliteDropMultiplier 倍。運で少し上がる)
  mapDepthMin: 3, mapDepthMax: 10, // 地図に書かれる階:拾った階の何階先か(この間のランダム。goalDepth より深くはならない)
  mapRewardItems: 3,        // 掘り出したときの装備の数(宝箱と同じ選び方)
  mapLumpChance: 0.5,       // 掘り出したとき、謎の塊も1つ出る確率

  // 呪われた装備(効果の種類は effects.js に書く)
  cursedChance: 0.05,       // 拾う装備が呪われている確率(床の装備・敵が落とす装備どちらも)
  cursedStatBonus: 0.5,     // 呪われた装備の基礎値の上乗せ(0.5 なら +50%)
  cursedRollSpread: 0.3,    // 呪いの重さのブレ。良い効果の強さに近い重さになるが、この幅だけずれる

  shieldBlockMax: 90,     // 盾で防ぐ% の上限(ゴブリン一族のセット効果などで増えても、ここまで)
  materialRatio: 1 / 5,   // 刻んだとき、装備の性能のうち刻印になる割合
  weaponKindBonus: 0.1,   // 武器の刻印が、着けている武器と同じジャンル(WEAPON_KINDS)なら、刻印の数値がこの割合だけ増える
  // 武器のジャンルごとの攻撃の形(js/combat.js の tryMove)
  sneakHits: 2,           // 不意打ち(気づいていない敵を殴る)の攻撃回数
  daggerSneakHits: 3,     // 短剣:不意打ちの攻撃回数
  fangHits: 2,            // 爪牙:1回殴ると、この回数だけ攻撃する(会心はそれぞれ判定)
  fangRate: 0.5,          // 爪牙:1回あたりのダメージの割合
  spearPierceRate: 0.5,   // 槍:殴った敵の後ろ(2マス先)の敵へのダメージの割合
  axeSideRate: 0.7,       // 斧:殴った敵の左右(こちらのとなりのマス)の敵へのダメージの割合
  scytheRate: 0.5,        // 鎌:殴った敵のほか、自分の周り8マスの敵へのダメージの割合
  bowRange: 5,            // 弓:R で撃って届く距離(マス。縦横まっすぐ・壁で止まる)
  bowShotRate: 0.8,       // 弓:2マス先の敵に撃ったときのダメージの割合
  bowFalloff: 0.1,        // 弓:そこから1マス遠くなるごとに下がる割合(3マス 0.7 / 4マス 0.6 / 5マス 0.5)
  bowMeleeRate: 0.5,      // 弓:となりの敵を殴る・撃つときのダメージの割合(不意打ちはある)
  // 床の装備などから刻んだ刻印のレア度(名前が変わる)。刻んだ装備の個体差(各ステータスの±%)の平均で決める
  //   上から順に見て、平均が minRoll(%)以上の最初のものになる。名前は「word + 部位 + の刻印」(例:輝く胴の刻印)
  //   呪われた装備の基礎値の上乗せ(+50%)は関係なく、個体差だけで決める
  //   敵の固有装備から刻んだ刻印は、equipment.js の materialName(その装備だけの名前)になる
  materialRanks: [
    { rank: "極", word: "輝く",     minRoll: 14 },
    { rank: "上", word: "鮮やかな", minRoll: 7 },
    { rank: "良", word: "確かな",   minRoll: 0 },
    { rank: "並", word: "かすれた", minRoll: -Infinity },
  ],
  refineBase: 1,          // 死んだときに刻める数(エリートを倒すと1体につき+1)
  // 刻印を持てる数の上限(セーブが大きくなりすぎないように)
  materialMax: 1000,
  materialDiveFree: 10,   // 空きがこの数より少ないと、ダンジョンに潜れない(解体・合成で減らす)

  // 刻印の強化(拠点の「制作」。素材を使う)
  enhanceMax: 15,           // 強化できる上限(+15)
  enhanceMinPercent: 5,     // 1回の強化で上がる量の最小(今の性能に対する%)
  enhanceMaxPercent: 15,    // 1回の強化で上がる量の最大。上に行くほど出にくい(運が高いと出やすくなる)
  enhanceCostBase: 3,       // +0 → +1 に必要な素材の数
  enhanceCostPerPlus: 2,    // +1 上がるごとに増える、必要な素材の数(+0→+1 は 3個、+1→+2 は 5個 …)
  specialEnhanceCostMultiplier: 2, // 効果つき(呪い・浄化)の刻印は、強化に使う素材がこの倍

  // 解体(サルベージ):刻印を素材に戻す。戻るのは「刻印の価値」× salvageRate
  //   刻印の価値 = salvageBaseValue(合成したものは2個分)+ 強化に使った素材の合計
  salvageRate: 0.5,
  salvageBaseValue: 6,
  leftoverSalvageAmount: 1, // 冒険の終わりに、刻まなかった装備1個から戻る素材の数(その部位の素材)

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
  engraveToTownMs: 900,   // 最後に刻んだあと、拠点へ移るまでのミリ秒(刻んだ光 fx-engrave を見せるため。style.css の 0.9s と同じ)
  touchRepeatDelayMs: 300, // スマホの十字キー:押しっぱなしにしてから、続けて動き始めるまでのミリ秒(そのあとは moveRepeatMs ごと)

  // 図鑑の敵:倒した数で、分かることが増える(js/townscreens.js の dexDetailHTML)
  //   [1, 5, 20] → 1体:強さ(★)・速さ・群れ・一族 / 5体:特徴・素材・固有装備 / 20体:くわしい数字・出る階
  dexRevealKills: [1, 5, 20],
  // 図鑑の敵の強さの★(1〜5個)。その敵が出始める階で、同じ階に出る敵の平均の何倍か
  //   この値より小さければ ★ / ★★ / ★★★ / ★★★★、どれより大きければ ★★★★★
  dexStarRatios: [0.6, 0.85, 1.2, 1.7],

  // 効果音(js/sound.js。音の形は下の SE_SOUNDS)
  seVolumeDefault: 50,    // 最初の音量(0〜100)
  seVolumeStep: 10,       // 設定画面で1回に変わる音量
  seMasterGain: 0.3,      // 全体の大きさ(音量100のとき。大きすぎて割れないように小さめ)
  seRepeatGapMs: 40,      // 同じ音をこのミリ秒以内にもう一度鳴らさない(敵がたくさんいるとき、重なってうるさくならないように)
};

// ==================== 効果音の形 ====================
// 音のファイルは使わず、js/sound.js がこの表からその場で音を作る(暗く不気味なレトロの音)
// 1つの音は「音のかけら」の並び。かけら1つの形:
//   wave:音の種類(sine=丸い / triangle=やわらかい / square=ファミコンっぽい / sawtooth=ざらざら / noise=ザッという雑音)
//   freq:始まりの音の高さ(Hz。大きいほど高い。440 = ラ) / to:(省略できる)終わりの高さ。だんだんこの高さに変わる
//   at:鳴り始め(秒。0 ならすぐ) / dur:長さ(秒) / vol:大きさ(0〜1)
//   lp:(省略できる)この高さ(Hz)より上を削って、こもった音にする。小さいほど暗くこもる
//   少しだけずらした高さ(110 と 113 など)を重ねると、音がうなって不気味になる
const SE_SOUNDS = {
  // 攻撃が当たる「ドスッ」(こもった肉を打つ音)
  //   (何度も鳴るので、おとなしめ。小さく・短く・こもらせている)
  hit:     [{ wave: "noise", lp: 600, at: 0, dur: 0.05, vol: 0.35 },
            { wave: "sine", freq: 120, to: 55, at: 0, dur: 0.07, vol: 0.3 }],
  // 会心の一撃「ザグッ」(骨まで届くような重い音。ふつうより少しだけ強い)
  crit:    [{ wave: "noise", lp: 1200, at: 0, dur: 0.09, vol: 0.45 },
            { wave: "sawtooth", freq: 150, to: 45, at: 0, dur: 0.1, lp: 500, vol: 0.18 },
            { wave: "sine", freq: 90, to: 40, at: 0.02, dur: 0.15, vol: 0.4 }],
  // ダメージを受ける「ズン」(低いうなり。おとなしめ)
  hurt:    [{ wave: "sawtooth", freq: 100, to: 50, at: 0, dur: 0.14, lp: 300, vol: 0.25 },
            { wave: "noise", lp: 250, at: 0, dur: 0.07, vol: 0.25 }],
  // アイテムを拾う「カチッ…コト」(乾いた音)
  pickup:  [{ wave: "square", freq: 1400, at: 0, dur: 0.015, lp: 2500, vol: 0.25 },
            { wave: "triangle", freq: 180, to: 150, at: 0.03, dur: 0.08, vol: 0.5 }],
  // レベルアップ:ゆっくり上がる不穏な和音(ラ・ド・ミ♭・ラ。減和音)。最後はうなりながら消える
  levelup: [{ wave: "triangle", freq: 220, at: 0, dur: 0.18, lp: 1200, vol: 0.5 },
            { wave: "triangle", freq: 262, at: 0.14, dur: 0.18, lp: 1200, vol: 0.5 },
            { wave: "triangle", freq: 311, at: 0.28, dur: 0.18, lp: 1200, vol: 0.5 },
            { wave: "triangle", freq: 440, at: 0.42, dur: 0.9, lp: 1200, vol: 0.45 },
            { wave: "triangle", freq: 446, at: 0.42, dur: 0.9, lp: 1200, vol: 0.3 }],
  // 階段を降りる「ゴト…ゴト…ゴト」(暗い奥へ下りていく足音)
  stairs:  [{ wave: "noise", lp: 250, at: 0, dur: 0.09, vol: 0.7 },
            { wave: "sine", freq: 110, to: 70, at: 0, dur: 0.12, vol: 0.5 },
            { wave: "noise", lp: 220, at: 0.22, dur: 0.09, vol: 0.6 },
            { wave: "sine", freq: 98, to: 62, at: 0.22, dur: 0.12, vol: 0.45 },
            { wave: "noise", lp: 180, at: 0.44, dur: 0.1, vol: 0.5 },
            { wave: "sine", freq: 82, to: 50, at: 0.44, dur: 0.18, vol: 0.4 }],
  // 死ぬ「ゴーン…」(弔いの鐘。うなりながら長く響く)
  death:   [{ wave: "sine", freq: 110, to: 104, at: 0, dur: 2.6, vol: 0.7 },
            { wave: "sine", freq: 113, to: 107, at: 0, dur: 2.6, vol: 0.4 },
            { wave: "triangle", freq: 304, at: 0, dur: 1.2, lp: 1500, vol: 0.25 },
            { wave: "triangle", freq: 594, at: 0, dur: 0.6, lp: 1500, vol: 0.12 },
            { wave: "noise", lp: 150, at: 0, dur: 1.5, vol: 0.3 }],
  // 自分の墓に初めて乗った「カーン…」(遠くで鳴る、小さく短い弔いの鐘。death より高く・小さく)
  grave:   [{ wave: "sine", freq: 220, to: 216, at: 0, dur: 1.8, vol: 0.3 },
            { wave: "sine", freq: 226, to: 222, at: 0, dur: 1.8, vol: 0.18 },
            { wave: "triangle", freq: 608, at: 0, dur: 0.8, lp: 1500, vol: 0.1 },
            { wave: "triangle", freq: 1188, at: 0, dur: 0.4, lp: 1800, vol: 0.04 }],
  // 設定画面で音量を変えたときのお試し「コッ」
  test:    [{ wave: "triangle", freq: 330, to: 280, at: 0, dur: 0.07, vol: 0.5 }],

  // ---- 宝箱・ミミック(js/treasure.js) ----
  // 宝箱を開ける「ギィ…コト」(古いふたがきしんで、落ちる)
  chest:   [{ wave: "sawtooth", freq: 70, to: 95, at: 0, dur: 0.35, lp: 500, vol: 0.25 },
            { wave: "sawtooth", freq: 72, to: 98, at: 0, dur: 0.35, lp: 500, vol: 0.15 },
            { wave: "noise", lp: 300, at: 0.38, dur: 0.08, vol: 0.5 },
            { wave: "triangle", freq: 160, to: 120, at: 0.38, dur: 0.12, vol: 0.45 }],
  // ミミックだった「ガチン!」(かみつく音のあと、濁った低いうなり)
  mimic:   [{ wave: "noise", lp: 2500, at: 0, dur: 0.05, vol: 0.6 },
            { wave: "square", freq: 900, to: 300, at: 0, dur: 0.04, lp: 2000, vol: 0.2 },
            { wave: "sawtooth", freq: 65, at: 0.04, dur: 0.5, lp: 350, vol: 0.35 },
            { wave: "sawtooth", freq: 69, at: 0.04, dur: 0.5, lp: 350, vol: 0.3 }],

  // ---- 龍の技(属性ごと。名前は skill_ + 属性。js/enemyskills.js) ----
  // 火「ゴウッ」(ブレス・爆炎・マグマ)
  skill_fire:    [{ wave: "noise", lp: 800, at: 0, dur: 0.7, vol: 0.6 },
                  { wave: "sawtooth", freq: 90, to: 45, at: 0, dur: 0.6, lp: 400, vol: 0.3 }],
  // 氷「キーン…」(ブレス・氷の壁・凍てつく風。割れる音のあと、冷たい響き)
  skill_ice:     [{ wave: "noise", lp: 2500, at: 0, dur: 0.06, vol: 0.4 },
                  { wave: "triangle", freq: 1180, to: 1100, at: 0, dur: 0.9, lp: 3000, vol: 0.12 },
                  { wave: "triangle", freq: 1195, to: 1112, at: 0, dur: 0.9, lp: 3000, vol: 0.1 },
                  { wave: "sine", freq: 80, to: 60, at: 0, dur: 0.5, vol: 0.35 }],
  // 雷「バリッ…ゴロゴロ」(ブレス・落雷・電光石火)
  skill_thunder: [{ wave: "noise", at: 0, dur: 0.1, vol: 0.5 },
                  { wave: "square", freq: 1800, to: 150, at: 0, dur: 0.1, lp: 3000, vol: 0.12 },
                  { wave: "noise", lp: 180, at: 0.08, dur: 1.0, vol: 0.6 },
                  { wave: "sawtooth", freq: 55, to: 40, at: 0.08, dur: 1.0, lp: 200, vol: 0.3 }],
  // 毒「ジュウ…」(ブレス・脱皮。泡立つような、うなる音)
  skill_poison:  [{ wave: "noise", lp: 1800, at: 0, dur: 0.6, vol: 0.25 },
                  { wave: "sine", freq: 150, to: 95, at: 0, dur: 0.7, vol: 0.3 },
                  { wave: "sine", freq: 154, to: 98, at: 0, dur: 0.7, vol: 0.25 }],

  // ---- ベヒーモスの技(js/enemyskills.js) ----
  // 地響き「ドォン」
  quake:   [{ wave: "noise", lp: 120, at: 0, dur: 0.8, vol: 0.8 },
            { wave: "sine", freq: 60, to: 30, at: 0, dur: 0.8, vol: 0.6 }],
  // 咆哮「グオォォ…」
  roar:    [{ wave: "sawtooth", freq: 110, to: 70, at: 0, dur: 1.0, lp: 600, vol: 0.35 },
            { wave: "sawtooth", freq: 116, to: 73, at: 0, dur: 1.0, lp: 600, vol: 0.3 },
            { wave: "noise", lp: 500, at: 0, dur: 0.9, vol: 0.3 }],
  // エクリプスメテオの詠唱が始まる「ヴォォン…」(地の底からのうなり)
  meteorOmen: [{ wave: "sine", freq: 55, to: 50, at: 0, dur: 2.0, vol: 0.6 },
               { wave: "sine", freq: 58, to: 52, at: 0, dur: 2.0, vol: 0.5 },
               { wave: "sawtooth", freq: 110, to: 100, at: 0, dur: 2.0, lp: 250, vol: 0.2 }],
  // エクリプスメテオが落ちる「ズドドォォン…ゴゴゴ…」(大爆発のあと、爆発が何度も続き、地の底まで長く響く)
  meteor:  [{ wave: "noise", lp: 5000, at: 0, dur: 0.25, vol: 0.8 },                      // 最初の「バァン!」
            { wave: "noise", lp: 250, at: 0, dur: 4.0, vol: 1.0 },                        // 長い爆風
            { wave: "sine", freq: 90, to: 20, at: 0, dur: 3.5, vol: 0.8 },                // 腹に響く「ドォォン」
            { wave: "sawtooth", freq: 55, to: 25, at: 0, dur: 3.0, lp: 200, vol: 0.35 },  // 2つずらして、うなるように
            { wave: "sawtooth", freq: 58, to: 27, at: 0, dur: 3.0, lp: 200, vol: 0.3 },
            { wave: "noise", lp: 1500, at: 0.2, dur: 2.0, vol: 0.25 },                    // 岩が砕けて降る「ザァァ」
            { wave: "noise", lp: 600, at: 0.6, dur: 0.7, vol: 0.7 },                      // 続く爆発(1回目)
            { wave: "sine", freq: 70, to: 30, at: 0.6, dur: 0.8, vol: 0.5 },
            { wave: "noise", lp: 450, at: 1.3, dur: 0.9, vol: 0.6 },                      // 続く爆発(2回目)
            { wave: "sine", freq: 60, to: 28, at: 1.3, dur: 1.0, vol: 0.45 },
            { wave: "noise", lp: 300, at: 2.2, dur: 1.5, vol: 0.5 },                      // 続く爆発(3回目・遠くなる)
            { wave: "sine", freq: 40, to: 18, at: 0.5, dur: 4.5, vol: 0.5 }],             // 最後まで残る地鳴り

  // ---- 実績・刻む ----
  // 実績を取った「チリン…チリン」(暗めの小さな鐘が2つ。2つ目は不穏な音程で下がる。js/screens.js)
  achieve: [{ wave: "triangle", freq: 880, at: 0, dur: 0.6, lp: 2500, vol: 0.25 },
            { wave: "triangle", freq: 887, at: 0, dur: 0.6, lp: 2500, vol: 0.15 },
            { wave: "triangle", freq: 622, at: 0.2, dur: 0.9, lp: 2500, vol: 0.25 },
            { wave: "triangle", freq: 627, at: 0.2, dur: 0.9, lp: 2500, vol: 0.15 }],
  // 刻む「カン…カン」(石に彫りこむ音。js/items.js)
  engrave: [{ wave: "noise", lp: 3000, at: 0, dur: 0.03, vol: 0.5 },
            { wave: "triangle", freq: 1050, to: 1000, at: 0, dur: 0.25, lp: 2500, vol: 0.2 },
            { wave: "noise", lp: 3000, at: 0.18, dur: 0.03, vol: 0.45 },
            { wave: "triangle", freq: 940, to: 900, at: 0.18, dur: 0.3, lp: 2500, vol: 0.18 },
            { wave: "sine", freq: 220, at: 0.18, dur: 0.5, vol: 0.15 }],

  // ---- 状態異常にかかった(種類ごと。名前は ail_ + 種類。js/ailments.js) ----
  // 毒「ゴポッ」(泡がはじける)
  ail_poison:  [{ wave: "sine", freq: 300, to: 120, at: 0, dur: 0.15, vol: 0.4 },
                { wave: "sine", freq: 260, to: 100, at: 0.12, dur: 0.15, vol: 0.3 }],
  // やけど「ジュッ」
  ail_burn:    [{ wave: "noise", lp: 2500, at: 0, dur: 0.18, vol: 0.35 },
                { wave: "sawtooth", freq: 200, to: 90, at: 0, dur: 0.15, lp: 800, vol: 0.15 }],
  // 鈍足「ズゥン」(音がのろく沈む)
  ail_slow:    [{ wave: "triangle", freq: 220, to: 80, at: 0, dur: 0.45, lp: 800, vol: 0.4 }],
  // 盲目「フッ」(明かりが消える)
  ail_blind:   [{ wave: "noise", lp: 500, at: 0, dur: 0.35, vol: 0.3 },
                { wave: "sine", freq: 400, to: 150, at: 0, dur: 0.35, vol: 0.2 }],
  // 混乱「ウワン」(音がゆらぐ)
  ail_confuse: [{ wave: "triangle", freq: 300, to: 420, at: 0, dur: 0.12, vol: 0.3 },
                { wave: "triangle", freq: 420, to: 280, at: 0.12, dur: 0.12, vol: 0.3 },
                { wave: "triangle", freq: 280, to: 400, at: 0.24, dur: 0.15, vol: 0.25 }],
  // 拘束「ギュッ」(締めつけられる)
  ail_bind:    [{ wave: "sawtooth", freq: 90, to: 140, at: 0, dur: 0.2, lp: 600, vol: 0.3 },
                { wave: "noise", lp: 400, at: 0.18, dur: 0.06, vol: 0.4 }],
  // 凍え「ピキッ」
  ail_chill:   [{ wave: "triangle", freq: 1500, to: 1300, at: 0, dur: 0.08, lp: 3000, vol: 0.2 },
                { wave: "noise", lp: 3000, at: 0, dur: 0.04, vol: 0.25 },
                { wave: "triangle", freq: 700, at: 0.05, dur: 0.3, lp: 2000, vol: 0.12 }],
  // しびれ「ビリッ」
  ail_shock:   [{ wave: "square", freq: 120, at: 0, dur: 0.2, lp: 1500, vol: 0.2 },
                { wave: "square", freq: 127, at: 0, dur: 0.2, lp: 1500, vol: 0.15 },
                { wave: "noise", lp: 3000, at: 0, dur: 0.08, vol: 0.25 }],
  // 衰弱「スゥ…」(力が抜けていく)
  ail_weak:    [{ wave: "sine", freq: 330, to: 110, at: 0, dur: 0.6, vol: 0.35 },
                { wave: "sine", freq: 335, to: 112, at: 0, dur: 0.6, vol: 0.25 }],
};

// 効果音の表示名(デバッグの「サウンドテスト」画面に出す。js/debug.js)
//   ここにない音は、SE_SOUNDS の名前(hit など)のまま出る
const SE_NAMES = {
  hit: "攻撃が当たる", crit: "会心の一撃", hurt: "ダメージを受ける", pickup: "拾う",
  levelup: "レベルアップ", stairs: "階段を降りる", death: "死ぬ", grave: "自分の墓に乗る", test: "設定のお試し",
  chest: "宝箱を開ける", mimic: "ミミックだった",
  skill_fire: "龍の技(火)", skill_ice: "龍の技(氷)", skill_thunder: "龍の技(雷)", skill_poison: "龍の技(毒)",
  quake: "ベヒーモスの地響き", roar: "ベヒーモスの咆哮", meteorOmen: "メテオの詠唱", meteor: "メテオが落ちる",
  achieve: "実績を取った", engrave: "刻む",
  ail_poison: "毒になった", ail_burn: "やけどになった", ail_slow: "鈍足になった", ail_blind: "盲目になった",
  ail_confuse: "混乱した", ail_bind: "拘束された", ail_chill: "凍えた", ail_shock: "しびれた", ail_weak: "衰弱した",
};

// ==================== レア度(謎の塊を鑑定して出る装備) ====================
// 謎の塊を鑑定した装備にだけ付く(床・宝箱・敵の装備には付かない)
//   鑑定した装備が呪われていたら(lumpCursedChance)、この性能にさらに cursedStatBonus と、良い効果1つ+呪い1つが乗る
// 上から順に並べる。id:区別する名前 / name:表示名 / cls:色(CSS のクラス名)
//   weight:出る確率(%。全部で100)/ statRate:基礎値の倍率 / rollMin〜rollMax:個体差の範囲(-0.2 なら -20%)
//   effects:付く良い効果の数(effects.js の良い効果から、呪いなし)/ effectMin〜effectMax:効果の強さ(幅のどのあたりか。0 なら下限、1 なら上限)
//   普通は今までの装備と同じ(印は付かない)
const RARITY_TYPES = [
  { id: "common",    name: "普通",       cls: "r-common", weight: 72,  statRate: 1.0, rollMin: -0.2, rollMax: 0.2, effects: 0, effectMin: 0,   effectMax: 0 },
  { id: "rare",      name: "レア",       cls: "r-rare",   weight: 22,  statRate: 1.15, rollMin: 0,    rollMax: 0.2, effects: 0, effectMin: 0,   effectMax: 0 },
  { id: "epic",      name: "エピック",   cls: "r-epic",   weight: 5,   statRate: 1.4, rollMin: 0,    rollMax: 0.2, effects: 0, effectMin: 0,   effectMax: 0 },
  { id: "legendary", name: "レジェンド", cls: "r-legend", weight: 0.9, statRate: 1.7, rollMin: 0.05, rollMax: 0.25, effects: 1, effectMin: 0.6, effectMax: 1 },
  { id: "mythic",    name: "ミシック",   cls: "r-mythic", weight: 0.1, statRate: 2.2, rollMin: 0.1,  rollMax: 0.3, effects: 2, effectMin: 1,   effectMax: 1 },
];

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

// 武器のジャンル(equipment.js の武器の kind に書くもの)
//   武器の刻印は、着けている武器と同じジャンルなら数値が weaponKindBonus だけ増える
//   ここに書いた順番が、図鑑などで並ぶ順番になる
const WEAPON_KINDS = {
  sword:  { name: "剣" },
  dagger: { name: "短剣" },
  spear:  { name: "槍" },
  axe:    { name: "斧" },
  blunt:  { name: "鈍器" },
  bow:    { name: "弓" },
  staff:  { name: "杖" },
  scythe: { name: "鎌" },
  fang:   { name: "爪牙" },
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
  // 「その他」タブは中身がないので外した(使い道ができたら戻す)
];

const STAT_NAMES = { hp: "HP", atk: "ATK", def: "DEF", luk: "LUK", agl: "AGL", crt: "CRT" };
