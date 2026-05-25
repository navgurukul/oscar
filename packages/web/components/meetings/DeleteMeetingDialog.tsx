"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { v2, v2Serif } from "@/components/v2/V2Primitives";

interface DeleteMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeleteMeetingDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteMeetingDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            style={{
              fontFamily: v2Serif,
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "-0.015em",
              color: v2.ink,
            }}
          >
            Delete this meeting?
          </AlertDialogTitle>
          <AlertDialogDescription style={{ color: v2.inkSoft }}>
            This action cannot be undone. The meeting notes, transcript, and all
            associated data will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isDeleting}
            style={{ background: v2.cream2, border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            style={{ background: v2.danger, color: v2.cream }}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
