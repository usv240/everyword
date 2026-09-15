import type { Metadata, Viewport } from "next";
import { Inter, Lexend } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

// Lexend is designed for reading proficiency; it is the reader's typeface.
const lexend = Lexend({
  variable: "--font-reading",
  subsets: ["latin"],
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "EveryWord",
  description:
    "Subtitles that light up word by word as they are spoken. The same proven technique that has given reading practice to 200 million people in India, on your screen.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const themeScript = `(function(){try{var t=localStorage.getItem("ew-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${lexend.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
