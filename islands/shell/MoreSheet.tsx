import { useSignal } from "@preact/signals";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon, type IconName } from "@/components/md3/Icon.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import { navigateTo } from "@/utils/loading.ts";
import NotificationSetting from "@/islands/shell/NotificationSetting.tsx";
import InstallSetting from "@/islands/shell/InstallSetting.tsx";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}
const badge = (icon: IconName) => (
  <span
    class="grid place-items-center bg-primary-container text-on-primary-container rounded-full"
    style={{ width: 40, height: 40 }}
  >
    <Icon name={icon} size={20} />
  </span>
);

export default function MoreSheet({ open, onClose }: MoreSheetProps) {
  const snack = useSignal<{ msg: string } | null>(null);
  const soon = (label: string) => {
    snack.value = { msg: `${label} — coming soon` };
    setTimeout(() => snack.value = null, 2200);
  };
  const chevron = () => <Icon name="chevron" size={18} />;
  return (
    <>
      <Sheet open={open} onClose={onClose} title="The household">
        <div
          class="md-label-medium text-on-surface-variant uppercase tracking-wide"
          style={{ margin: "8px 4px 4px" }}
        >
          Modules
        </div>
        <ListItem
          leading={badge("cart")}
          headline="Shopping"
          trailing={chevron()}
          onClick={() => {
            onClose();
            navigateTo("/shopping");
          }}
        />
        <ListItem
          leading={badge("checklist")}
          headline="To-dos"
          trailing={chevron()}
          onClick={() => {
            onClose();
            navigateTo("/todos");
          }}
        />
        <ListItem
          leading={badge("plate")}
          headline="Menu planner"
          trailing={chevron()}
          onClick={() => soon("Menu planner")}
        />
        <ListItem
          leading={badge("card")}
          headline="Loyalty cards"
          trailing={chevron()}
          onClick={() => {
            onClose();
            navigateTo("/cards");
          }}
        />
        <div
          class="md-label-medium text-on-surface-variant uppercase tracking-wide"
          style={{ margin: "16px 4px 4px" }}
        >
          Household
        </div>
        <ListItem
          leading={badge("people")}
          headline="Members"
          trailing={chevron()}
          onClick={() => {
            onClose();
            navigateTo("/members");
          }}
        />
        <ListItem
          leading={badge("cog")}
          headline="Settings"
          trailing={chevron()}
          onClick={() => soon("Settings")}
        />
        {
          /* onOpen={onClose} so the notifications sheet never stacks on top of
            this one — the same reason the due picker is a sibling sheet. */
        }
        <NotificationSetting onOpen={onClose} />
        <InstallSetting onOpen={onClose} />
        <ListItem
          leading={badge("swap")}
          headline="Switch household"
          trailing={chevron()}
          onClick={() => soon("Switch household")}
        />
        <a
          href="/logout"
          class="block text-center md-label-large text-error"
          style={{ padding: "16px" }}
        >
          Log out
        </a>
      </Sheet>
      <Snackbar data={snack.value} />
    </>
  );
}
