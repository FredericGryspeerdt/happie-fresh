import { createDefine } from "fresh";
interface LoginPageData {
  error?: string;
}
// Setup, do this once in a file and import it everywhere else.
export const loginPage = createDefine<LoginPageData>();
