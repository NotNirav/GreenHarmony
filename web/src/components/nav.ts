import { BookOpen, Home, Lightbulb, Sprout, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/plants/", label: "Plants", icon: BookOpen },
  { href: "/garden/", label: "My garden", icon: Sprout },
  { href: "/insights/", label: "Insights", icon: Lightbulb },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  const base = href.replace(/\/$/, "");
  // Segment match, so "/plan" is not active on "/plants".
  return pathname === base || pathname.startsWith(base + "/");
}
