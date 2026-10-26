import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "정기점검 관리",
  description: "복사기 정기점검 관리",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
