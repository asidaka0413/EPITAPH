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
//   block    :(盾だけ)向いている方向から飛んでくる矢・炎・属性の球のダメージを減らす割合(%)
//                向き = 最後に動いた(攻撃した)方向。深い階でも強くならない
//   effects  :(省略できる)最初から付いている効果。effects.js の良い効果の id と強さ
//                例:effects: [{ id: "poisonHit", value: 6 }]  … 攻撃すると敵を毒にする
//   desc     :(省略できる)図鑑の紹介文。詳細のいちばん下に出る。\n で改行できる
//                例:desc: "なめした革の兜。軽くて丈夫。"
//   hidden   :(省略できる)true なら隠し装備。一度拾うまで、図鑑に「？？？」の行すら出さない
//   materialName:(固有装備だけ)刻んで刻印になったときの名前(例:"小鬼の牙")
//                書いていない装備は、個体差のレア度で「輝く胴の刻印」のような名前になる(js/config.js の materialRanks)

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
  // 盾:向いている方向から飛んでくる矢・炎・属性の球を防ぐ(block)。軽い盾は動きやすく、重い盾はよく防ぐ
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

  // 低層の後半(20階〜)の装備。浅い階の装備より基礎値が少し高い(深い階ほど強くなる倍率は、ほかの装備と同じ)
  { id: "mithril_sword",   name: "ミスリルの剣",   slot: "weapon",  stats: { atk: 45, crt: 20 }, from: "field", weight: 5,  minDepth: 22, maxDepth: null },
  { id: "steel_hammer",    name: "鋼の戦槌",       slot: "weapon",  stats: { atk: 50, def: 30 }, from: "field", weight: 4,  minDepth: 26, maxDepth: null },
  { id: "arcane_spear",    name: "魔鋼の槍",       slot: "weapon",  stats: { atk: 42, crt: 60 }, from: "field", weight: 4,  minDepth: 30, maxDepth: null },
  { id: "executioner",     name: "処刑人の大剣",   slot: "weapon",  stats: { atk: 62 },          from: "field", weight: 3,  minDepth: 36, maxDepth: null },
  { id: "reaper_scythe",   name: "首狩りの鎌",     slot: "weapon",  stats: { atk: 40, crt: 40 }, from: "field", weight: 2,  minDepth: 32, maxDepth: null, effects: [{ id: "critDmg", value: 15 }] },
  { id: "mithril_shield",  name: "ミスリルの盾",   slot: "shield",  stats: { hp: 50, def: 60 },  block: 50, from: "field", weight: 4, minDepth: 24, maxDepth: null },
  { id: "steel_helm",      name: "鋼の兜",         slot: "head",    stats: { hp: 60, def: 70 },  from: "field", weight: 5,  minDepth: 20, maxDepth: null },
  { id: "plumed_hat",      name: "羽飾りの帽子",   slot: "head",    stats: { hp: 50, luk: 40, agl: 40 }, from: "field", weight: 4, minDepth: 28, maxDepth: null },
  { id: "mithril_mail",    name: "ミスリルの鎖帷子", slot: "body",  stats: { hp: 100, def: 110, agl: 20 }, from: "field", weight: 4, minDepth: 22, maxDepth: null },
  { id: "fortress_plate",  name: "城塞の板金鎧",   slot: "body",    stats: { hp: 150, def: 160 }, from: "field", weight: 3, minDepth: 34, maxDepth: null },
  { id: "steel_tasset",    name: "鋼の腰当て",     slot: "waist",   stats: { hp: 80, def: 40 },  from: "field", weight: 5,  minDepth: 24, maxDepth: null },
  { id: "gale_boots",      name: "疾風の靴",       slot: "feet",    stats: { agl: 90 },          from: "field", weight: 4,  minDepth: 26, maxDepth: null },
  { id: "steel_greaves",   name: "鋼の脚甲",       slot: "feet",    stats: { hp: 40, def: 60, agl: 20 }, from: "field", weight: 4, minDepth: 30, maxDepth: null },
  { id: "gold_ring",       name: "金の指輪",       slot: "ring",    stats: { atk: 18, crt: 30, luk: 20 }, from: "field", weight: 5, minDepth: 22, maxDepth: null },
  { id: "ruby_ring",       name: "紅玉の指輪",     slot: "ring",    stats: { hp: 100, atk: 15 }, from: "field", weight: 4,  minDepth: 32, maxDepth: null },
  { id: "gold_earring",    name: "金のイヤリング", slot: "earring", stats: { luk: 40, crt: 25, agl: 15 }, from: "field", weight: 5, minDepth: 24, maxDepth: null },
  { id: "moonstone_earring", name: "月長石の耳飾り", slot: "earring", stats: { crt: 45, agl: 25 }, from: "field", weight: 4, minDepth: 34, maxDepth: null },

  // ---------- ゴブリンの固有装備 ----------
  { id: "goblin_dagger",   name: "ゴブリンの短剣", materialName: "小鬼の牙", slot: "weapon",  stats: { atk: 30, crt: 40 }, from: "goblin", weight: 10, minDepth: 1, maxDepth: null },
  { id: "goblin_earring",  name: "ゴブリンの耳飾り", materialName: "小鬼のささやき", slot: "earring", stats: { agl: 40, crt: 30 }, from: "goblin", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 大ネズミの固有装備 ----------
  { id: "rat_boots",       name: "ネズミ革のブーツ", materialName: "すばしこい足音", slot: "feet",  stats: { def: 15, agl: 70 },  from: "rat",    weight: 10, minDepth: 1, maxDepth: null },

  // ---------- コウモリの固有装備 ----------
  { id: "bat_wing",        name: "蝙蝠の羽飾り", materialName: "夜を裂く羽音",   slot: "earring", stats: { agl: 60, luk: 20 },  from: "bat",    weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 影蝙蝠の固有装備(隠し装備。見つけるまで図鑑に出ない) ----------
  { id: "shadow_robe",     name: "影の衣", materialName: "影をまとう衣", slot: "body", stats: { def: 50, agl: 80 }, from: "shadowbat", weight: 10, minDepth: 1, maxDepth: null, hidden: true, effects: [{ id: "blindImmune", value: 1 }] },

  // ---------- ゴブリンの呼び子の固有装備 ----------
  { id: "captain_helm",    name: "隊長の兜", materialName: "小鬼の号令",       slot: "head",    stats: { hp: 60, def: 30, atk: 10 }, from: "caller", weight: 10, minDepth: 1, maxDepth: null },
  { id: "war_horn",        name: "角笛の首飾り", materialName: "鳴りやまぬ角笛",   slot: "earring", stats: { atk: 12, luk: 30 },  from: "caller", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- スライムの固有装備 ----------
  { id: "slime_core",      name: "スライムの核", materialName: "ぬめる心臓",   slot: "ring",    stats: { hp: 150 },            from: "slime",  weight: 10, minDepth: 1, maxDepth: null },
  { id: "slime_boots",     name: "ぬめる長靴", materialName: "とろける足取り",     slot: "feet",    stats: { hp: 60, agl: 50 },   from: "slime",  weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ゴブリンの弓兵の固有装備 ----------
  { id: "short_bow",       name: "弓兵の短弓", materialName: "狙い澄ました矢",     slot: "weapon",  stats: { atk: 28, crt: 50 },  from: "archer", weight: 10, minDepth: 1, maxDepth: null },
  { id: "archer_hood",     name: "射手の頭巾", materialName: "狩人の眼",     slot: "head",    stats: { hp: 40, agl: 40, crt: 30 }, from: "archer", weight: 10, minDepth: 1, maxDepth: null },
  { id: "arrow_guard",     name: "矢除けの小盾", materialName: "矢返しの守り",   slot: "shield",  stats: { def: 15, agl: 30 },  block: 50, from: "archer", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 盗賊の固有装備 ----------
  { id: "thief_knife",     name: "盗賊のナイフ", materialName: "闇夜の刃",   slot: "weapon",  stats: { atk: 25, agl: 40, luk: 30 }, from: "thief", weight: 10, minDepth: 1, maxDepth: null },
  { id: "thief_pouch",     name: "盗賊の腰袋", materialName: "奪われた重み",     slot: "waist",   stats: { hp: 40, luk: 60 },   from: "thief",  weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 大蜘蛛の固有装備 ----------
  { id: "fang_dagger",     name: "毒牙の短剣", materialName: "滴る毒牙",     slot: "weapon",  stats: { atk: 30, crt: 30 },  from: "spider", weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "poisonHit", value: 10 }] },
  { id: "silk_cloak",      name: "蜘蛛糸の外套", materialName: "絡みつく糸",   slot: "body",    stats: { hp: 80, def: 40, agl: 50 }, from: "spider", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 鬼火の固有装備 ----------
  { id: "ember_blade",     name: "残り火の剣", materialName: "消えない残り火",     slot: "weapon",  stats: { atk: 45 },           from: "wisp",   weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "followUp", value: 25 }] },
  { id: "wisp_earring",    name: "鬼火の耳飾り", materialName: "さまよう灯",   slot: "earring", stats: { luk: 30, crt: 50 },  from: "wisp",   weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 爆ぜ虫の固有装備 ----------
  { id: "beetle_shell",    name: "爆ぜ虫の甲殻", materialName: "弾けた殻",   slot: "head",    stats: { hp: 90, def: 40 },   from: "bomber", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- オークの固有装備 ----------
  { id: "orc_axe",         name: "オークの斧", materialName: "蛮勇の一撃",     slot: "weapon",  stats: { atk: 50, crt: 10 },  from: "orc",    weight: 10, minDepth: 1, maxDepth: null },
  { id: "orc_armor",       name: "オークの鎧", materialName: "荒くれの守り",     slot: "body",    stats: { hp: 180, def: 90 },  from: "orc",    weight: 10, minDepth: 1, maxDepth: null },

  // ---------- スケルトンの固有装備 ----------
  { id: "bone_helm",       name: "骨の兜", materialName: "眠らぬ骸",         slot: "head",    stats: { hp: 70, def: 50, crt: 30 }, from: "skeleton", weight: 10, minDepth: 1, maxDepth: null },
  { id: "bone_shield",     name: "骨の盾", materialName: "朽ちぬ骨守り",         slot: "shield",  stats: { def: 30, crt: 30 },  block: 40, from: "skeleton", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 甲冑騎士の固有装備 ----------
  { id: "knight_sword",    name: "騎士の剣", materialName: "誉れの刃",       slot: "weapon",  stats: { atk: 55, def: 30 },  from: "knight", weight: 10, minDepth: 1, maxDepth: null },
  { id: "knight_armor",    name: "騎士の鎧", materialName: "揺るがぬ鋼",       slot: "body",    stats: { hp: 150, def: 150 }, from: "knight", weight: 10, minDepth: 1, maxDepth: null },
  { id: "knight_shield",   name: "騎士の紋章盾", materialName: "誓いの紋章",   slot: "shield",  stats: { hp: 80, def: 70 },   block: 70, from: "knight", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- トロルの固有装備 ----------
  { id: "troll_club",      name: "トロルの棍棒", materialName: "貪る一撃",   slot: "weapon",  stats: { atk: 70 },           from: "troll",  weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "killHeal", value: 12 }] },
  { id: "troll_loincloth", name: "トロルの腰巻", materialName: "尽きぬ生命",   slot: "waist",   stats: { hp: 200 },           from: "troll",  weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "lifeSteal", value: 2 }] },

  // ---------- 怨霊の固有装備 ----------
  { id: "wraith_ring",     name: "怨念の指輪", materialName: "消えぬ怨み",     slot: "ring",    stats: { crt: 60, luk: 40 },  from: "wraith", weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "critDmg", value: 15 }] },
  { id: "shroud",          name: "死装束", materialName: "黄泉の衣",         slot: "body",    stats: { hp: 100, agl: 80 },  from: "wraith", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ゴブリンの族長の固有装備 ----------
  { id: "chief_axe",       name: "族長の戦斧",   materialName: "小鬼の王の一撃", slot: "weapon", stats: { atk: 65, hp: 60 },  from: "chieftain", weight: 10, minDepth: 1, maxDepth: null },
  { id: "chief_crown",     name: "族長の羽根冠", materialName: "群れを率いる冠", slot: "head",   stats: { hp: 90, atk: 20, luk: 30 }, from: "chieftain", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ダイアウルフの固有装備 ----------
  { id: "wolf_pelt",       name: "大狼の毛皮",   materialName: "群れの温もり",   slot: "body",    stats: { hp: 130, agl: 60 }, from: "direwolf", weight: 10, minDepth: 1, maxDepth: null },
  { id: "wolf_fang",       name: "狼牙の首飾り", materialName: "遠吠えの牙",     slot: "earring", stats: { atk: 20, crt: 40 }, from: "direwolf", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- リザードマンの固有装備 ----------
  { id: "lizard_spear",    name: "蜥蜴兵の槍",   materialName: "鱗兵の穂先",     slot: "weapon",  stats: { atk: 60, crt: 40 }, from: "lizardman", weight: 10, minDepth: 1, maxDepth: null },
  { id: "scale_buckler",   name: "鱗の小盾",     materialName: "固い鱗守り",     slot: "shield",  stats: { def: 40, agl: 30 }, block: 40, from: "lizardman", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 死霊術師の固有装備 ----------
  { id: "necro_staff",     name: "死霊術師の杖", materialName: "囁く死者",       slot: "weapon",  stats: { atk: 55, luk: 40 }, from: "necromancer", weight: 10, minDepth: 1, maxDepth: null },
  { id: "bone_ring",       name: "骨細工の指輪", materialName: "繋がれた魂",     slot: "ring",    stats: { def: 40, luk: 40 }, from: "necromancer", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 火蜥蜴の固有装備 ----------
  { id: "salamander_tail", name: "火蜥蜴の尾剣", materialName: "燃える尾",   slot: "weapon",  stats: { atk: 60, crt: 30 },   from: "salamander", weight: 10, minDepth: 1, maxDepth: null },
  { id: "scale_belt",      name: "耐火の鱗帯",   materialName: "焦げぬ鱗",   slot: "waist",   stats: { hp: 120, def: 40 },  from: "salamander", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- バジリスクの固有装備 ----------
  { id: "stone_eye",       name: "石眼の首飾り", materialName: "見透かす石眼", slot: "earring", stats: { luk: 40, agl: 60 }, from: "basilisk", weight: 10, minDepth: 1, maxDepth: null },
  { id: "serpent_greaves", name: "蛇鱗の脚甲",   materialName: "硬い鱗の歩み", slot: "feet",    stats: { def: 60, agl: 50 }, from: "basilisk", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 黒騎士の固有装備 ----------
  { id: "black_greatsword", name: "黒鉄の大剣",  materialName: "黒き誓約",   slot: "weapon",  stats: { atk: 85, def: 20 },  from: "darkknight", weight: 10, minDepth: 1, maxDepth: null },
  { id: "black_armor",      name: "黒騎士の鎧",  materialName: "沈黙の鉄壁", slot: "body",    stats: { hp: 200, def: 200 }, from: "darkknight", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 吸血鬼の固有装備 ----------
  { id: "blood_ring",      name: "血の盃の指輪", materialName: "渇く紅",     slot: "ring",    stats: { atk: 30, crt: 40 },  from: "vampire", weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "lifeSteal", value: 3 }] },
  { id: "night_cloak",     name: "夜会の外套",   materialName: "宵闇のまとい", slot: "body",  stats: { hp: 120, agl: 70 },  from: "vampire", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ワイバーンの固有装備 ----------
  { id: "wyvern_claw",     name: "飛竜の爪",     materialName: "裂く翼爪",   slot: "weapon",  stats: { atk: 75, agl: 30 },  from: "wyvern", weight: 10, minDepth: 1, maxDepth: null },
  { id: "wyvern_fang",     name: "飛竜の牙飾り", materialName: "風切る牙",   slot: "earring", stats: { crt: 60, agl: 40 },  from: "wyvern", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ドレイクの固有装備 ----------
  { id: "drake_shield",    name: "火竜の鱗盾",   materialName: "炎を拒む鱗", slot: "shield",  stats: { hp: 100, def: 90 },  block: 60, from: "drake", weight: 10, minDepth: 1, maxDepth: null },
  { id: "drake_heart",     name: "火竜の心臓",   materialName: "燻る竜心",   slot: "ring",    stats: { hp: 150, atk: 30 },  from: "drake", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ゴーレムの固有装備 ----------
  { id: "golem_core",      name: "ゴーレムの核", materialName: "動かぬ心",   slot: "ring",    stats: { hp: 120, def: 60 },  from: "golem",  weight: 10, minDepth: 1, maxDepth: null },

  // ==================== 中層(51階〜)の敵の固有装備 ====================
  // ---------- ホブゴブリンの固有装備 ----------
  { id: "hob_cleaver",     name: "大鬼の鉈",     materialName: "荒ぶる大鬼",   slot: "weapon",  stats: { atk: 80, hp: 60 },   from: "hobgoblin", weight: 10, minDepth: 1, maxDepth: null },
  { id: "hob_belt",        name: "大鬼の革帯",   materialName: "群れの腕っぷし", slot: "waist", stats: { hp: 150, atk: 20 },  from: "hobgoblin", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ミノタウロスの固有装備 ----------
  { id: "bull_axe",        name: "牛頭の大斧",   materialName: "迷宮の剛腕",   slot: "weapon",  stats: { atk: 100 },          from: "minotaur", weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "dmgUp", value: 10 }] },
  { id: "horned_helm",     name: "迷宮の角兜",   materialName: "猛る双角",     slot: "head",    stats: { hp: 120, def: 60, atk: 20 }, from: "minotaur", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 暗殺者の固有装備 ----------
  { id: "assassin_blade",  name: "暗殺者の短刀", materialName: "音なき一刺し", slot: "weapon",  stats: { atk: 60, crt: 80 },  from: "assassin", weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "critDmg", value: 20 }] },
  { id: "silent_boots",    name: "忍び足の靴",   materialName: "消える足音",   slot: "feet",    stats: { agl: 100, def: 30 }, from: "assassin", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- マンティコアの固有装備 ----------
  { id: "stinger_whip",    name: "毒針の尾鞭",   materialName: "しなる毒尾",   slot: "weapon",  stats: { atk: 70, crt: 40 },  from: "manticore", weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "poisonHit", value: 14 }] },
  { id: "lion_mane",       name: "獅子のたてがみ", materialName: "獣王の威",   slot: "earring", stats: { atk: 25, agl: 60 },  from: "manticore", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- バンシーの固有装備 ----------
  { id: "wailing_earring", name: "嘆きの耳飾り", materialName: "響く嘆き",     slot: "earring", stats: { luk: 60, crt: 60 },  from: "banshee", weight: 10, minDepth: 1, maxDepth: null },
  { id: "mourning_veil",   name: "泣き女のヴェール", materialName: "涙の帳",   slot: "head",    stats: { hp: 80, agl: 80 },   from: "banshee", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 大爆ぜ虫の固有装備 ----------
  { id: "blast_shield",    name: "爆ぜ殻の盾",   materialName: "砕けぬ大殻",   slot: "shield",  stats: { hp: 120, def: 80 },  block: 55, from: "bigbomber", weight: 10, minDepth: 1, maxDepth: null },
  { id: "powder_pouch",    name: "火薬袋",       materialName: "弾ける火種",   slot: "waist",   stats: { hp: 100, atk: 40 },  from: "bigbomber", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ヘルハウンドの固有装備 ----------
  { id: "hound_collar",    name: "獄犬の首輪",   materialName: "地獄の番",     slot: "earring", stats: { atk: 30, crt: 50 },  from: "hellhound", weight: 10, minDepth: 1, maxDepth: null },
  { id: "blackfire_pelt",  name: "黒炎の毛皮",   materialName: "燃えさかる毛並み", slot: "body", stats: { hp: 160, def: 40, agl: 70 }, from: "hellhound", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- リッチの固有装備 ----------
  { id: "lich_scepter",    name: "不死者の王笏", materialName: "死を統べる者", slot: "weapon",  stats: { atk: 90, luk: 60 },  from: "lich", weight: 10, minDepth: 1, maxDepth: null },
  { id: "soul_vessel",     name: "魂の器",       materialName: "囚われた魂",   slot: "ring",    stats: { hp: 100, crt: 60 },  from: "lich", weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "lifeSteal", value: 3 }] },

  // ---------- ゴブリンの王の固有装備 ----------
  { id: "king_sword",      name: "小鬼王の大剣", materialName: "王の一太刀",   slot: "weapon",  stats: { atk: 95, hp: 80 },   from: "goblinking", weight: 10, minDepth: 1, maxDepth: null },
  { id: "king_crown",      name: "小鬼王の冠",   materialName: "小鬼の王権",   slot: "head",    stats: { hp: 140, atk: 30, luk: 40 }, from: "goblinking", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 鉄巨人の固有装備 ----------
  { id: "giant_gauntlet",  name: "鉄巨人の拳甲", materialName: "砕く鉄拳",     slot: "weapon",  stats: { atk: 90, def: 50 },  from: "irongiant", weight: 10, minDepth: 1, maxDepth: null },
  { id: "giant_cuirass",   name: "鉄巨人の胸甲", materialName: "動じぬ鉄塊",   slot: "body",    stats: { hp: 250, def: 250 }, from: "irongiant", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ゴブリンの祈祷師の固有装備 ----------
  { id: "shaman_staff",    name: "祈祷師の杖",   materialName: "小鬼の祈り",   slot: "weapon",  stats: { atk: 85, luk: 70 },  from: "goblinshaman", weight: 10, minDepth: 1, maxDepth: null },
  { id: "charm_earring",   name: "呪い札の首飾り", materialName: "まとわる呪言", slot: "earring", stats: { luk: 50, crt: 70 }, from: "goblinshaman", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 盗賊頭の固有装備 ----------
  { id: "bandit_saber",    name: "盗賊頭の曲刀", materialName: "掠め取る刃",   slot: "weapon",  stats: { atk: 85, agl: 50, luk: 50 }, from: "banditboss", weight: 10, minDepth: 1, maxDepth: null },
  { id: "bandit_eyepatch", name: "かしらの眼帯", materialName: "目ざとい片目", slot: "head",    stats: { hp: 100, luk: 100 }, from: "banditboss", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ゴブリンの狙撃兵の固有装備 ----------
  { id: "sniper_longbow",  name: "狙撃兵の長弓", materialName: "千里を射抜く矢", slot: "weapon", stats: { atk: 90, crt: 70 }, from: "goblinsniper", weight: 10, minDepth: 1, maxDepth: null },
  { id: "hawkeye_hood",    name: "鷹目の頭巾",   materialName: "遠くを見る眼", slot: "head",    stats: { hp: 120, agl: 60, crt: 50 }, from: "goblinsniper", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- デュラハンの固有装備 ----------
  { id: "headless_scythe", name: "首なし騎士の大鎌", materialName: "刈り取る影", slot: "weapon", stats: { atk: 110, crt: 40 }, from: "dullahan", weight: 10, minDepth: 1, maxDepth: null },
  { id: "headless_armor",  name: "首なし騎士の鎧", materialName: "主なき甲冑", slot: "body",    stats: { hp: 220, def: 220, agl: 20 }, from: "dullahan", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ガーゴイルの固有装備 ----------
  { id: "stone_greatsword", name: "石像の大剣",  materialName: "薙ぎ払う石腕", slot: "weapon",  stats: { atk: 105, def: 40 }, from: "gargoyle", weight: 10, minDepth: 1, maxDepth: null },
  { id: "stone_wing_shield", name: "石翼の盾",   materialName: "閉じた石の翼", slot: "shield",  stats: { hp: 120, def: 140 }, block: 40, from: "gargoyle", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 竜人の固有装備 ----------
  { id: "dragonkin_lance", name: "竜人の突撃槍", materialName: "貫く竜の角", slot: "weapon",  stats: { atk: 110, agl: 30 }, from: "dragonkin", weight: 10, minDepth: 1, maxDepth: null },
  { id: "dragonscale_plate", name: "竜鱗の胸当て", materialName: "熱を帯びた鱗", slot: "body", stats: { hp: 180, def: 150 }, from: "dragonkin", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- キマイラの固有装備 ----------
  { id: "triple_fang",     name: "三つ首の牙",   materialName: "三つの咆哮",   slot: "weapon",  stats: { atk: 100, agl: 40 }, from: "chimera", weight: 10, minDepth: 1, maxDepth: null },
  { id: "chimera_belt",    name: "合成獣の皮帯", materialName: "継がれた皮",   slot: "waist",   stats: { hp: 180, def: 60 },  from: "chimera", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- 狂戦士の固有装備 ----------
  { id: "berserk_axes",    name: "狂戦士の双斧", materialName: "止まぬ猛り",   slot: "weapon",  stats: { atk: 110 },          from: "berserker", weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "dmgUp", value: 15 }] },
  { id: "blood_bangle",    name: "血染めの腕輪", materialName: "乾かぬ返り血", slot: "ring",    stats: { atk: 45, crt: 50 },  from: "berserker", weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "lifeSteal", value: 3 }] },

  // ---------- ヒュドラの固有装備 ----------
  { id: "hydra_mail",      name: "多頭蛇の鱗鎧", materialName: "絡みあう鱗",   slot: "body",    stats: { hp: 200, def: 120, agl: 50 }, from: "hydra", weight: 10, minDepth: 1, maxDepth: null },
  { id: "regrow_fang",     name: "再生の牙",     materialName: "生え替わる首", slot: "ring",    stats: { hp: 200 },           from: "hydra", weight: 10, minDepth: 1, maxDepth: null, effects: [{ id: "killHeal", value: 15 }] },

  // ---------- グールの固有装備 ----------
  { id: "ghoul_claw",      name: "屍食いの鉤爪", materialName: "腐れた爪",     slot: "weapon",  stats: { atk: 110, agl: 40 }, from: "ghoul", weight: 10, minDepth: 1, maxDepth: null },
  { id: "carrion_necklace", name: "腐肉の首飾り", materialName: "飢えた屍の牙", slot: "earring", stats: { hp: 150, luk: 60 }, from: "ghoul", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ベヒーモスの固有装備 ----------
  { id: "behemoth_horn",   name: "巨獣の角",     materialName: "大地を穿つ角", slot: "weapon",  stats: { atk: 130 },          from: "behemoth", weight: 10, minDepth: 1, maxDepth: null },
  { id: "behemoth_hooves", name: "巨獣の蹄靴",   materialName: "揺るがす蹄",   slot: "feet",    stats: { hp: 150, def: 100, agl: 40 }, from: "behemoth", weight: 10, minDepth: 1, maxDepth: null },

  // ---------- ドラゴンゾンビの固有装備(不死と竜の両方の一族) ----------
  { id: "rotdragon_fang",  name: "腐竜の牙",     materialName: "朽ちぬ竜牙",   slot: "weapon",  stats: { atk: 135, crt: 40 }, from: "dragonzombie", weight: 10, minDepth: 1, maxDepth: null },
  { id: "rotdragon_bonemail", name: "腐竜の骨鎧", materialName: "死してなお竜", slot: "body",   stats: { hp: 250, def: 200 }, from: "dragonzombie", weight: 10, minDepth: 1, maxDepth: null },
];
