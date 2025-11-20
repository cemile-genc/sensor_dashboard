import { ref, set, onValue, off } from "firebase/database";
import { db } from "../firebaseConfig";

export const readPrefs = (uid, cb) => {
  const r = ref(db, `/users/${uid}/prefs`);
  onValue(r, (snap) => cb(snap.val() || {}));
  return () => off(r);
};

export const writePrefs = (uid, prefs) =>
  set(ref(db, `/users/${uid}/prefs`), prefs ?? {});
