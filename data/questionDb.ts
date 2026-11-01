import { Category, Question } from '../types';
import { QUESTIONS_DB } from './questions';

const DB_NAME = 'TrivialPursuitLocalDB';
const DB_VERSION = 2; // Bump version to ensure clean migration
const STORE_NAME = 'questions';

// In-memory cache for fast, synchronous gameplay lookups
let inMemoryQuestions: Question[] = [...QUESTIONS_DB];
let isInitialized = false;

/**
 * Open or initialize IndexedDB
 */
const openIndexedDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB ist in dieser Umgebung nicht verfügbar'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('category', 'category', { unique: false });
      store.createIndex('minGrade', 'minGrade', { unique: false });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Initialize database and sync into in-memory cache.
 * Automatically discards any old procedurally generated questions ('gen_q_')
 * and restores the genuine handcrafted curriculum questions.
 */
export const initQuestionDatabase = async (): Promise<number> => {
  try {
    const db = await openIndexedDB();
    const stored = await getAllFromStore(db);

    // Filter out any previously generated questions
    const cleanStored = stored.filter(q => !q.id.startsWith('gen_q_'));

    if (cleanStored.length === 0 || cleanStored.length !== stored.length) {
      // Re-seed with pristine QUESTIONS_DB + any genuine custom imported questions
      const userCustomOnly = cleanStored.filter(
        q => !QUESTIONS_DB.some(orig => orig.id === q.id)
      );
      const combined = [...QUESTIONS_DB, ...userCustomOnly];
      
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      for (const q of combined) {
        store.put(q);
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      inMemoryQuestions = combined;
    } else {
      inMemoryQuestions = cleanStored;
    }

    isInitialized = true;
    return inMemoryQuestions.length;
  } catch (err) {
    console.warn('Fallback to in-memory questions due to IndexedDB issue:', err);
    inMemoryQuestions = [...QUESTIONS_DB];
    isInitialized = true;
    return inMemoryQuestions.length;
  }
};

const getAllFromStore = (db: IDBDatabase): Promise<Question[]> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as Question[]);
    req.onerror = () => reject(req.error);
  });
};

const putQuestionsInBatch = async (db: IDBDatabase, questions: Question[]): Promise<void> => {
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
    const chunk = questions.slice(i, i + CHUNK_SIZE);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const q of chunk) {
        store.put(q);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};

/**
 * Get all current questions (synchronous from memory cache)
 */
export const getActiveQuestions = (): Question[] => {
  return inMemoryQuestions;
};

/**
 * Returns question count
 */
export const getActiveQuestionCount = (): number => {
  return inMemoryQuestions.length;
};

/**
 * Save new questions (merge or replace)
 */
export const saveQuestionsToDb = async (
  newQuestions: Question[],
  mode: 'merge' | 'replace' = 'merge'
): Promise<number> => {
  let combined: Question[];
  if (mode === 'replace') {
    combined = newQuestions;
  } else {
    const existingMap = new Map<string, Question>();
    inMemoryQuestions.forEach(q => existingMap.set(q.id, q));
    newQuestions.forEach(q => existingMap.set(q.id, q));
    combined = Array.from(existingMap.values());
  }

  inMemoryQuestions = combined;

  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    if (mode === 'replace') {
      store.clear();
    }
    
    await putQuestionsInBatch(db, combined);
  } catch (err) {
    console.warn('Error saving to IndexedDB, stored in memory cache:', err);
  }

  return inMemoryQuestions.length;
};

/**
 * Reset database to original base questions from the curriculum
 */
export const resetQuestionsToDefault = async (): Promise<number> => {
  inMemoryQuestions = [...QUESTIONS_DB];
  try {
    const db = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      for (const q of QUESTIONS_DB) {
        store.put(q);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Reset in IndexedDB failed:', err);
  }
  return inMemoryQuestions.length;
};

/**
 * Synchronous, instant selection for game loop
 */
export const getGameQuestion = (
  category: Category,
  grade: number,
  excludedIds: string[] = []
): Question => {
  const pool = inMemoryQuestions.length > 0 ? inMemoryQuestions : QUESTIONS_DB;
  const allInCategory = pool.filter(q => q.category === category);
  
  if (allInCategory.length === 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Priority 1: Matching grade window (grade-2 .. grade)
  let matchingQuestions = allInCategory.filter(
    q => q.minGrade <= grade && q.minGrade >= Math.max(2, grade - 2)
  );

  // Priority 2: Any question <= player grade
  if (matchingQuestions.filter(q => !excludedIds.includes(q.id)).length === 0) {
    matchingQuestions = allInCategory.filter(q => q.minGrade <= grade);
  }

  // Priority 3: Any question in category
  let finalPool = matchingQuestions.filter(q => !excludedIds.includes(q.id));
  if (finalPool.length === 0) {
    finalPool = allInCategory.filter(q => !excludedIds.includes(q.id));
  }

  if (finalPool.length === 0) {
    return allInCategory[Math.floor(Math.random() * allInCategory.length)];
  }

  return finalPool[Math.floor(Math.random() * finalPool.length)];
};
