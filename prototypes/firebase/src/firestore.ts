// Lazy so module load (cold start) does not pay for loading or setting up
// firebase-admin: the import itself happens on the first Firestore call.
import type { Firestore } from "firebase-admin/firestore";

let instance: Promise<Firestore> | undefined;

export function db() {
  instance ??= (async () => {
    const [{ initializeApp }, { initializeFirestore }] = await Promise.all([
      import("firebase-admin/app"),
      import("firebase-admin/firestore"),
    ]);
    // REST over HTTP/1.1 skips gRPC channel setup on the first call; it
    // switches to gRPC only for streaming methods, which Happie does not use.
    return initializeFirestore(initializeApp(), { preferRest: true });
  })();
  return instance;
}
