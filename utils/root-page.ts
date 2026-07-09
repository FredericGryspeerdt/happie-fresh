import { createDefine } from "fresh";
type Data = Record<string, never>;
// Setup, do this once in a file and import it everywhere else.
export const rootPage = createDefine<Data>();
