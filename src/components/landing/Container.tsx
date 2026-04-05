import type { ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

/** max-width 1200px, centered — aligned horizontal padding on all breakpoints */
export function Container({ children, className = "" }: ContainerProps) {
  return (
    <div
      className={`mx-auto w-full max-w-[1200px] px-6 sm:px-8 lg:px-10 ${className}`}
    >
      {children}
    </div>
  );
}
