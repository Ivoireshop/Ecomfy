import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBYUyP1HiA8mBOn7YZzwJaGxKAcF5gMAtU",
  authDomain: "visualpro-shops.firebaseapp.com",
  projectId: "visualpro-shops",
  storageBucket: "visualpro-shops.firebasestorage.app",
  messagingSenderId: "197251478839",
  appId: "1:197251478839:web:04d733d53ca526446f56b2",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

let _messaging: Messaging | null = null;

export async function getMessagingInstance(): Promise<Messaging | null> {
  if (_messaging) return _messaging;
  if (!(await isSupported().catch(() => false))) return null;
  _messaging = getMessaging(firebaseApp);
  return _messaging;
}

export { getToken, onMessage };