import { useSignal } from "@preact/signals";
import TopAppBar from "./TopAppBar.tsx";
import NavigationBar from "./NavigationBar.tsx";
import MoreSheet from "./MoreSheet.tsx";
import { NAV_CONFIG } from "@/config/navigation.ts";
import { appBarAction } from "@/utils/app-bar.ts";
import { IconButton } from "@/components/md3/IconButton.tsx";

interface AppChromeProps {
  activeId?: string;
  appBar?: { title: string; backUrl: string };
  sectionTitle: string;
}

export default function AppChrome(
  { activeId, appBar, sectionTitle }: AppChromeProps,
) {
  const moreOpen = useSignal(false);
  return (
    <>
      {appBar
        ? (
          <TopAppBar
            title={appBar.title}
            backUrl={appBar.backUrl}
            trailing={appBarAction.value
              ? (
                <IconButton
                  name={appBarAction.value.icon}
                  aria-label={appBarAction.value.label}
                  onClick={appBarAction.value.onClick}
                />
              )
              : undefined}
          />
        )
        : <TopAppBar title={sectionTitle} />}
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
