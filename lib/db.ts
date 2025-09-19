import { openDB } from "idb";

const DB_NAME = "gbaweb";
const STORE_NAME = "saves";
const DB_VERSION = 1;

let dbPromise;

async function getDatabase() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

export async function setSave(key, value) {
  const db = await getDatabase();
  await db.put(STORE_NAME, value, key);
}

export async function getSave(key) {
  const db = await getDatabase();
  return db.get(STORE_NAME, key);
}

export async function removeSave(key) {
  const db = await getDatabase();
  await db.delete(STORE_NAME, key);
}

export async function listSaves() {
  const db = await getDatabase();
  return db.getAllKeys(STORE_NAME);
}

export const SAVES_STORE_NAME = STORE_NAME;
