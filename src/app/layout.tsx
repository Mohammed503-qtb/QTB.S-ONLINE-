import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { QueryProvider } from "@/components/app/providers";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "متجر الأصيل — تسوق بثقة",
  description: "متجر إلكتروني يمني متكامل: أزياء، عطور، إلكترونيات وأكثر مع توصيل لجميع المحافظات ودفع بالتحويل البنكي أو عند الاستلام.",
  keywords: ["متجر", "اليمن", "تسوق", "عطور", "أزياء", "إلكترونيات"],
};

export const viewport: Viewport = {
  themeColor: "#0d9468",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <QueryProvider>
            {children}
            <Toaster position="top-center" richColors closeButton dir="rtl" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
