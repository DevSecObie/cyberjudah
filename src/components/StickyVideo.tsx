import React, { useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };

export default function StickyVideo({ videoId }: { videoId: string }) {
  const frameRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; startX: number; startY: number } | null>(null);
  const [docked, setDocked] = useState(false);
  const [closed, setClosed] = useState(false);
  const [position, setPosition] = useState<Point | null>(null);

  useEffect(() => {
    const update = () => {
      if (!frameRef.current || closed) return;
      const placeholder = frameRef.current.parentElement;
      if (!placeholder) return;
      setDocked(placeholder.getBoundingClientRect().top < -180);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [closed]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!docked || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, startX: rect.left, startY: rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(window.innerWidth - rect.width - 8, dragRef.current.startX + event.clientX - dragRef.current.pointerX));
    const y = Math.max(70, Math.min(window.innerHeight - rect.height - 8, dragRef.current.startY + event.clientY - dragRef.current.pointerY));
    setPosition({ x, y });
  };
  const stopDrag = () => { dragRef.current = null; };
  const restore = () => {
    setDocked(false); setPosition(null);
    frameRef.current?.parentElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return <div className={`class-video-slot ${closed ? "is-closed" : ""}`}>
    {!closed && <figure ref={frameRef} className={`class-video ${docked ? "is-docked" : ""}`}
      style={docked && position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined}>
      <div className="class-video-bar" onPointerDown={startDrag} onPointerMove={drag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
        <span><i /> CLASS_STREAM</span>
        <div>
          {docked && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={restore} aria-label="Return video to page">↙</button>}
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setClosed(true)} aria-label="Close video">×</button>
        </div>
      </div>
      <iframe src={`https://www.youtube-nocookie.com/embed/${videoId}`} title="Sabbath Class video" loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
      <figcaption><a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">Open class on YouTube ↗</a></figcaption>
    </figure>}
  </div>;
}
