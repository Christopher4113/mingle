"use client";

import type React from "react";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { useSession, signOut } from "next-auth/react";

/** ----- Small helpers ----- */
function getCookie(name: string) {
  if (typeof document === "undefined") return undefined; // SSR guard
  const m = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : undefined;
}

function toDateStr(d: Date) {
  // yyyy-mm-dd
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function toTimeStr(d: Date) {
  // HH:MM (24h)
  return d.toTimeString().slice(0, 5);
}

function combineToISO(date: string, time: string) {
  // Combine local date+time to ISO string normalized to UTC (preserving local clock)
  const d = new Date(`${date}T${time || "00:00"}:00`);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}

function to12h(hhmm: string) {
  const [hStr, m] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12; // 0->12
  return `${h}:${m} ${ampm}`;
}

/** Event shape used in the UI (date & time split for the form) */
type EventUI = {
  id: string;
  title: string;
  description: string;
  date: string;     // start: "2024-01-15"
  time: string;     // start: "18:00"
  endDate: string;  // end:   "2024-01-15"
  endTime: string;  // end:   "20:00"
  location: string;
  category: string;
  attendees: number;
  maxAttendees: number;
  inviteOnly: boolean;
};

type EventFromServer = {
  id: string;
  title: string;
  description: string;
  startsAt: string;   // ISO string from DB
  endsAt?: string;    // ISO string from DB (optional for backwards compat)
  location: string;
  category: string;
  attendees?: number;
  maxAttendees?: number;
  inviteOnly: boolean;
};

const Page = () => {
  const { status } = useSession();

  const [activeTab, setActiveTab] = useState<"create" | "manage">("create");
  const [events, setEvents] = useState<EventUI[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    endDate: "",
    endTime: "",
    location: "",
    category: "Networking",
    maxAttendees: "",
    inviteOnly: false,
  });
  const [editingEvent, setEditingEvent] = useState<EventUI | null>(null);

  const axiosConfig = useMemo(() => {
    const token = getCookie("token");
    return {
      withCredentials: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    };
  }, []);

  /** Transform server Event -> EventUI */
  const toUI = useCallback((e: EventFromServer): EventUI => {
    // backend returns `startsAt` (ISO) and maybe `endsAt`
    const start = new Date(e.startsAt);
    const end =
      e.endsAt ? new Date(e.endsAt) : new Date(start.getTime() + 60 * 60 * 1000); // default +1h

    return {
      id: e.id,
      title: e.title,
      description: e.description,
      date: toDateStr(start),
      time: toTimeStr(start),
      endDate: toDateStr(end),
      endTime: toTimeStr(end),
      location: e.location,
      category: e.category,
      attendees: e.attendees ?? 0,
      maxAttendees: e.maxAttendees ?? 0,
      inviteOnly: Boolean(e.inviteOnly),
    };
  }, []);

  /** GET events (also used after POST/PUT/DELETE) */
  const loadEvents = useCallback(async () => {
    // ensure our custom JWT cookie exists
    try {
      await fetch("/api/set-token", { method: "GET", credentials: "include" });
    } catch {
      /* non-fatal */
    }
    const token = getCookie("token");
    const cfg = {
      withCredentials: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    };
    const res = await axios.get("/api/users/create", cfg);
    if (res.data?.ok && Array.isArray(res.data.events)) {
      setEvents(res.data.events.map(toUI));
    }
  }, [toUI]);

  useEffect(() => {
    if (status === "authenticated") {
      loadEvents().catch(console.error);
    }
  }, [status, loadEvents]);

  /** ----- Form handlers ----- */
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const resetForm = () =>
    setFormData({
      title: "",
      description: "",
      date: "",
      time: "",
      endDate: "",
      endTime: "",
      location: "",
      category: "Networking",
      maxAttendees: "",
      inviteOnly: false,
    });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Default endDate/Time to start if left blank
    const endDate = formData.endDate || formData.date;
    const endTime = formData.endTime || formData.time;

    const startsAtISO = combineToISO(formData.date, formData.time);
    const endsAtISO = combineToISO(endDate, endTime);

    if (!formData.date || !formData.time) {
      alert("Please provide a start date and time.");
      return;
    }
    if (new Date(endsAtISO).getTime() < new Date(startsAtISO).getTime()) {
      alert("End time must be after the start time.");
      return;
    }

    const body = {
      title: formData.title,
      description: formData.description,
      date: formData.date,
      time: formData.time,
      endDate,
      endTime,
      endsAt: endsAtISO, // NEW: send computed ISO end time
      location: formData.location,
      category: formData.category,
      maxAttendees: Number.parseInt(formData.maxAttendees),
      inviteOnly: formData.inviteOnly,
    };

    try {
      if (editingEvent) {
        await axios.put(
          "/api/users/create",
          { id: editingEvent.id, ...body },
          axiosConfig,
        );
      } else {
        await axios.post("/api/users/create", body, axiosConfig);
      }

      await loadEvents(); // always refresh from DB
      setEditingEvent(null);
      resetForm();
      setActiveTab("manage");
    } catch (err) {
      console.error(err);
      alert("Failed to save event.");
    }
  };

  const handleEdit = (event: EventUI) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      endDate: event.endDate,
      endTime: event.endTime,
      location: event.location,
      category: event.category,
      maxAttendees: event.maxAttendees.toString(),
      inviteOnly: event.inviteOnly,
    });
    setActiveTab("create");
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      await axios.delete("/api/users/create", {
        ...axiosConfig,
        data: { id: eventId },
      });
      await loadEvents(); // refresh list after delete
    } catch (err) {
      console.error(err);
      alert("Failed to delete event.");
    }
  };

  const cancelEdit = () => {
    setEditingEvent(null);
    resetForm();
  };

  /** ----- Auth gates ----- */
  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          <p className="text-white">Loading...</p>
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
    );
  }

  /** ----- UI ----- */
  return (
    <div
      className="min-h-screen bg-slate-900"
      style={{ background: "linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)" }}
    >
      <div className="flex justify-between items-center p-6">
        <Link
          href="/menu"
          className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-all duration-200"
        >
          ← Back to Menu
        </Link>
        <h1 className="text-2xl font-bold text-white">My Events</h1>
        <button
          onClick={async () => {
            await fetch("/api/users/logout");
            signOut();
          }}
          className="bg-red-500/20 backdrop-blur-sm border border-red-300/30 rounded-xl px-6 py-3 text-white hover:bg-red-500/30 transition-all duration-300"
        >
          Logout
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => setActiveTab("create")}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "create"
                ? "bg-white text-purple-600 shadow-lg"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            {editingEvent ? "Edit Event" : "Create Event"}
          </button>
          <button
            onClick={() => setActiveTab("manage")}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "manage"
                ? "bg-white text-purple-600 shadow-lg"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            Manage Events
          </button>
        </div>

        {activeTab === "create" && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6">
              {editingEvent ? "Edit Event" : "Create New Event"}
            </h2>

            {editingEvent && (
              <div className="mb-4">
                <button
                  onClick={cancelEdit}
                  className="bg-gray-500/80 text-white px-4 py-2 rounded-lg hover:bg-gray-600/80 transition-all duration-200"
                >
                  Cancel Edit
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-white font-medium mb-2">
                    Event Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-white/70 border border-white/30 focus:border-white focus:outline-none"
                    placeholder="Enter event title"
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 focus:border-white focus:outline-none text-white [color-scheme:dark]"
                  >
                    <option className="text-black" value="Networking">
                      Networking
                    </option>
                    <option className="text-black" value="Social">
                      Social
                    </option>
                    <option className="text-black" value="Learning">
                      Learning
                    </option>
                    <option className="text-black" value="Creative">
                      Creative
                    </option>
                    <option className="text-black" value="Wellness">
                      Wellness
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white/20 text-white border border-white/30 focus:border-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">Time</label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white/20 text-white border border-white/30 focus:border-white focus:outline-none"
                  />
                </div>

                {/* NEW: End Date */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 text-white border border-white/30 focus:border-white focus:outline-none"
                  />
                  <p className="text-xs text-white/70 mt-1">
                    Leave blank to use the same day as the start.
                  </p>
                </div>

                {/* NEW: End Time */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 text-white border border-white/30 focus:border-white focus:outline-none"
                  />
                  <p className="text-xs text-white/70 mt-1">
                    Leave blank to use the same time as the start.
                  </p>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-white/70 border border-white/30 focus:border-white focus:outline-none"
                    placeholder="Enter event location"
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Max Attendees
                  </label>
                  <input
                    type="number"
                    name="maxAttendees"
                    value={formData.maxAttendees}
                    onChange={handleInputChange}
                    required
                    min={1}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-white/70 border border-white/30 focus:border-white focus:outline-none"
                    placeholder="Maximum number of attendees"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white font-medium mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-white/70 border border-white/30 focus:border-white focus:outline-none resize-none"
                  placeholder="Describe your event..."
                />
              </div>

              <div className="flex items-center justify-between bg-white/10 rounded-lg p-4 border border-white/30">
                <div>
                  <label className="block text-white font-medium mb-1">
                    Event Access
                  </label>
                  <p className="text-white/70 text-sm">
                    {formData.inviteOnly
                      ? "Only invited guests can attend"
                      : "Open to everyone"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((p) => ({ ...p, inviteOnly: !p.inviteOnly }))
                  }
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-purple-600 ${
                    formData.inviteOnly ? "bg-purple-600" : "bg-white/30"
                  }`}
                  role="switch"
                  aria-checked={formData.inviteOnly}
                  aria-label="Toggle invite only"
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-200 ${
                      formData.inviteOnly ? "translate-x-9" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center space-x-3 text-white/90 text-sm">
                <span className={!formData.inviteOnly ? "font-semibold" : ""}>
                  Everyone
                </span>
                <span>•</span>
                <span className={formData.inviteOnly ? "font-semibold" : ""}>
                  Invite Only
                </span>
              </div>

              <button
                type="submit"
                className="w-full bg-white text-purple-600 font-bold py-4 rounded-lg hover:bg-gray-100 transition-all duration-200 shadow-lg"
              >
                {editingEvent ? "Update Event" : "Create Event"}
              </button>
            </form>
          </div>
        )}

        {activeTab === "manage" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">Your Events</h2>

            {events.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
                <p className="text-white text-lg">
                  You have not created any events yet.
                </p>
                <button
                  onClick={() => setActiveTab("create")}
                  className="mt-4 bg-white text-purple-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-all duration-200"
                >
                  Create Your First Event
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col gap-2">
                        <span className="bg-blue-500/80 text-white px-3 py-1 rounded-full text-sm font-medium">
                          {event.category}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            event.inviteOnly
                              ? "bg-purple-500/80 text-white"
                              : "bg-green-500/80 text-white"
                          }`}
                        >
                          {event.inviteOnly
                            ? "🔒 Invite Only"
                            : "🌍 Everyone"}
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(event)}
                          className="text-white hover:text-blue-300 transition-colors duration-200"
                          title="Edit event"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(event.id)}
                          className="text-white hover:text-red-300 transition-colors duration-200"
                          title="Delete event"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">
                      {event.title}
                    </h3>
                    <p className="text-white/80 mb-4 line-clamp-2">
                      {event.description}
                    </p>

                    <div className="space-y-2 text-white/90">
                      <div className="flex items-center">
                        <span className="mr-2">📅</span>
                        <span>
                          {new Date(`${event.date}T00:00:00`).toLocaleDateString()}
                          {event.endDate &&
                          event.endDate !== event.date
                            ? ` → ${new Date(
                                `${event.endDate}T00:00:00`,
                              ).toLocaleDateString()}`
                            : ""}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="mr-2">🕒</span>
                        <span>
                          {to12h(event.time)}
                          {event.endTime ? ` - ${to12h(event.endTime)}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="mr-2">📍</span>
                        <span>{event.location}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="mr-2">👥</span>
                        <span>
                          {event.attendees}/{event.maxAttendees} attendees
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 flex space-x-3">
                      <button
                        onClick={() => handleEdit(event)}
                        className="flex-1 bg-blue-500/80 text-white py-2 rounded-lg hover:bg-blue-600/80 transition-all duration-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="flex-1 bg-red-500/80 text-white py-2 rounded-lg hover:bg-red-600/80 transition-all duration-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default Page;
