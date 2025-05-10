import { Handlers, PageProps } from "$fresh/server.ts";

interface Data {
  isLoggedIn: boolean;
}

export const handler: Handlers<Data> = {
  async GET(_req, ctx) {
    return await ctx.render();
  },
  async POST(req, ctx) {
    const form = await req.formData();
    const username = form.get("username")?.toString();
    const password = form.get("password")?.toString();
    const isLoggedIn = !!(username && password);
    console.log(username, password);
    return ctx.render({ isLoggedIn });
  },
};

export default function LoginPage({ data }: PageProps<Data>) {
  const { isLoggedIn } = data || {};
  console.log(isLoggedIn);
  return (
    <main>
      <h1>Login</h1>
      <p>This is the login page.</p>

      {isLoggedIn ? <p>Je bent ingelogd!</p> : (
        <form method="post">
          <input
            type="text"
            placeholder="Gebruikersnaam"
            name="username"
          />
          <input
            type="password"
            placeholder="Wachtwoord"
            name="password"
          />
          <button type="submit">Inloggen</button>
        </form>
      )}
    </main>
  );
}
