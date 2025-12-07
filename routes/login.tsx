import { PageProps } from "fresh";
import { Handlers } from "fresh/compat";

interface Data {
  isLoggedIn: boolean;
}

export const handler: Handlers<Data> = {
  async GET(ctx) {
    return await ctx.render();
  },
  async POST(ctx) {
    const req = ctx.req;
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
