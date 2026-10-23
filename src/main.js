import "./style.css";
import { Battlefield } from "./engine.js";
import { BATTLES, TROOPS } from "./battles.js";
import {
  loadSave,
  saveData,
  evaluateAchievements,
  WEAPONS,
  PORTRAITS,
  THEMES,
  CRESTS,
} from "./progress.js";

const baseUrl = import.meta.env.BASE_URL;
const paths = {
  swords: "m14.5 3 6 6-6 6M3 3l18 18M3 21l6-6M3 15l6 6M15 3l6 6",
  flag: "M4 22V3m0 1c6-5 10 5 16 0v11c-6 5-10-5-16 0",
  chevron: "m9 5 7 7-7 7",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  shield: "M12 3 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z",
  book: "M12 6C8 3 4 3 2 4v16c3-1 7-1 10 2m0-16c4-3 8-3 10-2v16c-3-1-7-1-10 2V6",
  medal: "m8 3 4 6 4-6M5 3l4 7m10-7-4 7M12 22a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 4-3 1-1 4H9l-1-4-3-1-2-4 2-5 3-1Z",
  user: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  sun: "M12 3v2m0 14v2M3 12h2m14 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v6l4 2",
  map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16",
  mountain: "m2 20 7-14 4 7 3-5 6 12H2Zm5-10 2 3 2-3",
  cross: "m6 6 12 12M6 18 18 6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  play: "m9 4 12 8-12 8V4Z",
  pause: "M8 4v16M16 4v16",
  focus:
    "M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  volume: "m11 4-6 5H2v6h3l6 5V4Zm4 4c3 2 3 6 0 8m3-11c5 4 5 10 0 14",
  check: "m5 12 4 4L20 5",
  spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z",
  info: "M12 11v6m0-10v1M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z",
  back: "M20 12H4m6-6-6 6 6 6",
  target: "M12 2v4m0 12v4M2 12h4m12 0h4M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z",
  horse: "m5 21 1-7-2-4 6-6 5 1 3-3v5l4 5-3 3-5-3-2 5v4M9 21v-6",
  bow: "M4 3c20 0 20 18 0 18L14 12 4 3Zm0 9h18m-4-3 4 3-4 3",
  spear: "M4 21 18 5m-2-2 5 0 0 5M7 14l4 4",
  axe: "M6 22 15 3m-4 3c5-3 9-1 10 4l-7 4",
  sword: "m4 21 4-4M4 15l5 5m-1-6L17 3h4v4L10 17Z",
};
const icon = (name, cl = "") =>
  `<svg class="icon ${cl}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.shield}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let save = loadSave(),
  selected = BATTLES[0],
  mode = "tactical",
  running = false,
  mapOpen = false,
  lastState = null,
  modalType = null,
  selectedUnit = "all",
  speed = 1,
  commanderDraft = null,
  battleSession = 0;
const $ = (s) => document.querySelector(s);
const troopList = Array.isArray(TROOPS)
  ? TROOPS
  : Object.entries(TROOPS).map(([id, t]) => ({ id, ...t }));
const troopName = {
  spear: "장창병",
  shield: "방패병",
  archer: "궁병",
  cavalry: "기병",
  sword: "검병",
  axe: "도끼병",
};
const troopIcon = {
  spear: "spear",
  shield: "shield",
  archer: "bow",
  cavalry: "horse",
  sword: "sword",
  axe: "axe",
};
function portrait(id = 0, size = 64) {
  const p = PORTRAITS[id % PORTRAITS.length];
  return `<svg class="portrait" width="${size}" height="${size}" viewBox="0 0 80 80" aria-label="지휘관 초상 ${id + 1}"><rect width="80" height="80" rx="4" fill="${p.bg}"/><path d="M6 80q3-24 34-24t34 24" fill="${p.cloak}"/><path d="m25 57 15 14 15-14 12 23H13Z" fill="${p.armor}"/><path d="M33 51h14v14H33" fill="${p.skin}"/><ellipse cx="40" cy="35" rx="18" ry="22" fill="${p.skin}"/><path d="M21 34q-2-24 20-25 23 3 19 28l-7-15-26 7-5 16Z" fill="${p.hair}"/><path d="M29 36h6m10 0h6" stroke="#30302a" stroke-width="2"/><path d="m40 36-2 10h5m-9 4q6 4 12-1" stroke="#8c6650" fill="none"/><path d="M19 23Q21 5 41 5q22 3 22 20l-6-3-34 3Z" fill="${p.armor}"/><path d="m37 5 3 16 4-16" fill="#e2ca86"/>${id % 3 === 0 ? '<path d="m28 49 12 14 14-17-6 15-8 6-10-8Z" fill="' + p.hair + '"/>' : ""}</svg>`;
}
function createShell() {
  $("#app").innerHTML = `
<header class="topbar"><a class="brand" href="${baseUrl}" aria-label="재의 군기 전장 사령부"><img src="${baseUrl}assets/crest.svg" alt=""/><span>재의 군기<small>역사를 다시 쓰는 전장</small></span></a><nav aria-label="주 메뉴"><button class="nav-btn active" data-view="battles">${icon("flag")}전장</button><button class="nav-btn" data-view="commander">${icon("user")}지휘관</button><button class="nav-btn" data-view="codex">${icon("book")}병종 도감</button><button class="nav-btn" data-view="records">${icon("medal")}전투 기록<span class="count" id="victory-count">${Object.keys(save.victories).length}</span></button></nav><div class="top-actions"><span class="saved-indicator"><i></i>진행 자동 저장</span><button class="icon-btn" data-action="settings" title="환경 설정" aria-label="환경 설정">${icon("settings")}</button><button class="profile-btn" data-view="commander">${portrait(save.portrait, 36)}<span>${esc(save.name)}<small>군단장</small></span></button></div></header>
<div class="workspace"><aside class="campaign-sidebar"><div class="sidebar-title"><span>작전 일지</span><span class="small-badge">20개의 전장</span></div><div class="mode-switch"><button data-mode="tactical" class="active">역사 전술전</button><button data-mode="heroic">영웅 무쌍전</button></div><p class="sidebar-description" id="mode-description">지형을 읽고, 군대를 지휘하세요.</p><div class="battle-list" id="battle-list"></div><div class="campaign-progress"><div><span>당신의 원정</span><strong id="campaign-total">0 / 20</strong></div><div class="progress-track"><i id="campaign-fill"></i></div><small>승리는 당신의 군기 아래 기록됩니다.</small></div><div class="sidebar-bottom">${icon("shield")} 작은 군대, 위대한 전략.</div></aside>
<main class="command-center"><div class="page-heading"><div><div class="eyebrow"><i></i>전장 사령부</div><h1>당신의 군기 아래, 새로운 역사.</h1><p>전장을 선택하고 당신만의 전술을 펼쳐 보세요.</p></div><button class="text-btn" data-action="guide">${icon("info")}처음 오셨나요?</button></div>
<section class="battle-board"><div class="scene-bar"><div><span class="live-dot"></span><span id="scene-label">전장 미리보기</span><span class="scene-separator">/</span><span id="scene-place"></span></div><span class="weather">${icon("sun")}맑음 · 새벽</span></div><div id="scene" aria-label="3D 전장. 휠로 확대 축소할 수 있습니다."><div class="scene-fade"></div><div class="scene-title"><span id="scene-year"></span><h2 id="scene-name"></h2><p id="scene-region"></p></div><div class="scene-tag">${icon("mountain")}실시간 3D 전장</div><div class="scene-legend"><span><i class="teal"></i>아군</span><span><i class="red"></i>적군</span><span><i class="gold"></i>거점</span></div><div class="camera-tools"><button class="icon-btn" data-action="zoom-in" aria-label="카메라 확대" title="확대">${icon("plus")}</button><button class="icon-btn" data-action="zoom-out" aria-label="카메라 축소" title="축소">${icon("minus")}</button><span></span><button class="icon-btn" data-action="focus" aria-label="지휘관 시점으로 돌아가기" title="지휘관 시점">${icon("focus")}</button><button class="icon-btn active" data-action="cinematic" aria-label="상황별 카메라 연출" title="상황별 카메라 연출">${icon("spark")}</button></div><div class="camera-hint">마우스 휠로 확대·축소 <span>·</span> 우클릭 드래그로 회전</div><div class="camera-caption" id="camera-caption"></div><div id="battle-hud" hidden></div></div><div class="board-footer"><span>${icon("focus")}결정적인 순간, 전장을 더 가까이.</span><label class="toggle-label"><input id="auto-camera" type="checkbox" ${save.settings.cinematic ? "checked" : ""}/><span class="toggle"></span>자동 카메라 연출</label></div></section>
<section class="army-section"><div class="section-heading"><h3>${icon("shield")}출전 부대 <span>균형 잡힌 병종이 승리를 만듭니다.</span></h3><button class="text-btn" data-view="codex">병종 살펴보기 ${icon("chevron")}</button></div><div class="troop-grid" id="troop-grid"></div></section>
<div class="field-note"><div class="note-icon">${icon("book")}</div><div><span>사령관의 한마디</span><p id="tactical-note"></p></div><span class="note-number">01 / 20</span></div><footer class="main-footer"><span>20개의 역사 전장. 하나의 당신만의 군기.</span><span>직접 싸우고, 함께 지휘하세요.</span></footer></main>
<aside class="briefing"><div class="eyebrow">작전 브리핑 <span id="brief-number">01</span></div><span class="type-label" id="battle-type">역사 전술전</span><h2 id="brief-title"></h2><p class="brief-subtitle" id="brief-subtitle"></p><div class="difficulty" id="difficulty"></div><div class="brief-divider"></div><div class="army-comparison"><div><span><i class="teal"></i>아군</span><strong id="ally-count"></strong><small id="ally-name"></small></div><span class="versus">대</span><div><span><i class="red"></i>적군</span><strong id="enemy-count"></strong><small id="enemy-name"></small></div></div><div class="brief-divider"></div><h3>${icon("target")}승리 목표</h3><p class="objective" id="objective"></p><div class="operation-tags"><span>${icon("clock")}<span id="battle-duration"></span></span><span>${icon("mountain")}<span id="terrain-name"></span></span></div><h3 class="history-title">역사의 한 페이지</h3><p class="history" id="history"></p><button class="text-btn history-link" data-action="history">작전 상세 읽기 ${icon("arrow")}</button><div class="commander-card">${portrait(save.portrait, 46)}<div><span id="company-name">${esc(save.company)}</span><strong id="commander-name">${esc(save.name)}<small> · 군단장</small></strong></div><button class="icon-btn" data-view="commander" aria-label="지휘관 편집">${icon("settings")}</button></div><div class="weapon-select"><span>선택 무기</span><button data-action="armory" id="weapon-open"></button></div><button class="launch-btn" data-action="launch">${icon("swords")}출전하기 ${icon("arrow")}</button><p class="launch-hint">이 전투의 역사를 다시 써 보세요.</p></aside></div><div id="modal-root"></div><div id="toast-root" aria-live="polite"></div><div id="mobile-warning"><span>${icon("map")}가로 화면으로 더 넓게 지휘하세요.</span><button data-action="dismiss-mobile" aria-label="안내 닫기">${icon("cross")}</button></div>`;
}
createShell();
let engine;
try {
  engine = new Battlefield($("#scene"), {
    onUpdate: updateHUD,
    onEvent: handleEvent,
    settings: save.settings,
  });
  engine.preview(selected);
  engine.setCinematic(save.settings.cinematic);
  engine.setQuality(save.settings.quality);
  engine.setSound(save.settings.sound);
} catch (error) {
  console.error(error);
  $("#scene").insertAdjacentHTML(
    "beforeend",
    `<div class="webgl-error"><h3>전장을 불러오지 못했습니다.</h3><p>브라우저의 하드웨어 가속을 켠 뒤 새로고침해 주세요.</p><button onclick="location.reload()">다시 불러오기</button></div>`,
  );
}
function persist() {
  saveData(save);
}
function renderList() {
  const scrollLeft = $("#battle-list").scrollLeft,
    scrollTop = $("#battle-list").scrollTop;
  $("#battle-list").innerHTML = BATTLES.filter((b) => b.mode === mode)
    .map(
      (b) =>
        `<button class="battle-item ${b.id === selected.id ? "selected" : ""}" data-battle="${b.id}" aria-label="${b.name} 선택" aria-pressed="${b.id === selected.id}"><span class="battle-number">${String(b.id).padStart(2, "0")}</span><span class="battle-item-text"><strong>${esc(b.title)}</strong><small>${esc(b.name)} · ${esc(b.year)}</small></span>${save.victories[b.id] ? icon("check", "won-icon") : icon("chevron")}</button>`,
    )
    .join("");
  $("#battle-list").scrollLeft = scrollLeft;
  $("#battle-list").scrollTop = scrollTop;
  const n = Object.keys(save.victories).length;
  $("#campaign-total").textContent = `${n} / 20`;
  $("#campaign-fill").style.width = `${n * 5}%`;
  $("#victory-count").textContent = n;
}
function renderBattle() {
  renderList();
  const b = selected;
  const names = {
    ridge: "능선과 비탈",
    bridge: "강과 교량",
    forest: "숲과 협곡",
    marsh: "습지와 평원",
    camp: "보급 진지",
    plain: "탁 트인 평원",
  };
  const set = (id, value) => ($(id).textContent = value);
  set("#scene-place", b.region);
  set(
    "#scene-year",
    `${b.year} · ${b.mode === "heroic" ? "영웅 무쌍전" : "역사 전술전"}`,
  );
  set("#scene-name", b.name);
  set("#scene-region", b.region);
  set("#brief-number", String(b.id).padStart(2, "0"));
  set("#battle-type", b.mode === "heroic" ? "영웅 무쌍전" : "역사 전술전");
  set("#brief-title", b.title);
  set("#brief-subtitle", `${b.name} · ${b.year}`);
  $("#difficulty").innerHTML =
    `<span class="difficulty-dots"><i></i><i></i><i class="${b.difficulty === "어려움" ? "" : "muted"}"></i></span>${b.difficulty || "보통"}<span>지형 활용이 중요합니다</span>`;
  set("#ally-count", `${b.allyCount} 명`);
  set("#enemy-count", `${b.enemyCount} 명`);
  set("#ally-name", b.allies);
  set("#enemy-name", b.enemies);
  set("#objective", b.objective);
  set("#battle-duration", `약 ${Math.ceil(b.duration / 60)}분`);
  set("#terrain-name", names[b.terrain] || "평원");
  set("#history", b.intro);
  set("#tactical-note", b.tactic);
  $(".note-number").textContent = `${String(b.id).padStart(2, "0")} / 20`;
  $("#weapon-open").innerHTML =
    `${icon(troopIcon[save.weapon] || "sword")}${WEAPONS.find((w) => w.id === save.weapon)?.name || "장창"}${icon("chevron")}`;
  $("#troop-grid").innerHTML = ["spear", "shield", "archer", "cavalry"]
    .map(
      (type, i) =>
        `<button class="troop-card" data-troop="${type}"><div class="troop-illustration ${type}">${icon(troopIcon[type])}<span class="troop-level">${i === 3 ? "기동" : "정예"}</span></div><div><strong>${troopName[type]}</strong><small>${["기병 저지 · 전선 유지", "화살 방어 · 전열 보호", "원거리 지원 · 집중 사격", "측면 돌파 · 신속 기동"][i]}</small></div><span class="troop-card-arrow">${icon("chevron")}</span></button>`,
    )
    .join("");
}
renderBattle();
function chooseBattle(id) {
  selected = BATTLES.find((b) => b.id === id) || BATTLES[0];
  engine?.preview(selected);
  renderBattle();
}
function showToast(text, type = "info") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `${icon(type === "success" ? "check" : "flag")}<span>${esc(text)}</span>`;
  while ($("#toast-root").children.length >= 3)
    $("#toast-root").firstElementChild.remove();
  $("#toast-root").append(t);
  setTimeout(() => t.remove(), 4200);
}
function modal(title, subtitle, content, kind, wide = false) {
  if (running) engine?.setPaused(true);
  modalType = kind;
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-heading"><div><div class="eyebrow">再 · 재의 군기</div><h2>${title}</h2><p>${subtitle}</p></div><button class="icon-btn" data-action="${kind === "result" ? "return" : "close-modal"}" aria-label="닫기">${icon("cross")}</button></div><div class="modal-content">${content}</div></section></div>`;
  $("#modal-root .icon-btn").focus();
}
function closeModal() {
  $("#modal-root").innerHTML = "";
  modalType = null;
  if (running) engine?.setPaused(false);
}
function showHistory() {
  const b = selected;
  modal(
    b.name,
    `${b.year} · ${b.region}`,
    `<img class="history-art" src="${baseUrl}assets/battle-keyart.png" alt="새벽 능선에서 마주한 청록 군기와 붉은 군기"/><div class="history-grid"><section><h3>역사적 배경</h3><p>${esc(b.intro)}</p><h3>당신의 작전</h3><p>${esc(b.tactic)}</p></section><section class="history-orders"><h3>전투 목표</h3><p>${esc(b.objective)}</p><h3>지휘관</h3><p>${esc(b.commander)} · ${esc(b.allies)}</p><h3>전투 방식</h3><p>${b.mode === "heroic" ? "강력한 지휘관과 소수 정예 부대로 전장을 돌파하세요." : "아군 진형과 병종 상성을 활용하고 지휘관의 생존을 지키세요."}</p></section></div><div class="info-note">역사를 바탕으로 재구성한 전투입니다. 병력 규모와 제한 시간은 플레이에 맞춰 조정했습니다.</div><button class="primary-btn full" data-action="launch">군기를 세우고 출전하기 ${icon("arrow")}</button>`,
    "history",
    true,
  );
}
function showGuide() {
  modal(
    "군단장을 위한 첫 번째 작전",
    "직접 싸우고, 부대를 지휘하며 승리를 만드세요.",
    `<div class="guide-steps"><div><span>01</span><h3>전장과 무기를 선택하세요</h3><p>역사 전술전에서는 진형과 지형이, 영웅 무쌍전에서는 지휘관의 기술이 전투의 흐름을 바꿉니다.</p></div><div><span>02</span><h3>함께 움직이고 공격하세요</h3><p>부대에 추종·방어·돌격·후퇴 명령을 내리고, 전술 지도에서 상황을 읽어 보세요.</p></div><div><span>03</span><h3>결정적인 순간을 잡으세요</h3><p>적을 타격해 무쌍 게이지를 채우세요. 강력한 기술과 함께 카메라가 전투의 순간을 포착합니다.</p></div></div>${controlsHTML()}<button class="primary-btn full" data-action="close-modal">준비되었습니다 ${icon("check")}</button>`,
    "guide",
    true,
  );
}
function controlsHTML() {
  return `<div class="controls-grid">${[
    ["W A S D / 방향키", "지휘관 이동"],
    ["마우스 왼쪽", "일반 공격"],
    ["Q / E / R", "무기 기술 / 전열 회복"],
    ["T", "무쌍 기술"],
    ["스페이스", "회피 돌진"],
    ["마우스 휠", "카메라 확대·축소"],
    ["우클릭 드래그", "카메라 회전"],
    ["M / Esc", "전술 지도 / 일시정지"],
  ]
    .map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`)
    .join("")}</div>`;
}
function showCommander() {
  commanderDraft = {
    portrait: save.portrait,
    banner: save.banner,
    crest: save.crest,
    equipment: { ...save.equipment },
  };
  modal(
    "당신의 이름을, 당신의 군기를.",
    "지휘관과 군단을 꾸미세요. 외형은 능력치에 영향을 주지 않습니다.",
    `<div class="commander-editor"><div class="commander-preview"><div id="portrait-preview">${portrait(save.portrait, 150)}</div><div class="banner-preview" style="--banner:${save.banner}">${icon(save.crest)}</div><h3>${esc(save.name)}</h3><p>${esc(save.company)}</p></div><form id="commander-form"><label class="form-label">지휘관 이름<input name="name" maxlength="16" required value="${esc(save.name)}"/></label><label class="form-label">군단 이름<input name="company" maxlength="20" required value="${esc(save.company)}"/></label><span class="form-label">군기의 색상</span><div class="swatches">${["#359e8b", "#3d6f9b", "#af514b", "#a6823e", "#7f6898", "#3d4c47"].map((c) => `<button type="button" style="--swatch:${c}" class="swatch ${save.banner === c ? "selected" : ""}" data-color="${c}" aria-label="군기 색상 ${c}">${save.banner === c ? icon("check") : ""}</button>`).join("")}</div><span class="form-label">군단 문장</span><div class="crest-choices">${CRESTS.map((c) => `<button type="button" class="${c.id === save.crest ? "selected" : ""}" data-crest="${c.id}" aria-label="${c.name} 문장">${icon(c.id)}<small>${c.name}</small></button>`).join("")}</div><div class="equipment-mix">${[
      ["armor", "갑옷"],
      ["helmet", "투구"],
      ["cape", "망토"],
    ]
      .map(
        ([key, label]) =>
          `<label>${label}<select data-equipment="${key}" aria-label="${label} 외형">${THEMES.map((th) => `<option value="${th.id}" ${save.equipment[key] === th.id ? "selected" : ""}>${th.name}</option>`).join("")}</select></label>`,
      )
      .join(
        "",
      )}</div><div class="form-label portrait-label">지휘관 초상<span>40개의 새로운 얼굴</span></div><div class="portrait-grid">${PORTRAITS.map((_, i) => `<button type="button" class="portrait-choice ${i === save.portrait ? "selected" : ""}" data-portrait="${i}" aria-label="지휘관 초상 ${i + 1}" aria-pressed="${i === save.portrait}">${portrait(i, 48)}</button>`).join("")}</div><button class="primary-btn full" type="submit">변경 사항 저장 ${icon("check")}</button></form></div>`,
    "commander",
    true,
  );
}
function showArmory() {
  modal(
    "전장을 바꾸는 여덟 가지 무기",
    "무기를 선택하면 지휘관의 공격 거리와 전투 방식이 달라집니다.",
    `<div class="weapon-grid">${WEAPONS.map((w) => `<button class="weapon-card ${save.weapon === w.id ? "selected" : ""}" data-weapon="${w.id}"><span class="weapon-symbol">${icon(w.icon)}</span><strong>${w.name}</strong><small>${w.desc}</small><span class="weapon-status">${save.weapon === w.id ? "장착 중" : "장착하기"}</span></button>`).join("")}</div><div class="info-note">Q 돌파 기술 · E 광역 기술 · R 전열 회복 · T 무쌍 기술. 회피는 스페이스를 사용하세요.</div>`,
    "armory",
    true,
  );
}
function showCodex(active = "spear") {
  const t = troopList.find((t) => (t.id || t.type) === active) || troopList[0];
  modal(
    "병종 도감",
    "강점을 살리고 약점을 보완하는 것이 좋은 지휘의 시작입니다.",
    `<div class="codex-tabs">${Object.keys(troopName)
      .map(
        (k) =>
          `<button class="${k === active ? "active" : ""}" data-codex="${k}">${icon(troopIcon[k])}${troopName[k]}</button>`,
      )
      .join(
        "",
      )}</div><div class="codex-content"><div class="codex-symbol">${icon(troopIcon[active])}<span>병종 연구 · ${troopName[active]}</span></div><div><h3>${troopName[active]}</h3><p>${{ spear: "긴 창으로 진형을 유지합니다. 정지 방어 명령으로 기병 돌격을 저지하고 아군 궁병의 전면을 보호하세요.", shield: "방패로 공격을 버티는 전선의 중심입니다. 궁병과 함께 움직이고 방어 명령으로 거점을 지키세요.", archer: "안전한 거리에서 적을 공격합니다. 근접전에는 취약하므로 장창병과 방패병 뒤에 배치하세요.", cavalry: "빠른 이동으로 고립된 궁병과 측면을 공격합니다. 정면의 장창 진형은 피하고 돌격 기회를 만드세요.", sword: "균형 잡힌 근접 보병입니다. 지휘관을 따르며 거점에서 싸우고 고립된 부대를 지원합니다.", axe: "강한 근접 타격으로 밀집한 적을 돌파합니다. 공격 기회가 생기면 돌격 명령을 내려 전선을 무너뜨리세요." }[active]}</p><div class="stat-rows">${[
      ["생명력", t?.hp || 100, 200],
      ["공격력", t?.damage || 15, 40],
      ["기동력", t?.speed || 4, 10],
      ["사거리", t?.range || 2, 18],
    ]
      .map(
        ([label, val, max]) =>
          `<div><span>${label}</span><div class="stat-track"><i style="width:${Math.min(100, (val / max) * 100)}%"></i></div><strong>${val}</strong></div>`,
      )
      .join(
        "",
      )}</div></div></div><div class="codex-notes"><section><h3>${icon("map")}지형을 읽으세요</h3><p>능선은 전선의 중심이 되고, 좁은 다리는 수적 열세를 보완합니다. 기병은 열린 땅에서, 궁병은 보호받는 후방에서 제 역할을 합니다.</p></section><section><h3>${icon("flag")}부대를 지휘하세요</h3><p>추종은 지휘관과 이동, 방어는 현재 위치 유지, 돌격은 적에게 진격, 후퇴는 아군 진영으로 복귀합니다. 부대를 선택하면 해당 병종에만 명령합니다.</p></section></div>`,
    "codex",
    true,
  );
}
function showRecords() {
  const wins = Object.keys(save.victories).length,
    medals = Object.values(save.achievements).reduce(
      (n, a) => n + a.filter(Boolean).length,
      0,
    );
  modal(
    "당신의 전투가 역사가 됩니다.",
    "전투마다 다섯 가지 업적을 달성하고 당신만의 원정을 기록하세요.",
    `<div class="record-summary"><div><strong>${wins}<small> / 20</small></strong><span>승리한 전장</span></div><div><strong>${medals}<small> / 100</small></strong><span>획득한 훈장</span></div><div><strong>${save.totalKills.toLocaleString()}</strong><span>누적 격파</span></div></div><div class="record-list">${BATTLES.map(
      (b) => {
        const a = save.achievements[b.id] || [];
        return `<div class="record-row"><span>${String(b.id).padStart(2, "0")}</span><div><strong>${b.name}</strong><small>${b.mode === "heroic" ? "영웅 무쌍전" : "역사 전술전"} · ${b.year}</small></div><div class="medals">${["첫 승리", "신속한 승리", "지휘관 생존", "정예 격파", "전선 보존"].map((n, i) => `<span class="medal ${a[i] ? "earned" : ""}" title="${n}${a[i] ? " · 달성" : " · 미달성"}">${icon("medal")}</span>`).join("")}</div><span class="record-status">${save.victories[b.id] ? "승리" : "미완료"}</span></div>`;
      },
    ).join(
      "",
    )}</div><div class="info-note">훈장 조건: 승리 / 제한 시간의 70% 이내 승리 / 생명력 50% 이상으로 승리 / 15명 이상 격파 / 아군 50% 이상 생존. 기록은 이 브라우저에 저장됩니다.</div>`,
    "records",
    true,
  );
}
function showSettings() {
  modal(
    "당신에게 맞는 전장",
    "화면과 연출, 소리를 편안하게 조정하세요.",
    `<div class="settings-list"><label><span><strong>상황별 카메라 연출</strong><small>출전, 기술, 거점 점령, 승패에 따라 시점이 변합니다.</small></span><input type="checkbox" data-setting="cinematic" ${save.settings.cinematic ? "checked" : ""}/><span class="toggle"></span></label><label><span><strong>전장의 소리</strong><small>공격과 지휘에 합성 효과음을 사용합니다.</small></span><input type="checkbox" data-setting="sound" ${save.settings.sound ? "checked" : ""}/><span class="toggle"></span></label><label><span><strong>그래픽 품질</strong><small>낮음은 저사양 기기에서 권장합니다.</small></span><select data-setting="quality"><option value="high" ${save.settings.quality === "high" ? "selected" : ""}>높음</option><option value="low" ${save.settings.quality === "low" ? "selected" : ""}>낮음</option></select></label><label><span><strong>전투 난이도</strong><small>새로 시작하는 전투부터 적용됩니다.</small></span><select data-setting="difficulty"><option value="easy" ${save.settings.difficulty === "easy" ? "selected" : ""}>쉬움</option><option value="normal" ${save.settings.difficulty === "normal" ? "selected" : ""}>보통</option><option value="hard" ${save.settings.difficulty === "hard" ? "selected" : ""}>어려움</option></select></label></div><button class="secondary-btn full" data-action="guide">${icon("book")}조작 방법 보기</button>`,
    "settings",
  );
}
function hudShell() {
  return `<div class="battle-top"><button class="battle-back" data-action="pause">${icon("pause")}일시정지 <kbd>Esc</kbd></button><div class="battle-heading"><span>${selected.mode === "heroic" ? "영웅 무쌍전" : "역사 전술전"} · ${selected.year}</span><h1>${selected.name}</h1><p>${selected.objective}</p></div><button class="battle-map-btn" data-action="map">${icon("map")}전술 지도 <kbd>M</kbd></button></div><div class="battle-score"><div><span>아군 병력</span><strong id="hud-allies">0</strong><i class="teal"></i></div><span class="battle-timer" id="hud-time">00:00</span><div><span>적군 병력</span><strong id="hud-enemies">0</strong><i class="red"></i></div></div><div class="camp-status" id="camp-status"></div><div class="objective-tracker"><span id="objective-status-text"></span><div><i id="objective-progress"></i></div></div><div class="enemy-commander-panel" id="enemy-commander-panel" hidden></div><div class="battle-notification" id="battle-notification"></div><div class="hero-marker" id="hero-marker">${esc(save.name)}<span>지휘관</span></div><div class="lieutenant-status" id="lieutenant-status"></div><div class="hero-panel">${portrait(save.portrait, 64)}<div><div class="hero-name"><strong>${esc(save.name)}</strong><span id="hud-hp-text"></span></div><div class="hp-track"><i id="hud-hp"></i></div><div class="rage-label"><span>무쌍</span><small id="hud-rage-text">0%</small></div><div class="rage-track"><i id="hud-rage"></i></div></div><div class="kill-counter"><strong id="hud-kills">0</strong><span>격파</span></div></div><div class="skillbar">${[
    ["attack", "일반 공격", "sword", "클릭"],
    ["q", "질풍 찌르기", "spear", "Q"],
    ["e", "회전 베기", "swords", "E"],
    ["r", "장수의 함성", "shield", "R"],
    ["t", "천하무쌍", "spark", "T"],
    ["space", "회피 돌진", "arrow", "스페이스"],
  ]
    .map(
      ([key, name, ic, k]) =>
        `<button class="skill-button ${key === "t" ? "ultimate" : ""}" data-skill="${key}" title="${name}"><kbd>${k}</kbd>${icon(ic)}<span>${name}</span><strong class="cooldown" id="cd-${key}"></strong></button>`,
    )
    .join(
      "",
    )}</div><div class="battle-bottom"><div class="unit-selector"><span>명령 대상</span><select id="command-unit" aria-label="명령 대상 부대"><option value="all">전체 부대</option><option value="left">좌익 · 부장 일</option><option value="right">우익 · 부장 이</option>${Object.keys(
    troopName,
  )
    .map((k) => `<option value="${k}">${troopName[k]}</option>`)
    .join("")}</select></div><div class="command-buttons">${[
    ["follow", "추종", "flag"],
    ["hold", "방어", "shield"],
    ["charge", "돌격", "swords"],
    ["retreat", "후퇴", "back"],
  ]
    .map(
      ([id, n, i]) =>
        `<button data-order="${id}" class="${id === "charge" ? "active" : ""}">${icon(i)}${n}</button>`,
    )
    .join(
      "",
    )}</div><button class="speed-button" data-action="speed">${icon("clock")}전투 <span id="speed-label">1×</span></button></div><div class="minimap-panel"><div><span>전장 현황</span><button class="icon-btn" data-action="map" aria-label="전술 지도 확대">${icon("focus")}</button></div><canvas id="minimap" width="280" height="190" aria-label="아군, 적군, 거점을 표시한 전장 지도"></canvas><div class="minimap-legend"><span><i class="teal"></i>아군</span><span><i class="red"></i>적군</span><span><i class="gold"></i>지휘관</span></div></div><div class="touch-movement"><button data-move="w" aria-label="앞으로 이동">↑</button><div><button data-move="a" aria-label="왼쪽 이동">←</button><button data-move="s" aria-label="뒤로 이동">↓</button><button data-move="d" aria-label="오른쪽 이동">→</button></div></div><div class="battle-key-hint">W A S D 이동 <span>·</span> 마우스 공격 <span>·</span> 휠 확대·축소</div>`;
}
function launch() {
  if (!engine) return;
  closeModal();
  battleSession++;
  running = true;
  mapOpen = false;
  selectedUnit = "all";
  speed = 1;
  $("#app").classList.remove("map-mode");
  $("#app").classList.add("battle-mode");
  $("#battle-hud").hidden = false;
  $("#battle-hud").innerHTML = hudShell();
  engine.resize();
  engine.start(selected, {
    weapon: save.weapon,
    banner: save.banner,
    difficulty: save.settings.difficulty,
    crest: save.crest,
    appearance: Object.fromEntries(
      ["armor", "helmet", "cape"].map((k) => [
        k,
        THEMES.find((t) => t.id === save.equipment[k])?.[k],
      ]),
    ),
  });
  showToast("군기를 세웠습니다. 부대를 지휘하고 목표를 달성하세요.");
}
function returnLobby() {
  battleSession++;
  running = false;
  mapOpen = false;
  closeModal();
  engine?.setPaused(false);
  $("#app").classList.remove("battle-mode", "map-mode");
  $("#battle-hud").hidden = true;
  $("#battle-hud").innerHTML = "";
  engine?.preview(selected);
  engine?.setMapMode(false);
  engine?.resize();
  $("#camera-caption").textContent = "";
  $("#toast-root").innerHTML = "";
  renderBattle();
  renderList();
}
function showPause() {
  modal(
    "잠시, 전열을 가다듬으세요.",
    `${selected.name} · 전투가 일시정지되었습니다.`,
    `<div class="pause-actions"><button class="primary-btn" data-action="close-modal">${icon("play")}전투 계속하기</button><button class="secondary-btn" data-action="restart">${icon("flag")}전투 다시 시작</button><button class="secondary-btn" data-action="settings">${icon("settings")}환경 설정</button><button class="secondary-btn" data-action="return">${icon("back")}사령부로 돌아가기</button></div>${controlsHTML()}`,
    "pause",
    true,
  );
}
function handleEvent(e) {
  if (!e) return;
  const type = e.type;
  if (type === "victory" || type === "defeat") {
    const state = engine.getState();
    lastState = state;
    const session = battleSession;
    setTimeout(() => {
      if (session === battleSession) showResult(type === "victory", state);
    }, 1000);
  } else if (
    type === "skill" ||
    type === "capture" ||
    type === "warning" ||
    type === "command"
  ) {
    if ($("#battle-notification")) {
      $("#battle-notification").textContent =
        e.text ||
        {
          skill: "전장의 흐름을 바꾸세요",
          capture: "거점 점령",
          warning: "지휘관을 보호하세요",
          command: "명령 전달",
        }[type];
      $("#battle-notification").classList.add("show");
      setTimeout(
        () => $("#battle-notification")?.classList.remove("show"),
        2600,
      );
    }
  }
}
function showResult(won, state) {
  if (!running) return;
  save.totalKills += state.kills || 0;
  const earned = evaluateAchievements(selected, state, won);
  if (won) {
    save.victories[selected.id] = {
      time: Math.round(state.time),
      kills: state.kills,
    };
  }
  save.achievements[selected.id] = earned.map(
    (v, i) => v || save.achievements[selected.id]?.[i] || false,
  );
  save.lastBattle = selected.id;
  persist();
  const next = BATTLES.find((b) => b.id === selected.id + 1);
  modal(
    won
      ? "당신의 군기가 전장에 올랐습니다."
      : "군기는 다시 일어설 수 있습니다.",
    won ? `${selected.name} · 승리` : `${selected.name} · 패배`,
    `<div class="result-crest ${won ? "won" : ""}">${icon(won ? "medal" : "shield")}</div><div class="result-stats"><div><strong>${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, "0")}</strong><span>전투 시간</span></div><div><strong>${state.kills || 0}</strong><span>지휘관 격파</span></div><div><strong>${state.allies || 0}</strong><span>생존 아군</span></div></div><div class="result-medals">${["승리의 군기", "신속한 결단", "흔들리지 않는 지휘관", "전장의 영웅", "함께 돌아온 이들"].map((n, i) => `<span class="${earned[i] ? "earned" : ""}">${icon("medal")}<small>${n}</small></span>`).join("")}</div><p class="result-description">${won ? "이 전투의 기록과 획득한 훈장이 저장되었습니다." : "병종을 보호하고 회복 기술을 활용해 보세요. 전술을 바꾸면 결과도 달라집니다."}</p><div class="result-buttons"><button class="secondary-btn" data-action="return">사령부로</button><button class="primary-btn" data-action="${won && next ? "next" : "restart"}">${won && next ? "다음 전장으로" : "다시 출전하기"} ${icon("arrow")}</button></div>`,
    "result",
  );
}
function updateHUD(state) {
  lastState = state;
  if (!running || !$("#hud-time")) return;
  const text = (s, v) => {
    const el = $(s);
    if (el) el.textContent = v;
  };
  text("#hud-allies", state.allies);
  text("#hud-enemies", state.enemies);
  text(
    "#hud-time",
    `${String(Math.floor(state.remaining / 60)).padStart(2, "0")}:${String(Math.floor(state.remaining % 60)).padStart(2, "0")}`,
  );
  text("#hud-hp-text", `${Math.ceil(state.hp)} / ${state.maxHp}`);
  $("#hud-hp").style.width = `${Math.max(0, (state.hp / state.maxHp) * 100)}%`;
  $("#hud-rage").style.width = `${state.rage}%`;
  text("#hud-rage-text", `${Math.floor(state.rage)}%`);
  text("#hud-kills", state.kills);
  $("#camp-status").innerHTML = (state.camps || [])
    .map(
      (c) =>
        `<span class="camp-pill ${c.owner === "ally" ? "owned" : c.owner === "enemy" ? "enemy" : ""}" title="점령 진행 ${Math.floor(c.progress || 0)}%">${icon("flag")}${esc(c.name)}<i style="width:${Math.max(0, c.progress || 0)}%"></i></span>`,
    )
    .join("");
  for (const key of ["q", "e", "r", "t", "space"]) {
    const cd = state.cooldowns?.[key] || 0;
    const el = $(`#cd-${key}`);
    if (el) {
      el.textContent = cd > 0 ? Math.ceil(cd) : "";
      el.parentElement.classList.toggle(
        "unavailable",
        cd > 0 || (key === "t" && state.rage < 100),
      );
    }
  }
  if (state.objectiveStatus) {
    text("#objective-status-text", state.objectiveStatus.label);
    $("#objective-progress").style.width = `${state.objectiveStatus.progress}%`;
  }
  const ep = $("#enemy-commander-panel");
  if (ep) {
    ep.hidden = !state.enemyCommander;
    if (state.enemyCommander)
      ep.innerHTML = `${icon("swords")}<span>${esc(state.enemyCommander.name)}<small>${state.enemyCommander.alive ? `${Math.ceil(state.enemyCommander.hp)} / ${state.enemyCommander.maxHp}` : "제압 완료"}</small></span>`;
  }
  const cam = state.cameraEvent || "";
  text("#camera-caption", typeof cam === "string" ? cam : "");
  if (state.heroScreen) {
    const m = $("#hero-marker");
    m.hidden = state.heroScreen.visible === false;
    m.style.left = `${state.heroScreen.x * 100}%`;
    m.style.top = `${state.heroScreen.y * 100}%`;
  }
  if (state.lieutenants)
    $("#lieutenant-status").innerHTML = state.lieutenants
      .map(
        (l) =>
          `<button data-front="${l.id}" class="lieutenant-chip ${selectedUnit === l.id ? "selected" : ""}">${icon("flag")}<span>${esc(l.name)}<small>${l.count}명 · 사기 ${Math.round(l.hp || 0)}%</small></span></button>`,
      )
      .join("");
  drawMap(state);
}
function drawMap(s) {
  const canvas = $("#minimap");
  if (!canvas) return;
  const ctx = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  ctx.fillStyle = "#d8dfcf";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#b8c7b3";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 27) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.fillStyle = "#b5c6aa";
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.ellipse(
      (i * 71 + 12) % w,
      (i * 37 + 22) % h,
      20,
      10,
      0.5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const bounds = s.bounds || { minX: -55, maxX: 55, minZ: -40, maxZ: 40 };
  const pos = (p) => [
    ((p.x - bounds.minX) / (bounds.maxX - bounds.minX)) * w,
    ((p.z - bounds.minZ) / (bounds.maxZ - bounds.minZ)) * h,
  ];
  for (const a of s.soldiers || s.markers || []) {
    if (a.alive === false) continue;
    const [x, y] = pos(a);
    ctx.fillStyle = a.team === "ally" || a.team === 1 ? "#278c7e" : "#c25d4c";
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  for (const escort of s.escorts || []) {
    if (!escort.alive) continue;
    const [x, y] = pos(escort);
    ctx.fillStyle = "#fff6c9";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b29249";
    ctx.stroke();
  }
  for (const c of s.camps || []) {
    const [x, y] = pos(c);
    ctx.fillStyle = c.owner === "ally" ? "#298f7d" : "#bc8350";
    ctx.fillRect(x - 5, y - 5, 10, 10);
    ctx.strokeStyle = "#f6f2df";
    ctx.strokeRect(x - 5, y - 5, 10, 10);
  }
  if (s.hero) {
    const [x, y] = pos(s.hero);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#e5ba54";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.stroke();
  }
}
function toggleMap() {
  mapOpen = !mapOpen;
  engine?.setMapMode(mapOpen);
  $("#app").classList.toggle("map-mode", mapOpen);
  if (mapOpen) showToast("전술 시점 · 부대를 선택하고 명령을 내려 보세요.");
}
document.addEventListener("click", (event) => {
  const t = event.target.closest("button,a");
  if (!t) return;
  if (t.dataset.battle) chooseBattle(Number(t.dataset.battle));
  if (t.dataset.mode) {
    mode = t.dataset.mode;
    document
      .querySelectorAll("[data-mode]")
      .forEach((b) => b.classList.toggle("active", b === t));
    $("#mode-description").textContent =
      mode === "heroic"
        ? "소수 정예와 함께 전선을 돌파하세요."
        : "지형을 읽고, 군대를 지휘하세요.";
    chooseBattle(BATTLES.find((b) => b.mode === mode).id);
  }
  if (t.dataset.view) {
    event.preventDefault();
    ({
      battles: () => {
        if (running) returnLobby();
        else closeModal();
      },
      commander: showCommander,
      codex: showCodex,
      records: showRecords,
    })[t.dataset.view]?.();
  }
  if (t.dataset.troop) showCodex(t.dataset.troop);
  if (t.dataset.codex) showCodex(t.dataset.codex);
  if (t.dataset.skill) engine?.skill(t.dataset.skill);
  if (t.dataset.front) {
    selectedUnit = t.dataset.front;
    $("#command-unit").value = selectedUnit;
    engine?.selectUnit(selectedUnit);
    showToast(
      `${selectedUnit === "left" ? "좌익" : "우익"} 부대의 지휘권을 인수했습니다.`,
    );
  }
  if (t.dataset.order) {
    engine?.command(t.dataset.order, selectedUnit);
    document
      .querySelectorAll("[data-order]")
      .forEach((b) => b.classList.toggle("active", b === t));
  }
  if (t.dataset.portrait) {
    commanderDraft.portrait = Number(t.dataset.portrait);
    $("#portrait-preview").innerHTML = portrait(commanderDraft.portrait, 150);
    document.querySelectorAll("[data-portrait]").forEach((b) => {
      b.classList.toggle("selected", b === t);
      b.setAttribute("aria-pressed", String(b === t));
    });
  }
  if (t.dataset.color) {
    commanderDraft.banner = t.dataset.color;
    $(".banner-preview").style.setProperty("--banner", commanderDraft.banner);
    document.querySelectorAll("[data-color]").forEach((b) => {
      b.classList.toggle("selected", b === t);
      b.innerHTML = b === t ? icon("check") : "";
    });
  }
  if (t.dataset.crest && commanderDraft) {
    commanderDraft.crest = t.dataset.crest;
    $(".banner-preview").innerHTML = icon(t.dataset.crest);
    document
      .querySelectorAll("[data-crest]")
      .forEach((b) => b.classList.toggle("selected", b === t));
  }
  if (t.dataset.weapon) {
    save.weapon = t.dataset.weapon;
    persist();
    renderBattle();
    showArmory();
    showToast("선택한 무기를 장착했습니다.", "success");
  }
  if (t.dataset.action) {
    const actions = {
      settings: showSettings,
      guide: showGuide,
      history: showHistory,
      armory: showArmory,
      "close-modal": closeModal,
      launch,
      "zoom-in": () =>
        engine?.setZoom(Math.min(1.65, (engine.getState().zoom || 1) + 0.15)),
      "zoom-out": () =>
        engine?.setZoom(Math.max(0.65, (engine.getState().zoom || 1) - 0.15)),
      focus: () => engine?.focusHero(),
      cinematic: () => {
        save.settings.cinematic = !save.settings.cinematic;
        applySettings();
      },
      pause: showPause,
      map: toggleMap,
      return: returnLobby,
      restart: launch,
      next: () => {
        selected = BATTLES.find((b) => b.id === selected.id + 1) || BATTLES[0];
        mode = selected.mode;
        launch();
      },
      speed: () => {
        speed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
        engine?.setSpeed(speed);
        $("#speed-label").textContent = `${speed}×`;
      },
      "dismiss-mobile": () => $("#mobile-warning").remove(),
    };
    actions[t.dataset.action]?.();
  }
});
document.addEventListener("change", (e) => {
  if (e.target.dataset.equipment && commanderDraft)
    commanderDraft.equipment[e.target.dataset.equipment] = e.target.value;
  if (e.target.id === "auto-camera") {
    save.settings.cinematic = e.target.checked;
    applySettings();
  }
  if (e.target.id === "command-unit") {
    selectedUnit = e.target.value;
    engine?.selectUnit(selectedUnit);
  }
  if (e.target.dataset.setting) {
    save.settings[e.target.dataset.setting] =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    applySettings();
  }
});
function applySettings() {
  engine?.setCinematic(save.settings.cinematic);
  engine?.setQuality(save.settings.quality);
  engine?.setSound(save.settings.sound);
  $("#auto-camera").checked = save.settings.cinematic;
  document
    .querySelector('[data-action="cinematic"]')
    .classList.toggle("active", save.settings.cinematic);
  persist();
}
document.addEventListener("submit", (e) => {
  if (e.target.id !== "commander-form") return;
  e.preventDefault();
  const f = new FormData(e.target);
  if (commanderDraft) {
    save.portrait = commanderDraft.portrait;
    save.banner = commanderDraft.banner;
    save.crest = commanderDraft.crest;
    save.equipment = commanderDraft.equipment;
  }
  save.name = String(f.get("name")).trim() || "새벽";
  save.company = String(f.get("company")).trim() || "은빛 군단";
  persist();
  $(".profile-btn").innerHTML =
    `${portrait(save.portrait, 36)}<span>${esc(save.name)}<small>군단장</small></span>`;
  $("#company-name").textContent = save.company;
  $("#commander-name").innerHTML = `${esc(save.name)}<small> · 군단장</small>`;
  $(".commander-card .portrait").outerHTML = portrait(save.portrait, 46);
  closeModal();
  showToast("지휘관과 군기를 저장했습니다.", "success");
});
document.addEventListener("keydown", (e) => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
  if (e.key === "Escape") {
    e.preventDefault();
    if (modalType === "result") return;
    if (modalType) closeModal();
    else if (running) showPause();
  }
  if (e.code === "KeyM" && running && !modalType) {
    e.preventDefault();
    toggleMap();
  }
  if (modalType && e.key === "Tab") {
    const nodes = [
        ...$("#modal-root").querySelectorAll("button,input,select,a"),
      ].filter((x) => !x.disabled),
      first = nodes[0],
      last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  }
});
document.addEventListener("pointerdown", (e) => {
  const t = e.target.closest("[data-move]");
  if (t) {
    e.preventDefault();
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: t.dataset.move,
        bubbles: true,
        code: `Key${t.dataset.move.toUpperCase()}`,
      }),
    );
    t.setPointerCapture(e.pointerId);
  }
});
document.addEventListener("pointerup", (e) => {
  const t = e.target.closest("[data-move]");
  if (t)
    document.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: t.dataset.move,
        bubbles: true,
        code: `Key${t.dataset.move.toUpperCase()}`,
      }),
    );
});
window.addEventListener("blur", () => {
  if (running && !modalType) showPause();
});
window.__BANNER_DEBUG__ = {
  getState: () => engine?.getState(),
  getSelection: () => selected.id,
  getSave: () => structuredClone(save),
  getBattle: () => selected,
  version: "1.0.0",
};
