import { page, PageProps } from "fresh";
import { Handlers } from "fresh/compat";
import { setCookie } from "$std/http/cookie.ts";
import { UserRepo, SessionRepo } from "@/database/index.ts";
import { hashPassword } from "@/utils/index.ts";
import { loginPage } from "../utils/login-page.ts";
import { l } from "../_fresh/server/server-entry.mjs";

interface Data {
  error?: string;
}

export const handler = loginPage.handlers<Data>({
  GET(_ctx) {
    return page({});
  },
  async POST(ctx) {
    const req = ctx.req;
    const form = await req.formData();
    const username = form.get("username")?.toString();
    console.log("🚀 ~ username:", username);
    const password = form.get("password")?.toString();
    console.log("🚀 ~ password:", password);

    if (!username || !password) {
      return page({ error: "Vul alle velden in." });
    }

    const user = await UserRepo.findByUsername(username);
    console.log("🚀 ~ user:", user);
    if (!user) {
      return page({ error: "Ongeldige inloggegevens." });
    }

    const passwordHash = await hashPassword(password);
    console.log("🚀 ~ passwordHash:", passwordHash);
    if (user.passwordHash !== passwordHash) {
      return page({ error: "Ongeldige inloggegevens." });
    }

    // Create session
    const session = await SessionRepo.create(user.id);

    const headers = new Headers();
    setCookie(headers, {
      name: "sessionId",
      value: session.id,
      maxAge: 60 * 60 * 24, // 24 hours
      sameSite: "Lax",
      domain: ctx.url.hostname,
      path: "/",
      secure: true,
    });

    headers.set("location", "home");
    return new Response(null, {
      status: 303,
      headers,
    });
  },
});

export default loginPage.page(function Login({ data }) {
  const { error } = data || {};

  return (
    <main>
      <h1>Login</h1>
      <p>This is the login page.</p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form method="post">
        <input
          type="text"
          placeholder="Gebruikersnaam"
          name="username"
          class="border p-2 mr-2"
        />
        <input
          type="password"
          placeholder="Wachtwoord"
          name="password"
          class="border p-2 mr-2"
        />
        <button type="submit" class="bg-blue-500 text-white p-2 rounded">
          Inloggen
        </button>
      </form>
    </main>
  );
});
