// THROWAWAY: the D1 transaction probes, expressed in Firestore terms.
import type { Firestore } from "firebase-admin/firestore";

export async function probeStorage(db: Firestore) {
  const id = crypto.randomUUID();
  const entry = db.collection("prototype_entries").doc(id);
  await entry.set({ listId: "source", revision: 0 });

  // Two competing moves: optimistic-concurrency retry must leave one winner.
  const move = () =>
    db.runTransaction(async (tx) => {
      const snap = await tx.get(entry);
      if (snap.get("revision") !== 0) throw new Error("stale move");
      tx.update(entry, { listId: "destination", revision: 1 });
      tx.create(db.collection("prototype_receipts").doc(), { entry: id });
    });
  const contenders = await Promise.allSettled([move(), move()]);
  const moved = (await entry.get()).data();

  // A failing transaction must leave no partial write.
  const rollback = await Promise.allSettled([
    db.runTransaction(async (tx) => {
      tx.update(entry, { listId: "broken", revision: 2 });
      throw new Error("abort");
    }),
  ]);
  const afterRollback = (await entry.get()).data();

  // Atomic claim: create() fails if the document exists.
  const claims = await Promise.allSettled(
    [0, 1].map(() => db.collection("prototype_claims").doc(id).create({ at: new Date() })),
  );

  // A deleted session must not be recreated by a stale renewal.
  await entry.delete();
  const renewal = await Promise.allSettled([entry.update({ revision: 2 })]);
  const recreated = (await entry.get()).exists;

  const result = {
    raceWinners: contenders.filter((r) => r.status === "fulfilled").length,
    moved,
    rollbackRejected: rollback[0].status === "rejected",
    rollbackPreserved: JSON.stringify(moved) === JSON.stringify(afterRollback),
    claimWinners: claims.filter((r) => r.status === "fulfilled").length,
    staleRenewalRejected: renewal[0].status === "rejected",
    recreated,
  };
  return {
    ...result,
    passed: result.raceWinners === 1 && moved?.listId === "destination" &&
      moved.revision === 1 && result.rollbackRejected &&
      result.rollbackPreserved && result.claimWinners === 1 &&
      result.staleRenewalRejected && !recreated,
  };
}
