import { useEffect, useRef } from "react";

/**
 * A field of monospace characters that brightens, glows and scales around the pointer.
 * Adapted from 21st.dev "Cyber Matrix Hero" (dhileepkumargm): the same tile grid and
 * intensity falloff, restyled to the CyberJudah palette and made SSR-safe (the grid is
 * only built in the browser). On touch devices, where there is no pointer to follow,
 * random tiles glitch instead so the field still reads as alive.
 */
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/?;:[]{}|!@#$%^&*()_+-=אבגדהוזחטיכלמנסעפצקרשת";

export function Matrix({ size = 44 }: { size?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    const section = grid.parentElement;
    if (!section) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const rand = () => CHARS[Math.floor(Math.random() * CHARS.length)];

    const build = () => {
      grid.innerHTML = "";
      const w = section.clientWidth;
      const h = section.clientHeight;
      const columns = Math.max(4, Math.floor(w / size));
      const rows = Math.max(3, Math.floor(h / size));
      grid.style.setProperty("--columns", String(columns));
      grid.style.setProperty("--rows", String(rows));
      const frag = document.createDocumentFragment();
      for (let i = 0; i < columns * rows; i++) {
        const t = document.createElement("span");
        t.className = "tile";
        t.textContent = rand();
        frag.appendChild(t);
      }
      grid.appendChild(frag);
    };

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = section.getBoundingClientRect();
        const mx = e.clientX;
        const my = e.clientY;
        if (my < r.top - 200 || my > r.bottom + 200) return;
        const radius = Math.max(220, r.width / 4);
        const tiles = grid.children as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < tiles.length; i++) {
          const t = tiles[i];
          const b = t.getBoundingClientRect();
          const dx = mx - (b.left + b.width / 2);
          const dy = my - (b.top + b.height / 2);
          const d = Math.sqrt(dx * dx + dy * dy);
          const intensity = Math.max(0, 1 - d / radius);
          t.style.setProperty("--intensity", intensity.toFixed(3));
          if (intensity > 0.85 && Math.random() < 0.08) t.textContent = rand();
        }
      });
    };

    const onLeave = () => {
      const tiles = grid.children as HTMLCollectionOf<HTMLElement>;
      for (let i = 0; i < tiles.length; i++) tiles[i].style.setProperty("--intensity", "0");
    };

    build();
    const ro = new ResizeObserver(build);
    ro.observe(section);

    let timer = 0;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (!reduced) {
      if (coarse) {
        timer = window.setInterval(() => {
          const tiles = grid.children;
          if (!tiles.length) return;
          const t = tiles[Math.floor(Math.random() * tiles.length)] as HTMLElement;
          t.textContent = rand();
          t.classList.add("glitch");
          window.setTimeout(() => t.classList.remove("glitch"), 260);
        }, 90);
      } else {
        window.addEventListener("mousemove", onMove, { passive: true });
        section.addEventListener("mouseleave", onLeave);
      }
    }

    return () => {
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      section.removeEventListener("mouseleave", onLeave);
      if (timer) window.clearInterval(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [size]);

  return <div ref={ref} className="matrix" aria-hidden="true" />;
}
