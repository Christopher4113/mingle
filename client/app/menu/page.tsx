"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRouter } from "next/navigation"

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

const sampleEvents = [
  { id: 1, title: "Professional Networking Mixer", date: "Dec 15, 2024", time: "6:00 PM", location: "Downtown Convention Center", attendees: 45, category: "Networking" },
  { id: 2, title: "Creative Professionals Meetup", date: "Dec 18, 2024", time: "7:30 PM", location: "Art District Gallery", attendees: 32, category: "Creative" },
  { id: 3, title: "Social Impact Happy Hour", date: "Dec 20, 2024", time: "5:30 PM", location: "Community Center", attendees: 28, category: "Social" },
  { id: 4, title: "AI & Machine Learning Workshop", date: "Dec 22, 2024", time: "2:00 PM", location: "Tech Campus Building A", attendees: 67, category: "Learning" },
  { id: 5, title: "Mindfulness & Wellness Retreat", date: "Dec 25, 2024", time: "10:00 AM", location: "Wellness Center", attendees: 24, category: "Wellness" },
]

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
  data?: { eventId?: string; eventTitle?: string } | null
  read: boolean
  createdAt: string
  icon: string
}

type NotificationsResponse = {
  ok: boolean
  notifications: Notif[]
}

const Page = () => {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [selectedCategory, setSelectedCategory] = useState<string>("All")
  const [notifications, setNotifications] = useState<Notif[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  const loadNotifications = useCallback(async () => {
    await fetch("/api/set-token", { method: "GET", credentials: "include" })
    const res = await fetch("/api/users/notifications", {
      credentials: "include",
      headers: authHeaders(),
    })
    if (!res.ok) return
    const data: NotificationsResponse = await res.json()
    if (data?.ok && Array.isArray(data.notifications)) {
      // keep ISO string for timeAgo()
      setNotifications(data.notifications)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") {
      void fetch("/api/set-token", { method: "GET", credentials: "include" })
      void loadNotifications()
    }
  }, [status, loadNotifications])

  const markAllAsRead = async () => {
    const toMark = notifications.filter((n) => !n.read)
    await Promise.all(
      toMark.map((n) =>
        fetch("/api/users/notifications", {
          method: "PATCH",
          credentials: "include",
          headers: jsonAuthHeaders(),
          body: JSON.stringify({ id: n.id, action: "read" }),
        })
      )
    )
    await loadNotifications()
  }

  const markAsRead = async (id: string) => {
    await fetch("/api/users/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: jsonAuthHeaders(),
      body: JSON.stringify({ id, action: "read" }),
    })
    await loadNotifications()
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

  const filteredEvents =
    selectedCategory === "All" ? sampleEvents : sampleEvents.filter((event) => event.category === selectedCategory)

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
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                    notification.read
                      ? "bg-white/5 border-white/10 hover:bg-white/10"
                      : "bg-white/15 border-white/30 hover:bg-white/20"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-3xl flex-shrink-0">{notification.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className={`font-semibold ${notification.read ? "text-white/80" : "text-white"}`}>
                          {notification.title}
                        </h3>
                        {!notification.read && <span className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0 mt-2" />}
                      </div>

                      <p className={`text-sm mb-2 ${notification.read ? "text-white/60" : "text-white/80"}`}>
                        {notification.message}
                      </p>

                      {notification.type === "EVENT_INVITE" && (
                        <div className="flex gap-2 mb-2">
                          <Button
                            size="sm"
                            className="bg-green-500/80 text-white hover:bg-green-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleAcceptInvite(notification.id)
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="bg-red-500/80 text-white hover:bg-red-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleDeclineInvite(notification.id)
                            }}
                          >
                            Decline
                          </Button>
                        </div>
                      )}

                      <p className="text-xs text-white/50">{timeAgo(notification.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
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
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 hover:bg-white/20 transition-all duration-300 cursor-pointer group"
                onClick={() => router.push(`/events/${event.id}`)}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-white group-hover:text-white/90">{event.title}</h3>
                  <span className="text-xs bg-white/20 text-white px-2 py-1 rounded-full">{event.category}</span>
                </div>
                <div className="space-y-2 text-white/80 text-sm">
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span>
                      {event.date} at {event.time}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>📍</span>
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>👥</span>
                    <span>{event.attendees} attending</span>
                  </div>
                </div>
                <Button className="w-full mt-4 bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all duration-300">
                  Join Event
                </Button>
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
