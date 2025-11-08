// app/notifications/[id]/page.tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";

interface NotificationData { eventId?: string }

// 👇 params is a Promise — await it first
export default async function NotificationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getServerSession();
  if (!session?.user?.id) return null;

  const notif = await db.notification.findUnique({ where: { id } });
  if (!notif || notif.userId !== session.user.id) return notFound();

  const notifData = (notif.data ?? {}) as Prisma.JsonValue;
  const parsed: NotificationData =
    typeof notifData === "object" && notifData !== null
      ? (notifData as NotificationData)
      : {};

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-2">{notif.title}</h1>
      <p className="text-white/80 mb-4">{notif.message}</p>
      {parsed.eventId && (
        <a href={`/events/${parsed.eventId}`} className="underline text-blue-200">
          Go to event
        </a>
      )}
    </div>
  );
}
