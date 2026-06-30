// components/md3/Snackbar.tsx
interface SnackData {
  msg: string;
  action?: string;
  onAction?: () => void;
}
interface SnackbarProps {
  data: SnackData | null;
}
export function Snackbar({ data }: SnackbarProps) {
  return (
    <div
      class="fixed left-4 right-4 z-[300]"
      style={{
        bottom: "calc(96px + env(safe-area-inset-bottom))",
        transform: `translateY(${data ? 0 : 16}px)`,
        opacity: data ? 1 : 0,
        transition: "all .3s var(--md-emphasized)",
        pointerEvents: "none",
      }}
    >
      {data && (
        <div
          class="flex items-center gap-3 bg-inverse-surface text-inverse-on-surface rounded-[var(--md-shape-sm)]"
          style={{
            padding: "6px 8px 6px 16px",
            boxShadow: "0 4px 12px rgba(0,0,0,.3)",
          }}
        >
          <span class="md-body-medium flex-1">{data.msg}</span>
          {data.action && (
            <button
              type="button"
              onClick={data.onAction}
              class="md-label-large text-inverse-primary rounded-[var(--md-shape-full)]"
              style={{
                background: "transparent",
                border: "none",
                padding: "8px 12px",
                pointerEvents: "auto",
              }}
            >
              {data.action}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
