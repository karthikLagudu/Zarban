// Re-mounts on every /admin/* navigation, so each page cross-fades in smoothly.
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page">{children}</div>;
}
