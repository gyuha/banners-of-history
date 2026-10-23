import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultSave,
  normalizeSave,
  loadSave,
  saveData,
  evaluateAchievements,
  WEAPONS,
  PORTRAITS,
  THEMES,
  CRESTS,
} from "../src/progress.js";
import { BATTLES, TROOPS } from "../src/battles.js";

test("20 scenarios have valid, playable configurations", () => {
  assert.equal(BATTLES.length, 20);
  assert.equal(BATTLES.filter((b) => b.mode === "tactical").length, 10);
  assert.equal(BATTLES.filter((b) => b.mode === "heroic").length, 10);
  for (const [i, b] of BATTLES.entries()) {
    assert.equal(b.id, i + 1);
    assert.ok(b.title && b.name && b.objective && b.tactic);
    assert.ok(b.duration >= 120 && b.duration <= 300);
    assert.ok(b.allyCount > 0 && b.enemyCount > b.allyCount);
    assert.ok(
      ["ridge", "forest", "bridge", "marsh", "camp", "plain"].includes(
        b.terrain,
      ),
    );
    assert.ok(["hold", "capture", "rout", "rescue"].includes(b.victory));
  }
  assert.equal(Object.keys(TROOPS).length, 6);
  assert.equal(WEAPONS.length, 8);
  assert.equal(PORTRAITS.length, 40);
  assert.equal(THEMES.length, 8);
  assert.equal(CRESTS.length, 6);
});
test("corrupt or malicious storage fields recover safely", () => {
  assert.deepEqual(normalizeSave(null), defaultSave());
  const s = normalizeSave({
    portrait: 999,
    weapon: "invalid",
    banner: "javascript:alert(1)",
    totalKills: -100,
    equipment: { armor: "nope" },
    settings: { sound: "yes", quality: "ultra" },
    achievements: { 1: [true] },
    victories: { 21: { time: 9 } },
  });
  assert.equal(s.portrait, 0);
  assert.equal(s.weapon, "spear");
  assert.equal(s.banner, "#359e8b");
  assert.equal(s.totalKills, 0);
  assert.equal(s.equipment.armor, "forest");
  assert.equal(s.settings.quality, "high");
  assert.equal(s.settings.sound, true);
  assert.equal(s.achievements[1].length, 5);
  assert.equal(s.victories[21], undefined);
  assert.deepEqual(loadSave({ getItem: () => "{broken" }), defaultSave());
  assert.deepEqual(
    loadSave({
      getItem: () => {
        throw Error("denied");
      },
    }),
    defaultSave(),
  );
});
test("customization and earned progress survive a full storage round trip", () => {
  const memory = new Map();
  const storage = {
    setItem: (k, v) => memory.set(k, v),
    getItem: (k) => memory.get(k),
  };
  const s = defaultSave();
  Object.assign(s, {
    name: "하늘",
    company: "푸른 새벽 군단",
    portrait: 39,
    banner: "#7f6898",
    weapon: "bow",
    crest: "sun",
    totalKills: 25,
  });
  s.equipment = { armor: "royal", helmet: "silver", cape: "night" };
  s.victories[15] = { time: 88, kills: 22 };
  s.achievements[15] = [true, true, true, true, false];
  assert.equal(saveData(s, storage), true);
  assert.deepEqual(loadSave(storage), s);
  assert.equal(
    saveData(s, {
      setItem: () => {
        throw Error("quota");
      },
    }),
    false,
  );
});
test("achievements require victory and apply actual time, health, kills, survival thresholds", () => {
  const b = BATTLES[0];
  const s = { time: 100, hp: 900, maxHp: 1200, kills: 20, allies: 30 };
  assert.deepEqual(evaluateAchievements(b, s, true), [
    true,
    true,
    true,
    true,
    true,
  ]);
  assert.deepEqual(evaluateAchievements(b, s, false), [
    false,
    false,
    false,
    false,
    false,
  ]);
  assert.deepEqual(
    evaluateAchievements(
      b,
      { ...s, time: 150, hp: 500, kills: 14, allies: 10 },
      true,
    ),
    [true, false, false, false, false],
  );
});
