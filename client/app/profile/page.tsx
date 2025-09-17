"use client"

import type React from "react"
import { useState,useEffect } from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import axios from "axios"
import { dataUrlToBlob } from "@/helpers/dataUrlToBlob"
import { useEdgeStore } from "@/lib/edgestore"

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const [isEditing, setIsEditing] = useState(false)
  const [profileImage, setProfileImage] = useState<string | File | null>(null)
  const { edgestore } = useEdgeStore()
  const [profile, setProfile] = useState({
    bio: "Passionate about connecting with like-minded individuals and exploring new opportunities in tech and creativity.",
    location: "San Francisco, CA",
    interests: ["Networking", "Social", "Creative", "Learning", "Wellness" ],
    joinedDate: "January 2024",
    eventsAttended: 12,
    connectionsMode: 8,
  })

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
      if (status === "authenticated") {
        fetch("/api/set-token", {
          method: "GET",
          credentials: "include", // very important to include the cookie
        }).then((res) => {
          if (!res.ok) {
            console.error("Failed to set custom JWT cookie")
          }
        })
      }
  }, [status])
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
      let imageUrl: string | undefined

      // 1) If there's a new image, upload it to EdgeStore and grab the URL
      if (profileImage) {
        if (profileImage instanceof File) {
          const { url } = await edgestore.myPublicFiles.upload({ file: profileImage })
          imageUrl = url
        } else if (typeof profileImage === "string" && profileImage.startsWith("data:")) {
          // convert dataURL -> Blob -> File for upload
          const blob = await dataUrlToBlob(profileImage)
          const file = new File([blob], `profile-${Date.now()}.png`, { type: blob.type || "image/png" })
          const { url } = await edgestore.myPublicFiles.upload({ file })
          imageUrl = url
        } else if (typeof profileImage === "string") {
          // already a hosted URL (rare in this flow)
          imageUrl = profileImage
        }
      }

      // 2) Build JSON payload for your backend
      const payload = {
        bio: profile.bio,
        location: profile.location,
        interests: profile.interests,
        profileImageUrl: imageUrl, // may be undefined if user didn’t change image
      }

      // 3) Send PUT with JWT in Authorization + cookies (belt & suspenders)
      const token = getCookie("token")
      const res = await axios.put("/api/users/profile", payload, {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (res.data?.ok) {
        const u = res.data.user
        setProfile((prev) => ({
          ...prev,
          bio: u.bio ?? prev.bio,
          location: u.location ?? prev.location,
          interests: Array.isArray(u.interests) ? u.interests : prev.interests,
        }))
        if (u.image) setProfileImage(u.image)
        setIsEditing(false)
      } else {
        console.error(res.data)
        alert("Failed to save profile.")
      }
    } catch (e) {
      console.error(e)
      alert("Something went wrong while saving.")
    }
  }

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
              <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-pink-400 rounded-full flex items-center justify-center text-4xl font-bold text-white overflow-hidden">
                {(() => {
                    if (session?.user.name) {
                        return session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase();
                    }
                    if (session?.user.username) {
                        return session.user.username.slice(0, 2).toUpperCase();
                    }
                    return "U";
                })()}
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
                  <span className="text-2xl font-bold">{profile.connectionsMode}</span>
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
