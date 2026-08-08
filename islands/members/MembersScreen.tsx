import { useMemo, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { MemberInterface } from "@/models/index.ts";
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_AVATAR_EMOJI,
} from "@/models/index.ts";
import { useMembers } from "@/hooks/useMembers.ts";
import { MemberAvatar } from "@/components/members/MemberAvatar.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";

interface Props {
  initialMembers: MemberInterface[];
  actingMember: MemberInterface | null;
}

export default function MembersScreen(
  { initialMembers, actingMember }: Props,
) {
  // useMemo([]) so the hook's signals are created once from SSR props.
  const { members, addMember, updateMember, removeMember } = useMemo(
    () => useMembers(initialMembers),
    [],
  );

  const canManage = actingMember?.isManager === true;

  // null = closed; "" = creating; otherwise the id being edited.
  const editingId = useSignal<string | null>(null);
  const confirmingId = useSignal<string | null>(null);
  const draftName = useSignal("");
  const draftColor = useSignal<string>(DEFAULT_AVATAR_COLOR);
  const draftEmoji = useSignal<string>(DEFAULT_AVATAR_EMOJI);
  const draftManager = useSignal(false);
  const saving = useSignal(false);

  const snack = useSignal<{ msg: string } | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = (msg: string) => {
    snack.value = { msg };
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => (snack.value = null), 3000);
  };

  const managerCount = members.value.filter((m) => m.isManager).length;
  const editing = editingId.value !== null && editingId.value !== ""
    ? members.value.find((m) => m.id === editingId.value) ?? null
    : null;
  // The last manager can be neither demoted nor removed (grilled Q10).
  const lockedLastManager = editing !== null && editing.isManager &&
    managerCount <= 1;

  const openCreate = () => {
    draftName.value = "";
    draftColor.value = DEFAULT_AVATAR_COLOR;
    draftEmoji.value = DEFAULT_AVATAR_EMOJI;
    draftManager.value = false;
    editingId.value = "";
  };

  const openEdit = (m: MemberInterface) => {
    draftName.value = m.name;
    draftColor.value = m.color;
    draftEmoji.value = m.emoji;
    draftManager.value = m.isManager;
    editingId.value = m.id;
  };

  const submit = async () => {
    const name = draftName.value.trim();
    if (!name) return;
    saving.value = true;
    try {
      if (editingId.value === "") {
        const created = await addMember({
          name,
          color: draftColor.value,
          emoji: draftEmoji.value,
          isManager: draftManager.value,
        });
        if (!created) {
          say("Couldn't add that member. Try again?");
          return;
        }
      } else if (editing) {
        const saved = await updateMember(editing.id, {
          name,
          color: draftColor.value,
          emoji: draftEmoji.value,
          // Only managers may change who manages; sending it otherwise 403s.
          ...(canManage && draftManager.value !== editing.isManager
            ? { isManager: draftManager.value }
            : {}),
        });
        if (!saved) {
          say("Couldn't save those changes. Try again?");
          return;
        }
      }
      editingId.value = null;
    } finally {
      saving.value = false;
    }
  };

  const confirmRemove = async () => {
    const id = confirmingId.value;
    confirmingId.value = null;
    if (!id) return;
    const ok = await removeMember(id);
    if (!ok) say("Couldn't remove that member. Try again?");
  };

  const canEdit = (m: MemberInterface) =>
    canManage || m.id === actingMember?.id;

  return (
    <>
      <ul class="pt-2">
        {members.value.map((m) => (
          <li key={m.id}>
            <ListItem
              leading={<MemberAvatar color={m.color} emoji={m.emoji} />}
              headline={m.name}
              supporting={m.isManager ? "Manager" : undefined}
              trailing={canEdit(m)
                ? <span class="md-label-large text-primary">Edit</span>
                : undefined}
              onClick={canEdit(m) ? () => openEdit(m) : undefined}
            />
          </li>
        ))}
      </ul>

      {canManage && (
        <div class="pt-4 pb-6">
          <Button variant="filled" full onClick={openCreate}>
            Add a member
          </Button>
        </div>
      )}

      <Sheet
        open={editingId.value !== null}
        onClose={() => (editingId.value = null)}
        title={editingId.value === "" ? "New member" : "Edit member"}
      >
        <div class="flex flex-col gap-4 pb-2">
          <input
            type="text"
            value={draftName.value}
            onInput={(e) => (draftName.value = e.currentTarget.value)}
            placeholder="Name or nickname"
            aria-label="Name"
            class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none"
          />

          <div
            class="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Colour"
          >
            {AVATAR_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={draftColor.value === c.key}
                aria-label={c.key}
                onClick={() => (draftColor.value = c.key)}
                class={`rounded-full ${
                  draftColor.value === c.key
                    ? "ring-2 ring-offset-2 ring-primary"
                    : ""
                }`}
                style={{ width: 36, height: 36, backgroundColor: c.bg }}
              />
            ))}
          </div>

          <div
            class="flex flex-wrap gap-1"
            role="radiogroup"
            aria-label="Emoji"
          >
            {AVATAR_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={draftEmoji.value === e}
                onClick={() => (draftEmoji.value = e)}
                class={`text-2xl p-1.5 rounded-full ${
                  draftEmoji.value === e ? "bg-primary-container" : ""
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          {canManage && (
            <label class="flex items-center gap-3 py-1 md-body-large text-on-surface">
              <input
                type="checkbox"
                checked={draftManager.value}
                disabled={lockedLastManager}
                onChange={(e) => (draftManager.value = e.currentTarget.checked)}
                class="w-5 h-5"
              />
              Manages the household
            </label>
          )}
          {lockedLastManager && (
            <div class="md-body-medium text-on-surface-variant">
              Every household needs a manager. Promote someone else first.
            </div>
          )}

          <Button variant="filled" full loading={saving.value} onClick={submit}>
            {editingId.value === "" ? "Add" : "Save"}
          </Button>
          {canManage && editing && !lockedLastManager && (
            <Button
              variant="error"
              full
              onClick={() => {
                const id = editing.id;
                editingId.value = null;
                confirmingId.value = id;
              }}
            >
              Remove from household
            </Button>
          )}
        </div>
      </Sheet>

      {/* Confirmation is a sibling sheet — sheets never stack (house rule). */}
      <Sheet
        open={confirmingId.value !== null}
        onClose={() => (confirmingId.value = null)}
        title="Remove this member?"
      >
        <div class="flex flex-col gap-3 pb-2">
          <div class="md-body-medium text-on-surface-variant">
            Their name and avatar are gone for good. Things they added stay.
          </div>
          <Button variant="error" full onClick={confirmRemove}>Remove</Button>
          <Button
            variant="text"
            full
            onClick={() => (confirmingId.value = null)}
          >
            Keep them
          </Button>
        </div>
      </Sheet>

      <Snackbar data={snack.value} />
    </>
  );
}
