"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { USER_ROLES } from "@/lib/constants";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <Button variant="ghost" disabled>로딩 중...</Button>;
  }

  if (!session?.user) {
    return (
      <Link href="/auth/signin">
        <Button variant="ghost">로그인</Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          {session.user.name || session.user.email}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{session.user.name || "사용자"}</p>
            <p className="text-xs text-muted-foreground">{session.user.email}</p>
            {session.user.role && (
              <p className="text-xs text-muted-foreground">
                {USER_ROLES[session.user.role as keyof typeof USER_ROLES]}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Link href="/dashboard">
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            대시보드
          </DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}




import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { USER_ROLES } from "@/lib/constants";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <Button variant="ghost" disabled>로딩 중...</Button>;
  }

  if (!session?.user) {
    return (
      <Link href="/auth/signin">
        <Button variant="ghost">로그인</Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          {session.user.name || session.user.email}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{session.user.name || "사용자"}</p>
            <p className="text-xs text-muted-foreground">{session.user.email}</p>
            {session.user.role && (
              <p className="text-xs text-muted-foreground">
                {USER_ROLES[session.user.role as keyof typeof USER_ROLES]}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Link href="/dashboard">
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            대시보드
          </DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}




import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { USER_ROLES } from "@/lib/constants";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <Button variant="ghost" disabled>로딩 중...</Button>;
  }

  if (!session?.user) {
    return (
      <Link href="/auth/signin">
        <Button variant="ghost">로그인</Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          {session.user.name || session.user.email}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{session.user.name || "사용자"}</p>
            <p className="text-xs text-muted-foreground">{session.user.email}</p>
            {session.user.role && (
              <p className="text-xs text-muted-foreground">
                {USER_ROLES[session.user.role as keyof typeof USER_ROLES]}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Link href="/dashboard">
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            대시보드
          </DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}





