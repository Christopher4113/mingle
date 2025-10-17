import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";

type Props = { params: { id: string } };

// Define the expected shape of notif.data (if stored as JSON in Prisma)
interface NotificationData {
  eventId?: string;
}

export default async function NotificationDetail({ params }: Props) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    // middleware should have redirected, but just in case
    return null;
  }

  const notif = await db.notification.findUnique({
    where: { id: params.id },
  });

  if (!notif || notif.userId !== session.user.id) {
    return notFound();
  }

  // Parse notif.data safely (avoid `any`)
  const notifData = (notif.data ?? {}) as Prisma.JsonValue;
  const parsedData: NotificationData =
    typeof notifData === "object" && notifData !== null
      ? (notifData as NotificationData)
      : {};

  const eventId = parsedData.eventId;

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-2">{notif.title}</h1>
      <p className="text-white/80 mb-4">{notif.message}</p>

      {eventId && (
        <a href={`/events/${eventId}`} className="underline text-blue-200">
          Go to event
        </a>
      )}
    </div>
  );
}
