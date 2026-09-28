/**
 * GeoSync — Brand mark + wordmark
 */
import React from "react";

type LogoProps = {
  /** Height of the mark in px */
  size?: number;
  /** Show the "GeoSync" wordmark next to the mark */
  withText?: boolean;
  /** Optional tagline under the wordmark */
  tagline?: string;
  /** Render the wordmark in white (for dark backgrounds) */
  inverted?: boolean;
  className?: string;
};

export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/geosync-mark.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`flex-shrink-0 ${className}`}
    />
  );
}

export default function Logo({ size = 32, withText = true, tagline, inverted = false, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {withText && (
        <span className="leading-tight">
          <span
            className={`block font-heading font-bold tracking-tight ${inverted ? "text-white" : "text-slate-900"}`}
            style={{ fontSize: Math.max(16, size * 0.58) }}
          >
            Geo<span className={inverted ? "text-brand-300" : "text-brand-600"}>Sync</span>
          </span>
          {tagline && (
            <span className={`hidden sm:block text-[11px] font-medium ${inverted ? "text-slate-400" : "text-slate-500"}`}>
              {tagline}
            </span>
          )}
        </span>
      )}
      {!withText && <span className="sr-only">GeoSync</span>}
    </span>
  );
}
