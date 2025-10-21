"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

function timeAgo(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
  return `${Math.floor(diff / 86400)} days ago`
}

function getCookie(name: string) {
  if (typeof document === "undefined") return undefined
  const m = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"))
  return m ? decodeURIComponent(m[2]) : undefined
}

function authHeaders(): HeadersInit {
  const token = getCookie("token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function jsonAuthHeaders(): HeadersInit {
  return { "Content-Type": "application/json", ...authHeaders() }
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
function pct(a: number, b: number) {
  if (!b) return 0
  return Math.min(100, Math.max(0, (a / b) * 100))
}

type DiscoverEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  category: string;
  attendees: number;
  maxAttendees: number;
  inviteOnly: boolean;
  hostName: string;
  isFull: boolean;
};


type NotifType =
  | "EVENT_INVITE"
  | "EVENT_UPDATE"
  | "EVENT_REMINDER"
  | "EVENT_CANCELLED"
  | "NEW_FOLLOWER"
  | "EVENT_JOINED"

type Notif = {
  id: string
  type: NotifType
  title: string
  message: string
  data?: {
    eventId?: string
    eventTitle?: string
    actorId?: string
    actorUsername?: string
    creatorId?: string
    creatorUsername?: string
  } | null
  read: boolean
  createdAt: string
  icon: string
}

type NotificationsResponse = {
  ok: boolean
  notifications: Notif[]
}

const Page = () => {
  const { data: session, status } = useSession()
  const [selectedCategory, setSelectedCategory] = useState<string>("All")
  const [notifications, setNotifications] = useState<Notif[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [discover, setDiscover] = useState<DiscoverEvent[]>([]);

  const loadNotifications = useCallback(async () => {
    await fetch("/api/set-token", { method: "GET", credentials: "include" })
    const res = await fetch("/api/users/notifications?onlyUnread=1", {
      credentials: "include",
      headers: authHeaders(),
    })
    if (!res.ok) return
    const data: NotificationsResponse = await res.json()
    if (data?.ok && Array.isArray(data.notifications)) {
      setNotifications(data.notifications)
    }
  }, [])


  const loadDiscover = useCallback(async () => {
    await fetch("/api/set-token", { method: "GET", credentials: "include" });
    const res = await fetch("/api/users/menu", { credentials: "include", headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.ok && Array.isArray(data.events)) setDiscover(data.events);
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      void fetch("/api/set-token", { method: "GET", credentials: "include" })
      void loadNotifications()
      void loadDiscover();
    }
  }, [status, loadNotifications, loadDiscover])

  
  const markAsRead = async (id: string) => {
    // optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    try {
      const res = await fetch("/api/users/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ id, action: "read" }),
      })
      if (!res.ok) throw new Error("Failed to mark read")
      // no refetch needed because we already removed it
    } catch  {
      // rollback if something went wrong
      await loadNotifications()
    }
  }

  const markAllAsRead = async () => {
    const toMark = notifications.map((n) => n.id)
    // optimistic clear
    setNotifications([])
    try {
      await Promise.all(
        toMark.map((id) =>
          fetch("/api/users/notifications", {
            method: "PATCH",
            credentials: "include",
            headers: jsonAuthHeaders(),
            body: JSON.stringify({ id, action: "read" }),
          })
        )
      )
    } catch {
      await loadNotifications()
    }
  }
  


  const handleAcceptInvite = async (id: string) => {
    await fetch("/api/users/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: jsonAuthHeaders(),
      body: JSON.stringify({ id, action: "accept_invite" }),
    })
    await loadNotifications()
  }

  const handleDeclineInvite = async (id: string) => {
    await fetch("/api/users/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: jsonAuthHeaders(),
      body: JSON.stringify({ id, action: "decline_invite" }),
    })
    await loadNotifications()
  }


  const unreadCount = notifications.filter((n) => !n.read).length

  async function handleJoin(eventId: string) {
    await fetch("/api/set-token", { method: "GET", credentials: "include" });
    const res = await fetch(`/api/users/events/${eventId}/join`, {
      method: "POST",
      credentials: "include",
      headers: jsonAuthHeaders(),
    });
    const data = await res.json();
    if (!data?.ok) {
      alert(data?.error ?? "Unable to join");
      return;
    }
    // Soft refresh list so full/attendee counts update or the event disappears if you joined
    await loadDiscover();
    alert(data.status === "ATTENDING" ? "You joined the event" : "Request sent to the host");
  }

  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)" }}
      >
        <div className="text-center">
          <div className="text-6xl mb-4">👥</div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Required</h2>
          <p className="text-white/80 mb-6">Please login to see your Mingle dashboard</p>
          <Link href="/login">
            <Button className="bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all duration-300">
              Go to Login
            </Button>
          </Link>
        </div>
      </div>
    )
  }



  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)" }}>
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Welcome back, {session?.user.username || session?.user.name}!
            </h1>
            <p className="text-white/80">Ready to connect and discover amazing events?</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNotifications((s) => !s)}
              className="relative bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all duration-300 px-4 py-2 rounded-lg"
            >
              <span className="text-xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <Button
              variant="destructive"
              onClick={async () => {
                await fetch("/api/users/logout")
                signOut()
              }}
              className="bg-red-500/20 backdrop-blur-sm border border-red-300/30 text-white hover:bg-red-500/30"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {showNotifications && (
          <div className="mb-8 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Notifications</h2>
                <p className="text-white/70 text-sm">
                  {unreadCount > 0
                    ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                    : "You're all caught up!"}
                </p>
              </div>
              {unreadCount > 0 && (
                <Button
                  onClick={markAllAsRead}
                  className="bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all duration-300"
                >
                  Mark all as read
                </Button>
              )}
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {notifications.map((n) => {
                // Pull structured usernames if backend added them to `data`
                const actor = n.data?.actorUsername;       // the person who joined / requested
                const creatorU = n.data?.creatorUsername;  // the host who approved/declined

                // Prefer structured usernames to craft a clearer line; fall back to original message
                let displayMsg = n.message;
                if (n.type === "EVENT_JOINED" && actor) {
                  displayMsg = `${actor} joined your event.`;
                } else if (n.title === "Join Request" && actor) {
                  displayMsg = `${actor} requested to join your invite only event.`;
                } else if (n.title === "Request Approved" && creatorU) {
                  displayMsg = `You have been accepted to "${n.data?.eventTitle ?? "the event"}" by ${creatorU}.`;
                } else if (n.title === "Request Declined" && creatorU) {
                  displayMsg = `Your request to join "${n.data?.eventTitle ?? "the event"}" was declined by ${creatorU}.`;
                }

                return (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                      n.read
                        ? "bg-white/5 border-white/10 hover:bg-white/10"
                        : "bg-white/15 border-white/30 hover:bg-white/20"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-3xl flex-shrink-0">{n.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <h3 className={`font-semibold ${n.read ? "text-white/80" : "text-white"}`}>
                            {n.title}
                            {/* username chips beside title when we know who */}
                            {n.title === "Join Request" && actor ? (
                              <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">@{actor}</span>
                            ) : null}
                            {(n.title === "Request Approved" || n.title === "Request Declined") && creatorU ? (
                              <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">@{creatorU}</span>
                            ) : null}
                          </h3>
                          {!n.read && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-400" />}
                        </div>

                        <p className={`mb-2 text-sm ${n.read ? "text-white/60" : "text-white/80"}`}>
                          {displayMsg}
                        </p>

                        {n.type === "EVENT_INVITE" && (
                          <div className="mb-2 flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-500/80 text-white hover:bg-green-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleAcceptInvite(n.id);
                              }}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="bg-red-500/80 text-white hover:bg-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDeclineInvite(n.id);
                              }}
                            >
                              Decline
                            </Button>
                          </div>
                        )}

                        <p className="text-xs text-white/50">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Link href="/profile">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/20 transition-all duration-300 cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="text-4xl">👤</div>
                <div>
                  <h3 className="text-xl font-semibold text-white group-hover:text-white/90">My Profile</h3>
                  <p className="text-white/70">View and edit your profile information</p>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/create">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/20 transition-all duration-300 cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="text-4xl">➕</div>
                <div>
                  <h3 className="text-xl font-semibold text-white group-hover:text-white/90">Your Events</h3>
                  <p className="text-white/70">Host your own or join networking event</p>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Events Section */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Discover Events</h2>
            <div className="flex gap-2">
              {["All", "Networking", "Social", "Learning", "Creative", "Wellness"].map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                    selectedCategory === category
                      ? "bg-white/30 text-white border border-white/40"
                      : "bg-white/10 text-white/80 border border-white/20 hover:bg-white/20"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {(selectedCategory === "All"
              ? discover
              : discover.filter(e => e.category === selectedCategory)
            ).map((event) => (
              <div
                key={event.id}
                className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_60px_-12px_rgba(0,0,0,0.55)]"
              >
                {/* subtle gradient glow */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_circle_at_0%_0%,rgba(255,255,255,0.08),transparent_40%),radial-gradient(600px_circle_at_100%_0%,rgba(255,255,255,0.06),transparent_40%)]" />

                <div className="relative z-10">
                  {/* header */}
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="line-clamp-1 text-xl font-semibold text-white/95">{event.title}</h3>
                    <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-xs text-white/80">
                      {event.category}
                    </span>
                  </div>

                  {/* meta */}
                  <div className="mb-3 space-y-2 text-sm text-white/85">
                    <div className="flex items-center gap-2">
                      <span>📅</span>
                      <span className="line-clamp-1">{fmtDateTime(event.startsAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📍</span>
                      <span className="line-clamp-1">{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>👥</span>
                      <span>
                        {event.attendees} / {event.maxAttendees} attending
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>👤</span>
                      <span className="line-clamp-1">Host: {event.hostName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{event.inviteOnly ? "🔒" : "🌍"}</span>
                      <span>{event.inviteOnly ? "Invite Only" : "Open to Everyone"}</span>
                    </div>
                  </div>

                  {/* capacity bar */}
                  <div className="mb-4">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-white/80 transition-[width] duration-500 group-hover:bg-white"
                        style={{ width: `${pct(event.attendees, event.maxAttendees)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-right text-[11px] uppercase tracking-wide text-white/50">
                      {pct(event.attendees, event.maxAttendees)}% filled
                    </div>
                  </div>

                  {/* action */}
                  <Button
                    disabled={event.isFull}
                    onClick={() => handleJoin(event.id)}
                    className={[
                      "w-full rounded-xl border border-white/30 bg-white/15 px-4 py-2 font-semibold text-white",
                      "transition-all duration-200 hover:bg-white/25 hover:shadow-[inset_0_0_0_999px_rgba(255,255,255,0.04)]",
                      event.isFull ? "cursor-not-allowed opacity-60" : "",
                    ].join(" ")}
                  >
                    {event.isFull ? "Event Full" : event.inviteOnly ? "Request to Join" : "Join Event"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="mt-8 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">🤖 AI Recommendations</h2>
          <p className="text-white/80 mb-4">
            Based on your interests and networking history, we think you would love these events:
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">Design Thinking Workshop</h4>
              <p className="text-white/70 text-sm">Perfect match for your creative background</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">Blockchain Meetup</h4>
              <p className="text-white/70 text-sm">Trending in your network</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">Leadership Summit</h4>
              <p className="text-white/70 text-sm">Based on your career goals</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Page
