"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const COVER_DURATION_MS = 360;

type TransitionTarget = Readonly<{ href: string; label: string }>;
type WorldTransitionContextValue = (target: TransitionTarget) => void;
const WorldTransitionContext =
  createContext<WorldTransitionContextValue | null>(null);

function supportsNativeViewTransition(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function"
  );
}

// The browser's support for the API never changes over a session, so the
// "subscribe" side is a no-op -- this exists purely to read a client/server-
// divergent value without a hydration mismatch (the useEffect+setState
// equivalent is the documented anti-pattern useSyncExternalStore replaces).
function subscribeToNothing(): () => void {
  return () => {};
}

function getServerSnapshot(): boolean {
  return false;
}

function useNativeViewTransitionSupport(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    supportsNativeViewTransition,
    getServerSnapshot,
  );
}

function coverClassName(target: TransitionTarget): string {
  return `world-transition ${target.href.startsWith("/kwaliti-print") ? "world-transition--kwaliti" : "world-transition--pixel"}`;
}

export function WorldTransitionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [target, setTarget] = useState<TransitionTarget | null>(null);
  const useNativeTransition = useNativeViewTransitionSupport();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Kept in sync via effect (not during render) so the pathname-change
  // effect below can read the latest target without depending on it --
  // depending on it would re-run this effect on every navigate() call,
  // not just on real route changes.
  const targetRef = useRef<TransitionTarget | null>(null);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    const resetId = setTimeout(() => {
      if (useNativeTransition && targetRef.current) {
        document.startViewTransition(() => flushSync(() => setTarget(null)));
      } else {
        setTarget(null);
      }
    }, 0);
    return () => clearTimeout(resetId);
  }, [pathname, useNativeTransition]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const navigate = useCallback(
    (next: TransitionTarget) => {
      if (next.href === pathname || target) return;
      if (reduceMotion) {
        router.push(next.href);
        return;
      }
      if (useNativeTransition) {
        document.startViewTransition(() => flushSync(() => setTarget(next)));
      } else {
        setTarget(next);
      }
      timeoutRef.current = setTimeout(
        () => router.push(next.href),
        COVER_DURATION_MS,
      );
    },
    [pathname, reduceMotion, router, target, useNativeTransition],
  );

  return (
    <WorldTransitionContext.Provider value={navigate}>
      {children}
      {useNativeTransition ? (
        target ? (
          <div className={coverClassName(target)} role="status" aria-live="polite">
            <span>Changer d’univers</span>
            <strong>{target.label}</strong>
          </div>
        ) : null
      ) : (
        <AnimatePresence>
          {target ? (
            <motion.div
              key={target.href}
              className={coverClassName(target)}
              initial={{ clipPath: "inset(100% 0 0 0)" }}
              animate={{ clipPath: "inset(0% 0 0 0)" }}
              exit={{ opacity: 0 }}
              transition={{
                clipPath: { duration: 0.36, ease: [0.76, 0, 0.24, 1] },
                opacity: { duration: 0.14 },
              }}
              role="status"
              aria-live="polite"
            >
              <span>Changer d’univers</span>
              <strong>{target.label}</strong>
            </motion.div>
          ) : null}
        </AnimatePresence>
      )}
    </WorldTransitionContext.Provider>
  );
}

export function WorldTransitionLink({
  href,
  label,
  children,
  className,
  role,
  onNavigate,
}: Readonly<{
  href: string;
  label: string;
  children: ReactNode;
  className?: string;
  role?: string;
  onNavigate?: () => void;
}>) {
  const navigate = useContext(WorldTransitionContext);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onNavigate?.();
    if (!navigate || isModifiedClick(event)) return;
    event.preventDefault();
    navigate({ href, label });
  }

  return (
    <Link href={href} className={className} role={role} onClick={handleClick}>
      {children}
    </Link>
  );
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}
