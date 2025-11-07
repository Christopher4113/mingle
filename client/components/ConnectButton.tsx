"use client";

import { Button } from "@/components/ui/button";
import { useConnection, ConnStatus } from "@/hooks/useConnection";
import { UserPlus, Handshake, Clock, Ban } from "lucide-react";

export default function ConnectButton({
  targetUserId,
  size = "sm",
  className = "",
}: {
  targetUserId?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const { status, loading, request, accept, decline } = useConnection(targetUserId);

  const common = { size, className };

  if (!targetUserId) return null;

  if (status === "connected") {
    return (
      <Button {...common} disabled className="bg-white/10 text-white border border-white/20">
        <Handshake className="w-4 h-4 mr-2" />
        Connected
      </Button>
    );
  }

  if (status === "pending_outgoing") {
    return (
      <Button {...common} disabled className="bg-yellow-500/80 text-white">
        <Clock className="w-4 h-4 mr-2" />
        Requested
      </Button>
    );
  }

  if (status === "pending_incoming") {
    return (
      <div className="flex items-center gap-2">
        <Button {...common} disabled={loading} onClick={accept} className="bg-green-500/80 text-white hover:bg-green-600">
          <Handshake className="w-4 h-4 mr-2" />
          Accept
        </Button>
        <Button
          {...common}
          disabled={loading}
          onClick={decline}
          className="bg-red-500/80 text-white hover:bg-red-600"
          variant="destructive"
        >
          <Ban className="w-4 h-4 mr-2" />
          Decline
        </Button>
      </div>
    );
  }

  // none / declined → allow (re)request
  return (
    <Button
      {...common}
      disabled={loading}
      onClick={request}
      className="bg-blue-500/80 text-white hover:bg-blue-600"
    >
      <UserPlus className="w-4 h-4 mr-2" />
      Connect
    </Button>
  );
}
