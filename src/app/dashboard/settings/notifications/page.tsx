import { NotificationManagement } from "@/components/notification-management";
import { getNotificationView } from "@/services/notifications";
import { safeConfigurationStatus } from "@/lib/notifications/config";
export default async function NotificationsPage() {
  const view = await getNotificationView();
  return (
    <NotificationManagement
      {...view}
      configuration={safeConfigurationStatus()}
    />
  );
}
