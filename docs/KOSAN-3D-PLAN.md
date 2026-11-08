# Kosan 3D Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build `web/kosan-3d.html` — a walkable 3D Kosan world (Three.js)
per `KOSAN-3D-SPEC.md`, plus vendored Three.js, verified and ready for a
preview deploy (no production link yet).

**Architecture:** Single-file vanilla JS + Three.js 0.160.0 (importmap to
self-hosted vendor files), procedural geometry, localStorage only for the
visitor name. No framework, no build step, no backend.

**Tech Stack:** Three.js 0.160.0 (three.module.js + OrbitControls.js),
vanilla JS (ES modules), HTML/CSS. Target: mobile browsers (HP) first.

**Spec:** `~/workspace/kosan-ibu-kos/KOSAN-3D-SPEC.md`

## Global Constraints

- Site is 100% static: no Firebase, no network writes, no analytics, no login.
- `roomFor` / `makeId` / `normalize` / `previewFor` copied EXACTLY from
  `web/app.js` (FNV-1a, `0x811c9dc5`, `Math.imul(h, 0x01000193) >>> 0`).
- RESIDENTS is currently `{}` — every room shows "Masih kosong".
- Only Episode-built facilities appear: building, 10 rooms, yard, living
  room + WiFi router. Nothing else.
- Visual style: bright daylight, BRIGHT BLUE 2-floor building, "KOSAN DIBUKA"
  sign, round chibi characters (big round head, short chubby body — NOT boxy).
- New file only: `web/kosan-3d.html`. Do NOT modify `index.html` or `app.js`.
- "Misi" and "KTA" buttons exist but are INERT with a "segera hadir" label.
- Must run on a phone: cap `renderer.setPixelRatio` at 2, reuse materials.

## Review Focus

- Name "Budi Santoso" must yield Room 3 + ID `KOSAN-03-BUDI` (matches live web).
- A room whose hash is taken must fall through to the next empty room (rule c).
- Tapping a room door must open THAT room's card, not a neighbor's.
- The D-pad must actually move the avatar (not just the camera); the camera
  must follow the avatar.
- On a 390px-wide phone the D-pad/HUD must not cover the whole view.

---

### Task 1: Vendor Three.js 0.160.0

**Files:**
- Create: `web/vendor/three/three.module.js`
- Create: `web/vendor/three/OrbitControls.js`

**Interfaces:**
- Produces: importmap targets used by Task 2 (`./vendor/three/three.module.js`,
  `./vendor/three/OrbitControls.js`).

- [ ] **Step 1: Download the two files**
  - `https://unpkg.com/three@0.160.0/build/three.module.js` → `web/vendor/three/three.module.js`
  - `https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js` → `web/vendor/three/OrbitControls.js`
  - Use curl with `--fail`; if unpkg fails, try `https://cdn.jsdelivr.net/npm/three@0.160.0/...` (same paths).
- [ ] **Step 2: Verify contents**
  - Run: `grep -c WebGLRenderer web/vendor/three/three.module.js` — Expected: > 0.
  - Run: `grep -c "class OrbitControls" web/vendor/three/OrbitControls.js` — Expected: 1.
  - Run: `ls -l web/vendor/three/` — both files non-empty (>100 KB for three.module.js).
- [ ] **Step 3: Confirm OrbitControls imports `three` by bare specifier**
  - Run: `grep -n "from 'three'" web/vendor/three/OrbitControls.js` — Expected: 1 match (the importmap in Task 2 resolves it).

### Task 2: Page shell + importmap + HUD

**Files:**
- Create: `web/kosan-3d.html`

**Interfaces:**
- Consumes: Task 1 vendor files.
- Produces: HTML shell with importmap, `<canvas>` mount, HUD (title, name
  input, room card area, D-pad, zoom buttons, back link, inert Misi/KTA buttons).

- [ ] **Step 1: Write the shell**
  - `<!doctype html>`, viewport `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`, title "Kosan Ibu Kos — Jalan-jalan".
  - Importmap exactly: `"three": "./vendor/three/three.module.js"`,
    `"three/addons/controls/OrbitControls.js": "./vendor/three/OrbitControls.js"`.
  - HUD elements with these ids: `#hud-title`, `#nameInput`, `#nameBtn`,
    `#roomCard`, `#dpad` (buttons `#dUp #dDown #dLeft #dRight`), `#zoomIn #zoomOut`,
    `#backLink` (href `index.html`), `#misiBtn`, `#ktaBtn` (inert, label includes "segera hadir").
  - CSS: full-screen canvas; HUD absolute; D-pad bottom-left, large touch
    targets (min 48px); room card bottom sheet style; bright palette matching
    the site (blue #2E7FD6, yellow #FFD11A).
- [ ] **Step 2: Verify the shell loads without JS errors**
  - Run: `node --check` is not applicable to HTML; instead extract the module
    script (Task 3+) — for now, open the file's first 5 lines and confirm the
    importmap block is valid JSON via `python3 -c "json.loads(...)"` on the
    importmap content.

### Task 3: World — building, yard, living room, rooms

**Files:**
- Modify: `web/kosan-3d.html` (append module script section: world builder).

**Interfaces:**
- Consumes: Task 2 shell + canvas mount.
- Produces: `buildWorld(scene)` — building, yard, fence, path, living-room
  area with router, 10 numbered doors; `ROOM_DOORS` map (room number →
  door mesh + world position); `LIVING_ROOM` position.

- [ ] **Step 1: Implement `buildWorld`**
  - Daylight: `DirectionalLight` (warm sun, casts soft shadow) + ambient
    hemisphere light; sky blue background + fog far.
  - Building: bright blue 2-floor box massing with white trim, flat roof +
    parapet, big sign plane "KOSAN DIBUKA" (CanvasTexture, white text on
    dark blue), windows (emissive-lite planes), front door.
  - Yard: green ground plane, stone path from gate to front door, fence
    around the lot, 2-3 simple trees (cylinder + sphere canopy), a bench.
  - Living room: marked area beside the front door (rug plane + low table
    mesh + white router box with 2 antenna cylinders + small green LED
    sphere) — the router is the visual anchor for the WiFi card.
  - 10 doors: floor 1 rooms 1–5 along the ground floor front, floor 2 rooms
    6–10 on a balcony/walkway; each door a box + number plane (CanvasTexture
    "1".."10"). Record each door mesh in `ROOM_DOORS[n] = { mesh, pos }`.
  - Ibu Kos avatar: one static chibi figure near the front door (round head
    with hair bun + grey streak, blue batik dress cone, orange apron plane).
    Clickable → profile card (Task 5).
- [ ] **Step 2: Verify geometry counts**
  - Run a node smoke script that imports the module's pure helpers only
    (no WebGL): assert `ROOM_DOORS` has keys 1..10. (If the module cannot run
    in node, verify by grepping that all 10 door definitions exist.)

### Task 4: Visitor avatar + walk controls + camera

**Files:**
- Modify: `web/kosan-3d.html` (module script: avatar + controls).

**Interfaces:**
- Consumes: Task 3 world (ground plane for walking bounds).
- Produces: `spawnAvatar(name)`, D-pad + drag + zoom handlers, third-person
  follow camera, `moveAvatar(dx, dz)` with simple bounds (stay inside the
  fenced yard; no walking through the building).

- [ ] **Step 1: Implement the avatar**
  - Chibi: sphere head (skin tone), small sphere body (red shirt), grey
    capsule legs, blue cap — matches the reference test avatar (blue hat,
    red shirt, grey pants). Name label: CanvasTexture sprite above the head,
    updated by `spawnAvatar(name)` (default "kamu").
  - Spawn at the gate, facing the building.
- [ ] **Step 2: Implement controls**
  - D-pad: hold ▲ = walk forward (avatar turns to face movement dir),
    ◀/▶ = turn left/right, ▼ = walk backward; movement speed ~3 m/s.
  - Drag on canvas = orbit camera around avatar (OrbitControls with
    `target` following the avatar each frame; disable pan).
  - Zoom buttons adjust camera distance (clamp 6..20 m). Desktop: WASD/arrows
    move, wheel zooms.
  - Keep the avatar inside the yard rectangle; stop at the fence and at the
    building walls (simple AABB clamp).
- [ ] **Step 3: Verify movement logic without a browser**
  - Extract the movement math into a pure function if possible and unit-test
    it in node: avatar at (0,0) facing +Z, hold ▲ 1s → z increases, x ~0.
    (If extraction is impractical, leave verification to the parent's
    browser playtest and note it in the handoff.)

### Task 5: Name → room, click cards

**Files:**
- Modify: `web/kosan-3d.html` (module script: room logic + raycasting + cards).

**Interfaces:**
- Consumes: Task 3 (`ROOM_DOORS`, `LIVING_ROOM`), Task 4 (`spawnAvatar`),
  `web/app.js` room functions (copied verbatim).
- Produces: `previewFor` (verbatim port), card rendering for rooms / living
  room / Ibu Kos, "Lihat kamarku" camera fly-to.

- [ ] **Step 1: Port the room functions verbatim**
  - Copy `normalize`, `roomFor`, `makeId`, `previewFor` from `web/app.js`
    lines 64–103 EXACTLY (same constants, same order). RESIDENTS = {}.
- [ ] **Step 2: Implement name entry**
  - On `#nameBtn` (and Enter): read `#nameInput`, run `previewFor`; call
    `spawnAvatar(name)`; show `#roomCard` with: room number, ID from
    `makeId`, stempel "PREVIEW" + text "belum tercatat" (or "Penghuni
    tercatat" only if `resident: true`); save name to localStorage key
    `kosan3d-nama`; on load, restore it.
  - "Lihat kamarku" button in the card flies the camera to `ROOM_DOORS[room].pos`.
- [ ] **Step 3: Implement click/raycast cards**
  - Raycaster on tap/click: door mesh → room card ("Kamar N — Masih kosong"
    or resident name from RESIDENTS); living-room rug/table/router → WiFi
    card with the EXACT perk text from the spec (router sentence); Ibu Kos
    avatar → short profile card ("Ibu Kos — pemilik kosan...").
  - Highlight the selected door briefly (emissive pulse).
- [ ] **Step 4: Verify the port in node**
  - Run: `node -e` with the copied functions: `roomFor("Budi Santoso")`
    Expected: `3`. `makeId("Budi Santoso", 3)` Expected: `KOSAN-03-BUDI`.
    `previewFor("Budi Santoso").room` Expected: `3`.

### Task 6: Polish + self-check

**Files:**
- Modify: `web/kosan-3d.html` (final pass).

- [ ] **Step 1: Performance + mobile pass**
  - `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`; reuse shared
    materials/geometries; shadows only from the sun, small shadow map (1024).
  - Check at 390px width mentally: D-pad bottom-left, card bottom sheet,
    title small — nothing covers the center of the view.
- [ ] **Step 2: Extract + syntax-check the module script**
  - Run: extract `<script type="module">` content to `/tmp/kosan3d.mjs` and
    run `node --check /tmp/kosan3d.mjs` — Expected: no errors.
- [ ] **Step 3: Handoff notes**
  - Write `KOSAN-3D-BUILD-NOTES.md` in `~/workspace/kosan-ibu-kos/` listing:
    files created, how to deploy-preview, known limits, and anything the
    parent still needs to verify in a real browser (movement, clicks, name).
  - Do NOT deploy. Do NOT modify `index.html` or `app.js`. Do NOT link the
    page anywhere. The parent deploys the preview and playtests it.
