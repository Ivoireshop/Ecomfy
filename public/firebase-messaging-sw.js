importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBYUyP1HiA8mBOn7YZzwJaGxKAcF5gMAtU",
  authDomain: "visualpro-shops.firebaseapp.com",
  projectId: "visualpro-shops",
  storageBucket: "visualpro-shops.firebasestorage.app",
  messagingSenderId: "197251478839",
  appId: "1:197251478839:web:04d733d53ca526446f56b2",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon, click_action } = payload.notification || {};
  const data = payload.data || {};
  const orderId = data.order_id || Date.now().toString();
  if (!payload.notification) {
    self.registration.showNotification(data.title || '💰 Nouvelle commande VisualPro', {
      body: data.body || "Une nouvelle commande vient d'arriver.",
      icon: icon || '/app-icon-512.png',
      badge: '/app-icon-512.png',
      tag: `visualpro-order-${orderId}`,
      data: { url: click_action || data.url || '/', order_id: data.order_id },
      requireInteraction: true,
      vibrate: [300, 80, 300, 80, 700],
      renotify: false,
      silent: false,
    });
  }
  // Notify any open page so it can play the VisualPro cash sound in foreground.
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    cs.forEach((c) => c.postMessage({ type: 'vp-new-order', order_id: data.order_id }));
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) { if (c.url.includes(url) && 'focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
