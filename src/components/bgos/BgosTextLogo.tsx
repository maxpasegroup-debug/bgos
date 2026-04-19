import Link from "next/link";
import { textGradientLogo } from "@/styles/design-system";

type Props = {
  href?: string;
  className?: string;
  /** Larger type for header brand */
  size?: "md" | "lg";
};

export function BgosTextLogo({ href = "/", className = "", size = "md" }: Props) {
  const text =
    size === "lg" ? "text-lg sm:text-xl" : "text-base sm:text-lg";
  const inner = (
    <span
      className={`inline-block font-extrabold uppercase ${textGradientLogo} ${text} ${className}`}
    >
      BGOS
    </span>
  );
  if (href) {
    return (
      <Link href={href} className="shrink-0" aria-label="BGOS home">
        {inner}
      </Link>
    );
  }
  return inner;
}
