// Lazy so module load (cold start) does not pay for loading or setting up
// firebase-admin: the import itself happens on the first Firestore call.
import type { Firestore } from "firebase-admin/firestore";

let instance: Promise<Firestore> | undefined;

export function db() {
  instance ??= (async () => {
    const [{ initializeApp }, { getFirestore }] = await Promise.all([
      import("firebase-admin/app"),
      import("firebase-admin/firestore"),
    ]);
    return getFirestore(initializeApp());
  })();
  return instance;
}
