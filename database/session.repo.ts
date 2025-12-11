import { getKv } from "../db.ts";
import { SessionInterface } from "../../models/index.ts";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

export class SessionRepo {
  static async create(userId: string): Promise<SessionInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session: SessionInterface = { id, userId, expiresAt };

    await kv.set(["sessions", id], session, {
      expireIn: SESSION_TTL_MS,
    });
    return session;
  }

  static async findById(id: string): Promise<SessionInterface | null> {
    const kv = await getKv();
    const session = await kv.get<SessionInterface>(["sessions", id]);
    return session.value;
  }

  static async delete(id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["sessions", id]);
  }
}
