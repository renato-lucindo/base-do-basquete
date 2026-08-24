import { type ReactNode, useEffect, useRef, useState } from "react";

export function ScrollableTable({ children, label }: { children: ReactNode; label: string }) {
  const topRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const top = topRef.current;
    const viewport = viewportRef.current;
    if (!top || !viewport) return;

    const update = () => {
      setScrollWidth(viewport.scrollWidth);
      setEdges({
        left: viewport.scrollLeft > 1,
        right: viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1,
      });
    };
    const sync = (source: HTMLDivElement, target: HTMLDivElement) => {
      if (syncing.current) return;
      syncing.current = true;
      target.scrollLeft = source.scrollLeft;
      update();
      requestAnimationFrame(() => {
        syncing.current = false;
      });
    };
    const fromTop = () => sync(top, viewport);
    const fromViewport = () => sync(viewport, top);
    const observer = new ResizeObserver(update);

    top.addEventListener("scroll", fromTop, { passive: true });
    viewport.addEventListener("scroll", fromViewport, { passive: true });
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    update();

    return () => {
      top.removeEventListener("scroll", fromTop);
      viewport.removeEventListener("scroll", fromViewport);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className="scrollable-table"
      data-shadow-left={edges.left || undefined}
      data-shadow-right={edges.right || undefined}
    >
      <div aria-hidden="true" className="scrollable-table-top" ref={topRef} tabIndex={-1}>
        <div style={{ width: scrollWidth }} />
      </div>
      <div
        aria-label={label}
        className="statistics-table-wrap"
        ref={viewportRef}
        role="region"
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}
