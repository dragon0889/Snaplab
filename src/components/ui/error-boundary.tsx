"use client";

import { Component, type ReactNode } from "react";

/**
 * Keeps one broken part of the page (e.g. a 3D scene when WebGL is unavailable) from taking the whole page down.
 * `fallback` receives a `reset` function so the student can try again.
 */
export class ErrorBoundary extends Component<
  { fallback: (reset: () => void) => ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("A part of the page failed to load:", error);
  }

  reset = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}
