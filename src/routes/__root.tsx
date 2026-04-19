import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Mays Secret — Fragrances composed for the moments that linger" },
      { name: "description", content: "Mays Secret is a luxury fragrance house. Discover signature scents for men, women and unisex, crafted with rare ingredients." },
      { property: "og:title", content: "Mays Secret — Luxury Fragrance House" },
      { property: "og:description", content: "Signature fragrances for the moments that linger." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Inter:wght@300;400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: () => <Outlet />,
  notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-luxe text-muted-foreground">404</p>
        <h1 className="mt-4 font-display text-5xl">Lost in the air</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page has drifted away. Let us guide you back.</p>
        <a href="/" className="mt-8 inline-block border-b border-foreground pb-1 text-xs uppercase tracking-luxe">Return home</a>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
