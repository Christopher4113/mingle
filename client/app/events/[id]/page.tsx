"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import axios from "axios"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

function getCookie(name: string) {
  if (typeof document === "undefined") return undefined
  const m = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"))
  return m ? decodeURIComponent(m[2]) : undefined
}

function to12h(hhmm: string) {
  const [hStr, m] = hhmm.split(":")
  let h = Number.parseInt(hStr, 10)
  const ampm = h >= 12 ? "PM" : "AM"
  h = h % 12 || 12
  return `${h}:${m} ${ampm}`
}

type EventFromServer = {
  id: string
  title: string
  description: string
  startsAt: string
  endsAt?: string
  location: string
  category: string
  attendees?: number
  maxAttendees?: number
  inviteOnly: boolean
}

type EventDetail = {
  id: string
  title: string
  description: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  location: string
  category: string
  attendees: number
  maxAttendees: number
  inviteOnly: boolean
}

export default function EventDetailPage() {
  const params = useParams() as { id?: string }
  const { status } = useSession()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadEvent = useCallback(async () => {
    try {
      setLoading(true)

      // ensure token cookie exists for server routes
      await fetch("/api/set-token", { method: "GET", credentials: "include" })

      const token = getCookie("token")
      const cfg = {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }

      const res = await axios.get("/api/users/create", cfg)

      if (res.data?.ok && Array.isArray(res.data.events)) {
        const foundEvent = res.data.events.find((e: EventFromServer) => e.id === params.id)

        if (foundEvent) {
          const start = new Date(foundEvent.startsAt)
          const end = foundEvent.endsAt
            ? new Date(foundEvent.endsAt)
            : new Date(start.getTime() + 60 * 60 * 1000)

          setEvent({
            id: foundEvent.id,
            title: foundEvent.title,
            description: foundEvent.description,
            startDate: start.toLocaleDateString(),
            startTime: start.toTimeString().slice(0, 5),
            endDate: end.toLocaleDateString(),
            endTime: end.toTimeString().slice(0, 5),
            location: foundEvent.location,
            category: foundEvent.category,
            attendees: foundEvent.attendees ?? 0,
            maxAttendees: foundEvent.maxAttendees ?? 0,
            inviteOnly: Boolean(foundEvent.inviteOnly),
          })
        } else {
          setError("Event not found")
        }
      } else {
        setError("Failed to load event")
      }
    } catch (err) {
      console.error(err)
      setError("Failed to load event")
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (status === "authenticated" && params.id) {
      loadEvent()
    }
  }, [status, params.id, loadEvent])

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          <p className="text-white">Loading event...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)" }}>
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Required</h2>
          <p className="text-white/80 mb-6">Please login to view this event</p>
          <Link href="/login">
            <Button className="bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all duration-300">
              Go to Login
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)" }}>
        <div className="p-6">
          <Link
            href="/users/create"
            className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-all duration-200 inline-block"
          >
            ← Back to Events
          </Link>
        </div>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-white mb-2">{error || "Event Not Found"}</h2>
            <p className="text-white/80 mb-6">The event you are looking for does not exist</p>
            <Link href="/users/create">
              <Button className="bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all duration-300">
                View All Events
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const pct =
    event.maxAttendees > 0
      ? Math.min(100, Math.max(0, (event.attendees / event.maxAttendees) * 100))
      : 0

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)" }}>
      <div className="p-6">
        <Link
          href="/create"
          className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-all duration-200 inline-block"
        >
          ← Back to Events
        </Link>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
          <div className="flex flex-wrap gap-3 mb-6">
            <span className="bg-blue-500/80 text-white px-4 py-2 rounded-full text-sm font-medium">
              {event.category}
            </span>
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                event.inviteOnly ? "bg-purple-500/80 text-white" : "bg-green-500/80 text-white"
              }`}
            >
              {event.inviteOnly ? "🔒 Invite Only" : "🌍 Everyone"}
            </span>
          </div>

          <h1 className="text-4xl font-bold text-white mb-4">{event.title}</h1>

          <p className="text-white/90 text-lg mb-8 leading-relaxed">{event.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white/5 rounded-xl p-6">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-3">📅</span>
                <h3 className="text-white font-semibold text-lg">Date</h3>
              </div>
              <p className="text-white/90 ml-11">
                {event.startDate}
                {event.endDate !== event.startDate && ` → ${event.endDate}`}
              </p>
            </div>

            <div className="bg-white/5 rounded-xl p-6">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-3">🕒</span>
                <h3 className="text-white font-semibold text-lg">Time</h3>
              </div>
              <p className="text-white/90 ml-11">
                {to12h(event.startTime)} - {to12h(event.endTime)}
              </p>
            </div>

            <div className="bg-white/5 rounded-xl p-6">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-3">📍</span>
                <h3 className="text-white font-semibold text-lg">Location</h3>
              </div>
              <p className="text-white/90 ml-11">{event.location}</p>
            </div>

            <div className="bg-white/5 rounded-xl p-6">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-3">👥</span>
                <h3 className="text-white font-semibold text-lg">Attendees</h3>
              </div>
              <p className="text-white/90 ml-11">
                {event.attendees} / {event.maxAttendees}
              </p>
              <div className="ml-11 mt-2">
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white h-2 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Link href="/create" className="flex-1">
              <Button className="w-full bg-white text-purple-600 font-bold py-4 rounded-lg hover:bg-gray-100 transition-all duration-200 shadow-lg">
                Back to My Events
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
