"use client";

export function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`qc-glass ${className}`}>{children}</div>;
}
