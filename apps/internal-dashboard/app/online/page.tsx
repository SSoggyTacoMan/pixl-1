import { Suspense } from "react";
import { requirePage } from "@/lib/guard";
import { fetchOnlinePlayers, gameServerConfigured } from "@/lib/gameServer";
import { kickPlayer } from "@/app/actions";
import {
  ActionButton,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Mono,
  Muted,
  PageHeader,
  Table,
  TextLink,
} from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

function sceneLabel(scene: string): string {
  if (scene.startsWith("village")) return "village";
  if (scene.startsWith("lobby:")) return `lobby ${scene.slice(6)}`;
  return scene.replaceAll("_", " ");
}

export default async function OnlinePage() {
  const access = await requirePage("owner");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Online now"
        description="Live view from the game server. Kicking disconnects the player immediately. They can reconnect unless you ban them."
      />
      {/* The game server call can take up to its 5 s timeout, so stream it in
          instead of holding the whole page. */}
      <Suspense
        fallback={
          <Card>
            <EmptyState title="Asking the game server..." icon="clock" />
          </Card>
        }
      >
        <OnlinePlayers canKick={access.isOwner} />
      </Suspense>
    </div>
  );
}

async function OnlinePlayers({ canKick }: { canKick: boolean }) {
  const players = await fetchOnlinePlayers();

  if (players === null) {
    return (
      <Card>
        {gameServerConfigured() ? (
          <EmptyState title="Can't reach the game server" icon="important">
            It might be restarting. Try again in a minute.
          </EmptyState>
        ) : (
          <EmptyState title="Game server not configured" icon="settings">
            Set PIXL_SERVER_URL and SERVICE_KEY_INTERNAL_DASHBOARD in the dashboard env.
          </EmptyState>
        )}
      </Card>
    );
  }

  if (players.length === 0) {
    return (
      <Card>
        <EmptyState title="Nobody's online right now" icon="relaxed" />
      </Card>
    );
  }

  return (
    <>
      <Card padding="flush">
        <CardHeader title="Players" icon="people-2" count={players.length} />
        <Table headers={canKick ? ["Player", "Where", "Kick"] : ["Player", "Where"]}>
          {players.map((p) => (
            <tr key={p.userId}>
              <td>
                <TextLink href={`/players/${p.userId}`} className="font-bold">
                  {p.displayName || "Player"}
                </TextLink>
                <div className="text-xs">
                  <Muted>
                    <Mono>{p.userId}</Mono>
                  </Muted>
                </div>
              </td>
              <td>
                <Badge tone="success">{sceneLabel(p.scene)}</Badge>
              </td>
              {canKick && (
                <td>
                  <form action={kickPlayer} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="userId" value={p.userId} />
                    <Input name="reason" maxLength={100} placeholder="Reason (optional)" className="w-44" />
                    <ActionButton
                      variant="danger"
                      size="sm"
                      pendingLabel="Kicking..."
                      confirm={`Kick ${p.displayName || "this player"}? They'll be disconnected immediately.`}
                    >
                      Kick
                    </ActionButton>
                  </form>
                </td>
              )}
            </tr>
          ))}
        </Table>
      </Card>
      <p className="hc-caption text-xs">
        {players.length} player{players.length === 1 ? "" : "s"} online · refresh the page to update
      </p>
    </>
  );
}
