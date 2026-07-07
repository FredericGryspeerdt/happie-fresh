// components/md3/Progress.tsx
interface ProgressProps {
  value: number;
  total: number;
  height?: number;
}
export function Progress({ value, total, height = 4 }: ProgressProps) {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div class="flex items-center gap-1" style={{ height }}>
      <div
        class="bg-primary rounded-[var(--md-shape-full)]"
        style={{
          width: `${pct}%`,
          height,
          transition: "width .45s var(--md-emphasized)",
        }}
      />
      {pct < 100 && (
        <>
          <span
            class="bg-primary rounded-[var(--md-shape-full)] shrink-0"
            style={{ width: 4, height }}
          />
          <div
            class="flex-1 bg-primary-container rounded-[var(--md-shape-full)]"
            style={{ height }}
          />
        </>
      )}
    </div>
  );
}
