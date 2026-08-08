import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { MemberInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { reloadPage } from "@/utils/loading.ts";
import { MemberAvatar } from "@/components/members/MemberAvatar.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";

interface Props {
  actingMember: MemberInterface | null;
  /** True when a valid device cookie made the claim (vs. the login fallback). */
  claimed: boolean;
}

/**
 * The always-visible "who am I" chip (grilled Q6/Q12): seeing the wrong
 * avatar is how a family self-corrects attribution under the honor system.
 * Unclaimed devices self-heal on mount: a sole member is claimed silently; a
 * real choice auto-opens the picker once.
 */
export default function ActingMemberChip({ actingMember, claimed }: Props) {
  const open = useSignal(false);
  const acting = useSignal<MemberInterface | null>(actingMember);
  const members = useSignal<MemberInterface[] | null>(null);

  const load = async () => {
    if (members.value === null) members.value = await api.members.getAll();
  };

  useEffect(() => {
    if (claimed) return;
    (async () => {
      await load();
      const ms = members.value ?? [];
      if (ms.length === 1) {
        // Sole member: nothing to choose — claim silently (Q6).
        if (await api.members.claim(ms[0].id)) acting.value = ms[0];
      } else if (ms.length > 1) {
        open.value = true;
      }
    })();
  }, []);

  const pick = async (m: MemberInterface) => {
    const ok = await api.members.claim(m.id);
    if (!ok) return; // sheet stays open; nothing changed
    open.value = false;
    // Full reload: manager gating and attribution are server-resolved, so
    // every screen must re-render under the new acting member.
    reloadPage();
  };

  return (
    <>
      <Pressable
        aria-label="Switch member"
        onClick={() => {
          load();
          open.value = true;
        }}
        class="grid place-items-center rounded-full"
        style={{ width: 40, height: 40 }}
      >
        {acting.value
          ? (
            <MemberAvatar
              color={acting.value.color}
              emoji={acting.value.emoji}
              size={32}
            />
          )
          : <Icon name="people" size={22} />}
      </Pressable>
      <Sheet
        open={open.value}
        onClose={() => (open.value = false)}
        title="Who's using Happie?"
      >
        {(members.value ?? []).map((m) => (
          <ListItem
            key={m.id}
            leading={<MemberAvatar color={m.color} emoji={m.emoji} />}
            headline={m.name}
            supporting={m.isManager ? "Manager" : undefined}
            trailing={acting.value?.id === m.id
              ? <span class="md-label-large text-primary">That's me</span>
              : undefined}
            onClick={() => pick(m)}
          />
        ))}
      </Sheet>
    </>
  );
}
