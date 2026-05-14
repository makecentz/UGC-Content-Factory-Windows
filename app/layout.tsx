import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "UGC Content Factory Kids",
  description: "Local-first Windows kids story video generator",
  icons: {
    icon: "/ugccflogo.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Sidebar />
        <main className="min-h-screen bg-white pl-72">
          <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
