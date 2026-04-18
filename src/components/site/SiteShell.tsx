import { Outlet } from "@tanstack/react-router";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function SiteShell() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
