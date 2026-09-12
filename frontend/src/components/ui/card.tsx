import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Raised depth treatment — a layered shadow that lifts the card off
   * the page. For stat tiles and other surfaces that should read as
   * "objects", not "regions". */
  elevated?: boolean;
  /** Frosted translucent surface with a lit top edge. Best over a
   * gradient or image background, where plain white would look like a
   * hole punched in the page. */
  glass?: boolean;
  /** Leans toward the viewer on hover. Reserve this for small grids of
   * cards — on a long list it turns into visual noise. */
  tilt?: boolean;
  /** Gentle lift on hover; the calmer alternative to `tilt`. */
  lift?: boolean;
}

export function Card({ className, elevated, glass, tilt, lift, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl",
        glass
          ? "glass"
          : cn("border bg-white", elevated ? "border-transparent shadow-raised" : "border-ink-100 shadow-card"),
        tilt && "tilt-card",
        lift && "lift-card",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-ink-100/80 px-5 py-4", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold text-ink-900", className)} {...props} />;
}
