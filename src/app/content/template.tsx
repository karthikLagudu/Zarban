// Re-mounts on every /content/* navigation, so each page cross-fades in smoothly.
export default function ContentTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page">{children}</div>;
}
