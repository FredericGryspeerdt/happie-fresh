import { Chip } from "@/components/md3/Chip.tsx";
import { navigateTo } from "@/utils/loading.ts";

interface Props {
  active: "plan" | "dishes";
}

export default function MenuSubNav({ active }: Props) {
  return (
    <div class="flex gap-2 px-4 pt-4">
      <Chip
        selected={active === "plan"}
        leadingCheck={false}
        onClick={() => active !== "plan" && navigateTo("/menu")}
      >
        Deze week
      </Chip>
      <Chip
        selected={active === "dishes"}
        leadingCheck={false}
        onClick={() => active !== "dishes" && navigateTo("/menu/dishes")}
      >
        Gerechten
      </Chip>
    </div>
  );
}
