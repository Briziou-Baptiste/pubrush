import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermissions() {
  const settings = await Notifications.getPermissionsAsync();

  if (settings.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleFiveMinutesLeftNotification(stopName: string, secondsUntilTrigger: number) {
  if (secondsUntilTrigger <= 0) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Plus que 5 minutes',
      body: `Il te reste 5 minutes dans ${stopName}.`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilTrigger,
    },
  });
}

export async function scheduleOvertimeNotification(stopName: string, secondsUntilTrigger: number) {
  if (secondsUntilTrigger <= 0) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Temps dépassé',
      body: `Le temps maximum est dépassé pour ${stopName}.`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilTrigger,
    },
  });
}

export async function cancelNotification(notificationId: string | null) {
  if (!notificationId) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelStopNotifications(ids: {
  fiveMin: string | null;
  overtime: string | null;
}) {
  await cancelNotification(ids.fiveMin);
  await cancelNotification(ids.overtime);
}
