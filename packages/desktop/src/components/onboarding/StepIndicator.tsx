import { Fragment, type MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WINDOW_DRAG_BLOCKERS } from "../../lib/desktop-constants";

interface StepIndicatorProps {
  currentStep: "signin" | "permissions" | "setup";
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps = [
    { id: "signin", label: "SIGN IN" },
    { id: "permissions", label: "PERMISSIONS" },
    { id: "setup", label: "SET UP" },
  ] as const;

  const currentIndex = steps.findIndex((step) => step.id === currentStep);

  const handleTitleBarDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(WINDOW_DRAG_BLOCKERS)) return;

    void getCurrentWindow().toggleMaximize().catch(() => {});
  };

  return (
    <div
      data-tauri-drag-region
      className="step-indicator onboarding-titlebar drag-region"
      onDoubleClick={handleTitleBarDoubleClick}
    >
      {steps.map((step, index) => (
        <Fragment key={step.id}>
          <div className={`step-item ${index <= currentIndex ? "active" : ""}`}>
            <span className="step-label">{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <svg
              className="step-arrow"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
        </Fragment>
      ))}
    </div>
  );
}
