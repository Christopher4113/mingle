"use client"

import { useState } from "react"
import Link from "next/link"

export default function EventsPage() {
  const [activeTab, setActiveTab] = useState("create")
  const [events, setEvents] = useState([
    {
      id: 1,
      title: "Tech Networking Mixer",
      description: "Connect with fellow tech professionals in a relaxed environment.",
      date: "2024-01-15",
      time: "18:00",
      location: "Downtown Tech Hub",
      category: "Networking",
      attendees: 24,
      maxAttendees: 50,
    },
    {
      id: 2,
      title: "Creative Workshop: Digital Art",
      description: "Learn digital art techniques from industry professionals.",
      date: "2024-01-20",
      time: "14:00",
      location: "Art Studio Central",
      category: "Creative",
      attendees: 12,
      maxAttendees: 20,
    },
  ])

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    category: "Networking",
    maxAttendees: "",
  })

  type EventType = {
    id: number
    title: string
    description: string
    date: string
    time: string
    location: string
    category: string
    attendees: number
    maxAttendees: number
  }

  const [editingEvent, setEditingEvent] = useState<EventType | null>(null)

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (editingEvent) {
      setEvents((prev) =>
        prev.map((event) =>
          event.id === editingEvent.id
            ? { ...event, ...formData, maxAttendees: Number.parseInt(formData.maxAttendees) }
            : event,
        ),
      )
      setEditingEvent(null)
    } else {
      const newEvent = {
        id: Date.now(),
        ...formData,
        maxAttendees: Number.parseInt(formData.maxAttendees),
        attendees: 0,
      }
      setEvents((prev) => [...prev, newEvent])
    }

    // Reset form
    setFormData({
      title: "",
      description: "",
      date: "",
      time: "",
      location: "",
      category: "Networking",
      maxAttendees: "",
    })
  }

  const handleEdit = (event: EventType) => {
    setEditingEvent(event)
    setFormData({
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      location: event.location,
      category: event.category,
      maxAttendees: event.maxAttendees.toString(),
    })
    setActiveTab("create")
  }

  const handleDelete = (eventId: number) => {
    if (confirm("Are you sure you want to delete this event?")) {
      setEvents((prev) => prev.filter((event) => event.id !== eventId))
    }
  }

  const cancelEdit = () => {
    setEditingEvent(null)
    setFormData({
      title: "",
      description: "",
      date: "",
      time: "",
      location: "",
      category: "Networking",
      maxAttendees: "",
    })
  }

  return (
    <div
      className="min-h-screen bg-slate-900"
      style={{
        background: "linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)",
      }}
    >
      <div className="flex justify-between items-center p-6">
        <Link
          href="/menu"
          className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-all duration-200"
        >
          ← Back to Menu
        </Link>
        <h1 className="text-2xl font-bold text-white">My Events</h1>
        <Link
          href="/"
          className="bg-red-500/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-red-600/80 transition-all duration-200"
        >
          Logout
        </Link>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => setActiveTab("create")}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "create" ? "bg-white text-purple-600 shadow-lg" : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            {editingEvent ? "Edit Event" : "Create Event"}
          </button>
          <button
            onClick={() => setActiveTab("manage")}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "manage" ? "bg-white text-purple-600 shadow-lg" : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            Manage Events
          </button>
        </div>

        {activeTab === "create" && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6">{editingEvent ? "Edit Event" : "Create New Event"}</h2>

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
                  <label className="block text-white font-medium mb-2">Event Title</label>
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
                  <label className="block text-white font-medium mb-2">Category</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 text-white border border-white/30 focus:border-white focus:outline-none"
                  >
                    <option value="Networking">Networking</option>
                    <option value="Social">Social</option>
                    <option value="Learning">Learning</option>
                    <option value="Creative">Creative</option>
                    <option value="Wellness">Wellness</option>
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

                <div>
                  <label className="block text-white font-medium mb-2">Location</label>
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
                  <label className="block text-white font-medium mb-2">Max Attendees</label>
                  <input
                    type="number"
                    name="maxAttendees"
                    value={formData.maxAttendees}
                    onChange={handleInputChange}
                    required
                    min="1"
                    className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-white/70 border border-white/30 focus:border-white focus:outline-none"
                    placeholder="Maximum number of attendees"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Description</label>
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
                <p className="text-white text-lg">You have not created any events yet.</p>
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
                  <div key={event.id} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
                    <div className="flex justify-between items-start mb-4">
                      <span className="bg-blue-500/80 text-white px-3 py-1 rounded-full text-sm font-medium">
                        {event.category}
                      </span>
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

                    <h3 className="text-xl font-bold text-white mb-2">{event.title}</h3>
                    <p className="text-white/80 mb-4 line-clamp-2">{event.description}</p>

                    <div className="space-y-2 text-white/90">
                      <div className="flex items-center">
                        <span className="mr-2">📅</span>
                        <span>{new Date(event.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="mr-2">🕒</span>
                        <span>{event.time}</span>
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
  )
}
