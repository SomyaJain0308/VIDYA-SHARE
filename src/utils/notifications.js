export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return;

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    console.log("Notifications enabled!");
  }
};

export const sendLocalNotification = (title, body) => {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body: body,
      icon: '/icon.svg',
    });
  }
};
