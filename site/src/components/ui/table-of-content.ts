/*
 * Table of Content, from 21st.dev (zanwei/table-of-content): a dependency-free custom element
 * with a scrubbable tick rail, spring-driven magnification and a floating preview card.
 * Registered once on first import in the browser; a no-op on the server. The site drives it
 * imperatively (see components/site/contents-rail.tsx) and themes it through the --toc-*
 * custom properties.
 */
export type TableOfContentItem = { id: string; title: string; description?: string };
export type TableOfContentElement = HTMLElement & { items: TableOfContentItem[]; value: number; open: boolean; label: string; select: (index: number, options?: { open?: boolean; emit?: boolean }) => void; close: () => void };

const GEOMETRY = Object.freeze({ baseRemPixels: 16, stageHeight: 35.5, trackTop: 1.875, trackBottom: 33.625, hitTop: 0, hitHeight: 35.5, cardEdgeGap: 1.125, tickInfluenceSigma: 1.12 });
const MOTION = Object.freeze({ tickSpringStiffness: 845, tickSpringDamping: 58.5, tickSpringMaxStep: 1 / 120 });
const MAX_ITEMS = 200;

const finiteNumber = (value: unknown, fallback = 0) => { if (value === null || value === undefined || value === "") return fallback; const n = Number(value); return Number.isFinite(n) ? n : fallback; };
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const normalizeIndex = (value: unknown, count: number, fallback = 0) => { const itemCount = Math.max(1, Math.trunc(finiteNumber(count, 1))); return clamp(Math.round(finiteNumber(value, fallback)), 0, itemCount - 1); };
function normalizeItems(value: unknown): TableOfContentItem[] {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError("table-of-content.items must be a non-empty array.");
  if (value.length > MAX_ITEMS) throw new RangeError(`table-of-content.items supports at most ${MAX_ITEMS} items.`);
  return value.map((item, index) => { const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {}; return { id: String(r.id ?? "").trim() || `content-${index + 1}`, title: String(r.title ?? "").trim() || `Item ${index + 1}`, description: String(r.description ?? "") }; });
}
function tickY(index: number, count: number) { const itemCount = Math.max(1, Math.trunc(finiteNumber(count, 1))); const intervals = Math.max(itemCount - 1, 1); return GEOMETRY.trackTop + (normalizeIndex(index, itemCount) / intervals) * (GEOMETRY.trackBottom - GEOMETRY.trackTop); }
function selectionFromPointer(clientY: number, rectTop: number, rectHeight: number, count: number) {
  const height = finiteNumber(rectHeight, 0); if (height <= 0) return null;
  const localY = GEOMETRY.hitTop + ((finiteNumber(clientY, rectTop) - finiteNumber(rectTop, 0)) / height) * GEOMETRY.hitHeight;
  const center = clamp(localY, GEOMETRY.trackTop, GEOMETRY.trackBottom);
  const normalized = (center - GEOMETRY.trackTop) / (GEOMETRY.trackBottom - GEOMETRY.trackTop);
  const itemCount = Math.max(1, Math.trunc(finiteNumber(count, 1)));
  const floatIndex = normalized * Math.max(itemCount - 1, 1);
  return { center, floatIndex, index: normalizeIndex(floatIndex, itemCount) };
}
const tickInfluence = (index: number, floatIndex: number | null) => { if (floatIndex === null || floatIndex === undefined) return 0; const d = index - floatIndex; const s = GEOMETRY.tickInfluenceSigma; return Math.exp(-(d * d) / (2 * s * s)); };
type Spring = { value: number; velocity: number; target: number };
function stepSpring(state: Spring, target: number, deltaSeconds: number, stiffness: number, damping: number, maxStep: number) {
  const dt = clamp(finiteNumber(deltaSeconds, 0), 0, 1); const steps = Math.max(1, Math.ceil(dt / Math.max(maxStep, 1 / 1000))); const step = dt / steps;
  let value = finiteNumber(state.value, target), velocity = finiteNumber(state.velocity, 0);
  for (let i = 0; i < steps; i++) { const a = (target - value) * stiffness - velocity * damping; velocity += a * step; value += velocity * step; }
  state.value = value; state.velocity = velocity; return state;
}

const TEMPLATE = `
<style>
  :host { --toc-background: transparent; --toc-surface: #0b0f1c; --toc-ink: #f2f6fb; --toc-copy: #8298b4; --toc-line: rgba(130,152,180,0.22); --toc-accent: #00e5ff; --toc-title-size: 0.95rem; --toc-description-size: 0.88rem; --toc-title-lines: 2; --toc-description-lines: 4;
    display: block; position: relative; inline-size: min(100%, 33rem); block-size: 35.5rem; overflow: visible; background: var(--toc-background); color: var(--toc-ink); contain: layout style; container-name: table-of-content; container-type: inline-size; isolation: isolate; font-size: 1rem; font-family: "Newsreader", Georgia, serif; -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; }
  [part="viewport"] { position: absolute; inset: 0; overflow: visible; background: var(--toc-background); }
  [part="stage"] { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; }
  [part="rail"] { position: absolute; inset-inline-start: 0; inset-block-start: 0; inline-size: 4.25rem; block-size: 35.5rem; outline: none; cursor: default; touch-action: none; }
  [part="rail"]::before { content: ""; position: absolute; inset: -0.5rem -0.125rem; }
  [part="rail"]:focus-visible:not([data-pointer-focus])::after { content: ""; position: absolute; inset-inline-start: 0.6875rem; inset-block: 1.25rem; inline-size: 3rem; border: 0.1875rem solid var(--toc-accent); border-radius: 0.75rem; pointer-events: none; }
  [part="ticks"] { position: absolute; inset: 0; pointer-events: none; }
  [part="tick"] { --tick-y: 1.875rem; --tick-scale: 0.25; position: absolute; inset-inline-start: 1.1875rem; inset-block-start: 0; inline-size: 2.25rem; block-size: 0.1875rem; border-radius: 0.125rem; background: var(--toc-ink); opacity: 0.19; transform: translate3d(0, var(--tick-y), 0) scaleX(var(--tick-scale)); transform-origin: left center; will-change: transform, opacity; }
  [part="tick"][data-current] { background: var(--toc-accent); }
  [part="card"] { --card-y: 1.125rem; --card-height: auto; position: absolute; inset-inline-start: 4.3125rem; inset-block-start: 0; inline-size: min(28.1875rem, calc(100% - 4.8125rem)); block-size: var(--card-height); overflow: hidden; border: 0.0625rem solid var(--toc-line); border-radius: 0.75rem; background: var(--toc-surface); box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.3), 0 0.3125rem 0.75rem rgba(0,0,0,0.35), 0 1.0625rem 2.125rem rgba(0,0,0,0.45); opacity: 0; transform: translate3d(0, var(--card-y), 0); transform-origin: left center; pointer-events: none; contain: layout; will-change: transform; }
  :host([data-open]) [part="card"] { opacity: 1; }
  [part="card-content"] { box-sizing: border-box; display: grid; grid-template-rows: auto auto; align-content: start; gap: 0.4rem; inline-size: 100%; block-size: 100%; padding: 0.8rem 0.95rem; overflow: hidden; transform: translateZ(0); transform-origin: left center; color: var(--toc-copy); }
  [part="card-content"][data-measuring] { block-size: auto; }
  [part="title"] { display: -webkit-box; min-inline-size: 0; margin: 0; overflow: hidden; color: var(--toc-ink); font-size: var(--toc-title-size); font-weight: 600; line-height: 1.35; letter-spacing: -0.005em; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: var(--toc-title-lines); }
  [part="description"] { display: -webkit-box; min-block-size: 0; margin: 0; overflow: hidden; font-size: var(--toc-description-size); font-weight: 400; line-height: 1.5; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: var(--toc-description-lines); }
  [hidden] { display: none !important; }
</style>
<div part="viewport"><div part="stage">
  <div part="rail" tabindex="0" role="slider" aria-orientation="vertical" aria-valuemin="1" aria-valuenow="1"><div part="ticks" aria-hidden="true"></div></div>
  <div part="card" aria-hidden="true"><div part="card-content"><div part="title"></div><p part="description"></p></div></div>
</div></div>`;

export function defineTableOfContent(): void {
  if (typeof window === "undefined" || !("customElements" in window) || customElements.get("table-of-content")) return;
  const template = document.createElement("template");
  template.innerHTML = TEMPLATE;

  class TableOfContent extends HTMLElement {
    static get observedAttributes() { return ["label", "value", "open"]; }
    _rail: HTMLElement; _ticksRoot: HTMLElement; _card: HTMLElement; _cardContent: HTMLElement; _title: HTMLElement; _description: HTMLElement;
    _items: TableOfContentItem[] = []; _pendingValue: string | number | null; _tickNodes: HTMLElement[] = []; _tickMotion: Spring[] = [];
    _selected = 0; _floatIndex: number | null = null; _targetCenter = 0; _targetHeight = 0; _cardHeight = 0; _heightVelocity = 0; _targetY = 0; _cardY = 0; _yVelocity = 0;
    _open = false; _pointerInside = false; _dragging = false; _connected = false; _settingValue = false; _raf = 0; _lastFrameTime = 0; _closeTimer = 0; _measureVersion = 0; _lastInlineSize = 0;
    _railRect: DOMRect | null = null; _resizeObserver: ResizeObserver | null = null; _contentResizeObserver: ResizeObserver | null = null; _motionQuery: MediaQueryList; _reducedMotion: boolean; _current = -1;
    constructor() {
      super();
      this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true));
      const q = (s: string) => this.shadowRoot!.querySelector(s) as HTMLElement;
      this._rail = q('[part="rail"]'); this._ticksRoot = q('[part="ticks"]'); this._card = q('[part="card"]'); this._cardContent = q('[part="card-content"]'); this._title = q('[part="title"]'); this._description = q('[part="description"]');
      this._items = [{ id: "content-1", title: "Contents", description: "" }];
      this._pendingValue = this.getAttribute("value");
      this._targetCenter = this._tickY(0);
      this._motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this._reducedMotion = this._motionQuery.matches;
      this._onResize = this._onResize.bind(this); this._onContentResize = this._onContentResize.bind(this); this._invalidateRailRect = this._invalidateRailRect.bind(this);
      this._onPointerEnter = this._onPointerEnter.bind(this); this._onPointerMove = this._onPointerMove.bind(this); this._onPointerLeave = this._onPointerLeave.bind(this); this._onPointerDown = this._onPointerDown.bind(this); this._onPointerUp = this._onPointerUp.bind(this);
      this._onKeyDown = this._onKeyDown.bind(this); this._onFocus = this._onFocus.bind(this); this._onBlur = this._onBlur.bind(this); this._onMotionPreference = this._onMotionPreference.bind(this); this._animate = this._animate.bind(this);
      for (const p of ["items", "value", "open", "label"]) this._upgradeProperty(p);
    }
    _upgradeProperty(property: string) { if (!Object.prototype.hasOwnProperty.call(this, property)) return; const v = (this as unknown as Record<string, unknown>)[property]; delete (this as unknown as Record<string, unknown>)[property]; (this as unknown as Record<string, unknown>)[property] = v; }
    connectedCallback() {
      if (this._connected) return; this._connected = true;
      if (!this.hasAttribute("open")) { this._open = false; this.removeAttribute("data-open"); }
      this._renderTicks(); this._syncLabel();
      this._selected = normalizeIndex(this._pendingValue ?? this.getAttribute("value"), this._items.length); this._pendingValue = null;
      this._reflectValue(this._selected); this._targetCenter = this._tickY(this._selected); this._renderItem(false, true); this._updateMagnification(null, true); this._syncAria();
      const r = this._rail;
      r.addEventListener("pointerenter", this._onPointerEnter); r.addEventListener("pointermove", this._onPointerMove); r.addEventListener("pointerleave", this._onPointerLeave); r.addEventListener("pointerdown", this._onPointerDown); r.addEventListener("pointerup", this._onPointerUp); r.addEventListener("pointercancel", this._onPointerUp); r.addEventListener("keydown", this._onKeyDown); r.addEventListener("focus", this._onFocus); r.addEventListener("blur", this._onBlur);
      this._motionQuery.addEventListener("change", this._onMotionPreference);
      window.addEventListener("resize", this._invalidateRailRect, { passive: true }); window.addEventListener("scroll", this._invalidateRailRect, { capture: true, passive: true });
      this._resizeObserver = new ResizeObserver(this._onResize); this._resizeObserver.observe(this);
      this._contentResizeObserver = new ResizeObserver(this._onContentResize); this._contentResizeObserver.observe(this._title); this._contentResizeObserver.observe(this._description);
      if (this.hasAttribute("open")) this.select(this._selected, { open: true, emit: false });
    }
    disconnectedCallback() {
      this._connected = false; cancelAnimationFrame(this._raf); this._raf = 0; this._lastFrameTime = 0; clearTimeout(this._closeTimer); this._closeTimer = 0; this._measureVersion += 1;
      this._resizeObserver?.disconnect(); this._resizeObserver = null; this._contentResizeObserver?.disconnect(); this._contentResizeObserver = null; this._lastInlineSize = 0; this._railRect = null;
      this._motionQuery.removeEventListener("change", this._onMotionPreference); window.removeEventListener("resize", this._invalidateRailRect); window.removeEventListener("scroll", this._invalidateRailRect, true);
      this._pointerInside = false; this._dragging = false; this._floatIndex = null; this._rail.removeAttribute("data-pointer-focus");
      if (!this.hasAttribute("open")) { this._open = false; this.removeAttribute("data-open"); }
      const r = this._rail;
      r.removeEventListener("pointerenter", this._onPointerEnter); r.removeEventListener("pointermove", this._onPointerMove); r.removeEventListener("pointerleave", this._onPointerLeave); r.removeEventListener("pointerdown", this._onPointerDown); r.removeEventListener("pointerup", this._onPointerUp); r.removeEventListener("pointercancel", this._onPointerUp); r.removeEventListener("keydown", this._onKeyDown); r.removeEventListener("focus", this._onFocus); r.removeEventListener("blur", this._onBlur);
    }
    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
      if (oldValue === newValue) return;
      if (name === "label") this._syncLabel();
      if (name === "value" && !this._settingValue && !this._connected) this._pendingValue = newValue;
      if (name === "value" && !this._settingValue && this._connected) { this._pendingValue = null; const v = normalizeIndex(newValue, this._items.length, this._selected); this.select(v, { open: this._open, emit: false }); this._reflectValue(v); }
      if (name === "open" && !this._connected && !this.hasAttribute("open")) { this._open = false; this.removeAttribute("data-open"); }
      if (name === "open" && this._connected) { if (this.hasAttribute("open")) this.select(this._selected, { open: true, emit: false }); else if (!this._pointerInside && !this._rail.matches(":focus")) this._closeFromInteraction(); }
    }
    get items() { return this._items.map((i) => ({ ...i })); }
    set items(value: TableOfContentItem[]) {
      const requested = this._pendingValue ?? this._selected; this._items = normalizeItems(value); this._pendingValue = null;
      this._selected = normalizeIndex(requested, this._items.length); this._targetCenter = this._tickY(this._selected); this._floatIndex = this._open ? this._selected : null; this._reflectValue(this._selected);
      if (this._connected) { this._renderTicks(); this._renderItem(false, true); this._updateMagnification(this._floatIndex, true); this._updateTargetY(); this._syncAria(); }
    }
    get value() { return this._selected; }
    set value(index: number) { this._pendingValue = this._connected ? null : index; this.select(index, { open: this._open, emit: this._connected }); }
    get open() { return this.hasAttribute("open"); }
    set open(v: boolean) { this.toggleAttribute("open", Boolean(v)); }
    get label() { return this.getAttribute("label") || ""; }
    set label(v: string | null) { if (v === null || v === undefined) this.removeAttribute("label"); else this.setAttribute("label", String(v)); }
    /** The section the reader is in, marked on the rail without opening the card. */
    set current(index: number) { this._current = index; this._tickNodes.forEach((t, i) => t.toggleAttribute("data-current", i === index)); }
    get current() { return this._current; }
    select(index: number, options: { open?: boolean; emit?: boolean } = {}) {
      if (!this._items.length) return;
      const next = normalizeIndex(index, this._items.length); const shouldOpen = this.open || (options.open ?? true);
      this._targetCenter = this._tickY(next); this._floatIndex = next; this._setSelected(next, options.emit !== false); this._updateMagnification(next); this._updateTargetY(); this._setOpen(shouldOpen); this._startMotion();
    }
    close() { clearTimeout(this._closeTimer); this.open = false; this._setOpen(false); this._floatIndex = null; this._updateMagnification(null); }
    _closeFromInteraction() { if (this.open) return; this._setOpen(false); this._floatIndex = null; this._updateMagnification(null); }
    _renderTicks() {
      this._ticksRoot.replaceChildren(); const frag = document.createDocumentFragment();
      this._tickMotion = this._items.map(() => ({ value: 0, target: 0, velocity: 0 }));
      this._tickNodes = this._items.map((_, index) => { const t = document.createElement("span"); t.setAttribute("part", "tick"); t.style.setProperty("--tick-y", `${this._tickY(index) - GEOMETRY.hitTop}rem`); if (index === this._current) t.setAttribute("data-current", ""); frag.append(t); return t; });
      this._ticksRoot.append(frag); this._rail.setAttribute("aria-valuemax", String(this._items.length)); this._renderTickFrame();
    }
    _tickY(index: number) { return tickY(index, this._items.length); }
    _rootRemPixels() { const s = Number.parseFloat(getComputedStyle(document.documentElement).fontSize); return Number.isFinite(s) && s > 0 ? s : GEOMETRY.baseRemPixels; }
    _setSelected(index: number, emit: boolean) {
      if (this._connected) this._pendingValue = null;
      if (index === this._selected) return false;
      this._selected = index; this._reflectValue(index); this._renderItem(this._open, !this._open); this._syncAria();
      if (emit) this.dispatchEvent(new CustomEvent("toc-change", { bubbles: true, composed: true, detail: { index, item: { ...this._items[index] } } }));
      return true;
    }
    _reflectValue(index: number) { const v = String(index); if (this.getAttribute("value") === v) return; this._settingValue = true; this.setAttribute("value", v); this._settingValue = false; }
    _renderItem(animateHeight: boolean, immediateMeasure = false) { const item = this._items[this._selected]; if (!item) return; this._title.textContent = item.title; this._description.textContent = item.description ?? ""; this._description.hidden = !item.description; this._measureCard(animateHeight, immediateMeasure); }
    _measureCard(animateHeight: boolean, immediate = false) {
      const version = ++this._measureVersion;
      const measure = () => {
        if (version !== this._measureVersion || !this.isConnected) return;
        this._cardContent.toggleAttribute("data-measuring", true); const measured = Math.ceil(this._cardContent.scrollHeight) / this._rootRemPixels(); this._cardContent.toggleAttribute("data-measuring", false);
        this._targetHeight = Math.min(measured, GEOMETRY.stageHeight - GEOMETRY.cardEdgeGap * 2); this._updateTargetY();
        if (!animateHeight || !this._open || this._reducedMotion) { this._cardHeight = this._targetHeight; this._heightVelocity = 0; this._cardY = this._targetY; this._yVelocity = 0; this._renderMotionFrame(); } else this._startMotion();
      };
      if (immediate) measure(); else requestAnimationFrame(measure);
    }
    _setOpen(open: boolean) {
      const next = Boolean(open); if (next === this._open) return; this._open = next;
      if (next) { this._cardHeight = this._targetHeight; this._heightVelocity = 0; this._cardY = this._targetY; this._yVelocity = 0; this._renderMotionFrame(); }
      this.toggleAttribute("data-open", next);
      this.dispatchEvent(new CustomEvent(next ? "toc-open" : "toc-close", { bubbles: true, composed: true, detail: { index: this._selected } }));
    }
    _updateMagnification(floatIndex: number | null, snap = false) {
      this._tickMotion.forEach((m, index) => { m.target = floatIndex === null ? 0 : tickInfluence(index, floatIndex); if (snap || this._reducedMotion) { m.value = m.target; m.velocity = 0; } });
      if (snap || this._reducedMotion) this._renderTickFrame(); else this._startMotion();
    }
    _selectFromPointer(event: PointerEvent) {
      const rect = this._railRect ?? this._rail.getBoundingClientRect(); this._railRect = rect;
      const sel = selectionFromPointer(event.clientY, rect.top, rect.height, this._items.length); if (!sel) return;
      this._targetCenter = sel.center; this._floatIndex = sel.floatIndex; this._updateMagnification(sel.floatIndex); this._setSelected(sel.index, true); this._updateTargetY(); this._setOpen(true); this._startMotion();
    }
    _updateTargetY() { this._targetY = clamp(this._targetCenter - this._targetHeight / 2, GEOMETRY.cardEdgeGap, GEOMETRY.stageHeight - this._targetHeight - GEOMETRY.cardEdgeGap); }
    _startMotion() {
      if (this._reducedMotion) { this._cardY = this._targetY; this._cardHeight = this._targetHeight; this._yVelocity = 0; this._heightVelocity = 0; this._tickMotion.forEach((m) => { m.value = m.target; m.velocity = 0; }); this._renderMotionFrame(); this._renderTickFrame(); return; }
      if (this._raf) return; this._lastFrameTime = performance.now(); this._raf = requestAnimationFrame(this._animate);
    }
    _animate(now: number) {
      const dt = Math.min((now - this._lastFrameTime) / 1000, 0.032); this._lastFrameTime = now;
      this._yVelocity += ((this._targetY - this._cardY) * 430 - this._yVelocity * 41) * dt; this._cardY += this._yVelocity * dt;
      this._heightVelocity += ((this._targetHeight - this._cardHeight) * 460 - this._heightVelocity * 43) * dt; this._cardHeight += this._heightVelocity * dt;
      let ticksSettled = true;
      this._tickMotion.forEach((m) => { stepSpring(m, m.target, dt, MOTION.tickSpringStiffness, MOTION.tickSpringDamping, MOTION.tickSpringMaxStep); if (Math.abs(m.target - m.value) >= 0.0005 || Math.abs(m.velocity) >= 0.005) ticksSettled = false; });
      this._renderMotionFrame(); this._renderTickFrame();
      const cardSettled = Math.abs(this._targetY - this._cardY) < 0.005 && Math.abs(this._yVelocity) < 0.05 && Math.abs(this._targetHeight - this._cardHeight) < 0.005 && Math.abs(this._heightVelocity) < 0.05;
      if (cardSettled && ticksSettled) { this._cardY = this._targetY; this._cardHeight = this._targetHeight; this._yVelocity = 0; this._heightVelocity = 0; this._tickMotion.forEach((m) => { m.value = m.target; m.velocity = 0; }); this._renderMotionFrame(); this._renderTickFrame(); this._raf = 0; return; }
      this._raf = requestAnimationFrame(this._animate);
    }
    _renderMotionFrame() { this._card.style.setProperty("--card-y", `${this._cardY.toFixed(4)}rem`); this._card.style.setProperty("--card-height", `${this._cardHeight.toFixed(4)}rem`); }
    _renderTickFrame() { this._tickNodes.forEach((tick, index) => { const inf = clamp(this._tickMotion[index]?.value ?? 0, 0, 1); const width = 0.5 + 1.75 * inf; tick.style.setProperty("--tick-scale", (width / 2.25).toFixed(4)); tick.style.opacity = (0.19 + 0.78 * inf + (index === this._current ? 0.3 : 0)).toFixed(3); }); }
    _onPointerEnter(event: PointerEvent) { this._pointerInside = true; this._railRect = this._rail.getBoundingClientRect(); clearTimeout(this._closeTimer); this._selectFromPointer(event); }
    _onPointerMove(event: PointerEvent) { if (this._pointerInside || this._dragging) this._selectFromPointer(event); }
    _onPointerLeave(event: PointerEvent) { this._pointerInside = false; if (this._dragging || event.pointerType === "touch") return; this._railRect = null; clearTimeout(this._closeTimer); this._closeTimer = window.setTimeout(() => this._closeFromInteraction(), 80); }
    _onPointerDown(event: PointerEvent) { if (!event.isPrimary || event.button > 0) return; this._dragging = true; this._railRect = this._rail.getBoundingClientRect(); this._rail.setAttribute("data-pointer-focus", ""); this._rail.focus({ preventScroll: true }); this._rail.setPointerCapture(event.pointerId); this._selectFromPointer(event); }
    _onPointerUp(event: PointerEvent) {
      if (!this._dragging) return; this._dragging = false;
      if (this._rail.hasPointerCapture(event.pointerId)) this._rail.releasePointerCapture(event.pointerId);
      if (!this._pointerInside) this._railRect = null;
      this.dispatchEvent(new CustomEvent("toc-commit", { bubbles: true, composed: true, detail: { index: this._selected, item: { ...this._items[this._selected] } } }));
      if (event.pointerType === "touch") { clearTimeout(this._closeTimer); this._closeTimer = window.setTimeout(() => this._closeFromInteraction(), 1400); }
    }
    _onKeyDown(event: KeyboardEvent) {
      this._rail.removeAttribute("data-pointer-focus"); let next: number | null = null;
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = this._selected - 1; else if (event.key === "ArrowDown" || event.key === "ArrowRight") next = this._selected + 1; else if (event.key === "Home") next = 0; else if (event.key === "End") next = this._items.length - 1;
      else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this.dispatchEvent(new CustomEvent("toc-commit", { bubbles: true, composed: true, detail: { index: this._selected, item: { ...this._items[this._selected] } } })); return; }
      else if (event.key === "Escape") { event.preventDefault(); this.close(); return; } else return;
      event.preventDefault(); this.select(next, { open: true });
    }
    _onFocus() { clearTimeout(this._closeTimer); if (this._rail.hasAttribute("data-pointer-focus")) return; this.select(this._selected, { open: true, emit: false }); }
    _onBlur() { this._rail.removeAttribute("data-pointer-focus"); if (!this._pointerInside) this._closeFromInteraction(); }
    _onResize(entries: ResizeObserverEntry[]) { const w = entries[0]?.contentRect.width ?? 0; if (!this._connected || !w || Math.abs(w - this._lastInlineSize) < 0.5) return; this._lastInlineSize = w; this._invalidateRailRect(); this._measureCard(this._open); }
    _onContentResize() { if (this._connected) this._measureCard(this._open); }
    _invalidateRailRect() { this._railRect = null; }
    _onMotionPreference(event: MediaQueryListEvent) { this._reducedMotion = event.matches; if (event.matches) { cancelAnimationFrame(this._raf); this._raf = 0; this._cardY = this._targetY; this._cardHeight = this._targetHeight; this._yVelocity = 0; this._heightVelocity = 0; this._tickMotion.forEach((m) => { m.value = m.target; m.velocity = 0; }); this._renderMotionFrame(); this._renderTickFrame(); } }
    _syncLabel() { this._rail?.setAttribute("aria-label", this.getAttribute("label") || "Table of content"); }
    _syncAria() { const item = this._items[this._selected]; if (!item) return; this._rail.setAttribute("aria-valuenow", String(this._selected + 1)); this._rail.setAttribute("aria-valuetext", [`${this._selected + 1} of ${this._items.length}: ${item.title}`, item.description].filter(Boolean).join(". ")); }
  }
  customElements.define("table-of-content", TableOfContent);
}
