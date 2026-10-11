export function PriceTag({
  amount,
  from,
  cant,
  locked,
  was,
  unit = "PX",
}: {
  amount: number;
  from?: boolean;
  cant?: boolean;
  locked?: boolean;
  was?: number;
  unit?: string;
}) {
  return (
    <span className={`price${cant ? " cant" : ""}`}>
      {locked ? <span aria-label="locked">LOCKED · </span> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/pixel.png" alt="" />
      {from ? "FROM " : ""}
      {amount.toLocaleString()} {unit}
      {was !== undefined ? (
        <span className="price-was">
          {was.toLocaleString()} {unit}
        </span>
      ) : null}
    </span>
  );
}
