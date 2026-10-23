import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TROOPS } from "./battles.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ORDER_NAMES = {
  charge: "전군 돌격",
  follow: "영웅 호위",
  hold: "진형 사수",
  retreat: "후방 재집결",
  attack: "전군 돌격",
  advance: "전군 돌격",
  defend: "진형 사수",
  rally: "영웅 호위",
};
const TYPE_NAMES = {
  spear: "창병",
  shield: "방패병",
  sword: "검병",
  axe: "도끼병",
  archer: "궁병",
  cavalry: "기병",
};
const WEAPONS = {
  spear: { range: 7.3, damage: 54, rate: 0.42 },
  sword: { range: 5.8, damage: 61, rate: 0.34 },
  axe: { range: 6.3, damage: 98, rate: 0.63 },
  bow: { range: 27, damage: 72, rate: 0.48 },
  halberd: { range: 8.5, damage: 75, rate: 0.54 },
  dual: { range: 5.4, damage: 43, rate: 0.22 },
  hammer: { range: 6.5, damage: 125, rate: 0.78 },
  lance: { range: 9.5, damage: 66, rate: 0.46 },
};

/** Original procedural battlefield. No models, textures or code from the reference game. */
export class Battlefield {
  constructor(
    container,
    { onUpdate = () => {}, onEvent = () => {}, settings = {} } = {},
  ) {
    this.container = container;
    this.onUpdate = onUpdate;
    this.onEvent = onEvent;
    this.settings = settings;
    this.seed = settings.seed ?? 731;
    this.random = () => {
      this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
      return this.seed / 4294967296;
    };
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#b4c6ba");
    this.scene.fog = new THREE.Fog("#b4c6ba", 105, 225);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 350);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "삼차원 전장. WASD 이동, 클릭 공격, 마우스 휠로 확대 및 축소",
    );
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight("#fff2d1", "#657765", 2.7));
    const sun = new THREE.DirectionalLight("#fff2d4", 3.4);
    sun.position.set(-38, 65, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -85,
      right: 85,
      top: 65,
      bottom: -65,
      near: 1,
      far: 180,
    });
    sun.shadow.normalBias = 0.04;
    sun.shadow.bias = -0.0002;
    this.scene.add(sun);
    this.sun = sun;
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.army = new THREE.Group();
    this.scene.add(this.army);
    this.effects = new THREE.Group();
    this.scene.add(this.effects);
    this.geo = {
      box: new THREE.BoxGeometry(1, 1, 1),
      sphere: new THREE.IcosahedronGeometry(1, 0),
      cone: new THREE.ConeGeometry(1, 1, 5),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 7),
      ring: new THREE.TorusGeometry(1, 0.038, 4, 48),
      plane: new THREE.PlaneGeometry(1, 1),
    };
    this.materials = new Map();
    this.units = [];
    this.particles = [];
    this.keys = new Set();
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.publishElapsed = 0;
    this.zoom = 1;
    this.angle = 0.6;
    this.autoCamera = settings.cinematic !== false;
    this.cameraTarget = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.cameraEventUntil = 0;
    this.cameraEvent = "";
    this.sound = false;
    this.speed = 1;
    this.selectedUnit = "all";
    this.order = "charge";
    this.running = false;
    this.paused = false;
    this.mapMode = false;
    this.aim = new THREE.Vector3(0, 0, -20);
    this.raycaster = new THREE.Raycaster();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.mouse = new THREE.Vector2();
    this.lastShot = 0;
    this.cooldowns = { q: 0, e: 0, r: 0, t: 0, space: 0 };
    this.attackEffects = [];
    this.listeners = [];
    this.bindInput();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.preview({
      id: "preview",
      terrain: "ridge",
      allyCount: 1200,
      enemyCount: 1500,
      duration: 240,
      victory: "rout",
    });
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  mat(color, opts = {}) {
    const key = `${color}-${JSON.stringify(opts)}`;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.94,
          flatShading: true,
          ...opts,
        }),
      );
    return this.materials.get(key);
  }

  mesh(shape, color, scale, pos, parent = this.world, opts = {}) {
    const m = new THREE.Mesh(this.geo[shape], this.mat(color, opts));
    if (scale) m.scale.set(...scale);
    if (pos) m.position.set(...pos);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  clearGroup(group) {
    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((o) => {
        if (o.geometry && !Object.values(this.geo).includes(o.geometry))
          o.geometry.dispose();
      });
    }
  }

  terrainHeight(x, z) {
    let y = Math.sin(x * 0.07) * Math.cos(z * 0.065) * 0.48;
    if (this.battle?.terrain === "ridge")
      y += Math.max(0, (Math.abs(x) - 27) / 20) * 3;
    return y;
  }

  buildWorld() {
    this.clearGroup(this.world);
    const terrain = this.battle.terrain || "plain";
    const groundGeo = new THREE.PlaneGeometry(170, 135, 40, 32);
    groundGeo.rotateX(-Math.PI / 2);
    const verts = groundGeo.attributes.position;
    const colors = [];
    const color = new THREE.Color();
    for (let i = 0; i < verts.count; i++) {
      const x = verts.getX(i),
        z = verts.getZ(i);
      verts.setY(i, this.terrainHeight(x, z) - 0.12);
      const v = this.random();
      color.set(terrain === "marsh" ? "#849d82" : "#a8b38b");
      color.offsetHSL((v - 0.5) * 0.035, (v - 0.5) * 0.08, (v - 0.5) * 0.095);
      colors.push(color.r, color.g, color.b);
    }
    groundGeo.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3),
    );
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(
      groundGeo,
      this.mat("#ffffff", { vertexColors: true }),
    );
    ground.receiveShadow = true;
    this.world.add(ground);
    // Light sand roads connecting the fortifications.
    const road = this.mesh("plane", "#c8c3a3", [11, 115, 1], [0, -0.02, 0]);
    road.rotation.x = -Math.PI / 2;
    const crossRoad = this.mesh("plane", "#bbb99b", [95, 6, 1], [0, 0.01, 0]);
    crossRoad.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 13; i++) {
      const x = (this.random() - 0.5) * 240;
      const z = -85 - this.random() * 30;
      const hill = this.mesh(
        "sphere",
        i % 2 ? "#849b8c" : "#93a594",
        [22 + this.random() * 24, 13 + this.random() * 18, 20],
        [x, -6, z],
      );
      hill.castShadow = false;
    }
    const treeCount = terrain === "forest" ? 120 : 66;
    for (let i = 0; i < treeCount; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (29 + this.random() * 46);
      const z = (this.random() - 0.5) * 109;
      if (Math.abs(x) < 44 && Math.abs(z) < 9) continue;
      this.tree(x, z, 0.85 + this.random() * 0.85);
    }
    for (let i = 0; i < 48; i++) {
      const x = (this.random() - 0.5) * 145,
        z = (this.random() - 0.5) * 100;
      if (Math.abs(x) < 12 || Math.abs(z) < 6) continue;
      const s = 0.3 + this.random() * 1.4;
      const rock = this.mesh(
        "sphere",
        "#8c9584",
        [s * 1.5, s, s],
        [x, this.terrainHeight(x, z) + s * 0.25, z],
      );
      rock.rotation.y = this.random() * TAU;
    }
    if (terrain === "bridge" || terrain === "marsh") {
      const water = this.mesh(
        "plane",
        "#75a5a1",
        [terrain === "bridge" ? 170 : 34, terrain === "bridge" ? 13 : 90, 1],
        [terrain === "bridge" ? 0 : -39, 0.04, 0],
        this.world,
        { metalness: 0.15, roughness: 0.45 },
      );
      water.rotation.x = -Math.PI / 2;
      if (terrain === "bridge") {
        this.mesh("box", "#9e8665", [13, 0.7, 22], [0, 0.5, 0]);
        for (let z = -10; z <= 10; z += 2)
          this.mesh("box", "#b5a080", [13.4, 0.2, 0.2], [0, 0.9, z]);
        for (let x of [-6, 6]) {
          this.mesh("box", "#7d7056", [0.25, 0.25, 22], [x, 2.2, 0]);
          for (let z = -10; z <= 10; z += 5)
            this.mesh("box", "#847354", [0.45, 2.1, 0.45], [x, 1.2, z]);
        }
      }
    }
    this.camps = [
      {
        name: "서쪽 봉화대",
        x: terrain === "bridge" ? -22 : -29,
        z: terrain === "bridge" ? 14 : 0,
        owner: "neutral",
        progress: 0,
      },
      { name: "중앙 진지", x: 0, z: -24, owner: "enemy", progress: -100 },
      {
        name: "동쪽 보급소",
        x: terrain === "bridge" ? 22 : 29,
        z: terrain === "bridge" ? -14 : 0,
        owner: "neutral",
        progress: 0,
      },
    ];
    this.camps.forEach((camp, index) => this.buildCamp(camp, index));
    this.buildBase(-22, 35, this.banner || "#2e7e77");
    this.buildBase(21, -39, "#b85d48");
    // Grass islands give the ground a hand-painted, tactile texture.
    for (let i = 0; i < 100; i++) {
      const x = (this.random() - 0.5) * 130,
        z = (this.random() - 0.5) * 90;
      if (Math.abs(x) < 8 || Math.abs(z) < 5) continue;
      const tuft = this.mesh(
        "cone",
        "#8b9e76",
        [0.23, 0.7, 0.23],
        [x, this.terrainHeight(x, z) + 0.2, z],
      );
      tuft.castShadow = false;
    }
  }

  tree(x, z, scale) {
    const group = new THREE.Group();
    group.position.set(x, this.terrainHeight(x, z), z);
    group.scale.setScalar(scale);
    this.world.add(group);
    this.mesh("cylinder", "#7e7456", [0.28, 3.4, 0.28], [0, 1.7, 0], group);
    this.mesh("cone", "#536f5c", [2.1, 4.4, 2.1], [0, 4, 0], group);
    this.mesh("cone", "#638269", [1.7, 3.5, 1.7], [0, 5.5, 0], group);
    this.mesh("cone", "#789478", [1.12, 2.7, 1.12], [0, 6.9, 0], group);
    this.mergeStaticParts(group, "pine-tree");
  }

  buildBase(x, z, color) {
    for (let i = 0; i < 3; i++) {
      const tx = x + (i - 1) * 7;
      const tent = this.mesh("cone", "#dbcfac", [3.5, 4, 4.5], [tx, 1.8, z]);
      tent.geometry = new THREE.ConeGeometry(1, 1, 4);
      tent.rotation.y = Math.PI / 4;
      this.mesh("box", color, [0.8, 0.15, 4], [tx, 3.5, z]);
      this.mesh("box", "#5e6654", [1.1, 1.3, 0.1], [tx, 0.65, z + 3.2]);
    }
    for (let i = -5; i <= 5; i++) {
      this.mesh("box", "#938263", [0.45, 2.3, 0.45], [x + i * 2.2, 1, z - 5]);
    }
    this.mesh("box", "#938263", [23, 0.25, 0.25], [x, 1.5, z - 5]);
  }

  buildCamp(camp, i) {
    const g = new THREE.Group();
    g.position.set(camp.x, this.terrainHeight(camp.x, camp.z), camp.z);
    this.world.add(g);
    this.mesh("cylinder", "#b9b293", [4.8, 0.25, 4.8], [0, 0.05, 0], g);
    const ring = this.mesh("ring", "#e2ddba", [5, 5, 5], [0, 0.24, 0], g, {
      emissive: "#b5aa76",
      emissiveIntensity: 0.2,
    });
    ring.rotation.x = -Math.PI / 2;
    this.mesh("cylinder", "#746e55", [0.13, 8, 0.13], [0, 4, 0], g);
    const flag = this.mesh(
      "box",
      i === 1 ? "#be6650" : "#e5d3a7",
      [2.2, 1.4, 0.11],
      [1.1, 7.15, 0],
      g,
    );
    this.mesh("box", "#e9dcb5", [0.7, 0.7, 0.13], [1.1, 7.15, 0.02], g);
    camp.flag = flag;
    camp.ring = ring;
    for (let j = 0; j < 3; j++)
      this.mesh("box", "#9d8d6f", [1.4, 1, 1.1], [-3 + j * 1.7, 0.55, -3], g);
  }

  soldier(team, type, x, z, hero = false) {
    const model = new THREE.Group();
    const color =
      team === 1
        ? hero
          ? this.appearance.armor
          : this.banner || "#3e8a80"
        : "#b75d48";
    const dark = team === 1 ? this.banner || "#285b59" : "#773e36";
    const body = new THREE.Group();
    model.add(body);
    this.mesh("box", color, [0.87, 1.05, 0.6], [0, 1.45, 0], body);
    this.mesh("box", "#d4b48a", [0.55, 0.54, 0.53], [0, 2.24, 0], body);
    this.mesh(
      "sphere",
      hero ? this.appearance.helmet : "#59645b",
      [0.48, 0.35, 0.46],
      [0, 2.52, 0],
      body,
    );
    this.mesh(
      "cone",
      hero ? "#ddb965" : dark,
      [0.12, 0.45, 0.14],
      [0, 2.94, 0],
      body,
    );
    this.mesh("box", "#d5c18f", [0.82, 0.13, 0.64], [0, 1.14, 0], body);
    const leftLeg = this.mesh(
      "box",
      "#4c5b50",
      [0.31, 0.7, 0.37],
      [-0.22, 0.52, 0],
      body,
    );
    const rightLeg = this.mesh(
      "box",
      "#4c5b50",
      [0.31, 0.7, 0.37],
      [0.22, 0.52, 0],
      body,
    );
    const arm = new THREE.Group();
    arm.position.set(-0.6, 1.65, 0);
    body.add(arm);
    this.mesh("box", color, [0.3, 0.7, 0.3], [0, -0.2, 0], arm);
    if (type === "archer") {
      const bow = this.mesh(
        "ring",
        "#b79b6c",
        [0.6, 0.8, 0.6],
        [0, 0, -0.35],
        arm,
      );
      bow.rotation.y = Math.PI / 2;
    } else {
      const long =
        type === "spear" ||
        (hero && ["halberd", "lance"].includes(this.weapon));
      this.mesh(
        "cylinder",
        "#8b7958",
        [0.045, long ? 3.8 : 2.2, 0.045],
        [0, 0.75, -0.12],
        arm,
      );
      if (
        type === "axe" ||
        (hero && ["axe", "hammer", "halberd"].includes(this.weapon))
      ) {
        this.mesh(
          "box",
          "#c5ccbb",
          [hero && this.weapon === "hammer" ? 0.9 : 0.75, 0.55, 0.24],
          [0.2, long ? 2.4 : 1.7, -0.12],
          arm,
        );
      } else
        this.mesh(
          "cone",
          "#e2dcc0",
          [long ? 0.14 : 0.19, long ? 0.55 : 0.95, 0.14],
          [0, long ? 2.8 : 1.95, -0.12],
          arm,
        );
      const shield = this.mesh(
        "box",
        dark,
        [0.1, type === "shield" ? 1.5 : 0.95, type === "shield" ? 1.1 : 0.75],
        [0.61, 1.5, -0.1],
        body,
      );
      shield.rotation.z = 0.12;
      this.mesh("box", "#d1ba7f", [0.12, 0.55, 0.12], [0.67, 1.5, -0.1], body);
      if (hero)
        this.addCrest(body, this.crest, [0.74, 1.5, -0.1], 0.44, Math.PI / 2);
    }
    if (hero) {
      this.mesh("box", "#c9ac64", [1.1, 0.18, 0.7], [0, 1.95, 0], body);
      const cape = this.mesh(
        "box",
        this.appearance.cape,
        [0.8, 1.3, 0.12],
        [0, 1.25, 0.43],
        body,
      );
      cape.rotation.x = -0.14;
      const ring = this.mesh(
        "ring",
        "#f8df88",
        [1.2, 1.2, 1.2],
        [0, 0.1, 0],
        model,
        { emissive: "#dfb65a", emissiveIntensity: 0.7 },
      );
      ring.rotation.x = -Math.PI / 2;
      model.scale.setScalar(1.25);
      this.addArmyBanner(model, -0.75, true);
    }
    if (type === "cavalry" && !hero) {
      body.position.y = 1.15;
      this.mesh(
        "box",
        team === 1 ? "#88795d" : "#736a57",
        [1.05, 1.05, 2],
        [0, 1.08, 0],
        model,
      );
      this.mesh(
        "box",
        "#6b6450",
        [0.6, 1.2, 0.65],
        [0, 1.8, -0.9],
        model,
      ).rotation.x = -0.35;
      for (const hx of [-0.35, 0.35])
        for (const hz of [-0.6, 0.6])
          this.mesh("box", "#5f5c4c", [0.23, 0.9, 0.23], [hx, 0.45, hz], model);
    }
    // Each torso is a single cached draw call; moving legs and the weapon arm stay separate.
    this.mergeStaticParts(
      body,
      `body-${team}-${type}-${this.banner}-${hero ? this.weapon + this.crest + JSON.stringify(this.appearance) : ""}`,
      [leftLeg, rightLeg],
    );
    this.mergeStaticParts(
      arm,
      `weapon-${team}-${type}-${this.banner}-${hero ? this.weapon + this.appearance.armor : ""}`,
    );
    if (type === "cavalry" && !hero)
      this.mergeStaticParts(model, `horse-${team}`);
    model.position.set(x, this.terrainHeight(x, z), z);
    model.rotation.y = team === 1 ? 0 : Math.PI;
    this.army.add(model);
    const hp = TROOPS[type]?.hp || 100;
    return {
      model,
      body,
      arm,
      leftLeg,
      rightLeg,
      team,
      type,
      wing: x < 0 ? "left" : "right",
      x,
      z,
      hp,
      maxHp: hp,
      alive: true,
      attack: this.random(),
      phase: this.random() * TAU,
      order: "charge",
      death: 0,
      hero,
    };
  }

  addCrest(parent, kind, position, size = 0.7, angle = 0) {
    const emblem = new THREE.Group();
    emblem.position.set(...position);
    emblem.scale.setScalar(size);
    emblem.rotation.y = angle;
    parent.add(emblem);
    const gold = "#f3dda5";
    if (kind === "swords") {
      for (const sign of [-1, 1]) {
        const blade = this.mesh(
          "box",
          gold,
          [0.17, 1.2, 0.08],
          [0, 0, 0.04],
          emblem,
        );
        blade.rotation.z = sign * 0.65;
      }
    } else if (kind === "mountain") {
      this.mesh("cone", gold, [0.65, 0.9, 0.08], [-0.25, -0.1, 0.04], emblem);
      this.mesh("cone", gold, [0.45, 0.65, 0.09], [0.35, -0.22, 0.05], emblem);
    } else if (kind === "horse") {
      this.mesh(
        "box",
        gold,
        [0.42, 0.7, 0.09],
        [-0.1, -0.1, 0.04],
        emblem,
      ).rotation.z = -0.3;
      this.mesh("sphere", gold, [0.4, 0.26, 0.08], [0.18, 0.32, 0.05], emblem);
    } else if (kind === "shield") {
      this.mesh("box", gold, [0.72, 0.52, 0.1], [0, 0.12, 0.04], emblem);
      this.mesh(
        "cone",
        gold,
        [0.51, 0.64, 0.09],
        [0, -0.3, 0.04],
        emblem,
      ).rotation.z = Math.PI;
    } else if (kind === "spark") {
      for (const sign of [-1, 1]) {
        const ray = this.mesh(
          "cone",
          gold,
          [0.4, 0.75, 0.08],
          [0, sign * 0.3, 0.04],
          emblem,
        );
        ray.rotation.z = sign === 1 ? 0 : Math.PI;
      }
    } else {
      this.mesh("sphere", gold, [0.43, 0.43, 0.09], [0, 0, 0.04], emblem);
      for (let a = 0; a < 8; a++) {
        const ray = this.mesh(
          "box",
          gold,
          [0.1, 0.22, 0.08],
          [
            Math.sin((a * Math.PI) / 4) * 0.59,
            Math.cos((a * Math.PI) / 4) * 0.59,
            0.04,
          ],
          emblem,
        );
        ray.rotation.z = (-a * Math.PI) / 4;
      }
    }
    this.mergeStaticParts(emblem, `crest-${kind}`);
    return emblem;
  }

  addArmyBanner(
    model,
    x = 0,
    hero = false,
    color = this.banner,
    crest = this.crest,
  ) {
    const banner = new THREE.Group();
    model.add(banner);
    this.mesh(
      "cylinder",
      "#8d805c",
      [0.055, hero ? 4.5 : 3.9, 0.055],
      [x, hero ? 2.3 : 2, 0.6],
      banner,
    );
    this.mesh(
      "box",
      color,
      [hero ? 1.25 : 1, hero ? 1.05 : 0.8, 0.07],
      [x + 0.57, hero ? 4 : 3.4, 0.6],
      banner,
    );
    this.addCrest(
      banner,
      crest,
      [x + 0.57, hero ? 4 : 3.4, 0.66],
      hero ? 0.48 : 0.33,
    );
    this.mergeStaticParts(banner, `banner-${color}-${hero}`);
  }

  appointEnemyCommander(unit) {
    unit.commander = true;
    unit.name = this.battle.enemyCommander || "적군 총대장";
    unit.maxHp = this.battle.mode === "heroic" ? 1000 : 600;
    unit.hp = unit.maxHp;
    unit.model.scale.setScalar(1.45);
    this.mesh("box", "#e3ba68", [1.18, 0.2, 0.78], [0, 1.96, 0], unit.body);
    const cape = this.mesh(
      "box",
      "#7b292a",
      [0.92, 1.45, 0.13],
      [0, 1.23, 0.43],
      unit.body,
    );
    cape.rotation.x = -0.16;
    for (const x of [-0.28, 0, 0.28])
      this.mesh("cone", "#e3ba68", [0.09, 0.38, 0.09], [x, 2.82, 0], unit.body);
    this.addArmyBanner(unit.model, -0.7, true, "#9f3f37", "swords");
    this.enemyCommander = unit;
  }

  createEscort(index) {
    const model = new THREE.Group(),
      body = new THREE.Group(),
      arm = new THREE.Group();
    model.add(body);
    body.add(arm);
    this.army.add(model);
    const color = index === 0 ? "#e3c28d" : "#e6d9b6";
    this.mesh("box", color, [0.72, 1.1, 0.6], [0, 1.3, 0], body);
    this.mesh("sphere", "#d5b38c", [0.31, 0.35, 0.3], [0, 2.1, 0], body);
    this.mesh("cone", "#a88f5d", [0.55, 0.27, 0.55], [0, 2.4, 0], body);
    const leftLeg = this.mesh(
      "box",
      "#686755",
      [0.25, 0.65, 0.29],
      [-0.19, 0.4, 0],
      body,
    );
    const rightLeg = this.mesh(
      "box",
      "#686755",
      [0.25, 0.65, 0.29],
      [0.19, 0.4, 0],
      body,
    );
    this.mesh("box", "#a2bda5", [0.62, 0.75, 0.35], [0, 1.3, 0.43], body);
    const marker = this.mesh(
      "ring",
      "#f0d58e",
      [0.9, 0.9, 0.9],
      [0, 0.1, 0],
      model,
      { emissive: "#d9b868", emissiveIntensity: 0.7 },
    );
    marker.rotation.x = -Math.PI / 2;
    this.mergeStaticParts(body, `escort-${index}`, [leftLeg, rightLeg]);
    const x = this.camps[1].x + (index === 0 ? -2.7 : 2.7),
      z = this.camps[1].z + 3;
    model.position.set(x, this.terrainHeight(x, z), z);
    return {
      id: `escort-${index + 1}`,
      name: index === 0 ? "피난민" : "부상병",
      model,
      body,
      arm,
      leftLeg,
      rightLeg,
      x,
      z,
      hp: 360,
      maxHp: 360,
      team: 1,
      type: "civilian",
      alive: true,
      rescued: false,
      phase: index * 2,
      attack: 0,
      death: 0,
    };
  }

  updateEscorts(dt) {
    for (const escort of this.escorts) {
      if (!escort.alive) {
        escort.death -= dt;
        escort.model.rotation.z = lerp(
          escort.model.rotation.z,
          Math.PI * 0.46,
          Math.min(1, dt * 6),
        );
        if (escort.death < 0) escort.model.visible = false;
        continue;
      }
      if (escort.rescued) {
        this.animateSoldier(escort, dt, 0);
        continue;
      }
      const offset = escort.id === "escort-1" ? -2.3 : 2.3;
      const destination = this.routeTarget(
        escort,
        this.hero.x + offset,
        this.hero.z - 2,
      );
      const dx = destination.x - escort.x,
        dz = destination.z - escort.z,
        distance = Math.hypot(dx, dz);
      const walking = distance > 2;
      if (walking) {
        const step = Math.min(
          distance,
          dt *
            7.2 *
            this.terrainMovementFactor(escort, dx / distance, dz / distance),
        );
        this.movePosition(
          escort,
          (dx / distance) * step,
          (dz / distance) * step,
        );
        escort.model.rotation.y = Math.atan2(-dx, -dz);
      }
      if (escort.z > 31) {
        escort.rescued = true;
        this.emit(
          "capture",
          `${escort.name}, 아군 본진에 무사히 도착했습니다.`,
        );
      }
      this.animateSoldier(escort, dt, walking ? 1 : 0);
    }
  }

  mergeStaticParts(group, key, exclude = []) {
    const parts = group.children.filter(
      (child) => child.isMesh && !exclude.includes(child),
    );
    if (parts.length < 2) return;
    const cacheKey = `merged-${key}`;
    let geometry = this.geo[cacheKey];
    if (!geometry) {
      const pieces = parts.map((part) => {
        const copy = part.geometry.index
          ? part.geometry.toNonIndexed()
          : part.geometry.clone();
        part.updateMatrix();
        copy.applyMatrix4(part.matrix);
        const colors = new Float32Array(copy.attributes.position.count * 3);
        const c = part.material.color;
        for (let i = 0; i < colors.length; i += 3) {
          colors[i] = c.r;
          colors[i + 1] = c.g;
          colors[i + 2] = c.b;
        }
        copy.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        return copy;
      });
      geometry = mergeGeometries(pieces, false);
      pieces.forEach((piece) => piece.dispose());
      if (!geometry) return;
      this.geo[cacheKey] = geometry;
    }
    parts.forEach((part) => group.remove(part));
    const combined = new THREE.Mesh(
      geometry,
      this.mat("#ffffff", { vertexColors: true }),
    );
    combined.castShadow = true;
    combined.receiveShadow = true;
    group.add(combined);
  }

  reset(battle, options = {}) {
    this.battle = {
      allyCount: 1200,
      enemyCount: 1500,
      duration: 240,
      victory: "rout",
      terrain: "plain",
      mode: "tactical",
      ...battle,
    };
    const scenarioModes = {
      13: "raid-return",
      14: "commander-rout",
      15: "escort",
      16: "raid-return",
      17: "strength-rout",
      19: "commander-rout",
      20: "strength-rout",
    };
    this.objectiveMode =
      typeof this.battle.id === "number"
        ? scenarioModes[this.battle.id] || this.battle.victory
        : this.battle.victory;
    this.difficulty = options.difficulty || "normal";
    this.weapon = options.weapon || "spear";
    this.banner = options.banner || "#45b8a1";
    this.appearance = {
      armor: "#287d77",
      helmet: "#59645b",
      cape: "#1a5d5b",
      ...options.appearance,
    };
    this.crest = options.crest || "sun";
    this.clearGroup(this.army);
    this.clearEffects();
    this.buildWorld();
    this.units = [];
    this.escorts = [];
    this.raidFlags = [false, false];
    this.enemyCommander = null;
    const allyCount = Number(this.battle.allyCount),
      enemyCount = Number(this.battle.enemyCount);
    const allyN =
      allyCount <= 200
        ? clamp(Math.round(allyCount), 8, 65)
        : clamp(Math.round(allyCount / 32), 24, 48);
    const enemyN =
      enemyCount <= 200
        ? clamp(Math.round(enemyCount), 12, 100)
        : clamp(Math.round(enemyCount / 32), 30, 62);
    for (const [team, n] of [
      [1, allyN],
      [2, enemyN],
    ]) {
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / 10),
          col = i % 10;
        const x = (col - 4.5) * 2.6 + (this.random() - 0.5) * 0.4;
        const z = team === 1 ? 14 + row * 3 : -16 - row * 3;
        const type =
          col >= 8
            ? "cavalry"
            : row === 2 || row === 3 || col === 7
              ? "archer"
              : [
                  "spear",
                  "spear",
                  "shield",
                  "shield",
                  "sword",
                  "sword",
                  "axe",
                  "archer",
                ][col];
        const unit = this.soldier(team, type, x, z);
        if (team === 1 && (i === 2 || i === 5)) {
          unit.lieutenant = true;
          this.addArmyBanner(unit.model);
        }
        this.units.push(unit);
      }
    }
    this.appointEnemyCommander(
      this.units.find((u) => u.team === 2 && u.type === "sword") ||
        this.units.find((u) => u.team === 2),
    );
    this.initialAllies = allyN;
    this.initialEnemies = enemyN;
    this.hero = this.soldier(
      1,
      this.weapon === "bow"
        ? "archer"
        : ["sword", "dual"].includes(this.weapon)
          ? "sword"
          : ["axe", "hammer"].includes(this.weapon)
            ? "axe"
            : "spear",
      0,
      20,
      true,
    );
    this.hero.maxHp = this.battle.mode === "heroic" ? 3000 : 1200;
    this.hero.hp = this.hero.maxHp;
    this.time = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.rage = 0;
    this.order = "charge";
    this.selectedUnit = "all";
    this.cooldowns = { q: 0, e: 0, r: 0, t: 0, space: 0 };
    this.speed = 1;
    this.paused = false;
    this.result = null;
    this.heldTime = 0;
    this.heroLowWarned = false;
    this.manualCameraUntil = 0;
    this.lastShot = 0;
    this.damageFlash = 0;
    this.mapMode = false;
    this.lookTarget.set(0, 0, 0);
    this.cameraTarget.set(0, 0, 0);
    this.cameraEventUntil = 0;
    this.cameraEvent = "";
  }

  preview(battle, options = {}) {
    this.reset(battle, options);
    this.running = false;
    this.previewing = true;
    this.publish();
  }

  start(battle = this.battle, options = {}) {
    this.reset(battle, options);
    this.previewing = false;
    this.running = true;
    this.cinematic("출진", 4.5, 0.86);
    this.emit(
      "start",
      "전장에 도착했습니다. 거점을 장악하고 적군을 격파하십시오.",
    );
    this.playTone(220, 0.18, "triangle");
    this.publish();
  }

  bindInput() {
    const listen = (target, event, handler, opts) => {
      target.addEventListener(event, handler, opts);
      this.listeners.push(() =>
        target.removeEventListener(event, handler, opts),
      );
    };
    const canvas = this.renderer.domElement;
    listen(window, "keydown", (e) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      const key = e.key.toLowerCase();
      if (
        [" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(
          key,
        ) &&
        this.running
      )
        e.preventDefault();
      this.keys.add(key);
      if (!e.repeat && this.running && !this.paused) {
        if (["q", "e", "r", "t"].includes(key)) this.skill(key);
        if (key === " ") this.skill("space");
        if (key === "f") this.focusHero();
      }
    });
    listen(window, "keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    listen(window, "blur", () => this.keys.clear());
    listen(
      canvas,
      "wheel",
      (e) => {
        e.preventDefault();
        this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.001));
      },
      { passive: false },
    );
    listen(canvas, "contextmenu", (e) => e.preventDefault());
    listen(canvas, "pointerdown", (e) => {
      canvas.focus({ preventScroll: true });
      if (e.button === 2) {
        this.dragging = true;
        this.dragX = e.clientX;
        canvas.setPointerCapture(e.pointerId);
      }
      if (e.button === 0 && this.running && !this.paused) {
        this.mouseHeld = true;
        this.basicAttack();
      }
    });
    listen(window, "pointerup", () => {
      this.dragging = false;
      this.mouseHeld = false;
    });
    listen(canvas, "pointermove", (e) => {
      if (this.dragging) {
        this.angle += (e.clientX - this.dragX) * 0.008;
        this.dragX = e.clientX;
      }
      const rect = canvas.getBoundingClientRect();
      this.mouse.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(this.mouse, this.camera);
      this.raycaster.ray.intersectPlane(this.floorPlane, this.aim);
    });
  }

  emit(type, text, extra = {}) {
    this.onEvent({ type, text, ...extra });
  }

  command(order, unit = "all") {
    if (!this.running || this.paused) return false;
    const aliases = {
      attack: "charge",
      advance: "charge",
      defend: "hold",
      rally: "follow",
      돌격: "charge",
      호위: "follow",
      사수: "hold",
      후퇴: "retreat",
    };
    order = aliases[order] || order;
    if (!["charge", "hold", "follow", "retreat"].includes(order)) return false;
    this.order = order;
    this.selectedUnit = unit;
    this.units
      .filter(
        (u) =>
          u.team === 1 &&
          u.alive &&
          (unit === "all" || u.type === unit || u.wing === unit),
      )
      .forEach((u) => {
        u.order = order;
        u.holdX = u.x;
        u.holdZ = u.z;
      });
    this.emit(
      "command",
      `${unit === "all" ? "전군" : unit === "left" ? "좌군 부장" : unit === "right" ? "우군 부장" : TYPE_NAMES[unit] || "부대"} · ${ORDER_NAMES[order]}`,
    );
    if (order === "charge") this.cinematic("전군 돌격", 2.3, 0.9);
    this.ringAt(this.hero.x, this.hero.z, "#d4bd72", 10, 0.7);
    this.playTone(440, 0.1, "triangle");
    this.publish();
    return true;
  }

  selectUnit(type) {
    this.selectedUnit = type;
    this.publish();
  }
  setPaused(value) {
    this.paused = Boolean(value);
    this.keys.clear();
    this.mouseHeld = false;
    this.publish();
  }
  setSpeed(value) {
    this.speed = clamp(Number(value) || 1, 0.5, 2);
    this.publish();
  }
  setZoom(value) {
    this.zoom = clamp(Number(value) || 1, 0.65, 1.65);
    this.cameraEventUntil = 0;
    this.cameraEvent = "";
    this.publish();
  }
  setCinematic(value) {
    this.autoCamera = Boolean(value);
    if (!value) this.cameraEventUntil = 0;
  }
  setSound(value) {
    this.sound = Boolean(value);
    if (value) this.playTone(330, 0.1, "triangle");
  }
  setQuality(value) {
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, value === "low" ? 1 : 1.75),
    );
    this.renderer.shadowMap.enabled = value !== "low";
    this.sun.castShadow = value !== "low";
  }
  setMapMode(value) {
    this.mapMode = Boolean(value);
    this.publish();
  }
  focusHero() {
    this.cameraEvent = "영웅 추적";
    this.cameraEventUntil = this.elapsed + 2.5;
    this.manualCameraUntil = this.cameraEventUntil;
    this.eventZoom = 1.3;
    this.eventTarget = null;
    this.cameraTarget.set(this.hero?.x || 0, 0, this.hero?.z || 0);
    this.publish();
  }

  cinematic(name, duration, zoom = 1.2, target) {
    if (!this.autoCamera) return;
    this.cameraEvent = name;
    this.cameraEventUntil = this.elapsed + duration;
    this.eventZoom = zoom;
    this.eventTarget = target ? new THREE.Vector3(target.x, 0, target.z) : null;
  }

  basicAttack() {
    if (!this.running || this.paused || this.lastShot > this.time) return;
    const stats = WEAPONS[this.weapon] || WEAPONS.spear;
    this.lastShot = this.time + stats.rate;
    const hero = this.hero;
    hero.model.rotation.y = Math.atan2(
      hero.x - this.aim.x,
      hero.z - this.aim.z,
    );
    const bow = this.weapon === "bow";
    this.strike(stats.range, stats.damage, false);
    hero.attackAnim = 0.3;
    this.swoosh(hero.x, hero.z, bow ? "#d6c88e" : "#ede1aa", bow ? 3 : 4.5);
    this.playTone(190 + this.random() * 50, 0.055, "triangle", 0.025);
  }

  skill(key) {
    key = String(key).toLowerCase();
    if (key === "attack") {
      this.basicAttack();
      return this.running && !this.paused;
    }
    if (key === " ") key = "space";
    if (
      !this.running ||
      this.paused ||
      !(key in this.cooldowns) ||
      this.cooldowns[key] > 0
    )
      return false;
    const hero = this.hero;
    if (key === "t" && this.rage < 100) {
      this.emit("warning", "무쌍은 투지가 100일 때 사용할 수 있습니다.");
      return false;
    }
    if (key === "q") {
      this.cooldowns.q = 6;
      this.strike(11, 110, true);
      this.ringAt(hero.x, hero.z, "#f5dca0", 10, 0.55);
      this.cinematic("질풍 찌르기", 1.5, 1.38);
      this.emit("skill", "질풍 찌르기", { key });
    } else if (key === "e") {
      this.cooldowns.e = 10;
      this.strike(14, 140, true);
      this.ringAt(hero.x, hero.z, "#65d5c1", 15, 0.9);
      this.cinematic("회전 베기", 1.8, 1.48);
      this.emit("skill", "회전 베기", { key });
    } else if (key === "r") {
      this.cooldowns.r = 18;
      hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.23);
      [...this.units, ...this.escorts]
        .filter(
          (u) =>
            u.team === 1 &&
            u.alive &&
            Math.hypot(u.x - hero.x, u.z - hero.z) < 28,
        )
        .forEach((u) => {
          u.hp = u.maxHp;
          u.buff = 10;
        });
      this.ringAt(hero.x, hero.z, "#e6d888", 26, 1.6);
      this.cinematic("장수의 함성", 2, 0.93);
      this.emit("skill", "장수의 함성 · 체력 회복, 아군 사기 상승", { key });
    } else if (key === "t") {
      this.cooldowns.t = 30;
      this.rage = 0;
      this.strike(29, 440, true);
      // The ultimate consumes the meter; its own hits cannot refill it.
      this.rage = 0;
      this.ringAt(hero.x, hero.z, "#ffdf78", 30, 1.8);
      this.ringAt(hero.x, hero.z, "#ffffff", 19, 1.2);
      this.cinematic("천하무쌍", 3, 1.45);
      this.emit("skill", "천하무쌍!", { key });
      this.shake = 0.6;
    } else if (key === "space") {
      this.cooldowns.space = 3;
      const move = this.movementVector();
      if (move.lengthSq() < 0.1)
        move.set(this.aim.x - hero.x, 0, this.aim.z - hero.z).normalize();
      this.movePosition(hero, move.x * 9, move.z * 9);
      hero.invincible = 0.5;
      this.ringAt(hero.x, hero.z, "#dfebce", 3, 0.4);
      this.emit("skill", "회피", { key });
    }
    hero.attackAnim = 0.65;
    this.playTone(key === "t" ? 100 : 320, 0.2, "sawtooth", 0.045);
    this.publish();
    return true;
  }

  strike(radius, damage, allAround) {
    // Tactical commanders support their army; heroic commanders break formations.
    damage *= this.battle.mode === "heroic" ? 1 : 0.4;
    const h = this.hero;
    let count = 0;
    let nearest = null,
      nearestD = Infinity;
    for (const u of this.units) {
      if (u.team !== 2 || !u.alive) continue;
      const dx = u.x - h.x,
        dz = u.z - h.z;
      const d = Math.hypot(dx, dz);
      if (d < nearestD) {
        nearest = u;
        nearestD = d;
      }
      if (d > radius) continue;
      if (!allAround && d > 2) {
        const a = new THREE.Vector2(
          this.aim.x - h.x,
          this.aim.z - h.z,
        ).normalize();
        if (a.dot(new THREE.Vector2(dx, dz).normalize()) < -0.2) continue;
      }
      this.damage(u, damage, true);
      if (!allAround && this.weapon === "bow") this.arrow(h, u);
      count++;
      if (!allAround && count >= (this.weapon === "bow" ? 1 : 3)) break;
    }
    // A nearby click always aims toward the closest visible opponent.
    if (!count && !allAround && nearest && nearestD < radius)
      this.damage(nearest, damage, true);
  }

  damage(unit, amount, player = false) {
    if (!unit.alive) return;
    unit.hp -= amount * (unit.type === "shield" ? 0.72 : 1);
    unit.hit = 0.15;
    this.spark(unit.x, unit.z, player ? "#f2db99" : "#d7b09a");
    if (player) this.rage = clamp(this.rage + 1.5, 0, 100);
    if (unit.hp <= 0) {
      unit.alive = false;
      unit.death = 1.6;
      if (unit.commander) {
        this.emit(
          "capture",
          `${unit.name}을 제압했습니다! 적군의 지휘가 무너집니다.`,
        );
        this.cinematic("적장 격파", 2.8, 1.27, unit);
        this.ringAt(unit.x, unit.z, "#e9bc6c", 13, 1.2);
      }
      if (unit.team === 2 && player) {
        this.kills++;
        this.combo++;
        this.comboTimer = 5;
        this.rage = clamp(this.rage + 2.5, 0, 100);
      }
    }
  }

  movementVector() {
    const x =
      (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) -
      (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0);
    const z =
      (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) -
      (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0);
    // Screen-oriented movement follows the current orbital camera.
    return new THREE.Vector3(
      x * Math.cos(this.angle) + z * Math.sin(this.angle),
      0,
      -x * Math.sin(this.angle) + z * Math.cos(this.angle),
    ).normalize();
  }

  /** Ground rules are shared by player movement, dash and army pathing. */
  terrainMovementFactor(unit, dx, dz) {
    const terrain = this.battle.terrain;
    if (terrain === "ridge") {
      const slope =
        (this.terrainHeight(unit.x + dx * 2, unit.z + dz * 2) -
          this.terrainHeight(unit.x, unit.z)) /
        2;
      return clamp(1 - Math.max(0, slope) * 1.4, 0.5, 1);
    }
    if (
      terrain === "marsh" &&
      (unit.x < -20 || Math.sin(unit.x * 0.13 + unit.z * 0.08) > 0)
    )
      return unit.type === "cavalry" ? 0.48 : 0.67;
    if (terrain === "forest" && Math.abs(unit.x) > 24)
      return unit.type === "cavalry" ? 0.68 : 0.88;
    return 1;
  }

  routeTarget(unit, tx, tz) {
    if (this.battle.terrain !== "bridge") return { x: tx, z: tz };
    // The river spans z=-6.5..6.5; only the central wooden bridge is passable.
    if (unit.z >= 8 && tz < 8)
      return Math.abs(unit.x) > 3 ? { x: 0, z: 10 } : { x: 0, z: -10 };
    if (unit.z <= -8 && tz > -8)
      return Math.abs(unit.x) > 3 ? { x: 0, z: -10 } : { x: 0, z: 10 };
    if (Math.abs(unit.z) < 8)
      return { x: clamp(tx, -3.8, 3.8), z: tz >= 0 ? 10 : -10 };
    return { x: tx, z: tz };
  }

  movePosition(unit, dx, dz) {
    const nextX = clamp(unit.x + dx, -60, 60);
    let nextZ = clamp(unit.z + dz, -49, 49);
    if (
      this.battle.terrain === "bridge" &&
      Math.abs(nextZ) < 7.2 &&
      Math.abs(nextX) > 5.4
    ) {
      nextZ = (unit.z < 0 ? -1 : 1) * 7.2;
    }
    unit.x = nextX;
    unit.z = nextZ;
  }

  enemyEffectiveStrength() {
    return (
      this.units
        .filter((u) => u.team === 2 && u.alive)
        .reduce((total, unit) => total + clamp(unit.hp / unit.maxHp, 0, 1), 0) /
      Math.max(1, this.initialEnemies)
    );
  }

  getObjectiveStatus() {
    const mode = this.objectiveMode || this.battle.victory;
    const camps = this.camps.filter((c) => c.owner === "ally").length;
    const enemies = this.units.filter((u) => u.team === 2 && u.alive).length;
    const defeated = 1 - enemies / Math.max(1, this.initialEnemies);
    const status = {
      label: "",
      progress: 0,
      complete: false,
      returnRequired: false,
    };
    if (mode === "raid-return") {
      const captured = this.raidFlags.filter(Boolean).length;
      const returned = this.hero.z > 31;
      status.label =
        captured < 2
          ? `습격 거점 확보 · ${captured} / 2`
          : returned
            ? "습격 성공 · 지휘관 본진 귀환"
            : "습격 성공 · 지휘관을 아군 본진으로 귀환시키세요";
      status.progress = captured * 40 + (captured === 2 && returned ? 20 : 0);
      status.complete = captured === 2 && returned;
      status.returnRequired = captured === 2 && !returned;
    } else if (mode === "commander-rout") {
      const subdued = this.enemyCommander && !this.enemyCommander.alive;
      const commanderProgress = this.enemyCommander
        ? 1 - Math.max(0, this.enemyCommander.hp) / this.enemyCommander.maxHp
        : 0;
      status.label = `${this.enemyCommander?.name || "적 지휘관"} ${subdued ? "제압 완료" : "제압"} · 적군 격파 ${Math.round(defeated * 100)} / 30%`;
      status.progress = clamp(
        commanderProgress * 50 + Math.min(1, defeated / 0.3) * 50,
        0,
        100,
      );
      status.complete = Boolean(subdued && defeated >= 0.3);
    } else if (mode === "strength-rout") {
      const strength = this.enemyEffectiveStrength();
      status.label = `적 유효 병력 ${Math.ceil(strength * 100)}% · 20% 이하로 격퇴`;
      status.progress = clamp(((1 - strength) / 0.8) * 100, 0, 100);
      status.complete = strength <= 0.2 + 1e-9;
    } else if (mode === "escort") {
      const rescued = this.escorts.filter((e) => e.rescued && e.alive).length;
      status.label = this.escorts.length
        ? `피난민과 부상병 보호 · 본진 도착 ${rescued} / 2`
        : "중앙 진지를 확보하고 피난민과 부상병을 구출하세요";
      const escortProgress = this.escorts.reduce(
        (total, e) =>
          total +
          (e.alive ? (e.rescued ? 1 : clamp((e.z + 24) / 56, 0, 0.99)) : 0),
        0,
      );
      status.progress = this.escorts.length
        ? 30 + escortProgress * 35
        : Math.max(0, this.camps[1].progress) * 0.3;
      status.complete = this.escorts.length === 2 && rescued === 2;
      status.returnRequired = this.escorts.length === 2 && !status.complete;
    } else if (mode === "capture") {
      status.label = `거점 확보 · ${camps} / 3`;
      status.progress = (camps / 3) * 100;
      status.complete = camps === 3;
    } else if (mode === "rescue") {
      status.label = "중앙 진지의 아군을 구출하세요";
      status.progress = Math.max(0, this.camps[1].progress);
      status.complete = this.camps[1].owner === "ally";
    } else if (mode === "hold") {
      status.label = `두 거점 방어 · ${Math.floor(this.heldTime || 0)} / 40초`;
      status.progress = clamp(((this.heldTime || 0) / 40) * 100, 0, 100);
      status.complete =
        this.heldTime >= 40 ||
        enemies === 0 ||
        (this.time >= this.battle.duration && camps >= 1);
    } else {
      status.label = `적군 격파 · ${this.initialEnemies - enemies} / ${this.initialEnemies}`;
      status.progress = clamp(defeated * 100, 0, 100);
      status.complete = enemies === 0;
    }
    if (status.complete) status.progress = 100;
    return status;
  }

  updateScenarioState() {
    if (this.objectiveMode === "raid-return") {
      if (this.camps[0].owner === "ally") this.raidFlags[0] = true;
      if (this.camps[2].owner === "ally") this.raidFlags[1] = true;
    }
    if (
      this.objectiveMode === "escort" &&
      this.escorts.length === 0 &&
      this.camps[1].owner === "ally"
    ) {
      this.escorts = [this.createEscort(0), this.createEscort(1)];
      this.emit(
        "capture",
        "피난민과 부상병을 구출했습니다. 두 사람을 보호하며 남쪽 아군 본진으로 이동하세요.",
      );
      this.cinematic("호송 시작", 3, 1.15, this.camps[1]);
    }
  }

  updateBattle(dt) {
    this.time += dt;
    for (const key of Object.keys(this.cooldowns))
      this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;
    const hero = this.hero;
    const move = this.movementVector();
    const moving = move.lengthSq() > 0;
    const heroSpeed = this.keys.has("shift") ? 14 : 10;
    if (moving) {
      const terrainFactor = this.terrainMovementFactor(hero, move.x, move.z);
      this.movePosition(
        hero,
        move.x * dt * heroSpeed * terrainFactor,
        move.z * dt * heroSpeed * terrainFactor,
      );
      hero.model.rotation.y = Math.atan2(-move.x, -move.z);
    }
    hero.invincible = Math.max(0, (hero.invincible || 0) - dt);
    if (this.mouseHeld) this.basicAttack();
    this.animateSoldier(hero, dt, moving ? 1 : 0);
    this.updateEscorts(dt);
    const living = this.units.filter((u) => u.alive);
    const targets = [
      ...living,
      ...this.escorts.filter((e) => e.alive && !e.rescued),
    ];
    const alliedSurvivors = living.filter((u) => u.team === 1).length;
    const difficulty =
      this.difficulty === "hard" ? 1.3 : this.difficulty === "easy" ? 0.65 : 1;
    for (const u of this.units) {
      if (!u.alive) {
        u.death -= dt;
        u.model.rotation.z = lerp(
          u.model.rotation.z,
          Math.PI * 0.46,
          Math.min(1, dt * 6),
        );
        if (u.death < 0) u.model.visible = false;
        continue;
      }
      let target = null,
        minDistance = Infinity;
      for (const other of targets) {
        if (other.team === u.team) continue;
        const distance = Math.hypot(other.x - u.x, other.z - u.z);
        if (distance < minDistance) {
          minDistance = distance;
          target = other;
        }
      }
      if (u.team === 2) {
        const hd = Math.hypot(hero.x - u.x, hero.z - u.z);
        if (hd < minDistance && (hd < 19 || alliedSurvivors === 0)) {
          target = hero;
          minDistance = hd;
        }
      }
      let tx = target?.x ?? 0,
        tz = target?.z ?? (u.team === 1 ? -24 : 22);
      const stats = TROOPS[u.type] || TROOPS.sword;
      const range =
        stats.range *
        (u.type === "archer" && this.battle.terrain === "forest" ? 0.72 : 1);
      const speed = stats.speed;
      let moveFactor = 1;
      if (u.team === 1) {
        if (u.order === "follow") {
          tx = hero.x + Math.sin(u.phase) * 5;
          tz = hero.z + Math.cos(u.phase) * 5;
          if (minDistance < 9) {
            tx = target.x;
            tz = target.z;
          }
        }
        if (u.order === "hold") {
          tx = u.holdX ?? u.x;
          tz = u.holdZ ?? u.z;
          moveFactor = 0.5;
        }
        if (u.order === "retreat") {
          tx = Math.sin(u.phase) * 18;
          tz = 34;
        }
        // Squads on either flank contest objectives as part of an advance.
        if (u.order === "charge" && minDistance > 12 && u.type !== "archer") {
          const objective = this.camps[u.x < -7 ? 0 : u.x > 7 ? 2 : 1];
          if (objective.owner !== "ally") {
            tx = objective.x;
            tz = objective.z;
          }
        }
      }
      const destination = this.routeTarget(u, tx, tz);
      let dx = destination.x - u.x,
        dz = destination.z - u.z,
        dist = Math.hypot(dx, dz);
      const shouldFight =
        target &&
        minDistance < range &&
        !(u.team === 1 && u.order === "retreat");
      let walking = false;
      if (!shouldFight && dist > (u.order === "follow" ? 2 : 1.2)) {
        dx /= dist;
        dz /= dist;
        const terrainFactor = this.terrainMovementFactor(u, dx, dz);
        this.movePosition(
          u,
          dx * speed * dt * moveFactor * terrainFactor,
          dz * speed * dt * moveFactor * terrainFactor,
        );
        u.model.rotation.y = Math.atan2(-dx, -dz);
        walking = true;
      }
      if (shouldFight) {
        u.model.rotation.y = Math.atan2(u.x - target.x, u.z - target.z);
        u.attack -= dt;
        if (u.attack <= 0) {
          u.attack = u.type === "archer" ? 1.6 : 0.95 + this.random() * 0.45;
          u.attackAnim = 0.3;
          const advantage =
            u.type === "spear" && target.type === "cavalry" ? 1.65 : 1;
          let damage =
            stats.damage *
            advantage *
            (u.buff > 0 ? 1.5 : 1) *
            (u.commander ? 1.5 : 1);
          if (u.team === 2) damage *= difficulty;
          if (target.hero) {
            if (!hero.invincible) hero.hp = Math.max(0, hero.hp - damage * 0.9);
          } else this.damage(target, damage);
          if (u.type === "archer") this.arrow(u, target);
        }
      }
      // Gentle local separation keeps formations readable.
      for (const other of living) {
        if (other === u || other.team !== u.team) continue;
        const sx = u.x - other.x,
          sz = u.z - other.z;
        const sd = sx * sx + sz * sz;
        if (sd < 1.8 && sd > 0.001) {
          const k = (dt * 0.65) / Math.sqrt(sd);
          this.movePosition(u, sx * k, sz * k);
        }
      }
      u.x = clamp(u.x, -60, 60);
      u.z = clamp(u.z, -49, 49);
      u.buff = Math.max(0, (u.buff || 0) - dt);
      this.animateSoldier(u, dt, walking ? 1 : 0);
    }
    const surviving = this.units.filter((u) => u.alive);
    this.updateCamps(dt, surviving);
    this.updateScenarioState();
    const allies = surviving.filter((u) => u.team === 1).length;
    const enemies = surviving.length - allies;
    const alliedCamps = this.camps.filter((c) => c.owner === "ally").length;
    if (hero.hp / hero.maxHp < 0.25 && hero.hp > 0 && !this.heroLowWarned) {
      this.heroLowWarned = true;
      this.emit(
        "warning",
        "지휘관이 위험합니다! 회피하거나 전열 회복을 사용하세요.",
      );
      this.cinematic("지휘관 위기", 2.2, 1.32);
    } else if (hero.hp / hero.maxHp > 0.35) this.heroLowWarned = false;
    this.heldTime = alliedCamps >= 2 ? (this.heldTime || 0) + dt : 0;
    const objective = this.getObjectiveStatus();
    if (hero.hp <= 0)
      this.finish(false, "장수가 쓰러졌습니다. 다음 출진을 준비하십시오.");
    else if (
      this.objectiveMode === "escort" &&
      this.escorts.some((e) => !e.alive)
    )
      this.finish(
        false,
        "호송 중 구출 대상이 쓰러졌습니다. 두 사람을 모두 보호해야 합니다.",
      );
    else if (objective.complete)
      this.finish(
        true,
        this.objectiveMode === "escort"
          ? "피난민과 부상병을 모두 안전하게 호송했습니다!"
          : this.objectiveMode === "raid-return"
            ? "습격 목표를 달성하고 아군 본진으로 귀환했습니다!"
            : `전투 목표 달성! ${objective.label}`,
      );
    else if (this.time >= Number(this.battle.duration || 240))
      this.finish(false, "제한 시간 안에 전투 목표를 달성하지 못했습니다.");
    else if (
      allies === 0 &&
      enemies > 10 &&
      this.time > 50 &&
      hero.hp < hero.maxHp * 0.1
    )
      this.finish(false, "아군이 와해되었습니다.");
  }

  animateSoldier(u, dt, moving) {
    u.phase += dt * (moving ? 11 : 1.6);
    u.model.position.set(
      u.x,
      this.terrainHeight(u.x, u.z) +
        (moving ? Math.abs(Math.sin(u.phase)) * 0.1 : 0),
      u.z,
    );
    u.leftLeg.rotation.x = Math.sin(u.phase) * 0.65 * moving;
    u.rightLeg.rotation.x = -Math.sin(u.phase) * 0.65 * moving;
    u.attackAnim = Math.max(0, (u.attackAnim || 0) - dt);
    u.arm.rotation.x =
      u.attackAnim > 0
        ? -Math.sin(u.attackAnim * 12) * 1.6
        : Math.sin(u.phase) * 0.15 * moving;
    u.body.rotation.z =
      u.attackAnim > 0 ? Math.sin(u.attackAnim * 13) * 0.15 : 0;
  }

  updateCamps(dt, living) {
    for (const camp of this.camps) {
      let ally = 0,
        enemy = 0;
      for (const u of living)
        if (Math.hypot(u.x - camp.x, u.z - camp.z) < 10) {
          if (u.team === 1) ally++;
          else enemy++;
        }
      if (Math.hypot(this.hero.x - camp.x, this.hero.z - camp.z) < 10)
        ally += 5;
      const delta = clamp(ally - enemy, -6, 6);
      if (delta)
        camp.progress = clamp(camp.progress + delta * dt * 4, -100, 100);
      const previous = camp.owner;
      if (camp.progress >= 100) camp.owner = "ally";
      else if (camp.progress <= -100) camp.owner = "enemy";
      if (previous !== camp.owner) {
        camp.flag.material = this.mat(
          camp.owner === "ally" ? this.banner : "#bd644d",
        );
        camp.ring.material = this.mat(
          camp.owner === "ally" ? "#61bca3" : "#cc8a6b",
        );
        this.emit(
          "capture",
          `${camp.name} ${camp.owner === "ally" ? "점령!" : "함락!"}`,
          { owner: camp.owner, camp: camp.name },
        );
        this.cinematic("거점 점령", 2.5, 1.14, camp);
        this.ringAt(
          camp.x,
          camp.z,
          camp.owner === "ally" ? "#5cd6b5" : "#e0a17f",
          13,
          1.5,
        );
        if (camp.owner === "ally") {
          this.rage = clamp(this.rage + 12, 0, 100);
          this.playTone(660, 0.22, "triangle");
        }
      }
      camp.flag.rotation.y = Math.sin(this.elapsed * 2 + camp.x) * 0.1;
    }
  }

  finish(won, reason) {
    if (!this.running) return;
    this.running = false;
    this.result = won ? "victory" : "defeat";
    this.mouseHeld = false;
    this.keys.clear();
    this.cinematic(won ? "승전" : "패전", 6, won ? 1.25 : 0.85);
    this.emit(this.result, reason, {
      kills: this.kills,
      time: this.time,
      hp: this.hero.hp,
    });
    this.playTone(won ? 523 : 130, 0.5, "triangle");
    this.publish();
  }

  ringAt(x, z, color, radius, life) {
    const mesh = new THREE.Mesh(
      this.geo.ring,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.65 + this.terrainHeight(x, z), z);
    this.effects.add(mesh);
    this.attackEffects.push({ mesh, age: 0, life, radius, kind: "ring" });
  }

  swoosh(x, z, color, radius) {
    this.ringAt(x, z, color, radius, 0.25);
  }

  spark(x, z, color) {
    if (this.attackEffects.length > 110) return;
    const mesh = new THREE.Mesh(
      this.geo.sphere,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
    );
    mesh.scale.setScalar(0.24);
    mesh.position.set(x, 1.7, z);
    this.effects.add(mesh);
    this.attackEffects.push({
      mesh,
      age: 0,
      life: 0.38,
      kind: "spark",
      vx: (this.random() - 0.5) * 3,
      vz: (this.random() - 0.5) * 3,
    });
  }

  arrow(from, to) {
    const mesh = new THREE.Mesh(this.geo.box, this.mat("#d4c395"));
    mesh.scale.set(0.06, 0.06, 1.5);
    mesh.position.set(from.x, 2, from.z);
    mesh.lookAt(to.x, 1.5, to.z);
    this.effects.add(mesh);
    this.attackEffects.push({
      mesh,
      age: 0,
      life: 0.45,
      kind: "arrow",
      from: new THREE.Vector3(from.x, 2, from.z),
      to: new THREE.Vector3(to.x, 1.5, to.z),
      sharedMaterial: true,
    });
  }

  clearEffects() {
    for (const e of this.attackEffects) {
      this.effects.remove(e.mesh);
      if (!e.sharedMaterial) e.mesh.material.dispose();
    }
    this.attackEffects = [];
  }

  updateEffects(dt) {
    for (let i = this.attackEffects.length - 1; i >= 0; i--) {
      const e = this.attackEffects[i];
      e.age += dt;
      const p = e.age / e.life;
      if (p >= 1) {
        this.effects.remove(e.mesh);
        if (!e.sharedMaterial) e.mesh.material.dispose();
        this.attackEffects.splice(i, 1);
        continue;
      }
      if (e.kind === "ring") {
        e.mesh.scale.setScalar(Math.max(0.01, e.radius * p));
        e.mesh.material.opacity = (1 - p) * 0.85;
      }
      if (e.kind === "spark") {
        e.mesh.position.x += e.vx * dt;
        e.mesh.position.z += e.vz * dt;
        e.mesh.position.y += dt * (3 - p * 7);
        e.mesh.material.opacity = 1 - p;
      }
      if (e.kind === "arrow") {
        e.mesh.position.lerpVectors(e.from, e.to, p);
        e.mesh.position.y += Math.sin(p * Math.PI) * 3;
      }
    }
  }

  updateCamera(dt) {
    const activeEvent =
      (this.autoCamera || this.manualCameraUntil > this.elapsed) &&
      this.cameraEventUntil > this.elapsed;
    if (!activeEvent && this.cameraEvent) {
      this.cameraEvent = "";
      this.eventTarget = null;
    }
    let targetX = 0,
      targetZ = 0;
    if (!this.previewing && this.hero) {
      targetX = this.hero.x * 0.55;
      targetZ = this.hero.z * 0.55 - 2;
    }
    if (activeEvent) {
      targetX = this.eventTarget?.x ?? this.hero.x;
      targetZ = this.eventTarget?.z ?? this.hero.z;
    }
    if (this.mapMode) {
      targetX = 0;
      targetZ = 0;
    }
    this.cameraTarget.set(targetX, 0.5, targetZ);
    this.lookTarget.lerp(this.cameraTarget, 1 - Math.exp(-dt * 2.5));
    const z = this.mapMode
      ? 0.65
      : activeEvent
        ? this.eventZoom * this.zoom
        : this.zoom;
    const distance = 87 / z;
    const height = this.mapMode ? 125 : distance * 0.83;
    const ideal = new THREE.Vector3(
      this.lookTarget.x + Math.sin(this.angle) * distance,
      height,
      this.lookTarget.z + Math.cos(this.angle) * distance,
    );
    if (this.mapMode) ideal.set(0, 145, 8);
    this.camera.position.lerp(ideal, 1 - Math.exp(-dt * 3));
    if (this.shake > 0) {
      this.shake -= dt;
      this.camera.position.x += (this.random() - 0.5) * this.shake * 0.8;
    }
    this.camera.lookAt(this.lookTarget);
  }

  getState() {
    const allies = this.units.filter((u) => u.team === 1 && u.alive);
    const enemies = this.units.filter((u) => u.team === 2 && u.alive);
    const heroProjection = new THREE.Vector3(
      this.hero?.x || 0,
      2.5,
      this.hero?.z || 0,
    ).project(this.camera);
    return {
      running: this.running,
      paused: this.paused,
      result: this.result,
      time: this.time || 0,
      remaining: Math.max(
        0,
        Number(this.battle?.duration || 240) - (this.time || 0),
      ),
      hp: Math.ceil(this.hero?.hp || 0),
      maxHp: this.hero?.maxHp || 1600,
      rage: this.rage || 0,
      kills: this.kills || 0,
      combo: this.combo || 0,
      allies: Math.ceil(
        (allies.length / (this.initialAllies || 1)) *
          Number(this.battle?.allyCount || 1200),
      ),
      enemies: Math.ceil(
        (enemies.length / (this.initialEnemies || 1)) *
          Number(this.battle?.enemyCount || 1500),
      ),
      camps: (this.camps || []).map(({ name, owner, progress, x, z }) => ({
        name,
        owner,
        progress,
        x,
        z,
      })),
      cooldowns: { ...this.cooldowns },
      command: this.order,
      selectedUnit: this.selectedUnit,
      speed: this.speed,
      zoom: this.zoom,
      cameraEvent: this.cameraEvent,
      hero: { x: this.hero?.x || 0, z: this.hero?.z || 0 },
      mapMode: this.mapMode,
      heroScreen: {
        x: (heroProjection.x + 1) / 2,
        y: (1 - heroProjection.y) / 2,
        visible:
          heroProjection.z > -1 &&
          heroProjection.z < 1 &&
          Math.abs(heroProjection.x) < 1 &&
          Math.abs(heroProjection.y) < 1,
      },
      enemyCommander: this.enemyCommander
        ? {
            name: this.enemyCommander.name,
            hp: Math.max(0, this.enemyCommander.hp),
            maxHp: this.enemyCommander.maxHp,
            x: this.enemyCommander.x,
            z: this.enemyCommander.z,
            alive: this.enemyCommander.alive,
          }
        : null,
      escorts: this.escorts.map(
        ({ id, name, x, z, hp, maxHp, alive, rescued }) => ({
          id,
          name,
          x,
          z,
          hp: Math.max(0, hp),
          maxHp,
          alive,
          rescued,
        }),
      ),
      objectiveStatus: this.getObjectiveStatus(),
      enemyStrength: this.enemyEffectiveStrength() * 100,
      units: ["spear", "shield", "archer", "cavalry", "sword", "axe"].map(
        (type) => {
          const squad = allies.filter((u) => u.type === type);
          return {
            type,
            count: Math.round(
              (squad.length / (this.initialAllies || 1)) *
                Number(this.battle?.allyCount || 1200),
            ),
            hp: squad.length
              ? (squad.reduce((v, u) => v + u.hp / u.maxHp, 0) / squad.length) *
                100
              : 0,
          };
        },
      ),
      lieutenants: ["left", "right"].map((id) => {
        const squad = allies.filter((u) => u.wing === id);
        const leader = squad.find((u) => u.lieutenant) || squad[0];
        return {
          id,
          name: id === "left" ? "좌군 부장" : "우군 부장",
          x: leader?.x || 0,
          z: leader?.z || 0,
          hp: leader ? Math.max(0, (leader.hp / leader.maxHp) * 100) : 0,
          count: Math.round(
            (squad.length / (this.initialAllies || 1)) *
              Number(this.battle?.allyCount || 1200),
          ),
          alive: Boolean(leader),
          command: leader?.order || this.order,
        };
      }),
      soldiers: [...this.units, ...this.escorts]
        .filter((u) => u.alive)
        .map((u) => ({
          x: u.x,
          z: u.z,
          team: u.team,
          type: u.type,
          commander: Boolean(u.commander),
          escort: u.type === "civilian",
        })),
      markers: [...this.units, ...this.escorts]
        .filter((u) => u.alive)
        .map((u) => ({
          x: u.x,
          z: u.z,
          team: u.team,
          type: u.type,
          commander: Boolean(u.commander),
          escort: u.type === "civilian",
        })),
      bounds: { minX: -65, maxX: 65, minZ: -50, maxZ: 50 },
      cameraDistance: this.camera.position.distanceTo(this.lookTarget),
      fps: Math.round(this.fps || 60),
      heldTime: this.heldTime || 0,
    };
  }

  publish() {
    if (this.hero) this.onUpdate(this.getState());
  }

  playTone(frequency, duration = 0.1, type = "sine", gain = 0.04) {
    if (!this.sound) return;
    try {
      if (!this.audio)
        this.audio = new (window.AudioContext || window.webkitAudioContext)();
      if (this.audio.state === "suspended") this.audio.resume();
      const osc = this.audio.createOscillator(),
        volume = this.audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, frequency * 0.5),
        this.audio.currentTime + duration,
      );
      volume.gain.setValueAtTime(gain, this.audio.currentTime);
      volume.gain.exponentialRampToValueAtTime(
        0.001,
        this.audio.currentTime + duration,
      );
      osc.connect(volume);
      volume.connect(this.audio.destination);
      osc.start();
      osc.stop(this.audio.currentTime + duration);
      osc.onended = () => {
        osc.disconnect();
        volume.disconnect();
      };
    } catch {
      /* Audio is optional; game rendering remains available. */
    }
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth),
      height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  frame() {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const realDt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += realDt;
    this.fps = lerp(this.fps || 60, 1 / Math.max(0.001, realDt), 0.05);
    if (this.running && !this.paused) this.updateBattle(realDt * this.speed);
    else if (this.previewing) {
      for (const u of this.units) {
        u.phase += realDt * 1.5;
        u.body.position.y =
          (u.type === "cavalry" ? 1.15 : 0) + Math.sin(u.phase) * 0.035;
      }
      if (this.hero) this.hero.arm.rotation.x = Math.sin(this.elapsed) * 0.07;
    }
    if (!this.paused) this.updateEffects(realDt);
    this.updateCamera(realDt);
    this.renderer.render(this.scene, this.camera);
    this.publishElapsed += realDt;
    if (this.publishElapsed > 0.125) {
      this.publishElapsed = 0;
      this.publish();
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.listeners.forEach((remove) => remove());
    this.resizeObserver.disconnect();
    this.clearEffects();
    this.clearGroup(this.world);
    this.clearGroup(this.army);
    Object.values(this.geo).forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.audio?.close();
  }
}
