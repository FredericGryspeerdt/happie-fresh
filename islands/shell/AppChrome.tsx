import { useSignal } from "@preact/signals";
import TopAppBar from "./TopAppBar.tsx";
import NavigationBar from "./NavigationBar.tsx";
import MoreSheet from "./MoreSheet.tsx";
import { NAV_CONFIG } from "@/config/navigation.ts";

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
        ? <TopAppBar title={appBar.title} backUrl={appBar.backUrl} />
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
