// Lazy so module load (cold start) does not pay for Firestore client setup.
import { initializeApp } from "firebase-admin/app";
import { type Firestore, getFirestore } from "firebase-admin/firestore";

let instance: Firestore | undefined;

export function db() {
  instance ??= getFirestore(initializeApp());
  return instance;
}
