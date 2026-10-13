import { cn } from "@/lib/cn";
import { priceClass, priceWas } from "./shop-styles";

export function PriceTag({
  amount,
  from,
  cant,
  locked,
  was,
  unit = "PX",
  className,
}: {
  amount: number;
  from?: boolean;
  cant?: boolean;
  locked?: boolean;
  was?: number;
  unit?: string;
  className?: string;
}) {
  return (
    <span className={cn(priceClass(cant), className)}>
      {locked ? <span aria-label="locked">LOCKED · </span> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/pixel.png" alt="" />
      {from ? "FROM " : ""}
      {amount.toLocaleString()} {unit}
      {was !== undefined ? (
        <span className={priceWas}>
          {was.toLocaleString()} {unit}
        </span>
      ) : null}
    </span>
  );
}
