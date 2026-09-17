import { useState, useEffect } from "react";
import LandingPage from "@/pages/LandingPage";
import TrackingResult from "@/pages/TrackingResult";
import AdminPage from "@/pages/AdminPage";

type View = { screen: "landing" } | { screen: "tracking"; code: string } | { screen: "admin" };

function App() {
  const getInitialView = (): View => {
    const searchParams = new URLSearchParams(window.location.search);
    const initialCode = searchParams.get("code")?.trim().toUpperCase() ?? "";
    if (initialCode) return { screen: "tracking", code: initialCode };
    if (window.location.pathname === "/admin" || searchParams.has("admin")) {
      return { screen: "admin" };
    }
    return { screen: "landing" };
  };

  const [view, setView] = useState<View>(getInitialView);

  useEffect(() => {
    const handlePopState = () => {
      setView(getInitialView());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (view.screen === "tracking") {
      url.pathname = "/";
      url.searchParams.delete("admin");
      url.searchParams.set("code", view.code);
      window.history.replaceState(null, "", url.toString());
    } else if (view.screen === "admin") {
      url.pathname = "/admin";
      url.searchParams.delete("code");
      window.history.replaceState(null, "", url.toString());
    } else {
      url.pathname = "/";
      url.searchParams.delete("code");
      url.searchParams.delete("admin");
      window.history.replaceState(null, "", url.toString());
    }
  }, [view]);

  if (view.screen === "tracking") {
    return (
      <TrackingResult
        code={view.code}
        onBack={() => setView({ screen: "landing" })}
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
    />
  );
}

export default App;
