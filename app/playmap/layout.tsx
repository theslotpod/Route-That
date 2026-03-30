// PlayMap fills the space below the nav bar
export default function PlayMapLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", height: "calc(100vh - 60px)", overflow: "hidden", background: "#000" }}>
      {children}
    </div>
  );
}
