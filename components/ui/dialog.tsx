"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface DialogProps {
  open: boolean;
  title?: string;
  description?: React.ReactNode;
  onClose: () => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-[90%] max-w-md rounded-xl bg-slate-900 border border-cyan-700/30 shadow-xl p-6">
        {title && (
          <h2 className="text-xl font-semibold text-white mb-3">{title}</h2>
        )}
        {description && (
          <div className="text-gray-300 mb-6 text-sm whitespace-pre-wrap">
            {description}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          {secondaryActionLabel && (
            <Button variant="ghost" onClick={onSecondaryAction || onClose}>
              {secondaryActionLabel}
            </Button>
          )}
          {primaryActionLabel && (
            <Button onClick={onPrimaryAction || onClose}>{primaryActionLabel}</Button>
          )}
        </div>
      </div>
    </div>
  );
}