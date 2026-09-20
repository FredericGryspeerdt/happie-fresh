interface PendingState {
  value: boolean;
}

interface SubmitListRenameOptions {
  name: string;
  pending: PendingState;
  rename: (name: string) => Promise<unknown | null>;
  beginBusy: () => void;
  endBusy: () => void;
  onFailure?: () => void;
}

/** Submit one list rename while guarding duplicate requests and global loading. */
export async function submitListRename(
  {
    name,
    pending,
    rename,
    beginBusy,
    endBusy,
    onFailure,
  }: SubmitListRenameOptions,
): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed || pending.value) return false;

  pending.value = true;
  beginBusy();
  try {
    const renamed = await rename(trimmed);
    if (renamed === null) {
      onFailure?.();
      return false;
    }
    return true;
  } finally {
    pending.value = false;
    endBusy();
  }
}
