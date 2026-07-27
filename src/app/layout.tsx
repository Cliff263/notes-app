import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { AppChrome } from "@/components/app-chrome";
import { AuthStateSync } from "@/components/auth/auth-state-sync";
import { MotionProvider } from "@/components/motion/motion-provider";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Nexora",
    template: "%s · Nexora",
  },
  description:
    "Nexora is an intelligent note-taking workspace for capturing ideas, organizing knowledge, and thinking with AI.",
  applicationName: "Nexora",
  keywords: ["notes", "knowledge", "productivity", "AI workspace"],
  openGraph: {
    title: "Nexora — Ideas, evolved.",
    description: "Futuristic note-taking for modern minds.",
    siteName: "Nexora",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Nexora — Ideas, evolved.",
    description: "Futuristic note-taking for modern minds.",
  },
  appleWebApp: { capable: true, title: "Nexora", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the app paint under the notch; safe-area padding is applied in CSS.
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#f4f4f5" },
  ],
};

/** Applies the stored theme before paint so there is no light-mode flash. */
const themeScript = `(function(){try{var t=localStorage.getItem("nexora-theme")||localStorage.getItem("square-theme")||"dark";document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <SessionProvider
          refetchInterval={5 * 60}
          refetchOnWindowFocus
          refetchWhenOffline={false}
        >
          <QueryProvider>
            <AuthStateSync />
            <ThemeProvider>
              <MotionProvider>
                {children}
                <AppChrome />
              </MotionProvider>
            </ThemeProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
