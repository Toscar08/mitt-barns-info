import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Button } from "@/components/ui/button";
import { Spotlight } from "@/components/Spotlight";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { PrefsProvider } from "@/lib/prefs";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="surface rise w-full max-w-sm p-8 text-center">
        <p className="text-6xl font-semibold tracking-tight text-accent tabular-nums">404</p>
        <h1 className="mt-4 text-xl">Sidan finns inte</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sidan du letar efter finns inte eller har flyttats.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Till startsidan</Link>
        </Button>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: import("@tanstack/react-router").ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="surface w-full max-w-sm p-8 text-center">
        <h1 className="text-xl">Sidan kunde inte laddas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Något gick fel. Prova att ladda om eller gå tillbaka till startsidan.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Försök igen
          </Button>
          <Button asChild variant="outline">
            <a href="/">Till startsidan</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Barnmappen – samla allt om ditt barn" },
      {
        name: "description",
        content:
          "En trygg digital mapp per barn: hälsa, dokument, anteckningar och uppgifter – med AI-assistent.",
      },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Barnmappen" },
      { name: "theme-color", content: "#E3EBF7" },
      { property: "og:title", content: "Barnmappen" },
      {
        property: "og:description",
        content: "Samla allt viktigt om ditt barn på ett säkert ställe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      // DM Sans is bundled with the app (see styles.css), so no visitor's address is sent to Google.
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const prefsBootScript = `try{var t=localStorage.getItem('barnmappen.theme');if(t==='dark'){document.documentElement.classList.add('dark')}var l=localStorage.getItem('barnmappen.lang');if(l==='sv'||l==='en'){document.documentElement.lang=l}}catch(e){}try{if('serviceWorker' in navigator&&window.self===window.top&&!/lovableproject|id-preview/.test(location.hostname)){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}}catch(e){}`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: prefsBootScript }} />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthSync() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        return;
      }
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <PrefsProvider>
        <AuthSync />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster />
        <Spotlight />
      </PrefsProvider>
    </QueryClientProvider>
  );
}
