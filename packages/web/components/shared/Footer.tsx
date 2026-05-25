"use client";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full" style={{ borderTop: "1px solid #e5e0d6" }}>
      <div className="max-w-7xl mx-auto px-6 md:px-14 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm" style={{ color: "#5a5852" }}>
            © {new Date().getFullYear()} Samyak Arth Services Private Limited
          </p>

          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="text-sm transition-colors"
              style={{ color: "#5a5852" }}
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-sm transition-colors"
              style={{ color: "#5a5852" }}
            >
              Terms
            </Link>
            <Link
              href="/refund-policy"
              className="text-sm transition-colors"
              style={{ color: "#5a5852" }}
            >
              Refund Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
