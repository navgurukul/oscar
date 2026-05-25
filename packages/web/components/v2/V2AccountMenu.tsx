"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, LogOut, Settings as SettingsIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ROUTES } from "@/lib/constants";
import { v2, v2Serif, V2Mono } from "@/components/v2/V2Primitives";

function initialsFrom(name: string | null | undefined, email: string | null | undefined) {
  const source = (name || email || "").trim();
  if (!source) return "?";
  if (source.includes("@")) return source.charAt(0).toUpperCase();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export function V2AccountMenu() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      router.push(ROUTES.AUTH);
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }, [router, signOut, signingOut]);

  if (!user) return null;

  const name =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    null;
  const email = user.email ?? null;
  const initial = initialsFrom(name, email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 transition-colors"
        style={{
          background: v2.cream2,
          border: `1px solid ${v2.rule}`,
        }}
      >
        <span
          className="inline-flex items-center justify-center"
          style={{
            height: 26,
            width: 26,
            borderRadius: 999,
            background: v2.ink,
            color: v2.cream,
            fontFamily: v2Serif,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {initial}
        </span>
        <ChevronDown className="h-3.5 w-3.5" style={{ color: v2.inkFaint }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72"
        style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink }}
      >
        <DropdownMenuLabel className="py-2">
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 13, fontWeight: 500, color: v2.ink }}>
              {name || email || "Signed in"}
            </span>
            {name && email && (
              <V2Mono style={{ fontSize: 11, color: v2.inkFaint, letterSpacing: "0.04em" }}>
                {email}
              </V2Mono>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator style={{ background: v2.rule }} />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href={ROUTES.SETTINGS} className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" style={{ color: v2.inkSoft }} />
            <span style={{ fontSize: 13, color: v2.ink }}>Account & billing</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator style={{ background: v2.rule }} />
        <DropdownMenuItem
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="cursor-pointer"
        >
          <LogOut className="h-4 w-4 mr-2" style={{ color: v2.danger }} />
          <span style={{ fontSize: 13, color: v2.danger }}>
            {signingOut ? "Signing out…" : "Sign out"}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
