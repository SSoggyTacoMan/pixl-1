import { Suspense, type ComponentProps } from "react";
import { hackatimeUserIdsFor } from "@/lib/hackatime";
import { ReviewTable } from "@/app/_components/ReviewTable";

type Props = Omit<ComponentProps<typeof ReviewTable>, "hackatimeUserIds">;

const NO_IDS = new Map<number, string>();

async function WithTelescreen(props: Props) {
  const hackatimeUserIds = await hackatimeUserIdsFor(props.rows);
  return <ReviewTable {...props} hackatimeUserIds={hackatimeUserIds} />;
}

// A second-pass ReviewTable with its Telescreen links. The links need one
// Hackatime call per maker, so they stream in behind Suspense: the rows render
// straight away (Telescreen column empty), and a slow or down Hackatime only
// delays the links, never the queue.
export function TelescreenReviewTable(props: Props) {
  return (
    <Suspense fallback={<ReviewTable {...props} hackatimeUserIds={NO_IDS} />}>
      <WithTelescreen {...props} />
    </Suspense>
  );
}
