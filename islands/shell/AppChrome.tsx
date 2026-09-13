import { useSignal } from "@preact/signals";
import { useEffect, useMemo } from "preact/hooks";
import { usePushNotifications } from "./usePushNotifications.ts";
import TopAppBar from "./TopAppBar.tsx";
import NavigationBar from "./NavigationBar.tsx";
import MoreSheet from "./MoreSheet.tsx";
import GlobalLoadingBar from "./GlobalLoadingBar.tsx";
import ActingMemberChip from "./ActingMemberChip.tsx";
import { NAV_CONFIG } from "@/config/navigation.ts";
import { appBarAction } from "@/utils/app-bar.ts";
import { IconButton } from "@/components/md3/IconButton.tsx";
import type { AppBar } from "@/utils/define.ts";
import type { MemberInterface } from "@/models/index.ts";

interface AppChromeProps {
  activeId?: string;
  appBar?: AppBar;
  sectionTitle: string;
  actingMember: MemberInterface | null;
  actingClaimed: boolean;
}

export default function AppChrome(
  { activeId, appBar, sectionTitle, actingMember, actingClaimed }:
    AppChromeProps,
) {
  const moreOpen = useSignal(false);
  const { syncIfGranted } = useMemo(() => usePushNotifications(), []);

  // Re-register this device when permission is already granted but the server
  // has no subscription — after site data was cleared, or after a log out
  // removed it (issue #68). Silent: permission is granted, so nothing prompts.
  //
  // Lives here because AppChrome is the one island present on every
  // authenticated page (`_app.tsx` renders it only when state.userId is set),
  // so logging back in re-registers without the member doing anything.
  //
  // Above the early return below, since hooks cannot be called conditionally.
  useEffect(() => {
    syncIfGranted();
  }, []);

  // Full-screen routes (e.g. the add-items search) own the whole viewport:
  // no top bar and no bottom navigation.
  if (appBar?.mode === "none") return <GlobalLoadingBar />;

  const detail = appBar?.mode === "detail" ? appBar : null;

  const chip = (
    <ActingMemberChip actingMember={actingMember} claimed={actingClaimed} />
  );

  return (
    <>
      <GlobalLoadingBar />
      {detail
        ? (
          <TopAppBar
            title={detail.title}
            backUrl={detail.backUrl}
            trailing={
              <>
                {appBarAction.value && (
                  <IconButton
                    name={appBarAction.value.icon}
                    aria-label={appBarAction.value.label}
                    onClick={appBarAction.value.onClick}
                  />
                )}
                {chip}
              </>
            }
          />
        )
        : <TopAppBar title={sectionTitle} trailing={chip} />}
      <NavigationBar
        items={NAV_CONFIG}
        activeId={activeId}
        onMore={() => moreOpen.value = true}
      />
      <MoreSheet
        open={moreOpen.value}
        onClose={() => moreOpen.value = false}
      />
    </>
  );
}
