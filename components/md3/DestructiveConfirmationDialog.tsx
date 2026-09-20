import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";

interface DestructiveConfirmationDialogProps {
  open: boolean;
  headline: string;
  supportingText: string;
  confirmLabel: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

/** A consistent, accessible confirmation boundary before destructive changes. */
export function DestructiveConfirmationDialog(
  {
    open,
    headline,
    supportingText,
    confirmLabel,
    pending = false,
    onClose,
    onConfirm,
  }: DestructiveConfirmationDialogProps,
) {
  const close = () => {
    if (!pending) onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      headline={headline}
      actions={
        <>
          <Button variant="text" disabled={pending} onClick={close}>
            Cancel
          </Button>
          <Button
            variant="error"
            loading={pending}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {supportingText}
    </Dialog>
  );
}
