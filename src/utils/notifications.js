export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    console.log('Notifications enabled!');
  }
};

export const sendLocalNotification = (title, body) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: '/icon.svg',
    });
  }
};
