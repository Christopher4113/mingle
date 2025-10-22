"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, Sparkles, Calendar, Clock, MapPin, Tag } from "lucide-react";

function getCookie(name: string) {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : undefined;
}

function to12h(hhmm: string) {
  const [hStr, m] = hhmm.split(":");
  let h = Number.parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

type EventDetail = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  category: string;
  attendees: number;
  maxAttendees: number;
  inviteOnly: boolean;
};

type Attendee = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  joinedAt: string; // ISO string from server
};

type ApiResponse = {
  ok: true;
  event: {
    id: string;
    title: string;
    description: string;
    startsAt: string; // ISO
    endsAt: string;   // ISO
    location: string;
    category: string;
    inviteOnly: boolean;
    maxAttendees: number;
    attendees: number;
    hostName: string;
  };
  attendees: Attendee[];
};

export default function Page() {
  const params = useParams() as { id?: string };
  const { status } = useSession();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendeesList, setAttendeesList] = useState<Attendee[]>([]);

  const loadEvent = useCallback(async () => {
    try {
      setLoading(true);

      await fetch("/api/set-token", { method: "GET", credentials: "include" });

      const token = getCookie("token");
      const cfg = {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      };

      const res = await axios.get<ApiResponse>(`/api/users/meetup/${params.id}`, cfg);

      if (res.data?.ok && res.data.event) {
        const e = res.data.event;
        const start = new Date(e.startsAt);
        const end = new Date(e.endsAt);

        setEvent({
          id: e.id,
          title: e.title,
          description: e.description,
          startDate: start.toLocaleDateString(),
          startTime: start.toTimeString().slice(0, 5),
          endDate: end.toLocaleDateString(),
          endTime: end.toTimeString().slice(0, 5),
          location: e.location,
          category: e.category,
          attendees: e.attendees ?? 0,
          maxAttendees: e.maxAttendees ?? 0,
          inviteOnly: Boolean(e.inviteOnly),
        });

        setAttendeesList(res.data.attendees ?? []);
      } else {
        setError("Failed to load event");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (status === "authenticated" && params.id) {
      loadEvent();
    }
  }, [status, params.id, loadEvent]);

  const handleRecommendPeople = () => {
    console.log("Getting recommended people for this event...");
    alert("Recommend People feature - this will show suggested attendees based on interests and connections!");
  };

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
    );
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
    );
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
            <Link href="/create">
              <Button className="bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all duration-300">
                View All Events
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

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

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Event Header */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
          <div className="flex flex-wrap gap-3 mb-6">
            <span className="bg-blue-500/80 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
              <Tag className="w-4 h-4" />
              {event.category}
            </span>
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                event.inviteOnly ? "bg-purple-500/80 text-white" : "bg-green-500/80 text-white"
              }`}
            >
              {event.inviteOnly ? "🔒 Invite Only" : "🌍 Public Event"}
            </span>
          </div>

          <h1 className="text-4xl font-bold text-white mb-4">{event.title}</h1>
          <p className="text-white/90 text-lg leading-relaxed">{event.description}</p>
        </div>

        {/* Event Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-6">
            <div className="flex items-start gap-4">
              <div className="bg-white/10 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-1">Date</h3>
                <p className="text-white/90">
                  <span className="font-medium">Start:</span> {event.startDate}
                </p>
                <p className="text-white/90">
                  <span className="font-medium">End:</span> {event.endDate}
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-6">
            <div className="flex items-start gap-4">
              <div className="bg-white/10 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-1">Time</h3>
                <p className="text-white/90">
                  <span className="font-medium">Start:</span> {to12h(event.startTime)}
                </p>
                <p className="text-white/90">
                  <span className="font-medium">End:</span> {to12h(event.endTime)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-6 md:col-span-2">
            <div className="flex items-start gap-4">
              <div className="bg-white/10 p-3 rounded-lg">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-1">Location</h3>
                <p className="text-white/90">{event.location}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Attendees List */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6" />
              Attendees ({attendeesList.length})
            </h2>
            <Button
              onClick={handleRecommendPeople}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Recommend People
            </Button>
          </div>

          {attendeesList.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-white/40 mx-auto mb-4" />
              <p className="text-white/60 text-lg">No attendees yet. Be the first to join!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attendeesList.map((attendee) => (
                <div key={attendee.id} className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                      {attendee.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={attendee.avatar}
                          alt={attendee.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        attendee.name.charAt(0)
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-semibold">{attendee.name}</p>
                      <p className="text-white/60 text-sm">{attendee.email}</p>
                      <p className="text-white/50 text-xs mt-1">
                        Joined {new Date(attendee.joinedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Action Buttons (left as-is; wire up to your join flow if needed) */}
        <div className="flex gap-4">
          <Button className="flex-1 bg-white text-purple-600 font-bold py-6 rounded-lg hover:bg-gray-100 transition-all duration-200 shadow-lg text-lg">
            Join Event
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-2 border-white/30 text-white font-bold py-6 rounded-lg hover:bg-white/10 transition-all duration-200 backdrop-blur-sm text-lg bg-transparent"
          >
            Share Event
          </Button>
        </div>
      </div>
    </div>
  );
}
