"use client";

import {
  type HTMLAttributes,
  type PointerEvent,
  useEffect,
  useRef,
} from "react";

type ModalBackdropProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onPointerDown" | "onPointerUp" | "onPointerCancel"
> & {
  onBackdropClick?: () => void;
};

export function ModalBackdrop({
  onBackdropClick,
  ...props
}: ModalBackdropProps) {
  const pointerStartedOnBackdrop = useRef(false);

  useEffect(() => {
    return () => {
      pointerStartedOnBackdrop.current = false;
    };
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerStartedOnBackdrop.current = event.target === event.currentTarget;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const endedOnBackdrop = event.target === event.currentTarget;

    if (pointerStartedOnBackdrop.current && endedOnBackdrop) {
      onBackdropClick?.();
    }

    pointerStartedOnBackdrop.current = false;
  }

  function handlePointerCancel() {
    pointerStartedOnBackdrop.current = false;
  }

  return (
    <div
      {...props}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
}
