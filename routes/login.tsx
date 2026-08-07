import { page } from "fresh";
import {
  SESSION_IDLE_TTL_MS,
  SessionRepo,
  UserRepo,
} from "@/database/index.ts";
import { define, setSessionCookie, verifyPassword } from "@/utils/index.ts";

interface Data {
  error?: string;
}

export const handler = define.handlers<Data>({
  GET(_ctx) {
    return page({});
  },
  async POST(ctx) {
    const req = ctx.req;
    const form = await req.formData();
    const username = form.get("username")?.toString();
    const password = form.get("password")?.toString();

    if (!username || !password) {
      return page({ error: "Vul alle velden in." });
    }

    const user = await UserRepo.findByUsername(username);
    if (!user) {
      return page({ error: "Ongeldige inloggegevens." });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return page({ error: "Ongeldige inloggegevens." });
    }

    // Create session
    const session = await SessionRepo.create(user.id);

    const headers = new Headers();
    setSessionCookie(headers, session.id, SESSION_IDLE_TTL_MS / 1000);

    headers.set("location", "/shopping");
    return new Response(null, {
      status: 303,
      headers,
    });
  },
});

export default define.page(function Login({ data }) {
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
