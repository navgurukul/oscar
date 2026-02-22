"use client";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full border-t border-gray-800/50 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Copyright */}
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} OSCAR
          </p>

          {/* Legal Links */}
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="text-gray-500 text-sm hover:text-cyan-400 transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-gray-500 text-sm hover:text-cyan-400 transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/refund-policy"
              className="text-gray-500 text-sm hover:text-cyan-400 transition-colors"
            >
              Refund Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
