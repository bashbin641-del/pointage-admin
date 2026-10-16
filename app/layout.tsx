import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Administration | INOX PRÉSENCE",
  description: "Administration des présences INOX PRÉSENCE",
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
