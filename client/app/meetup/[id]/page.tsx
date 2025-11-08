"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, Sparkles, Calendar, Clock, MapPin, Tag, X, UserCircle } from "lucide-react";
import ConnectButton from "@/components/ConnectButton";
import toast from "react-hot-toast";
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
  joinedAt: string;
  location?: string;
  interests?: string[];
  connections?: number;
  bio?: string;
  profile?: string;
  username?: string;
  isCreator?: boolean;
};

type ApiResponse = {
  ok: true;
  event: {
    id: string;
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    location: string;
    category: string;
    inviteOnly: boolean;
    maxAttendees: number;
    attendees: number;
    hostName: string;
  };
  attendees: Attendee[];
};


// ---- Profile endpoint types
type AttendeeStatus = "INVITED" | "ATTENDING";
type ProfileResp = {
  ok: true;
  attendee: {
    id: string;
    eventId: string;
    userId: string;
    profile: string;
    status: AttendeeStatus;
  };
};

type InterestResp = {
  ok: true;
  eventId: string;
  category: string;
};

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

export default function Page() {
  const params = useParams() as { id?: string };
  const { status } = useSession();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendeesList, setAttendeesList] = useState<Attendee[]>([]);

  // modal state
  const [openProfile, setOpenProfile] = useState<Attendee | null>(null);

  // event profile editor state
  const [eventProfile, setEventProfile] = useState("");
  const [saving, setSaving] = useState(false);
  const [eventInterest, setEventInterest] = useState<string | null>(null);
  const [eventNamesData, setEventNamesData] = useState<NamesResp["people"] | null>(null);

  // --- NEW: recs modal state
  const [recsOpen, setRecsOpen] = useState(false);
  const [recsLoading, setRecsLoading] = useState(false);
  const [, setRecs] = useState<RecItem[]>([]);

  // for enriching the modal (avatar + snippet by name)
  type RecRenderItem = RecItem & { avatar?: string; snippet?: string };
  const [recsRender, setRecsRender] = useState<RecRenderItem[]>([]);

  // helper to ensure cookie token + axios cfg
  const authCfg = useCallback(async () => {
    await fetch("/api/set-token", { method: "GET", credentials: "include" });
    const token = getCookie("token");
    return {
      withCredentials: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    } as const;
  }, []);

  const loadEvent = useCallback(async () => {
    try {
      setLoading(true);
      const cfg = await authCfg();
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
  }, [params.id, authCfg]);



  // load my attendee profile (GET upsert-on-read)
  const loadMyProfile = useCallback(async () => {
    if (!params.id) return;
    try {
      const cfg = await authCfg();
      const res = await axios.get<ProfileResp>(`/api/users/meetup/${params.id}/profile`, cfg);
      if (res.data?.ok && res.data.attendee) {
        setEventProfile(res.data.attendee.profile ?? "");
      }
    } catch (e) {
      console.error("Failed to load event profile", e);
      // non-blocking
    }
  }, [params.id, authCfg]);

  const loadEventInterest = useCallback(async () => {
    if (!params.id) return;
    try {
      const cfg = await authCfg(); // same helper you used for other endpoints
      const res = await axios.get<InterestResp>(`/api/users/meetup/${params.id}/interest`, cfg);
      if (res.data?.ok) {
        setEventInterest(res.data.category ?? null);
        // Optionally: console.log("Event interest/category:", res.data.category);
      }
    } catch (e) {
      console.error("Failed to load event interest", e);
    }
  }, [params.id, authCfg]);

  const loadEventNames = useCallback(async () => {
    if (!params.id) return;
    try {
      const cfg = await authCfg();
      const res = await axios.get<NamesResp>(`/api/users/meetup/${params.id}/names`, cfg);
      if (res.data?.ok) {
        setEventNamesData(res.data.people);
        // optional: console.log("names/profiles:", res.data.people);
      }
    } catch (e) {
      console.error("Failed to load names/profiles", e);
    }
  }, [params.id, authCfg]);


  useEffect(() => {
    if (status === "authenticated" && params.id) {
      loadEvent();
      loadMyProfile?.();
      loadEventInterest?.(); 
      loadEventNames();
    }
  }, [status, params.id, loadEvent, loadMyProfile, loadEventInterest,loadEventNames]);


  
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
      // “name. text” (avoid duplicate name prefix)
      const snippet =
        text.toLowerCase().startsWith(disp.toLowerCase())
          ? text
          : `${disp}. ${text || ""}`.trim();
      snippets.push(snippet);
    }
    return { names, snippets };
  }
  function myGeneralBio(): string {
    return (eventProfile || "").trim();
  }

  const handleRecommendPeople = async () => {
    if (!params.id) return;
    if (!eventNamesData || !eventNamesData.length) {
      toast.error("No attendees to recommend from yet.");
      return;
    }
    if (!eventInterest) {
      toast.error("Missing event category/interest. Try reloading.");
      return;
    }

    try {
      setRecsLoading(true);

      // Build names + snippets
      const { names, snippets } = buildNamesAndSnippets();

      const body = {
        bio: myGeneralBio(),         // your bio (or eventProfile if that's what you want)
        profile: eventProfile || "", // event profile
        interest: eventInterest,     // e.g., "Networking"
        names,
        snippets,
      };

      // ✅ Hit Next API (server will attach Authorization from HttpOnly cookie)
      const res = await axios.post<RecsResp>("/api/users/recommendations", body);
      if (!res.data?.ok) {
        toast.error("Failed to get recommendations.");
        return;
      }

      const recsRaw = res.data.recommendations || [];

      // Enrich for modal
      const nameToAvatar = new Map<string, string | undefined>();
      const nameToSnippet = new Map<string, string | undefined>();

      for (const a of attendeesList) {
        const disp = displayNameOf(a.name, a.username);
        nameToAvatar.set(disp, a.avatar);
        const text = (a.profile && a.profile.trim()) || (a.bio && a.bio.trim()) || "";
        if (text) nameToSnippet.set(disp, text);
      }
      for (const p of eventNamesData) {
        const disp = displayNameOf(p.name, p.username);
        const text = (p.text || "").trim();
        if (text && !nameToSnippet.get(disp)) nameToSnippet.set(disp, text);
      }

      const enriched = recsRaw.map((r) => ({
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

  // Save button -> POST
  const handleSaveProfile = async () => {
    if (!params.id) return;
    try {
      setSaving(true);
      const cfg = await authCfg();
      const res = await axios.post<ProfileResp>(
        `/api/users/meetup/${params.id}/profile`,
        { profile: eventProfile },
        cfg
      );
      if (res.data?.ok) {
        setEventProfile(res.data.attendee.profile ?? "");
        toast.error("Profile saved successfully!");
      } else {
        toast.error("Save failed.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  // Autosave on blur -> GET with query
  const handleAutosave = async () => {
    if (!params.id) return;
    try {
      const cfg = await authCfg();
      const qs = new URLSearchParams({ profile: eventProfile }).toString();
      await axios.get<ProfileResp>(`/api/users/meetup/${params.id}/profile?${qs}`, cfg);
      // silent success; hook up a toast if you want
    } catch (e) {
      console.error("Autosave failed", e);
    }
  };

  function preferredProfileFor(p: Attendee, names?: NamesResp["people"] | null) {
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
            <Button className="bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30">
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
            href="/create"
            className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/30 inline-block"
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
              <Button className="bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30">
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
          className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/30 inline-block"
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

          {/* Event Profile */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-6 md:col-span-2">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-white/10 p-3 rounded-lg">
                <UserCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-lg mb-1">Event Profile</h3>
                <p className="text-white/70 text-sm mb-4">Edit your profile information for this event</p>
                <textarea
                  value={eventProfile}
                  onChange={(e) => setEventProfile(e.target.value)}
                  onBlur={handleAutosave}
                  placeholder="Enter your profile information..."
                  className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[120px] resize-y"
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg"
                  >
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
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
              disabled={recsLoading}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {recsLoading ? "Generating..." : "Recommend People"}
            </Button>
          </div>

          {attendeesList.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-white/40 mx-auto mb-4" />
              <p className="text-white/60 text-lg">No attendees yet. Be the first to join!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attendeesList.map((a) => (
                <div key={a.id} className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-3">
                    {/* avatar bubble (click to open profile) */}
                    <button
                      onClick={() => setOpenProfile(a)}
                      className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-lg overflow-hidden ring-2 ring-white/20 hover:ring-white/40 focus:outline-none"
                      title="View profile"
                    >
                      {a.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.avatar || "/placeholder.svg"} alt={a.name} className="w-full h-full object-cover" />
                      ) : (
                        a.name?.charAt(0) || "U"
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold truncate">{a.name}</p>
                        {a.isCreator && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/80">
                            Creator
                          </span>
                        )}
                      </div>
                      <p className="text-white/60 text-sm truncate">{a.email}</p>
                      <p className="text-white/50 text-xs mt-1">Joined {new Date(a.joinedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <ConnectButton targetUserId={a.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Actions */}
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

      {/* Profile Modal */}
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
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-white font-bold">
                {openProfile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={openProfile.avatar || "/placeholder.svg"}
                    alt={openProfile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  openProfile.name?.charAt(0) || "U"
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-semibold truncate">{openProfile.name}</h3>
                  {openProfile.isCreator && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/80">
                      Creator
                    </span>
                  )}
                </div>
                {openProfile.username && <p className="text-white/70 text-sm truncate">@{openProfile.username}</p>}
                <p className="text-white/70 text-sm truncate">{openProfile.email}</p>
              </div>
            </div>

            {openProfile.location && <p className="text-white/80 text-sm mb-2">📍 {openProfile.location}</p>}

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
              <div className="flex-1" />
                <div className="flex items-center gap-2">
                  <ConnectButton targetUserId={openProfile?.id} />
                  <Button onClick={() => setOpenProfile(null)} className="bg-white/80 text-purple-700 hover:bg-white">
                    Close
                  </Button>
                </div>
            </div>
          </div>
        </div>
      )}

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
                    people: attendeesList, // fallback to attendees
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
  );
}
