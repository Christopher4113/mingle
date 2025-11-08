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
import { Search, UserPlus, UserMinus, Users, Sparkles, X } from "lucide-react"
import { useRef } from "react";
import ConnectButton from "@/components/ConnectButton";
import toast from "react-hot-toast";


function Avatar({ src, alt }: { src?: string | null; alt: string }) {
  return (
    <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover rounded-full"
          width={36}
          height={36}
          loading="lazy"
        />
      ) : (
        <span className="text-white/70 text-sm font-semibold">
          {alt.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function getCookie(name: string) {
  if (typeof document === "undefined") return undefined
  const m = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"))
  return m ? decodeURIComponent(m[2]) : undefined
}
function authHeaders(): Record<string, string> {
  const token = getCookie("token")
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}
function jsonAuthHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", ...authHeaders() }
}

function to12h(hhmm: string) {
  const [hStr, m] = hhmm.split(":")
  let h = Number.parseInt(hStr, 10)
  const ampm = h >= 12 ? "PM" : "AM"
  h = h % 12 || 12
  return `${h}:${m} ${ampm}`
}

function resolveUserIdByName(
  displayName: string,
  opts: {
    names?: { userId: string; name: string | null; username: string | null }[] | null;
    people?: { id: string; name?: string | null; username?: string | null }[] | null;
  }
): string | undefined {
  const dn = displayName.trim().toLowerCase();

  // 1) from /names endpoint
  for (const p of opts.names ?? []) {
    const n = (p.name ?? "").trim().toLowerCase();
    const u = (p.username ?? "").trim().toLowerCase();
    if (dn === n || dn === u) return p.userId;
  }

  // 2) from invited/attendees arrays
  for (const p of opts.people ?? []) {
    const n = (p.name ?? "").trim().toLowerCase();
    const u = (p.username ?? "").trim().toLowerCase();
    if (dn === n || dn === u) return p.id as string;
  }

  return undefined;
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
  username?: string | null;
  bio?: string;
  profile?: string | null;
  location?: string;
  image?: string | null;
  interests?: string[]
  connections?: number
}
type ApiPerson = {
  id: string;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  bio?: string | null;
  profile?: string | null;
  location?: string | null;
  image?: string | null;
  status: Status;
  interests?: string[]
  connections?: number
};

type InvitedResp = { ok: boolean; invited: ApiPerson[] };
type SearchResp  = { ok: boolean; results: ApiPerson[] };

type NamesResp = {
  ok: true;
  eventId: string;
  people: {
    userId: string;
    name: string | null;
    username: string | null;
    text: string; // event-profile -> bio -> name/username
  }[];
};

type RecItem = { name: string; score: number; reason: string };
type RecsResp = {
  ok: boolean;
  user_id: string;
  created_user: boolean;
  added_bio_now: boolean;
  updated_bio_now?: boolean;
  has_bio_after: boolean;
  recommendations: RecItem[];
};

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
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [openProfile, setOpenProfile] = useState<Person | null>(null)
  const [eventNamesData, setEventNamesData] = useState<NamesResp["people"] | null>(null);

  const [recsOpen, setRecsOpen] = useState(false);
  const [recsLoading, setRecsLoading] = useState(false);
  const [, setRecs] = useState<RecItem[]>([]);

  // For enriching: avatar + snippet by name
  type RecRenderItem = RecItem & { avatar?: string; snippet?: string };
  const [recsRender, setRecsRender] = useState<RecRenderItem[]>([]);

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

  const fetchInvited = useCallback(async () => {
    await fetch("/api/set-token", { method: "GET", credentials: "include" });
    const res = await axios.get<InvitedResp>(`/api/users/events/${params.id}/invites`, {
      withCredentials: true,
      headers: authHeaders(),
    });

    if (res.data?.ok) {
      const invited: Person[] = (res.data.invited ?? []).map((u): Person => ({
        id: u.id,
        name: u.name || u.username || "User",
        email: u.email ?? "",
        status: u.status,
        username: u.username ?? null,
        bio: u.bio ?? "",
        profile: u.profile ?? null,
        location: u.location ?? "",
        image: u.image ?? null,
        interests: u.interests ?? [],     
        connections: u.connections ?? 0,
      }));
      setInvitedPeople(invited);
    }
  }, [params.id]);
  const doTypeahead = useCallback(
    async (q: string) => {
      if (!q.trim()) { setSearchResults([]); return; }
      await fetch("/api/set-token", { method: "GET", credentials: "include" });

      const res = await axios.get<SearchResp>(`/api/users/events/${params.id}/invites`, {
        params: { q, take: 5, prefix: 1 },     // ask server for “startsWith” if supported
        withCredentials: true,
        headers: authHeaders(),
      });

      if (res.data?.ok) {
        const results: Person[] = (res.data.results ?? []).map((u): Person => ({
          id: u.id,
          name: u.name || u.username || "User",
          email: u.email ?? "",
          status: "none",
          username: u.username ?? null,
          bio: u.bio ?? "",
          profile: u.profile ?? null,
          location: u.location ?? "",
          image: u.image ?? null,
          interests: u.interests ?? [],       
          connections: u.connections ?? 0,
        }));
        setSearchResults(results);
      }
    },
    [params.id]
  );

  const loadEventNames = useCallback(async () => {
    if (!params.id) return;
    try {
      // ensure the token cookie exists
      await fetch("/api/set-token", { method: "GET", credentials: "include" });

      const res = await axios.get<NamesResp>(
        `/api/users/meetup/${params.id}/names`,
        {
          withCredentials: true,
          headers: authHeaders(), // uses the helpers you already defined up top
        }
      );

      if (res.data?.ok) {
        setEventNamesData(res.data.people);
      }
    } catch (e) {
      console.error("Failed to load names/profiles", e);
    }
  }, [params.id]);

  useEffect(() => {
    if (status === "authenticated" && params.id) {
      loadEvent()
      fetchInvited();
      loadEventNames();
    }
  }, [status, params.id, loadEvent, fetchInvited, loadEventNames]);

  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // live search as the user types
    if (typeTimer.current) clearTimeout(typeTimer.current);
    typeTimer.current = setTimeout(() => {
      void doTypeahead(searchQuery);
    }, 250);  // 250–300ms feels good

    return () => {
      if (typeTimer.current) clearTimeout(typeTimer.current);
    };
  }, [searchQuery, doTypeahead]);


  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    await fetch("/api/set-token", { method: "GET", credentials: "include" });

    const res = await axios.get<SearchResp>(`/api/users/events/${params.id}/invites`, {
      params: { q: searchQuery, take: 5, prefix: 1 },
      withCredentials: true,
      headers: authHeaders(),
    });

    if (res.data?.ok) {
      const results: Person[] = (res.data.results ?? []).map((u): Person => ({
        id: u.id,
        name: u.name || u.username || "User",
        email: u.email ?? "",
        status: "none",
        username: u.username ?? null,
        bio: u.bio ?? "",
        profile: u.profile ?? null,
        location: u.location ?? "",
        image: u.image ?? null,
        interests: u.interests ?? [],       
        connections: u.connections ?? 0,
      }));
      setSearchResults(results);
    }

    setSearchQuery("");        // 👈 clear the input
  };

  const handleInvite = async (person: Person) => {
    await fetch("/api/set-token", { method: "GET", credentials: "include" });

    const res = await axios.post(
      `/api/users/events/${params.id}/invites`,
      { userId: person.id },
      { withCredentials: true, headers: authHeaders() }
    );

    if (res.data?.ok) {
      // optimistic add
      setInvitedPeople(prev => [...prev, { ...person, status: "invited" }]);
      setSearchResults(prev => prev.filter(p => p.id !== person.id));
      await fetchInvited();  
    }
    setSearchQuery("");  // clear input after invite
  };

  const handleKickOut = async (personId: string) => {
    await fetch("/api/set-token", { method: "GET", credentials: "include" });

    const res = await axios.delete<InvitedResp>(`/api/users/events/${params.id}/invites`, {
      params: { userId: personId },
      withCredentials: true,
      headers: authHeaders(),
    });

    if (res.data?.ok) {
      const invited: Person[] = (res.data.invited ?? []).map((u): Person => ({
        id: u.id,
        name: u.name || u.username || "User",
        email: u.email ?? "",
        status: u.status,
        username: u.username ?? null,
        bio: u.bio ?? "",
        profile: u.profile ?? null,
        location: u.location ?? "",
        image: u.image ?? null,
        interests: u.interests ?? [],       
        connections: u.connections ?? 0,
      }));
      setInvitedPeople(invited);
    }
  };

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

  function displayNameOf(n?: string | null, u?: string | null) {
    return (n && n.trim()) || (u && u.trim()) || "User";
  }

  function buildNamesAndSnippets() {
    const people = eventNamesData ?? [];
    const names: string[] = [];
    const snippets: string[] = [];

    for (const p of people) {
      const disp = displayNameOf(p.name, p.username);
      names.push(disp);

      const text = (p.text || "").trim();
      const snippet =
        text.toLowerCase().startsWith(disp.toLowerCase())
          ? text
          : `${disp}. ${text || ""}`.trim();

      snippets.push(snippet);
    }
    return { names, snippets };
  }

  function myGeneralBio(): string {
    return (aboutText || "").trim(); // you can swap to a different source if you prefer
  }
  const handleRecommendPeople = async () => {
    if (!params.id) return;

    // Need attendees to recommend from
    if (!eventNamesData || !eventNamesData.length) {
      toast.error("No attendees to recommend from yet.");
      return;
    }

    // Use the event category as the interest (your other page calls a separate interest API)
    const eventInterest = event?.category || "Networking";

    try {
      setRecsLoading(true);

      // 1) names + snippets from /names
      const { names, snippets } = buildNamesAndSnippets();

      // 2) ensure HttpOnly auth cookie is present so the Next route can attach Authorization
      await fetch("/api/set-token", { method: "GET", credentials: "include" });

      // 3) call your Next API (server-side will forward to FastAPI w/ Authorization)
      const body = {
        bio: myGeneralBio(),         // your general bio (or event-specific text)
        profile: aboutText || "",    // event-profile if you want to pass it too
        interest: eventInterest,     // e.g., "Networking"
        names,
        snippets,
      };

      const res = await axios.post<RecsResp>("/api/users/recommendations", body);
      if (!res.data?.ok) {
        toast.error("Failed to get recommendations.");
        return;
      }

      const recsRaw = res.data.recommendations || [];

      // 4) Enrich recommendations with avatar + snippet
      const nameToAvatar = new Map<string, string | undefined>();
      const nameToSnippet = new Map<string, string | undefined>();

      // Use invitedPeople as your local roster for avatars/bios
      for (const p of invitedPeople) {
        const disp = p.name || p.username || "User";
        nameToAvatar.set(disp, p.image ?? undefined);
        const text = (p.bio && p.bio.trim()) || "";
        if (text) nameToSnippet.set(disp, text);
      }
      // Prefer authoritative snippet from /names if present
      for (const p of eventNamesData) {
        const disp = displayNameOf(p.name, p.username);
        const text = (p.text || "").trim();
        if (text && !nameToSnippet.get(disp)) nameToSnippet.set(disp, text);
      }

      const enriched: RecRenderItem[] = recsRaw.map((r) => ({
        ...r,
        avatar: nameToAvatar.get(r.name),
        snippet: nameToSnippet.get(r.name),
      }));

      setRecs(recsRaw);
      setRecsRender(enriched);
      setRecsOpen(true);
    } catch (e) {
      console.error(e);
      toast.error("Could not generate recommendations.");
    } finally {
      setRecsLoading(false);
    }
  };

  async function handleApprove(personId: string) {
    try {
      setActioningId(personId);
      await fetch("/api/set-token", { method: "GET", credentials: "include" });
      const res = await fetch(`/api/users/events/${params.id}/join`, {
        method: "PATCH",
        credentials: "include",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ userId: personId, action: "approve" }),
      });
      const data = await res.json();
      if (!data?.ok) return toast.error(data?.error ?? "Approve failed");
      await fetchInvited(); // refresh list/status pills
    } finally {
      setActioningId(null);
    }
  }

  async function handleDecline(personId: string) {
    try {
      setActioningId(personId);
      await fetch("/api/set-token", { method: "GET", credentials: "include" });
      const res = await fetch(`/api/users/events/${params.id}/join`, {
        method: "PATCH",
        credentials: "include",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ userId: personId, action: "decline" }),
      });
      const data = await res.json();
      if (!data?.ok) return toast.error(data?.error ?? "Decline failed");
      await fetchInvited();
    } finally {
      setActioningId(null);
    }
  }

  function preferredProfileFor(p: Person, names?: NamesResp["people"] | null) {
    // 1) try event-scoped text from /names
    const hit = names?.find((n) => n.userId === p.id);
    const fromNames = hit?.text?.trim();
    if (fromNames) return fromNames;

    // 2) fall back to explicit event profile if you ever have it on Person
    const fromProfile = p.profile?.trim();
    if (fromProfile) return fromProfile;

    // 3) fall back to global bio
    const fromBio = p.bio?.trim();
    if (fromBio) return fromBio;

    return "";
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
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-white font-semibold mb-2">Search Results</h3>
              {searchResults.map((person) => (
                <div key={person.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenProfile(person)}
                      className="rounded-full ring-2 ring-white/10 hover:ring-white/30 focus:outline-none"
                      title="View profile"
                    >
                      <Avatar src={person.image ?? undefined} alt={person.name} />
                    </button>
                    <div>
                      <p className="text-white font-medium">
                        {person.name}
                        {person.username ? (
                          <span className="text-white/60 text-sm ml-2">@{person.username}</span>
                        ) : null}
                      </p>
                      <p className="text-white/60 text-xs">{person.email}</p>
                      {person.location ? (
                        <p className="text-white/60 text-xs">📍 {person.location}</p>
                      ) : null}
                    </div>
                  </div>
                  <ConnectButton targetUserId={person.id} className="bg-blue-500/80 text-white hover:bg-blue-600" />
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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6" />
              Manage Invitations
            </h2>

            <Button
              onClick={handleRecommendPeople}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
              disabled={recsLoading}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {recsLoading ? "Generating..." : "Recommend People"}
            </Button>
          </div>

          {invitedPeople.length === 0 ? (
            <p className="text-white/60 text-center py-8">
              No one invited yet. Search and invite people above!
            </p>
          ) : (
            <div className="space-y-2">
              {invitedPeople.map((person) => {
                const pending = person.status === "invited";
                return (
                  <div
                    key={person.id}
                    className="flex items-center justify-between bg-white/5 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                       <button
                          type="button"
                          onClick={() => setOpenProfile(person)}
                          className="rounded-full ring-2 ring-white/10 hover:ring-white/30 focus:outline-none"
                          title="View profile"
                        >
                          <Avatar src={person.image ?? undefined} alt={person.name} />
                        </button>
                      <div>
                        <p className="text-white font-medium">
                          {person.name}
                          {person.username ? (
                            <span className="text-white/60 text-sm ml-2">@{person.username}</span>
                          ) : null}
                        </p>
                        <p className="text-white/60 text-xs">{person.email}</p>
                        {person.location ? (
                          <p className="text-white/60 text-xs">📍 {person.location}</p>
                        ) : null}

                        

                        {/* Status pill */}
                        <span
                          className={[
                            "inline-block mt-1 px-2 py-1 text-white text-[10px] rounded",
                            pending ? "bg-yellow-500/70" : "bg-green-600/70",
                          ].join(" ")}
                        >
                          {pending ? "invited (pending approval)" : "attending"}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {pending ? (
                        <>
                          <Button
                            size="sm"
                            disabled={actioningId === person.id}
                            className="bg-green-500/80 text-white hover:bg-green-600"
                            onClick={() => handleApprove(person.id)}
                          >
                            {actioningId === person.id ? "Approving..." : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={actioningId === person.id}
                            className="bg-red-500/80 text-white hover:bg-red-600"
                            onClick={() => handleDecline(person.id)}
                          >
                            {actioningId === person.id ? "Declining..." : "Decline"}
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => handleKickOut(person.id)}
                          size="sm"
                          variant="destructive"
                          className="bg-red-500/80 text-white hover:bg-red-600"
                          disabled={actioningId === person.id}
                        >
                          <UserMinus className="w-4 h-4 mr-2" />
                          {actioningId === person.id ? "Removing..." : "Remove"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {openProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpenProfile(null)} />

            {/* modal */}
            <div className="relative z-10 max-w-md w-full mx-4 rounded-2xl border border-white/20 bg-gradient-to-br from-white/15 to-white/5 p-6 backdrop-blur-xl shadow-2xl">
              <button
                className="absolute right-3 top-3 text-white/70 hover:text-white"
                onClick={() => setOpenProfile(null)}
                aria-label="Close"
              >
                ✕
              </button>

              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-white font-bold">
                  {openProfile.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={openProfile.image} alt={openProfile.name} className="w-full h-full object-cover" />
                  ) : (
                    (openProfile.name?.charAt(0) || "U")
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-white font-semibold truncate">{openProfile.name}</h3>
                  {openProfile.username && (
                    <p className="text-white/70 text-sm truncate">@{openProfile.username}</p>
                  )}
                  <p className="text-white/70 text-sm truncate">{openProfile.email}</p>
                </div>
              </div>

              {openProfile.location && (
                <p className="text-white/80 text-sm mb-2">📍 {openProfile.location}</p>
              )}

              {(() => {
                const prioritized = preferredProfileFor(openProfile, eventNamesData);
                return prioritized ? (
                  <p className="text-white/90 text-sm mb-4 leading-relaxed">{prioritized}</p>
                ) : null;
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/10 p-3">
                  <p className="text-white/60 text-xs">Connections</p>
                  <p className="text-white font-semibold">{openProfile.connections ?? 0}</p>
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <p className="text-white/60 text-xs">Interests</p>
                  <p className="text-white font-semibold text-sm truncate">
                    {(openProfile.interests ?? []).join(", ") || "—"}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-between items-center">
                {/* Connect action (right-aligned on mobile) */}
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                  {/* Connect button */}
                  <ConnectButton targetUserId={openProfile?.id} />
                  <Button onClick={() => setOpenProfile(null)} className="bg-white/80 text-purple-700 hover:bg-white">
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <Link href="/create" className="flex-1">
            <Button className="w-full bg-white text-purple-600 font-bold py-4 rounded-lg hover:bg-gray-100 transition-all duration-200 shadow-lg">
              Back to My Events
            </Button>
          </Link>
        </div>
      </div>
      {/* --- NEW: Recommendations Modal --- */}
      {recsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setRecsOpen(false)} />
          {/* modal */}
          <div className="relative z-10 max-w-xl w-full mx-4 rounded-2xl border border-white/20 bg-gradient-to-br from-white/15 to-white/5 p-6 backdrop-blur-xl shadow-2xl">
            <button
              className="absolute right-3 top-3 text-white/70 hover:text-white"
              onClick={() => setRecsOpen(false)}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-white font-semibold text-lg mb-4">Recommended People</h3>

            {recsRender.length === 0 ? (
              <p className="text-white/80 text-sm">No recommendations this time.</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
                {recsRender.map((r, idx) => {
                  const targetId = resolveUserIdByName(r.name, {
                    names: eventNamesData ?? [],
                    people: invitedPeople, // fallback to attendees
                  });

                  return (
                    <div key={idx} className="bg-white/10 border border-white/10 rounded-xl p-3 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-white font-bold shrink-0">
                        {r.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.avatar || "/placeholder.svg"} alt={r.name} className="w-full h-full object-cover" />
                        ) : (
                          r.name.charAt(0)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-white font-semibold truncate">{r.name}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/80 shrink-0">
                            Score {r.score}
                          </span>
                        </div>

                        {r.snippet && (
                          <p className="text-white/80 text-sm mt-1 line-clamp-3">{r.snippet}</p>
                        )}
                        <p className="text-white/60 text-xs mt-2">
                          <span className="font-medium text-white/80">Why:</span> {r.reason}
                        </p>

                        <div className="mt-3 flex justify-end">
                          {targetId ? (
                            <ConnectButton targetUserId={targetId} />
                          ) : (
                            <Button disabled className="bg-white/10 text-white border border-white/20">
                              Can not connect (not in roster)
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button onClick={() => setRecsOpen(false)} className="bg-white/80 text-purple-700 hover:bg-white">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
