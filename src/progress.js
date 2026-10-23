export const SAVE_KEY = "banner-of-ashes-v1";
export const WEAPONS = [
  { id: "spear", name: "장창", icon: "spear", desc: "긴 사거리 · 전열 돌파" },
  { id: "sword", name: "장검", icon: "sword", desc: "균형 잡힌 연속 공격" },
  {
    id: "axe",
    name: "전투 도끼",
    icon: "axe",
    desc: "묵직한 타격 · 방어 돌파",
  },
  { id: "bow", name: "장궁", icon: "bow", desc: "원거리 조준 · 안전한 사격" },
  {
    id: "halberd",
    name: "월도",
    icon: "swords",
    desc: "넓은 범위 · 다수 제압",
  },
  { id: "dual", name: "쌍검", icon: "swords", desc: "빠른 연격 · 근접 전투" },
  {
    id: "hammer",
    name: "전투 망치",
    icon: "axe",
    desc: "강력한 일격 · 밀집진 파괴",
  },
  {
    id: "lance",
    name: "기병창",
    icon: "horse",
    desc: "돌진 공격 · 긴 타격 거리",
  },
];
export const THEMES = [
  {
    id: "forest",
    name: "숲의 파수꾼",
    armor: "#59736c",
    helmet: "#52645b",
    cape: "#2b6d59",
  },
  {
    id: "silver",
    name: "은빛 수호자",
    armor: "#a6b1ac",
    helmet: "#8f9c98",
    cape: "#435a78",
  },
  {
    id: "dawn",
    name: "새벽의 기사",
    armor: "#a89167",
    helmet: "#ab996f",
    cape: "#99614a",
  },
  {
    id: "ash",
    name: "잿빛 전사",
    armor: "#5a6261",
    helmet: "#454d4d",
    cape: "#555669",
  },
  {
    id: "royal",
    name: "왕실 근위대",
    armor: "#7e7661",
    helmet: "#b8a273",
    cape: "#893f45",
  },
  {
    id: "jade",
    name: "비취의 창병",
    armor: "#537d70",
    helmet: "#637f6b",
    cape: "#366c61",
  },
  {
    id: "night",
    name: "밤의 순찰자",
    armor: "#4a5666",
    helmet: "#3d4753",
    cape: "#4b527a",
  },
  {
    id: "sand",
    name: "모래의 기수",
    armor: "#ae9b7c",
    helmet: "#9c8d70",
    cape: "#b27e4e",
  },
];
export const CRESTS = [
  { id: "swords", name: "교차한 검" },
  { id: "sun", name: "태양" },
  { id: "shield", name: "수호 방패" },
  { id: "horse", name: "전장의 말" },
  { id: "mountain", name: "불굴의 산" },
  { id: "spark", name: "새벽별" },
];
const skins = ["#dcad87", "#c79771", "#edc5a5", "#a97a5c", "#d8b297"];
const hairs = ["#34302b", "#564438", "#252c2d", "#82715e", "#75503b"];
const armors = [
  "#59736c",
  "#63717e",
  "#827862",
  "#5f6569",
  "#667b6e",
  "#836760",
  "#737a8c",
  "#4c645e",
];
export const PORTRAITS = Array.from({ length: 40 }, (_, i) => ({
  bg: ["#cbd4c5", "#dad0ba", "#c7cfd2", "#d5c4bd", "#cfc7d5"][i % 5],
  skin: skins[i % 5],
  hair: hairs[Math.floor(i / 5) % 5],
  armor: armors[i % 8],
  cloak: ["#2d6258", "#785044", "#4c647c", "#807343"][Math.floor(i / 10)],
}));
export function defaultSave() {
  return {
    version: 1,
    name: "새벽",
    company: "은빛 군단",
    portrait: 0,
    banner: "#359e8b",
    weapon: "spear",
    crest: "swords",
    equipment: { armor: "forest", helmet: "forest", cape: "forest" },
    victories: {},
    achievements: {},
    totalKills: 0,
    lastBattle: 1,
    settings: {
      cinematic: true,
      sound: true,
      quality: "high",
      difficulty: "normal",
    },
  };
}
export function normalizeSave(input) {
  const d = defaultSave();
  if (!input || typeof input !== "object") return d;
  const s = { ...d };
  s.name =
    typeof input.name === "string" ? input.name.slice(0, 16) || d.name : d.name;
  s.company =
    typeof input.company === "string"
      ? input.company.slice(0, 20) || d.company
      : d.company;
  s.portrait =
    Number.isInteger(input.portrait) &&
    input.portrait >= 0 &&
    input.portrait < 40
      ? input.portrait
      : 0;
  s.banner = /^#[a-f\d]{6}$/i.test(input.banner) ? input.banner : d.banner;
  s.weapon = WEAPONS.some((w) => w.id === input.weapon)
    ? input.weapon
    : d.weapon;
  s.crest = CRESTS.some((c) => c.id === input.crest) ? input.crest : d.crest;
  for (const k of ["armor", "helmet", "cape"])
    if (THEMES.some((t) => t.id === input.equipment?.[k]))
      s.equipment[k] = input.equipment[k];
  for (let id = 1; id <= 20; id++) {
    if (input.victories?.[id] && typeof input.victories[id] === "object")
      s.victories[id] = {
        time: Math.max(0, Number(input.victories[id].time) || 0),
        kills: Math.max(0, Number(input.victories[id].kills) || 0),
      };
    if (Array.isArray(input.achievements?.[id]))
      s.achievements[id] = Array.from({ length: 5 }, (_, i) =>
        Boolean(input.achievements[id][i]),
      );
  }
  s.totalKills = Math.max(0, Math.floor(Number(input.totalKills) || 0));
  s.lastBattle =
    Number.isInteger(input.lastBattle) &&
    input.lastBattle >= 1 &&
    input.lastBattle <= 20
      ? input.lastBattle
      : 1;
  if (input.settings && typeof input.settings === "object") {
    for (const k of ["cinematic", "sound"])
      if (typeof input.settings[k] === "boolean")
        s.settings[k] = input.settings[k];
    if (["high", "low"].includes(input.settings.quality))
      s.settings.quality = input.settings.quality;
    if (["easy", "normal", "hard"].includes(input.settings.difficulty))
      s.settings.difficulty = input.settings.difficulty;
  }
  return s;
}
export function loadSave(storage = globalThis.localStorage) {
  try {
    return normalizeSave(JSON.parse(storage.getItem(SAVE_KEY)));
  } catch {
    return defaultSave();
  }
}
export function saveData(data, storage = globalThis.localStorage) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(normalizeSave(data)));
    return true;
  } catch {
    return false;
  }
}
export function evaluateAchievements(battle, state, won) {
  return [
    won,
    won && state.time <= battle.duration * 0.7,
    won && state.hp >= state.maxHp * 0.5,
    won && state.kills >= 15,
    won && state.allies >= battle.allyCount * 0.5,
  ];
}
