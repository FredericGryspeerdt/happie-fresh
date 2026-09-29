import { Segmented } from "@/components/md3/Segmented.tsx";
import { navigateTo } from "@/utils/loading.ts";

interface Props {
  active: "plan" | "dishes";
}

export default function MenuSubNav({ active }: Props) {
  return (
    <div class="px-4 pt-4 pb-2">
      <Segmented
        options={[
          ["plan", "calendar", "Deze week"],
          ["dishes", "plate", "Gerechten"],
        ]}
        value={active}
        onChange={(key) => {
          if (key !== active) {
            navigateTo(key === "plan" ? "/menu" : "/menu/dishes");
          }
        }}
      />
    </div>
  );
}
