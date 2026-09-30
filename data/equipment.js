// ==================== 装備データ ====================
// 装備の種類をここに並べる。index.html から読み込まれる
// 新しい装備を増やしたいときは、{ ... }, の行をコピーして書き換えればOK
//
//   id       :装備を区別するための名前(半角英数字。ほかとかぶらないように)
//   name     :画面に出る名前
//   slot     :どこに着ける装備か
//                weapon(武器) / shield(盾) / head(頭) / body(胴) / waist(腰) / feet(足)
//                ring(指輪)          … 指輪1・指輪2 のどちらの枠にも着けられる
//                earring(イヤリング) … イヤリング1・イヤリング2 のどちらの枠にも着けられる
//   stats    :基礎値。使えるのは hp / atk / def / luk / agl / crt
//                (深い階層ほど、js/config.js の BALANCE の設定に従って強くなる)
//   from     :どこで手に入るか
//                "field"   … ダンジョンの床に落ちている(そこそこの性能)
//                敵の id   … その敵を倒したときに落とす固有装備(monsters.js の id と同じ名前を書く)
//   weight   :出やすさ。大きいほど出やすい(同じ入手先・同じ階層で出る装備どうしで比べる)
//   minDepth :この階層から出る
//   maxDepth :この階層まで出る(null なら、どこまで深くても出る)
//   block    :(盾だけ)向いている方向から飛んでくる矢・炎のダメージを減らす割合(%)
//                向き = 最後に動いた(攻撃した)方向。深い階でも強くならない
//   effects  :(省略できる)最初から付いている効果。effects.js の良い効果の id と強さ
//                例:effects: [{ id: "poisonHit", value: 6 }]  … 攻撃すると敵を毒にする

const EQUIPMENT_DATA = [
  // ---------- 床に落ちている装備 ----------
  { id: "leather_helm",    name: "革の兜",         slot: "head",    stats: { hp: 50, def: 30 },  from: "field", weight: 10, minDepth: 1, maxDepth: null },
  { id: "leather_armor",   name: "革の鎧",         slot: "body",    stats: { hp: 100, def: 60 }, from: "field", weight: 10, minDepth: 1, maxDepth: null },
  { id: "leather_belt",    name: "革のベルト",     slot: "waist",   stats: { hp: 50, agl: 20 },  from: "field", weight: 10, minDepth: 1, maxDepth: null },
  { id: "leather_boots",   name: "革のブーツ",     slot: "feet",    stats: { def: 20, agl: 40 }, from: "field", weight: 10, minDepth: 1, maxDepth: null },
  { id: "copper_ring",     name: "銅の指輪",       slot: "ring",    stats: { atk: 10, crt: 30 }, from: "field", weight: 10, minDepth: 1, maxDepth: null },
  { id: "copper_earring",  name: "銅のイヤリング", slot: "earring", stats: { luk: 20, crt: 20 }, from: "field", weight: 10, minDepth: 1, maxDepth: null },
  { id: "short_sword",     name: "ショートソード", slot: "weapon",  stats: { atk: 20 },          from: "field", weight: 10, minDepth: 1, maxDepth: null },
  // 武器は種類ごとに得意なステータスが違う。深い階から出るものほど少し強い
  { id: "spear",           name: "槍",             slot: "weapon",  stats: { atk: 16, crt: 40 }, from: "field", weight: 6,  minDepth: 2, maxDepth: null },
  { id: "mace",            name: "メイス",         slot: "weapon",  stats: { atk: 18, def: 25 }, from: "field", weight: 6,  minDepth: 3, maxDepth: null },
  { id: "long_sword",      name: "ロングソード",   slot: "weapon",  stats: { atk: 26 },          from: "field", weight: 5,  minDepth: 6, maxDepth: null },
  { id: "war_axe",         name: "戦斧",           slot: "weapon",  stats: { atk: 32 },          from: "field", weight: 3,  minDepth: 9, maxDepth: null },
  { id: "rapier",          name: "レイピア",       slot: "weapon",  stats: { atk: 14, agl: 30, crt: 30 }, from: "field", weight: 4, minDepth: 5, maxDepth: null },
  // 盾:向いている方向から飛んでくる矢・炎を防ぐ(block)。軽い盾は動きやすく、重い盾はよく防ぐ
  { id: "wooden_shield",   name: "木の盾",         slot: "shield",  stats: { hp: 20, def: 15 },  block: 30, from: "field", weight: 10, minDepth: 1, maxDepth: null },
  { id: "buckler",         name: "バックラー",     slot: "shield",  stats: { def: 10, agl: 25 }, block: 25, from: "field", weight: 6,  minDepth: 3, maxDepth: null },
  { id: "iron_shield",     name: "鉄の盾",         slot: "shield",  stats: { hp: 30, def: 35 },  block: 45, from: "field", weight: 5,  minDepth: 6, maxDepth: null },
  { id: "tower_shield",    name: "大盾",           slot: "shield",  stats: { hp: 60, def: 50 },  block: 60, from: "field", weight: 3,  minDepth: 11, maxDepth: null },
  // 最初から効果が付いている、珍しい武器
  { id: "venom_blade",     name: "毒塗りの刃",     slot: "weapon",  stats: { atk: 15 },          from: "field", weight: 2,  minDepth: 4, maxDepth: null, effects: [{ id: "poisonHit", value: 6 }] },
  { id: "twin_fang",       name: "双牙",           slot: "weapon",  stats: { atk: 14, crt: 20 }, from: "field", weight: 2,  minDepth: 7, maxDepth: null, effects: [{ id: "followUp", value: 20 }] },
  { id: "hand_axe",        name: "手斧",           slot: "weapon",  stats: { atk: 22, hp: 30 },  from: "field", weight: 5,  minDepth: 4, maxDepth: null },
  { id: "estoc",           name: "刺突剣",         slot: "weapon",  stats: { atk: 20, crt: 60 }, from: "field", weight: 3,  minDepth: 10, maxDepth: null },
  { id: "great_sword",     name: "大剣",           slot: "weapon",  stats: { atk: 40 },          from: "field", weight: 3,  minDepth: 13, maxDepth: null },
  // 深い階の防具・装飾品(同じ部位でも、得意なステータスが違う)
  { id: "iron_helm",       name: "鉄の兜",         slot: "head",    stats: { hp: 30, def: 50 },  from: "field", weight: 5,  minDepth: 6, maxDepth: null },
  { id: "chain_mail",      name: "鎖かたびら",     slot: "body",    stats: { hp: 70, def: 90 },  from: "field", weight: 5,  minDepth: 6, maxDepth: null },
  { id: "hunter_hat",      name: "狩人の帽子",     slot: "head",    stats: { hp: 40, luk: 30, agl: 20 }, from: "field", weight: 4, minDepth: 3, maxDepth: null },
  { id: "padded_coat",     name: "綿入りの上着",   slot: "body",    stats: { hp: 140, def: 30 }, from: "field", weight: 5,  minDepth: 3, maxDepth: null },
  { id: "plate_armor",     name: "板金鎧",         slot: "body",    stats: { hp: 90, def: 130 }, from: "field", weight: 3,  minDepth: 12, maxDepth: null },
  { id: "chain_belt",      name: "鎖のベルト",     slot: "waist",   stats: { hp: 60, def: 25 },  from: "field", weight: 5,  minDepth: 5, maxDepth: null },
  { id: "sash",            name: "飾り帯",         slot: "waist",   stats: { luk: 30, agl: 30 }, from: "field", weight: 4,  minDepth: 4, maxDepth: null },
  { id: "iron_greaves",    name: "鉄の具足",       slot: "feet",    stats: { hp: 30, def: 45, agl: 15 }, from: "field", weight: 4, minDepth: 8, maxDepth: null },
  { id: "light_shoes",     name: "軽い靴",         slot: "feet",    stats: { agl: 60 },          from: "field", weight: 4,  minDepth: 4, maxDepth: null },
  { id: "silver_ring",     name: "銀の指輪",       slot: "ring",    stats: { atk: 14, crt: 20, luk: 10 }, from: "field", weight: 5, minDepth: 5, maxDepth: null },
  { id: "garnet_ring",     name: "柘榴石の指輪",   slot: "ring",    stats: { hp: 60, atk: 8 },   from: "field", weight: 4,  minDepth: 4, maxDepth: null },
  { id: "silver_earring",  name: "銀のイヤリング", slot: "earring", stats: { luk: 30, crt: 15, agl: 10 }, from: "field", weight: 5, minDepth: 5, maxDepth: null },
  { id: "bone_earring",    name: "骨のイヤリング", slot: "earring", stats: { hp: 40, crt: 30 }, from: "field", weight: 4,  minDepth: 7, maxDepth: null },

  // ---------- ゴブリンの固有装備 ----------
  { id: "goblin_dagger",   name: "ゴブリンの短剣", slot: "weapon",  stats: { atk: 30, crt: 40 }, from: "goblin", weight: 10, minDepth: 1, maxDepth: null },
  { id: "goblin_earring",  name: "ゴブリンの耳飾り", slot: "earring", stats: { agl: 40, crt: 30 }, from: "goblin", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 大ネズミの固有装備 ----------
  { id: "rat_boots",       name: "ネズミ革のブーツ", slot: "feet",  stats: { def: 15, agl: 70 },  from: "rat",    weight: 10, minDepth: 1, maxDepth: null },

  // ---------- コウモリの固有装備 ----------
  { id: "bat_wing",        name: "蝙蝠の羽飾り",   slot: "earring", stats: { agl: 60, luk: 20 },  from: "bat",    weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ゴブリンの呼び子の固有装備 ----------
  { id: "captain_helm",    name: "隊長の兜",       slot: "head",    stats: { hp: 60, def: 30, atk: 10 }, from: "caller", weight: 10, minDepth: 1, maxDepth: null },
  { id: "war_horn",        name: "角笛の首飾り",   slot: "earring", stats: { atk: 12, luk: 30 },  from: "caller", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- スライムの固有装備 ----------
  { id: "slime_core",      name: "スライムの核",   slot: "ring",    stats: { hp: 150 },            from: "slime",  weight: 10, minDepth: 1, maxDepth: null },
  { id: "slime_boots",     name: "ぬめる長靴",     slot: "feet",    stats: { hp: 60, agl: 50 },   from: "slime",  weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ゴブリンの弓兵の固有装備 ----------
  { id: "short_bow",       name: "弓兵の短弓",     slot: "weapon",  stats: { atk: 28, crt: 50 },  from: "archer", weight: 10, minDepth: 1, maxDepth: null },
  { id: "archer_hood",     name: "射手の頭巾",     slot: "head",    stats: { hp: 40, agl: 40, crt: 30 }, from: "archer", weight: 10, minDepth: 1, maxDepth: null },
  { id: "arrow_guard",     name: "矢除けの小盾",   slot: "shield",  stats: { def: 15, agl: 30 },  block: 50, from: "archer", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 盗賊の固有装備 ----------
  { id: "thief_knife",     name: "盗賊のナイフ",   slot: "weapon",  stats: { atk: 25, agl: 40, luk: 30 }, from: "thief", weight: 10, minDepth: 1, maxDepth: null },
  { id: "thief_pouch",     name: "盗賊の腰袋",     slot: "waist",   stats: { hp: 40, luk: 60 },   from: "thief",  weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 大蜘蛛の固有装備 ----------
  { id: "fang_dagger",     name: "毒牙の短剣",     slot: "weapon",  stats: { atk: 30, crt: 30 },  from: "spider", weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "poisonHit", value: 10 }] },
  { id: "silk_cloak",      name: "蜘蛛糸の外套",   slot: "body",    stats: { hp: 80, def: 40, agl: 50 }, from: "spider", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 鬼火の固有装備 ----------
  { id: "ember_blade",     name: "残り火の剣",     slot: "weapon",  stats: { atk: 45 },           from: "wisp",   weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "followUp", value: 25 }] },
  { id: "wisp_earring",    name: "鬼火の耳飾り",   slot: "earring", stats: { luk: 30, crt: 50 },  from: "wisp",   weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 爆ぜ虫の固有装備 ----------
  { id: "beetle_shell",    name: "爆ぜ虫の甲殻",   slot: "head",    stats: { hp: 90, def: 40 },   from: "bomber", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- オークの固有装備 ----------
  { id: "orc_axe",         name: "オークの斧",     slot: "weapon",  stats: { atk: 50, crt: 10 },  from: "orc",    weight: 10, minDepth: 1, maxDepth: null },
  { id: "orc_armor",       name: "オークの鎧",     slot: "body",    stats: { hp: 180, def: 90 },  from: "orc",    weight: 10, minDepth: 1, maxDepth: null },

  // ---------- スケルトンの固有装備 ----------
  { id: "bone_helm",       name: "骨の兜",         slot: "head",    stats: { hp: 70, def: 50, crt: 30 }, from: "skeleton", weight: 10, minDepth: 1, maxDepth: null },
  { id: "bone_shield",     name: "骨の盾",         slot: "shield",  stats: { def: 30, crt: 30 },  block: 40, from: "skeleton", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 甲冑騎士の固有装備 ----------
  { id: "knight_sword",    name: "騎士の剣",       slot: "weapon",  stats: { atk: 55, def: 30 },  from: "knight", weight: 10, minDepth: 1, maxDepth: null },
  { id: "knight_armor",    name: "騎士の鎧",       slot: "body",    stats: { hp: 150, def: 150 }, from: "knight", weight: 10, minDepth: 1, maxDepth: null },
  { id: "knight_shield",   name: "騎士の紋章盾",   slot: "shield",  stats: { hp: 80, def: 70 },   block: 70, from: "knight", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- トロルの固有装備 ----------
  { id: "troll_club",      name: "トロルの棍棒",   slot: "weapon",  stats: { atk: 70 },           from: "troll",  weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "killHeal", value: 12 }] },
  { id: "troll_loincloth", name: "トロルの腰巻",   slot: "waist",   stats: { hp: 200 },           from: "troll",  weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "lifeSteal", value: 2 }] },

  // ---------- 怨霊の固有装備 ----------
  { id: "wraith_ring",     name: "怨念の指輪",     slot: "ring",    stats: { crt: 60, luk: 40 },  from: "wraith", weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "critDmg", value: 15 }] },
  { id: "shroud",          name: "死装束",         slot: "body",    stats: { hp: 100, agl: 80 },  from: "wraith", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ゴーレムの固有装備 ----------
  { id: "golem_core",      name: "ゴーレムの核",   slot: "ring",    stats: { hp: 120, def: 60 },  from: "golem",  weight: 10, minDepth: 1, maxDepth: null },
];
