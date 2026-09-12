import { useState, useEffect } from "react";
import LandingPage from "@/pages/LandingPage";
import TrackingResult from "@/pages/TrackingResult";
import AdminPage from "@/pages/AdminPage";

type View = { screen: "landing" } | { screen: "tracking"; code: string } | { screen: "admin" };

function App() {
  const initialCode = new URLSearchParams(window.location.search).get("code")?.trim().toUpperCase() ?? "";
  const [view, setView] = useState<View>(
    initialCode ? { screen: "tracking", code: initialCode } : { screen: "landing" }
  );

  useEffect(() => {
    if (view.screen === "tracking") {
      const url = new URL(window.location.href);
      url.searchParams.set("code", view.code);
      window.history.replaceState(null, "", url.toString());
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      window.history.replaceState(null, "", url.toString());
    }
  }, [view]);

  if (view.screen === "tracking") {
    return (
      <TrackingResult
        code={view.code}
        onBack={() => setView({ screen: "landing" })}
        onAdmin={() => setView({ screen: "admin" })}
      />
    );
  }

  if (view.screen === "admin") {
    return (
      <AdminPage
        onBack={() => setView({ screen: "landing" })}
        onTrack={(code) => setView({ screen: "tracking", code })}
      />
    );
  }

  return (
    <LandingPage
      onTrack={(code) => setView({ screen: "tracking", code })}
      onAdmin={() => setView({ screen: "admin" })}
    />
  );
}

export default App;
