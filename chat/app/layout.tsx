import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Tasks Agent",
  description: "assistant-ui + AI SDK agent chat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
