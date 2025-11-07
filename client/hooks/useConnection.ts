"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";

export type ConnStatus =
  | "none"
  | "pending_outgoing"
  | "pending_incoming"
  | "connected"
  | "declined";

export function useConnection(targetUserId?: string | null) {
  const [status, setStatus] = useState<ConnStatus>("none");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!targetUserId) return;
    try {
      const res = await axios.get<{ ok: true; status: ConnStatus }>(
        `/api/users/connect/${targetUserId}`
      );
      if (res.data?.ok) setStatus(res.data.status);
    } catch {
      // ignore
    }
  }, [targetUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const request = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      await axios.post(`/api/users/connect/${targetUserId}`);
      setStatus("pending_outgoing");
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  const accept = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      await axios.patch(`/api/users/connect/${targetUserId}`, { action: "accept" });
      setStatus("connected");
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  const decline = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      await axios.patch(`/api/users/connect/${targetUserId}`, { action: "decline" });
      setStatus("declined");
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  return { status, loading, refresh, request, accept, decline };
}
