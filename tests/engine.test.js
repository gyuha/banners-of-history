import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Battlefield } from "../src/engine.js";
import { BATTLES, TROOPS } from "../src/battles.js";

// The real simulation and scene graph run without a DOM or a mock WebGL renderer.
// Rendering, pointer interaction and appearance are verified separately in Ego Lite.
function fixture(overrides = {}, options = {}) {
  const engine = Object.create(Battlefield.prototype);
  Object.assign(engine, {
    geo: {
      box: new THREE.BoxGeometry(1, 1, 1),
      sphere: new THREE.IcosahedronGeometry(1, 0),
      cone: new THREE.ConeGeometry(1, 1, 5),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 7),
      ring: new THREE.TorusGeometry(1, 0.038, 4, 48),
      plane: new THREE.PlaneGeometry(1, 1),
    },
    world: new THREE.Group(),
    army: new THREE.Group(),
    effects: new THREE.Group(),
    materials: new Map(),
    attackEffects: [],
    lookTarget: new THREE.Vector3(),
    cameraTarget: new THREE.Vector3(),
    camera: new THREE.PerspectiveCamera(40, 1.5, 0.5, 350),
    aim: new THREE.Vector3(0, 0, -20),
    keys: new Set(),
    sound: false,
    elapsed: 0,
    autoCamera: true,
    zoom: 1,
    angle: 0.6,
    seed: 731,
    onUpdate: () => {},
    events: [],
  });
  engine.random = () => {
    engine.seed = (engine.seed * 1664525 + 1013904223) >>> 0;
    return engine.seed / 4294967296;
  };
  engine.onEvent = (event) => engine.events.push(event);
  engine.camera.position.set(50, 65, 80);
  engine.camera.lookAt(0, 0, 0);
  engine.camera.updateMatrixWorld();
  engine.reset({ ...BATTLES[0], ...overrides }, options);
  engine.running = true;
  return engine;
}

function cleanup(engine) {
  engine.clearEffects();
  engine.clearGroup(engine.world);
  engine.clearGroup(engine.army);
  Object.values(engine.geo).forEach((geometry) => geometry.dispose());
  engine.materials.forEach((material) => material.dispose());
}

test("army roster uses the documented troop HP and supports both lieutenant wings", () => {
  const e = fixture(
    {},
    {
      banner: "#8045a1",
      crest: "mountain",
      appearance: { armor: "#53666b", helmet: "#a8b2ae", cape: "#80543e" },
    },
  );
  try {
    assert.equal(e.getState().allies, 44);
    assert.equal(e.getState().enemies, 72);
    assert.equal(e.units.length, 116);
    for (const unit of e.units)
      assert.equal(unit.maxHp, unit.commander ? 600 : TROOPS[unit.type].hp);
    assert.deepEqual(
      new Set(e.units.map((u) => u.type)),
      new Set(Object.keys(TROOPS)),
    );
    assert.equal(e.banner, "#8045a1");
    assert.equal(e.appearance.helmet, "#a8b2ae");
    assert.equal(e.crest, "mountain");
    assert.equal(e.getState().lieutenants.length, 2);
    assert.equal(e.units.filter((u) => u.lieutenant).length, 2);
    assert.equal(
      e.getState().lieutenants.reduce((n, u) => n + u.count, 0),
      44,
    );
    const screen = e.getState().heroScreen;
    assert.ok(Number.isFinite(screen.x) && Number.isFinite(screen.y));
  } finally {
    cleanup(e);
  }
});

test("skills apply actual healing, cooldowns, damage and pause restrictions", () => {
  const e = fixture({ mode: "heroic" });
  try {
    e.hero.hp = 300;
    assert.equal(e.skill("r"), true);
    assert.ok(e.hero.hp > 300);
    assert.equal(e.cooldowns.r, 18);
    assert.equal(e.skill("r"), false);
    e.paused = true;
    assert.equal(e.skill("q"), false);
    e.paused = false;
    const target = e.units.find((u) => u.team === 2 && u.type === "archer");
    target.x = e.hero.x;
    target.z = e.hero.z;
    e.skill("e");
    assert.equal(target.alive, false);
    assert.ok(e.kills >= 1);
    e.rage = 99;
    assert.equal(e.skill("t"), false);
    e.rage = 100;
    assert.equal(e.skill("t"), true);
    assert.equal(e.rage, 0);
  } finally {
    cleanup(e);
  }
});

test("left/right orders address the original wings after units have moved", () => {
  const e = fixture();
  try {
    e.units
      .filter((u) => u.team === 1)
      .forEach((u) => {
        u.x = -u.x;
      });
    e.command("hold", "left");
    assert.ok(
      e.units
        .filter((u) => u.team === 1 && u.wing === "left")
        .every((u) => u.order === "hold"),
    );
    assert.ok(
      e.units
        .filter((u) => u.team === 1 && u.wing === "right")
        .every((u) => u.order === "charge"),
    );
    e.command("retreat", "right");
    assert.ok(
      e.units
        .filter((u) => u.team === 1 && u.wing === "right")
        .every((u) => u.order === "retreat"),
    );
  } finally {
    cleanup(e);
  }
});

test("ridge uphill movement slows, and marsh penalizes cavalry more than infantry", () => {
  const e = fixture({ terrain: "ridge" });
  try {
    const unit = { x: 45, z: 0, type: "spear" };
    assert.ok(
      e.terrainMovementFactor(unit, 1, 0) <
        e.terrainMovementFactor(unit, -1, 0),
    );
    e.battle.terrain = "marsh";
    unit.x = -35;
    const foot = e.terrainMovementFactor(unit, 1, 0);
    unit.type = "cavalry";
    assert.ok(e.terrainMovementFactor(unit, 1, 0) < foot);
    assert.ok(foot < 1);
  } finally {
    cleanup(e);
  }
});

test("bridge routing crosses through the bridge and blocks walking or dashing into the river", () => {
  const e = fixture({ terrain: "bridge" });
  try {
    assert.ok(e.camps.every((c) => Math.abs(c.z) > 7.2 || Math.abs(c.x) < 5.4));
    const unit = { x: 25, z: 22 };
    for (let i = 0; i < 1800; i++) {
      const target = e.routeTarget(unit, -25, -22);
      const dx = target.x - unit.x,
        dz = target.z - unit.z,
        d = Math.hypot(dx, dz);
      if (d > 0.1) e.movePosition(unit, (dx / d) * 0.12, (dz / d) * 0.12);
      assert.ok(
        Math.abs(unit.z) >= 7.2 || Math.abs(unit.x) <= 5.4,
        "unit entered the river outside the bridge",
      );
      if (Math.hypot(unit.x + 25, unit.z + 22) < 0.3) break;
    }
    assert.ok(
      Math.hypot(unit.x + 25, unit.z + 22) < 0.3,
      "unit did not reach the other bank",
    );
    const hero = { x: 20, z: 8 };
    e.movePosition(hero, 0, -9);
    assert.equal(hero.z, 7.2);
  } finally {
    cleanup(e);
  }
});

test("forest reduces the actual effective archer range", () => {
  const healthAfterShot = (terrain) => {
    const e = fixture({ terrain });
    try {
      const archer = e.units.find((u) => u.team === 1 && u.type === "archer");
      const target = e.units.find((u) => u.team === 2 && u.type === "shield");
      e.units = [archer, target];
      Object.assign(archer, { x: 0, z: 0, attack: 0 });
      Object.assign(target, { x: 0, z: -15 });
      e.hero.x = 50;
      e.hero.z = 40;
      e.updateBattle(0.1);
      return target.hp;
    } finally {
      cleanup(e);
    }
  };
  assert.ok(healthAfterShot("plain") < healthAfterShot("forest"));
});

test("enemies pursue a distant hero after every allied soldier falls", () => {
  const e = fixture({ victory: "rout" });
  try {
    const enemy = e.units.find((u) => u.team === 2 && u.type === "spear");
    e.units = [enemy];
    Object.assign(enemy, { x: -35, z: -35 });
    Object.assign(e.hero, { x: 35, z: 35 });
    const before = Math.hypot(enemy.x - e.hero.x, enemy.z - e.hero.z);
    e.updateBattle(0.5);
    assert.ok(Math.hypot(enemy.x - e.hero.x, enemy.z - e.hero.z) < before);
  } finally {
    cleanup(e);
  }
});

test("capture, rout and rescue cannot win on timeout with unmet objectives", () => {
  for (const victory of ["capture", "rout", "rescue"]) {
    const e = fixture({ victory, duration: 0.01 });
    try {
      e.camps[0].owner = "ally";
      e.camps[0].progress = 100;
      e.camps[2].owner = "ally";
      e.camps[2].progress = 100;
      e.units
        .filter((u) => u.team === 2)
        .slice(1)
        .forEach((u) => {
          u.alive = false;
          u.death = 1;
        });
      e.updateBattle(0.02);
      assert.equal(
        e.result,
        "defeat",
        `${victory} incorrectly won with only two side camps and one enemy`,
      );
    } finally {
      cleanup(e);
    }
  }
  const e = fixture({ victory: "hold", duration: 0.01 });
  try {
    e.camps[0].owner = "ally";
    e.camps[0].progress = 100;
    e.updateBattle(0.02);
    assert.equal(e.result, "victory");
  } finally {
    cleanup(e);
  }
});

test("each objective succeeds only when its own completion condition is fulfilled", () => {
  for (const victory of ["capture", "rout", "rescue"]) {
    const e = fixture({ victory });
    try {
      if (victory === "capture")
        e.camps.forEach((c) => {
          c.owner = "ally";
          c.progress = 100;
        });
      if (victory === "rescue") {
        e.camps[1].owner = "ally";
        e.camps[1].progress = 100;
      }
      if (victory === "rout")
        e.units
          .filter((u) => u.team === 2)
          .forEach((u) => {
            u.alive = false;
            u.death = 1;
          });
      e.updateBattle(0.02);
      assert.equal(
        e.result,
        "victory",
        `${victory} objective did not complete`,
      );
    } finally {
      cleanup(e);
    }
  }
  const e = fixture({ victory: "capture" });
  try {
    e.units
      .filter((u) => u.team === 2)
      .forEach((u) => {
        u.alive = false;
        u.death = 1;
      });
    e.updateBattle(0.02);
    assert.equal(
      e.running,
      true,
      "enemy elimination must not replace the capture objective",
    );
  } finally {
    cleanup(e);
  }
});

test("manual focus works with automatic cameras disabled, and charge triggers an epic camera", () => {
  const e = fixture();
  try {
    e.autoCamera = false;
    e.focusHero();
    assert.equal(e.cameraEvent, "영웅 추적");
    assert.ok(e.manualCameraUntil > e.elapsed);
    e.updateCamera(0.5);
    assert.ok(e.lookTarget.z > 10, "manual camera did not focus the hero");
    e.autoCamera = true;
    e.command("charge");
    assert.equal(e.cameraEvent, "전군 돌격");
  } finally {
    cleanup(e);
  }
});

test("critical-health warnings fire once until health has recovered", () => {
  const e = fixture();
  try {
    e.hero.hp = e.hero.maxHp * 0.2;
    e.updateBattle(0.01);
    e.updateBattle(0.01);
    assert.equal(
      e.events.filter((event) => event.type === "warning").length,
      1,
    );
    assert.equal(e.cameraEvent, "지휘관 위기");
    e.hero.hp = e.hero.maxHp;
    e.updateBattle(0.01);
    e.hero.hp = e.hero.maxHp * 0.2;
    e.updateBattle(0.01);
    assert.equal(
      e.events.filter((event) => event.type === "warning").length,
      2,
    );
    e.hero.hp = 0;
    e.updateBattle(0.01);
    assert.equal(e.result, "defeat");
  } finally {
    cleanup(e);
  }
});

test("all twenty battle configurations build and advance with finite live unit positions", () => {
  for (const battle of BATTLES) {
    const e = fixture(battle);
    try {
      assert.equal(
        e.getState().allies,
        battle.allyCount,
        `${battle.name}: ally count`,
      );
      assert.equal(
        e.getState().enemies,
        battle.enemyCount,
        `${battle.name}: enemy count`,
      );
      for (let frame = 0; frame < 12; frame++) e.updateBattle(0.05);
      for (const unit of [...e.units, e.hero])
        assert.ok(
          Number.isFinite(unit.x) && Number.isFinite(unit.z),
          `${battle.name}: invalid unit position`,
        );
    } finally {
      cleanup(e);
    }
  }
});

test("active bridge combat keeps all soldiers on a bank or on the bridge", () => {
  const e = fixture(BATTLES[1]);
  try {
    for (let frame = 0; frame < 240 && e.running; frame++) {
      e.updateBattle(0.05);
      e.updateEffects(0.05);
      for (const unit of e.units.filter((u) => u.alive))
        assert.ok(
          Math.abs(unit.z) >= 7.19 || Math.abs(unit.x) <= 5.41,
          `soldier walked over water at ${unit.x},${unit.z}`,
        );
    }
  } finally {
    cleanup(e);
  }
});

test("Hefei and Hexi require both raid flags followed by the hero returning to base", () => {
  for (const id of [13, 16]) {
    const e = fixture(BATTLES.find((b) => b.id === id));
    try {
      e.hero.z = 35;
      e.camps[0].owner = "ally";
      e.camps[0].progress = 100;
      e.updateBattle(0.01);
      assert.equal(
        e.running,
        true,
        `${id}: one flag and returning is insufficient`,
      );
      assert.equal(e.getState().objectiveStatus.progress, 40);
      e.hero.z = 20;
      e.camps[2].owner = "ally";
      e.camps[2].progress = 100;
      e.updateBattle(0.01);
      assert.equal(
        e.running,
        true,
        `${id}: taking both flags must not immediately win`,
      );
      assert.equal(e.getState().objectiveStatus.returnRequired, true);
      e.hero.z = 35;
      e.updateBattle(0.01);
      assert.equal(e.result, "victory");
      assert.equal(e.getState().objectiveStatus.complete, true);
    } finally {
      cleanup(e);
    }
  }
  const e = fixture({ id: "13", victory: "rout" });
  try {
    assert.equal(
      e.objectiveMode,
      "rout",
      "string IDs must not activate a numbered historical scenario",
    );
  } finally {
    cleanup(e);
  }
});

test("Kunyang and Hulao require both the named commander and at least thirty percent of troops", () => {
  for (const id of [14, 19]) {
    for (const commanderFirst of [true, false]) {
      const e = fixture(BATTLES.find((b) => b.id === id));
      try {
        assert.equal(e.enemyCommander.maxHp, 1000);
        assert.equal(e.getState().enemyCommander.name, e.battle.enemyCommander);
        const killCommander = () => e.damage(e.enemyCommander, 2000, true);
        const defeatTroops = () =>
          e.units
            .filter((u) => u.team === 2 && u !== e.enemyCommander)
            .slice(0, Math.ceil(e.initialEnemies * 0.3))
            .forEach((u) => e.damage(u, u.maxHp * 2, true));
        if (commanderFirst) killCommander();
        else defeatTroops();
        e.updateBattle(0.01);
        assert.equal(e.running, true, `${id}: only one condition was met`);
        if (commanderFirst) defeatTroops();
        else killCommander();
        e.updateBattle(0.01);
        assert.equal(e.result, "victory");
        assert.equal(e.getState().enemyCommander.alive, false);
      } finally {
        cleanup(e);
      }
    }
  }
});

test("the named enemy commander takes real damage from ordinary allied troops", () => {
  const e = fixture(BATTLES[13]);
  try {
    const ally = e.units.find((u) => u.team === 1 && u.type === "axe");
    const commander = e.enemyCommander;
    e.units = [ally, commander];
    Object.assign(ally, { x: 0, z: 0, attack: 0 });
    Object.assign(commander, { x: 0, z: -1.5, attack: 1 });
    e.hero.x = 45;
    e.hero.z = 40;
    e.updateBattle(0.05);
    assert.ok(commander.hp < commander.maxHp);
  } finally {
    cleanup(e);
  }
});

test("Mobei and Yancheng win at twenty percent effective strength without requiring every enemy to die", () => {
  for (const id of [17, 20]) {
    const e = fixture(BATTLES.find((b) => b.id === id));
    try {
      e.units
        .filter((u) => u.team === 2)
        .forEach((u) => {
          u.hp = u.maxHp * 0.21;
        });
      assert.equal(e.getState().objectiveStatus.complete, false);
      e.units
        .filter((u) => u.team === 2)
        .forEach((u) => {
          u.hp = u.maxHp * 0.2;
        });
      e.updateBattle(0.01);
      assert.equal(e.result, "victory");
      assert.equal(
        e.getState().enemies,
        e.battle.enemyCount,
        "effective strength counts injury as well as casualties",
      );
    } finally {
      cleanup(e);
    }
  }
  const e = fixture({ ...BATTLES[16], duration: 0.01 });
  try {
    e.camps[0].owner = "ally";
    e.camps[0].progress = 100;
    e.updateBattle(0.02);
    assert.equal(
      e.result,
      "defeat",
      "Mobei must not inherit the generic hold timeout win",
    );
  } finally {
    cleanup(e);
  }
});

test("Changban spawns two noncombatants, heals them, and requires both to physically follow the hero home", () => {
  const e = fixture(BATTLES[14]);
  try {
    assert.equal(e.getState().escorts.length, 0);
    e.hero.x = 0;
    e.hero.z = -24;
    e.units = e.units.filter((u) => u.team === 1);
    e.camps[1].owner = "ally";
    e.camps[1].progress = 100;
    e.updateBattle(0.01);
    assert.equal(e.getState().escorts.length, 2);
    assert.equal(
      e.running,
      true,
      "securing the camp must not bypass escorting",
    );
    assert.equal(
      e.getState().allies,
      e.battle.allyCount,
      "noncombatants must not change the battle troop count",
    );
    assert.equal(e.getState().objectiveStatus.returnRequired, true);
    e.escorts[0].hp = 50;
    e.skill("r");
    assert.equal(e.escorts[0].hp, e.escorts[0].maxHp);
    const startZ = e.escorts[0].z;
    e.hero.z = 40;
    e.updateBattle(0.05);
    assert.ok(e.escorts[0].z > startZ, "escort did not follow the hero");
    for (let frame = 0; frame < 600 && e.running; frame++) {
      e.updateBattle(0.05);
      e.updateEffects(0.05);
    }
    assert.equal(e.result, "victory");
    assert.ok(
      e.escorts.every(
        (escort) => escort.alive && escort.rescued && escort.z > 31,
      ),
    );
    assert.equal(e.getState().objectiveStatus.progress, 100);
  } finally {
    cleanup(e);
  }
});

test("enemies can attack Changban escorts and losing either protected person defeats the mission", () => {
  const e = fixture(BATTLES[14]);
  try {
    e.hero.x = 0;
    e.hero.z = -24;
    e.camps[1].owner = "ally";
    e.camps[1].progress = 100;
    e.updateBattle(0.01);
    const escort = e.escorts[0];
    const enemy = e.units.find((u) => u.team === 2 && u.type === "axe");
    e.units = [enemy];
    Object.assign(enemy, { x: escort.x, z: escort.z - 1, attack: 0 });
    e.hero.x = 45;
    e.hero.z = 40;
    const hp = escort.hp;
    e.updateBattle(0.05);
    assert.ok(escort.hp < hp, "enemy AI did not target the protected civilian");
    assert.equal(
      enemy.hp,
      enemy.maxHp,
      "protected civilian should not counterattack",
    );
    e.damage(escort, 1000);
    e.updateBattle(0.01);
    assert.equal(e.result, "defeat");
    assert.equal(e.getState().escorts[0].alive, false);
  } finally {
    cleanup(e);
  }
});

test("defending two camps must be continuous before the forty-second hold victory", () => {
  const e = fixture();
  try {
    e.camps.slice(0, 2).forEach((c) => {
      c.owner = "ally";
      c.progress = 100;
    });
    e.heldTime = 39;
    e.updateBattle(0.5);
    assert.equal(e.running, true);
    e.camps[1].owner = "enemy";
    e.camps[1].progress = -100;
    e.updateBattle(0.1);
    assert.equal(e.heldTime, 0);
    e.camps[1].owner = "ally";
    e.camps[1].progress = 100;
    e.heldTime = 39.99;
    e.updateBattle(0.02);
    assert.equal(e.result, "victory");
  } finally {
    cleanup(e);
  }
});

test("Musou charges from real hits, not idle time or misses, and cannot refill itself", () => {
  const e = fixture();
  try {
    assert.equal(e.rage, 0);
    e.updateBattle(0.1);
    assert.equal(e.rage, 0);
    e.hero.x = 55;
    e.hero.z = 45;
    assert.equal(e.skill("e"), true);
    assert.equal(e.rage, 0, "a missed skill granted rage");
    const target = e.units.find((u) => u.team === 2 && u.type === "spear");
    e.damage(target, 1, true);
    assert.ok(e.rage > 0, "a real hit did not charge rage");
    target.x = e.hero.x;
    target.z = e.hero.z;
    e.rage = 100;
    assert.equal(e.skill("t"), true);
    assert.equal(e.rage, 0, "ultimate hits refilled their own cost");
    assert.equal(target.alive, false);
  } finally {
    cleanup(e);
  }
});

test("tactical commanders deal forty percent of heroic baseline damage", () => {
  const dealt = [];
  for (const mode of ["tactical", "heroic"]) {
    const e = fixture({ mode });
    try {
      const target = e.units.find((u) => u.team === 2 && u.type === "spear");
      e.units = [target];
      target.x = e.hero.x;
      target.z = e.hero.z;
      const hp = target.hp;
      e.strike(3, 50, true);
      dealt.push(hp - target.hp);
    } finally {
      cleanup(e);
    }
  }
  assert.equal(dealt[0], dealt[1] * 0.4);
});
