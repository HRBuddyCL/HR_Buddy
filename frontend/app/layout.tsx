import type { Metadata } from "next";
import { Kanit, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { Navbar } from "./_components/navbar";

const headlineFont = Kanit({
  subsets: ["latin", "thai"],
  weight: ["700"],
  variable: "--font-headline",
  display: "swap",
});

const contentFont = Noto_Sans_Thai({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-content",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HR Buddy - ระบบจัดการคำขอพนักงาน",
  description: "ระบบจัดการคำขอและบริการสำหรับพนักงานบริษัท Construction Lines",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${contentFont.variable} ${headlineFont.variable} antialiased pt-20`}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}