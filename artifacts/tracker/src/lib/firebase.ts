import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  onSnapshot,
  arrayUnion,
} from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

// ─── Initialize Firebase App & Firestore ─────────────────────────────────────
const app = initializeApp(firebaseConfig);

// CRITICAL: Must pass firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// ─── Error Handling Infrastructure (Mandated by SKILL.md) ────────────────────
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ─── Connection Verification on Initial Boot (Mandated by SKILL.md) ──────────
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    console.info("[Firebase] Connected to Firestore database successfully.");
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
    return false;
  }
}

// Trigger connection verification on boot
testConnection().catch(() => {});

// ─── Authentication Helpers ──────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    console.error("[Firebase] Google Sign-in error:", err);
    throw err;
  }
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// ─── Firestore Operations ─────────────────────────────────────────────────────

export async function getPackageDoc(code: string) {
  const path = `packages/${code.toUpperCase()}`;
  try {
    const snap = await getDoc(doc(db, "packages", code.toUpperCase()));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function listPackagesDocs() {
  const path = "packages";
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => d.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function savePackageDoc(code: string, data: Record<string, any>) {
  const path = `packages/${code.toUpperCase()}`;
  try {
    await setDoc(doc(db, "packages", code.toUpperCase()), data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePackageDoc(code: string) {
  const path = `packages/${code.toUpperCase()}`;
  try {
    await deleteDoc(doc(db, "packages", code.toUpperCase()));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToPackage(code: string, onData: (data: any) => void) {
  const path = `packages/${code.toUpperCase()}`;
  return onSnapshot(
    doc(db, "packages", code.toUpperCase()),
    (snapshot) => {
      if (snapshot.exists()) {
        onData(snapshot.data());
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function saveNotificationEmailToFirestore(
  code: string,
  email: string,
  pkgData?: Record<string, any>
): Promise<{ success: boolean }> {
  const cleanCode = code.trim().toUpperCase();
  const cleanEmail = email.trim().toLowerCase();
  const pkgPath = `packages/${cleanCode}`;

  try {
    const pkgRef = doc(db, "packages", cleanCode);
    const existingSnap = await getDoc(pkgRef);

    if (existingSnap.exists()) {
      // Document exists: update with notify_email and append to notification_emails
      await updateDoc(pkgRef, {
        notify_email: cleanEmail,
        notification_emails: arrayUnion(cleanEmail),
        updated_at: new Date().toISOString(),
      });
    } else {
      // Initialize Firestore document with core package info + notification email
      await setDoc(
        pkgRef,
        {
          code: cleanCode,
          status: pkgData?.status || "In Transit",
          origin: pkgData?.origin || "Warehouse Hub",
          destination: pkgData?.destination || "Delivery Destination",
          carrier: pkgData?.carrier || "Tesla Logistics",
          weight: pkgData?.weight || "2.5 kg",
          eta: pkgData?.eta || "In Transit",
          speed_kph: typeof pkgData?.speed_kph === "number" ? pkgData.speed_kph : 65,
          start_progress: typeof pkgData?.start_progress === "number" ? pkgData.start_progress : 0.25,
          notify_email: cleanEmail,
          notification_emails: [cleanEmail],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    // Also store in subscribers collection
    const subId = `${cleanCode}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, "_")}`.slice(0, 120);
    const subRef = doc(db, "subscribers", subId);
    await setDoc(
      subRef,
      {
        code: cleanCode,
        email: cleanEmail,
        created_at: new Date().toISOString(),
      },
      { merge: true }
    );

    return { success: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pkgPath);
  }
}

export async function getNotificationEmailFromFirestore(code: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, "packages", code.toUpperCase()));
    if (snap.exists()) {
      const data = snap.data();
      return data.notify_email || (Array.isArray(data.notification_emails) && data.notification_emails[0]) || null;
    }
    return null;
  } catch {
    return null;
  }
}

