"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import axios from "axios"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Search, UserPlus, UserMinus, Users, Sparkles } from "lucide-react"

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
type Status = "invited" | "attending" | "none";

type Person = {
  id: string
  name: string
  email: string
  status: Status
}

export default function EventDetailPage() {
  const params = useParams() as { id?: string }
  const { status } = useSession()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Person[]>([])
  const [invitedPeople, setInvitedPeople] = useState<Person[]>([])
  const [aboutText, setAboutText] = useState("")
  const [isEditingAbout, setIsEditingAbout] = useState(false)

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
          const end = foundEvent.endsAt ? new Date(foundEvent.endsAt) : new Date(start.getTime() + 60 * 60 * 1000)

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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    // Mock search - replace with actual API call
    const mockResults = [
      { id: "1", name: "John Doe", email: "john@example.com", status: "none" as const },
      { id: "2", name: "Jane Smith", email: "jane@example.com", status: "none" as const },
      { id: "3", name: "Bob Johnson", email: "bob@example.com", status: "none" as const },
    ] satisfies Person[];
    setSearchResults(mockResults);
  }

  const handleInvite = (person: Person) => {
    setInvitedPeople((prev) => [...prev, { ...person, status: "invited" }])
    setSearchResults((prev) => prev.filter((p) => p.id !== person.id))
  }

  const handleKickOut = (personId: string) => {
    setInvitedPeople((prev) => prev.filter((p) => p.id !== personId))
  }

  useEffect(() => {
    const run = async () => {
      if (status !== "authenticated" || !params.id) return;

      // ensure cookie token exists for SSR/client parity
      await fetch("/api/set-token", { method: "GET", credentials: "include" });
      const token = getCookie("token");
      const cfg = { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };

      try {
        const res = await axios.get(`/api/users/events/${params.id}`, cfg);
        if (res.data?.ok) setAboutText(res.data.profile ?? "");
      } catch (e) {
        console.error("Failed to load profile", e);
      }
    };

    run();
  }, [status, params.id]);

  const handleSaveAbout = async () => {
    try {
      await fetch("/api/set-token", { method: "GET", credentials: "include" });
      const token = getCookie("token");
      const cfg: RequestInit = {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ profile: aboutText }),
      };

      const res = await fetch(`/api/users/events/${params.id}`, cfg);
      const data = await res.json();

      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to save");
      // optional: refresh from GET to be 100% in sync
      const refreshed = await axios.get(`/api/users/events/${params.id}`, {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (refreshed.data?.ok) setAboutText(refreshed.data.profile ?? "");
      setIsEditingAbout(false);
    } catch (e) {
      console.error("Saving about text failed:", e);
      // You could toast an error here
    }
  };

  const handleRecommendPeople = () => {
    // Mock recommendations - replace with actual API call
    const mockRecommendations = [
      { id: "4", name: "Alice Williams", email: "alice@example.com", status: "none" as const },
      { id: "5", name: "Charlie Brown", email: "charlie@example.com", status: "none" as const },
    ] satisfies Person[];
    setSearchResults(mockRecommendations);
  }

  if (status === "loading" || loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          <p className="text-white">Loading event...</p>
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

  const pct = event.maxAttendees > 0 ? Math.min(100, Math.max(0, (event.attendees / event.maxAttendees) * 100)) : 0

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

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Event Details Card */}
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
                  <div className="bg-white h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6" />
              About Me
            </h2>
            {!isEditingAbout && (
              <Button
                onClick={() => setIsEditingAbout(true)}
                className="bg-white/20 text-white hover:bg-white/30"
                size="sm"
              >
                Edit
              </Button>
            )}
          </div>

          {isEditingAbout ? (
            <div className="space-y-4">
              <Textarea
                value={aboutText}
                onChange={(e) => setAboutText(e.target.value)}
                placeholder="Tell people about yourself and what you're looking for..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 min-h-[120px]"
              />
              <div className="flex gap-2">
                <Button onClick={handleSaveAbout} className="bg-white text-purple-600 hover:bg-gray-100">
                  Save
                </Button>
                <Button
                  onClick={() => setIsEditingAbout(false)}
                  variant="outline"
                  className="bg-white text-purple-600 hover:bg-gray-100"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-white/90 leading-relaxed">
              {aboutText || "Click Edit to add information about yourself and what you're looking for..."}
            </p>
          )}
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-6">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Search className="w-6 h-6" />
            Search & Invite People
          </h2>

          <div className="flex gap-2 mb-4">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
            <Button onClick={handleSearch} className="bg-white text-purple-600 hover:bg-gray-100">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
            <Button
              onClick={handleRecommendPeople}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Recommend People
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-white font-semibold mb-2">Search Results</h3>
              {searchResults.map((person) => (
                <div key={person.id} className="flex items-center justify-between bg-white/5 rounded-lg p-4">
                  <div>
                    <p className="text-white font-medium">{person.name}</p>
                    <p className="text-white/60 text-sm">{person.email}</p>
                  </div>
                  <Button
                    onClick={() => handleInvite(person)}
                    size="sm"
                    className="bg-green-500/80 text-white hover:bg-green-600"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-6">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-6 h-6" />
            Manage Invitations
          </h2>

          {invitedPeople.length === 0 ? (
            <p className="text-white/60 text-center py-8">No one invited yet. Search and invite people above!</p>
          ) : (
            <div className="space-y-2">
              {invitedPeople.map((person) => (
                <div key={person.id} className="flex items-center justify-between bg-white/5 rounded-lg p-4">
                  <div>
                    <p className="text-white font-medium">{person.name}</p>
                    <p className="text-white/60 text-sm">{person.email}</p>
                    <span className="inline-block mt-1 px-2 py-1 bg-blue-500/50 text-white text-xs rounded">
                      {person.status}
                    </span>
                  </div>
                  <Button
                    onClick={() => handleKickOut(person.id)}
                    size="sm"
                    variant="destructive"
                    className="bg-red-500/80 text-white hover:bg-red-600"
                  >
                    <UserMinus className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex gap-4">
          <Link href="/create" className="flex-1">
            <Button className="w-full bg-white text-purple-600 font-bold py-4 rounded-lg hover:bg-gray-100 transition-all duration-200 shadow-lg">
              Back to My Events
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
