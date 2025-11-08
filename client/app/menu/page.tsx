"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import toast from "react-hot-toast";

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

function isRecOut(v: unknown): v is RecOut {
  if (typeof v !== "object" || v === null) return false
  const obj = v as Record<string, unknown>
  return obj.ok === true && Array.isArray(obj.recommendations)
}

function isConnectRequest(n: Notif) {
  return n.title === "Connection Request" || n.data?.kind === "CONNECT_REQUEST";
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
    kind?: "CONNECT_REQUEST" | "CONNECT_ACCEPTED" | "CONNECT_DECLINED" | "CONNECT_ACCEPTED_CONFIRM"
  } | null
  read: boolean
  createdAt: string
  icon: string
}

type NotificationsResponse = {
  ok: boolean
  notifications: Notif[]
}

type UserMe = {
  id: string
  username?: string | null
  name?: string | null
  email?: string | null
  profileImageUrl?: string | null
  bio?: string | null
  location?: string | null
  interests: string[]
  connections: number
  createdAt: string
  updateAt: string
  events: number
}

type MeResp = { ok: boolean; user: UserMe }

type RecItem = { name: string; score: number; reason: string }
type RecOut = {
  ok: boolean
  user_id: string
  created_user: boolean
  added_bio_now: boolean
  has_bio_after: boolean
  recommendations: RecItem[]
}



const Page = () => {
  const { data: session, status } = useSession()
  const [selectedCategory, setSelectedCategory] = useState<string>("All")
  const [notifications, setNotifications] = useState<Notif[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [discover, setDiscover] = useState<DiscoverEvent[]>([]);
  const [me, setMe] = useState<UserMe | null>(null)
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)
  const [recEvents, setRecEvents] = useState<DiscoverEvent[]>([])
  const [recMeta, setRecMeta] = useState<Record<string, { reason: string; score: number }>>({})


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

  const loadMe = useCallback(async () => {
    await fetch("/api/set-token", { method: "GET", credentials: "include" })
    const res = await fetch("/api/users/me", {
      credentials: "include",
      headers: authHeaders(),
    })
    if (!res.ok) return
    const data: MeResp = await res.json()
    if (data?.ok && data.user) setMe(data.user)
  }, [])


  const loadDiscover = useCallback(async () => {
    await fetch("/api/set-token", { method: "GET", credentials: "include" })
    const res = await fetch("/api/users/menu", {  // 👈 updated
      credentials: "include",
      headers: authHeaders(),
    })
    if (!res.ok) return
    const data = await res.json()
    if (data?.ok && Array.isArray(data.events)) setDiscover(data.events)
  }, [])

  

  useEffect(() => {
    if (status === "authenticated") {
      void fetch("/api/set-token", { method: "GET", credentials: "include" })
      void loadNotifications()
      void loadDiscover();
      void loadMe();
    }
  }, [status, loadNotifications, loadDiscover, loadMe])

  
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
      toast.error(data?.error ?? "Unable to join");
      return;
    }
    // Soft refresh list so full/attendee counts update or the event disappears if you joined
    await loadDiscover();
    toast.error(data.status === "ATTENDING" ? "You joined the event" : "Request sent to the host");
  }

  const runEventRecs = useCallback(async () => {
    if (!me) return
    setRecLoading(true)
    setRecError(null)

    try {
      await fetch("/api/set-token", { method: "GET", credentials: "include" })

      const snippets = discover.map(
        (e) => `${e.title} | ${e.category} | ${e.location} | ${e.description}`
      )
      const events = discover.map((e) => e.title)

      const res = await fetch("/api/users/menu/recommendations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: me.bio ?? "",
          location: me.location ?? "",
          interests: Array.isArray(me.interests) ? me.interests : [],
          snippets,
          events,
        }),
      })

      // Parse once as unknown so we can narrow safely
      const json: unknown = await res.json()

      // If the proxy/fastapi returned an error JSON, surface it
      if (!res.ok) {
        const errMsg =
          json && typeof json === "object" && "error" in json
            ? String((json as { error?: unknown }).error ?? "Recommendation failed")
            : "Recommendation failed"
        throw new Error(errMsg)
      }

      // Success path: ensure it matches RecOut
      if (!isRecOut(json)) {
        throw new Error("Unexpected response shape from recommendations API")
      }
      const data = json // typed as RecOut by the guard

      // Map recs back to concrete events by title, sort by score desc
      const meta: Record<string, { reason: string; score: number }> = {}
      const nameToEvent = new Map(discover.map((e) => [e.title, e]))
      const chosen: DiscoverEvent[] = []

      data.recommendations
        .slice() // don’t mutate original
        .sort((a, b) => b.score - a.score)
        .forEach((r) => {
          const evt = nameToEvent.get(r.name)
          if (evt) {
            chosen.push(evt)
            meta[evt.id] = { reason: r.reason, score: r.score }
          }
        })

      setRecEvents(chosen)
      setRecMeta(meta)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch recommendations"
      setRecError(msg)
    } finally {
      setRecLoading(false)
    }
  }, [me, discover])

  // Accept a connection request from actorId, then mark this notif as read
  const handleAcceptConnect = async (actorId: string, notifId: string) => {
    await fetch(`/api/users/connect/${actorId}`, {
      method: "PATCH",
      credentials: "include",
      headers: jsonAuthHeaders(),
      body: JSON.stringify({ action: "accept" }),
    });
    // Mark this notification as read (or you could delete it)
    await fetch("/api/users/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: jsonAuthHeaders(),
      body: JSON.stringify({ id: notifId, action: "read" }),
    });
    await loadNotifications();
  };

  const handleDeclineConnect = async (actorId: string, notifId: string) => {
    await fetch(`/api/users/connect/${actorId}`, {
      method: "PATCH",
      credentials: "include",
      headers: jsonAuthHeaders(),
      body: JSON.stringify({ action: "decline" }),
    });
    await fetch("/api/users/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: jsonAuthHeaders(),
      body: JSON.stringify({ id: notifId, action: "read" }),
    });
    await loadNotifications();
  };

  const markOrClose = async (n: Notif) => {
    if (isConnectRequest(n) && n.data?.actorId) {
      await handleDeclineConnect(n.data.actorId, n.id);
    } else {
      await markAsRead(n.id);
    }
  };


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
              Welcome back, {me?.username || me?.name || session?.user.username || session?.user.name}!
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
                  displayMsg = `${actor} requested to join ${n.data?.eventTitle ?? "the event"}.`;
                } else if (n.title === "Request Approved" && creatorU) {
                  displayMsg = `You have been accepted to "${n.data?.eventTitle ?? "the event"}" by ${creatorU}.`;
                } else if (n.title === "Request Declined" && creatorU) {
                  displayMsg = `Your request to join "${n.data?.eventTitle ?? "the event"}" was declined by ${creatorU}.`;
                }

                return (
                  <div
                    key={n.id}
                    onClick={() => markOrClose(n)}
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
                            {n.title === "Join Request" && n.data?.eventId && actor &&(
                              <div className="mb-2">
                                <Link
                                  href={`/events/${n.data.eventId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-block"
                                >
                                  <Button
                                    size="sm"
                                    className="bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all duration-300"
                                  >
                                    View event
                                  </Button>
                                </Link>
                              </div>
                            )}
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

                        {(n.title === "Connection Request" || n.data?.kind === "CONNECT_REQUEST") && n.data?.actorId && (
                          <div className="mb-2 flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-500/80 text-white hover:bg-green-600"
                              onClick={(e) => {
                                e.stopPropagation(); // don't trigger the container click (markAsRead)
                                void handleAcceptConnect(n.data!.actorId!, n.id);
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
                                void handleDeclineConnect(n.data!.actorId!, n.id);
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
        <div className="mt-8 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white">🤖 AI Recommendations</h2>
              <p className="text-white/80">
                Based on your interests and networking history, we’ll suggest events you’ll probably like.
              </p>
            </div>

            <Button
              onClick={runEventRecs}
              disabled={recLoading || !me || discover.length === 0}
              className="bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all duration-300"
              title={!me ? "Load your profile first" : (discover.length === 0 ? "No events to rank" : "Get recommendations")}
            >
              {recLoading ? "Finding…" : "Get recommendations"}
            </Button>
          </div>

          {recError && (
            <div className="mb-4 rounded-lg border border-red-300/40 bg-red-500/20 p-3 text-sm text-white">
              {recError}
            </div>
          )}

          {/* Cards appear only after we have recs */}
          {recEvents.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-4">
              {recEvents.map((event) => (
                <div key={event.id} className="relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                  <h4 className="font-semibold text-white mb-1">{event.title}</h4>
                  <p className="text-white/70 text-sm mb-3">
                    {recMeta[event.id]?.reason || "Recommended for you"}
                  </p>

                  <div className="text-white/80 text-sm space-y-1 mb-4">
                    <div className="flex items-center gap-2">
                      <span>📍</span><span className="line-clamp-1">{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🏷️</span><span>{event.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>👥</span><span>{event.attendees} / {event.maxAttendees} attending</span>
                    </div>
                  </div>

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
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-white/70 text-sm">
              Click <span className="text-white font-medium">Get recommendations</span> to see personalized picks.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Page
