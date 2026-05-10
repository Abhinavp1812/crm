"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import {
  CameraIcon,
  CheckIcon,
  XMarkIcon,
  PencilIcon,
  LockClosedIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  // Super Admin has no DB record — block access
  useEffect(() => {
    if (session?.user?.id === "super-admin") router.replace("/");
  }, [session, router]);
  const userName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";
  const userRole = session?.user?.role ?? "";
  const photoUpdatedAt = session?.user?.photoUpdatedAt ?? 0;

  // Name edit
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(userName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Photo — localPhotoVersion overrides the session version immediately after upload
  // so the profile page shows the new photo without waiting for session propagation
  const [localPhotoVersion, setLocalPhotoVersion] = useState<number | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveVersion = localPhotoVersion ?? photoUpdatedAt;
  const photoApiSrc = effectiveVersion > 0 ? `/api/profile/photo?v=${effectiveVersion}` : null;
  const [photoErr, setPhotoErr] = useState(false);
  useEffect(() => { setPhotoErr(false); }, [effectiveVersion]);

  // Display: during selection show the local preview blob; after save use the API URL
  const displayPhoto = photoPreview ?? (photoApiSrc && !photoErr ? photoApiSrc : null);
  const avatar = userName.charAt(0).toUpperCase();

  async function saveName() {
    if (!nameValue.trim()) return;
    setNameSaving(true);
    setNameMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await update();
      router.refresh();
      setEditingName(false);
      setNameMsg({ type: "ok", text: "Name updated." });
    } catch (e) {
      setNameMsg({ type: "err", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setNameSaving(false);
    }
  }

  async function savePassword() {
    setPwMsg(null);
    if (!currentPassword || !newPassword) {
      setPwMsg({ type: "err", text: "Fill in all password fields." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "err", text: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg({ type: "err", text: "New password must be at least 6 characters." });
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMsg({ type: "ok", text: "Password changed successfully." });
    } catch (e) {
      setPwMsg({ type: "err", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setPwSaving(false);
    }
  }

  function onPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      setPhotoMsg({ type: "err", text: "Image must be under 2 MB." });
      return;
    }
    setPhotoFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
    setPhotoMsg(null);
  }

  async function uploadPhoto() {
    if (!photoFile) return;
    setPhotoUploading(true);
    setPhotoMsg(null);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile);
      const res = await fetch("/api/profile/photo", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      // Use returned timestamp to bust the cache immediately on this page
      setLocalPhotoVersion(data.photoUpdatedAt);
      setPhotoFile(null);
      setPhotoPreview(null);
      setPhotoMsg({ type: "ok", text: "Photo updated." });
      await update();
      router.refresh();
    } catch (e) {
      setPhotoMsg({ type: "err", text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setPhotoUploading(false);
    }
  }

  async function removePhoto() {
    setPhotoUploading(true);
    setPhotoMsg(null);
    try {
      const res = await fetch("/api/profile/photo", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove photo");
      setLocalPhotoVersion(null);
      setPhotoPreview(null);
      setPhotoFile(null);
      setPhotoMsg({ type: "ok", text: "Photo removed." });
      await update();
      router.refresh();
    } catch (e) {
      setPhotoMsg({ type: "err", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setPhotoUploading(false);
    }
  }

  function cancelPhotoSelect() {
    setPhotoPreview(null);
    setPhotoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

        {/* Photo section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Profile Photo</h2>
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {displayPhoto ? (
                <img
                  src={displayPhoto}
                  alt={userName}
                  className="w-20 h-20 rounded-full object-cover ring-2 ring-blue-100"
                  onError={() => setPhotoErr(true)}
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold ring-2 ring-blue-100">
                  {avatar}
                </div>
              )}
              {photoPreview && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-[9px] font-bold">NEW</span>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2">
              {!photoPreview ? (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
                  >
                    <CameraIcon className="h-4 w-4" />
                    {displayPhoto ? "Change photo" : "Upload photo"}
                  </button>
                  {(photoApiSrc || localPhotoVersion) && (
                    <button
                      onClick={removePhoto}
                      disabled={photoUploading}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-red-200 hover:bg-red-50 text-red-600 disabled:opacity-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Remove
                    </button>
                  )}
                </>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={uploadPhoto}
                    disabled={photoUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <CheckIcon className="h-4 w-4" />
                    {photoUploading ? "Uploading…" : "Save photo"}
                  </button>
                  <button
                    onClick={cancelPhotoSelect}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-400">JPG, PNG or WEBP · max 2 MB</p>
            </div>
          </div>

          {photoMsg && (
            <p className={"mt-3 text-sm " + (photoMsg.type === "ok" ? "text-green-700" : "text-red-700")}>
              {photoMsg.text}
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPhotoSelect}
          />
        </div>

        {/* Info + name section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Account Info</h2>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Display name</label>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={saveName}
                    disabled={nameSaving || !nameValue.trim()}
                    className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <CheckIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setEditingName(false); setNameValue(userName); setNameMsg(null); }}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{userName}</span>
                  <button
                    onClick={() => { setEditingName(true); setNameValue(userName); setNameMsg(null); }}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </div>
              )}
              {nameMsg && (
                <p className={"mt-1.5 text-xs " + (nameMsg.type === "ok" ? "text-green-700" : "text-red-700")}>
                  {nameMsg.text}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <p className="text-sm text-gray-700">{userEmail}</p>
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
              <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 uppercase tracking-wide">
                {userRole}
              </span>
            </div>
          </div>
        </div>

        {/* Password section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <LockClosedIcon className="h-4 w-4" />
            Change Password
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            {pwMsg && (
              <p className={"text-sm " + (pwMsg.type === "ok" ? "text-green-700" : "text-red-700")}>
                {pwMsg.text}
              </p>
            )}

            <button
              onClick={savePassword}
              disabled={pwSaving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {pwSaving ? "Saving…" : "Update password"}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
