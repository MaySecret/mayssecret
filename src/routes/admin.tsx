import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAdminAuth } from "@/lib/admin-auth";
import { useEffect } from "react";

export const Route = createFileRoute("/admin")({
  component: AdminGate,
});

function AdminGate() {
  const { user, isAdmin, loading, signOut } = useAdminAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isLogin = path === "/admin/login";

  useEffect(() => {
    if (loading) return;
    if (!user && !isLogin) navigate({ to: "/admin/login" });
  }, [user, loading, isLogin, navigate]);

  if (loading) return <FullScreen>Loading…</FullScreen>;
  if (isLogin) return <Outlet />;
  if (!user) return <FullScreen>Redirecting…</FullScreen>;

  if (!isAdmin) {
    return (
      <FullScreen>
        <div className="max-w-md text-center">
          <p className="text-xs uppercase tracking-luxe text-destructive">Access denied</p>
          <h1 className="mt-3 font-display text-3xl">Not an admin</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your account ({user.email}) does not have admin access. Ask the store owner to grant the admin role.
          </p>
          <button onClick={signOut} className="mt-6 border border-border px-5 py-2 text-xs uppercase tracking-luxe">Sign out</button>
        </div>
      </FullScreen>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 flex-shrink-0 border-r border-border bg-cream/40 md:block">
        <div className="p-6">
          <Link to="/" className="font-display text-2xl">May's Secret<span className="text-accent">.</span></Link>
          <p className="mt-1 text-xs uppercase tracking-luxe text-muted-foreground">Admin</p>
        </div>
        <nav className="px-3 pb-6 text-sm">
          <NavItem to="/admin">Dashboard</NavItem>
          <NavItem to="/admin/products">Products</NavItem>
          <NavItem to="/admin/orders">Orders</NavItem>
          <NavItem to="/admin/inventory">Inventory</NavItem>
          <NavItem to="/admin/settings">Settings</NavItem>
        </nav>
        <button
          onClick={signOut}
          className="mx-3 mt-4 w-[calc(100%-1.5rem)] border border-border px-3 py-2 text-xs uppercase tracking-luxe hover:bg-background"
        >
          Sign out
        </button>
      </aside>
      <div className="flex-1 overflow-x-auto">
        <Outlet />
      </div>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/admin" }}
      className="block rounded-sm px-3 py-2 text-foreground/80 hover:bg-background"
      activeProps={{ className: "block rounded-sm px-3 py-2 bg-background text-foreground font-medium" }}
    >
      {children}
    </Link>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-background p-6">{children}</div>;
}
