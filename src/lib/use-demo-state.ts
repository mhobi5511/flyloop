"use client";

import { useEffect, useState } from "react";
import {
  initialDemoState,
  readDemoState,
  subscribeDemoState,
  writeDemoState,
  type DemoState,
} from "./demo-store";

export function useDemoState() {
  const [state, setState] = useState<DemoState>(() =>
    typeof window === "undefined" ? initialDemoState : readDemoState(),
  );

  useEffect(() => {
    return subscribeDemoState(() => setState(readDemoState()));
  }, []);

  function updateState(nextState: DemoState) {
    setState(writeDemoState(nextState));
  }

  return [state, updateState] as const;
}
