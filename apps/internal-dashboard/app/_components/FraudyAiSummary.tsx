import { fraudyCheckAi, fraudyHours } from "@/lib/fraudy";
import { Badge } from "@/app/_ui/ui";

// Fraudy's human/AI split for one linked Hackatime project, shown next to the
// "is it ai?" button on the final pass. Renders nothing when there is no
// FRAUDY_API_KEY or Fraudy has no numbers, so the button alone still works.
export async function FraudyAiSummary({ hackatimeId, project }: { hackatimeId: string; project: string }) {
  const check = await fraudyCheckAi(hackatimeId, project);
  if (!check) return null;
  if (check.humanSeconds === 0 && check.aiSeconds === 0) {
    return <Badge outline>Fraudy has no data for {project}</Badge>;
  }
  const flagged = check.deflationSeconds > 0;
  return (
    <Badge tone={flagged ? "warning" : "success"} icon="view">
      {project}: {fraudyHours(check.humanSeconds)}h human, {fraudyHours(check.aiSeconds)}h AI
      {flagged ? `, deflate ${fraudyHours(check.deflationSeconds)}h` : ", no deflation"}
    </Badge>
  );
}
