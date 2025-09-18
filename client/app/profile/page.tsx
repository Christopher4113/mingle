"use client"

import type React from "react"
import { useState,useEffect,useCallback } from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import axios from "axios"
import { dataUrlToBlob } from "@/helpers/dataUrlToBlob"
import { useEdgeStore } from "@/lib/edgestore"
import Image from "next/image"

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const [isEditing, setIsEditing] = useState(false)
  const [profileImage, setProfileImage] = useState<string | File | null>(null)
  const { edgestore } = useEdgeStore()
  const [profile, setProfile] = useState({
    bio: "",
    location: "",
    interests: [] as string[],
    joinedDate: "",      // you set from createdAt when GET returns it
    eventsAttended: 0,
    connectionsMade: 0,
  })

  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const isDataUrl = (url?: string | null) => !!url && url.startsWith('data:');
  const allInterests = ["Networking", "Social", "Learning", "Creative", "Wellness"]

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setProfileImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  
  const handleInterestToggle = (interest: string) => {
    setProfile((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }))
  }

  useEffect(() => {
    (async () => {
      if (status === "authenticated") {
        try {
          const res1 = await fetch("/api/set-token", { method: "GET", credentials: "include" });
          if (!res1.ok) console.error("Failed to set custom JWT cookie");

          // define it right here so no deps complain
          const token = getCookie("token");
          const res = await fetch("/api/users/profile", {
            method: "GET",
            credentials: "include",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) throw new Error("Failed to load profile");
          const { user } = await res.json();

          setProfile((prev) => ({
            ...prev,
            bio: user.bio ?? prev.bio,
            location: user.location ?? prev.location,
            interests: Array.isArray(user.interests) ? user.interests : prev.interests,
            joinedDate: user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : prev.joinedDate,
            eventsAttended: typeof user.events === "number" ? user.events : prev.eventsAttended,
            connectionsMade: typeof user.connections === "number" ? user.connections : prev.connectionsMade,
          }));

          if (user.profileImageUrl) {
            setExistingImageUrl(user.profileImageUrl);
            setProfileImage(user.profileImageUrl);
          }
        } catch (e) {
          console.error(e);
        }
      }
    })();
  }, [status]);

  const loadProfile = useCallback(async () => {
    const token = getCookie("token");
    const res = await fetch("/api/users/profile", {
      method: "GET",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Failed to load profile");
    const { user } = await res.json();

    setProfile((prev) => ({
      ...prev,
      bio: user.bio ?? prev.bio,
      location: user.location ?? prev.location,
      interests: Array.isArray(user.interests) ? user.interests : prev.interests,
      eventsAttended: typeof user.events === "number" ? user.events : prev.eventsAttended,
      connectionsMade: typeof user.connections === "number" ? user.connections : prev.connectionsMade,
    }));

    if (user.profileImageUrl) {
      setExistingImageUrl(user.profileImageUrl);
      setProfileImage(user.profileImageUrl);
    }
  }, [setProfile, setExistingImageUrl, setProfileImage]);

  function isEdgeStoreUrl(url?: string | null) {
    if (!url) return false;
    return url.includes("edgestore") || url.includes("publicfiles"); // adjust if needed
  }
    
  
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
  function getCookie(name: string) {
    // simple cookie parser
    const match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"))
    return match ? decodeURIComponent(match[2]) : undefined
  }

  const handleSave = async () => {
    try {
      let newUploadUrl: string | undefined;

      // 1) Upload first if changed
      if (profileImage) {
        if (profileImage instanceof File) {
          const { url } = await edgestore.myPublicFiles.upload({ file: profileImage });
          newUploadUrl = url;
        } else if (typeof profileImage === "string" && profileImage.startsWith("data:")) {
          const blob = await dataUrlToBlob(profileImage);
          const file = new File([blob], `profile-${Date.now()}.png`, { type: blob.type || "image/png" });
          const { url } = await edgestore.myPublicFiles.upload({ file });
          newUploadUrl = url;
        } else if (typeof profileImage === "string") {
          newUploadUrl = profileImage; // pasted URL case
        }
      }

      const nextImageUrl = newUploadUrl ?? existingImageUrl ?? undefined;

      // 2) PUT
      const token = getCookie("token");
      const res = await axios.put("/api/users/profile", {
        bio: profile.bio,
        location: profile.location,
        interests: profile.interests,
        profileImageUrl: nextImageUrl,
      }, {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.data?.ok) {
        console.error(res.data);
        alert("Failed to save profile.");
        return;
      }

      // 3) Re-fetch fresh data from DB (includes connections/events and canonical image URL)
      const oldUrl = existingImageUrl;
      await loadProfile();

      
      if (newUploadUrl && oldUrl && newUploadUrl !== oldUrl && isEdgeStoreUrl(oldUrl)) {
        try {
          await edgestore.myPublicFiles.delete({ url: oldUrl });
        } catch (delErr) {
          console.warn("Failed to delete old profile image:", delErr);
        }
      }

      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert("Something went wrong while saving.");
    }
  };

  // helper: are we previewing a newly picked image (dataURL) vs the existing URL?
  const hasNewImage =
    typeof profileImage === "string" && profileImage.startsWith("data:");

  // compute what to show inside the avatar circle
  const displayImageUrl =
    typeof profileImage === "string"
      ? profileImage // dataURL or pasted URL
      : existingImageUrl || null;

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)",
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-6">
        <Link
          href="/menu"
          className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-6 py-3 text-white hover:bg-white/20 transition-all duration-300"
        >
          ← Back to Menu
        </Link>
        <button
          onClick={async () => {
                  await fetch("/api/users/logout"); // Clear custom JWT
                  signOut(); // Then call NextAuth signOut
                }}
          className="bg-red-500/20 backdrop-blur-sm border border-red-300/30 rounded-xl px-6 py-3 text-white hover:bg-red-500/30 transition-all duration-300"
        >
          Logout
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-12">
        {/* Profile Header */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 mb-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden relative bg-gradient-to-br from-blue-400 to-pink-400">
                {displayImageUrl ? (
                  isDataUrl(displayImageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayImageUrl}
                      alt="Profile image"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <Image
                      src={displayImageUrl}
                      alt="Profile image"
                      fill
                      sizes="2048px"
                      className="object-cover"
                      // If you prefer to bypass optimization for this host, you can also add:
                      // unoptimized
                    />
                  )
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-white">
                    {(() => {
                      if (session?.user?.name) return session.user.name.split(' ').map(n => n[0]).join('').toUpperCase();
                      if (session?.user?.username) return session.user.username.slice(0, 2).toUpperCase();
                      return 'U';
                    })()}
                  </div>
                )}
              </div>

              {isEditing && (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="profile-image-upload"
                  />
                  <label
                    htmlFor="profile-image-upload"
                    className="absolute -bottom-2 -right-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full w-10 h-10 flex items-center justify-center text-white hover:bg-white/30 transition-all duration-300 cursor-pointer"
                  >
                    <span className="text-lg">+</span>
                  </label>

                  {hasNewImage && (
                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-xs px-2 py-1 rounded-md bg-emerald-500/80 text-white shadow">
                      image added ✓
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Basic Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold mb-4">{session?.user.username || session?.user.name || "User"}</h1>
              <p className="text-white/80 mb-2">📧 {session?.user.email || "Email"}</p>
              <p className="text-white/80 mb-4">
                📍{" "}
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.location}
                    onChange={(e) => setProfile((prev) => ({ ...prev, location: e.target.value }))}
                    className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white placeholder-white/60 ml-2"
                  />
                ) : (
                  profile.location
                )}
              </p>

              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2">
                  <span className="text-2xl font-bold">{profile.eventsAttended}</span>
                  <p className="text-sm text-white/80">Events Attended</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2">
                  <span className="text-2xl font-bold">{profile.connectionsMade}</span>
                  <p className="text-sm text-white/80">Connections Made</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2">
                  <span className="text-sm font-bold">Member Since</span>
                  <p className="text-sm text-white/80">{profile.joinedDate}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bio Section */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">About Me</h2>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-xl px-6 py-2 text-white hover:shadow-lg transition-all duration-300"
            >
              {isEditing ? "Cancel" : "Edit Profile"}
            </button>
          </div>

          {isEditing ? (
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
              className="w-full h-32 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/60 resize-none"
              placeholder="Tell us about yourself..."
            />
          ) : (
            <p className="text-white/90 leading-relaxed">{profile.bio}</p>
          )}
        </div>

        {/* Interests Section */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Interests</h2>
          <div className="flex flex-wrap gap-3">
            {allInterests.map((interest) => (
              <button
                key={interest}
                onClick={() => isEditing && handleInterestToggle(interest)}
                className={`px-4 py-2 rounded-full border transition-all duration-300 ${
                  profile.interests.includes(interest)
                    ? "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 border-white/30 text-white"
                    : "bg-white/10 border-white/20 text-white/80 hover:bg-white/20"
                } ${isEditing ? "cursor-pointer" : "cursor-default"}`}
                disabled={!isEditing}
              >
                {interest}
              </button>
            ))}
          </div>
          {isEditing && (
            <p className="text-white/60 text-sm mt-4">Click on interests to add or remove them from your profile</p>
          )}
        </div>

        {/* Save Button */}
        {isEditing && (
          <div className="flex justify-center mt-8">
            <button
              onClick={handleSave}
              className="bg-gradient-to-r from-green-500 to-blue-500 rounded-xl px-12 py-4 text-white font-semibold hover:shadow-lg transition-all duration-300"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
