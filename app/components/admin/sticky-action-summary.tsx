import type { ReactNode } from "react";

interface StickyActionSummaryProps {
  title: string;
  metrics: Array<{ label: string; value: ReactNode }>;
  status?: string;
  children?: ReactNode;
}

export function StickyActionSummary({
  title,
  metrics,
  status,
  children,
}: StickyActionSummaryProps) {
  return (
    <aside className="sticky-action-summary" aria-label={title}>
      <strong>{title}</strong>
      <dl>
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>
      {status ? <p aria-live="polite">{status}</p> : null}
      {children}
    </aside>
  );
}
