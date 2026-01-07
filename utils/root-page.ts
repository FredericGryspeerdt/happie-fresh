import { createDefine } from "fresh";
interface Data {
}
// Setup, do this once in a file and import it everywhere else.
export const rootPage = createDefine<Data>();
