import {ExternalLink} from "lucide-react";
import {stremioTitleLink, type StremioTitle} from "@/lib/stremioLinks";

export function StremioLink({title}: {title: StremioTitle}) {
  const target = stremioTitleLink(title);
  if (!target) return null;
  // Keep a real, synchronous external-protocol link. No router interception,
  // blank browser tab, delayed window.open, install probe or automatic fallback.
  // Opening Stremio must never change the Radar watchlist or watched progress.
  return <a
    href={target.href}
    className="secondary personal-action stremio-link"
    data-testid="stremio-link"
    data-link-mode={target.mode}
    title={target.description}
  ><ExternalLink size={17} aria-hidden="true"/><span>{target.label}</span></a>;
}
