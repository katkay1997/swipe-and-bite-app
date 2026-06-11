import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";

import appCss from "../styles.css?url";
import { applyA11y, getA11y, A11Y_KEYS } from "@/lib/a11y";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "swipe&bite-cook your match" },
      { name: "description", content: "Swipe&Bite helps you discover meals to cook and find grocery stores near you. Fall in love with your next match" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "swipe&bite-cook your match" },
      { property: "og:description", content: "Swipe&Bite helps you discover meals to cook and find grocery stores near you. Fall in love with your next match" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "swipe&bite-cook your match" },
      { name: "twitter:description", content: "Swipe&Bite helps you discover meals to cook and find grocery stores near you. Fall in love with your next match" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b0ffde38-a8a3-40e2-9394-1ba75eab6186/id-preview-2680e1a6--6faf8ba1-19ed-4a0d-9c06-75c818ed25d7.lovable.app-1778857714095.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b0ffde38-a8a3-40e2-9394-1ba75eab6186/id-preview-2680e1a6--6faf8ba1-19ed-4a0d-9c06-75c818ed25d7.lovable.app-1778857714095.png" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,900&family=DM+Sans:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

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

function RootComponent() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    applyA11y();
    setReduce(getA11y().reduceMotion);
    const sync = () => {
      applyA11y();
      setReduce(getA11y().reduceMotion);
    };
    window.addEventListener("storage", sync);
    window.addEventListener("sb:a11y", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("sb:a11y", sync);
    };
  }, []);
  return (
    <MotionConfig reducedMotion={reduce ? "always" : "never"}>
      <Outlet />
      <Toaster richColors position="top-center" />
    </MotionConfig>
  );
}
