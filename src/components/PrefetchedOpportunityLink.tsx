"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

type PrefetchedOpportunityLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

const prefetchedHrefs = new Set<string>();

export function PrefetchedOpportunityLink({
  href,
  className,
  children,
}: PrefetchedOpportunityLinkProps) {
  const router = useRouter();
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  const prefetch = useCallback(() => {
    if (prefetchedHrefs.has(href)) {
      return;
    }

    prefetchedHrefs.add(href);
    router.prefetch(href);
  }, [href, router]);

  useEffect(() => {
    const link = linkRef.current;

    if (!link) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      prefetch();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          prefetch();
          observer.disconnect();
        }
      },
      { rootMargin: "160px 0px" },
    );

    observer.observe(link);

    return () => observer.disconnect();
  }, [prefetch]);

  return (
    <Link
      ref={linkRef}
      href={href}
      prefetch
      className={className}
      onFocus={prefetch}
      onPointerEnter={prefetch}
      onTouchStart={prefetch}
    >
      {children}
    </Link>
  );
}
