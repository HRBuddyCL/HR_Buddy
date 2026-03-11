import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "./_components/navbar";

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
      <body className="antialiased pt-20">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
