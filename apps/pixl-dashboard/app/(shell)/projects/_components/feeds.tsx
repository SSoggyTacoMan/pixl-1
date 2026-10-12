import { safeHttpUrl } from "@/lib/safe-url";
import { shortDate, timeAgo } from "../format";

export interface ActivityItem {
  kind: string;
  text: string;
  at: string;
}
export interface NewsItem {
  body: string;
  posted_at: string;
  link_url?: string | null;
}

/** Action log + program news under the project list. Either is hidden when empty. */
export function Feeds({ activity, news }: { activity: ActivityItem[]; news: NewsItem[] }) {
  if (!activity.length && !news.length) return null;
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {activity.length ? (
        <div className="feed panel">
          <div className="feed-h">ACTION LOG</div>
          {activity.map((a, i) => (
            <div key={i} className="mb-2 text-sm">
              <div>{a.text}</div>
              <div className="text-xs text-faint">{timeAgo(a.at)}</div>
            </div>
          ))}
        </div>
      ) : null}
      {news.length ? (
        <div className="feed panel">
          <div className="feed-h">NEWS</div>
          {news.map((n, i) => {
            const href = safeHttpUrl(n.link_url);
            return (
              <div key={i} className="mb-2 flex gap-3 text-sm">
                <span className="shrink-0 font-pixel text-xs text-faint">{shortDate(n.posted_at)}</span>
                <span>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {n.body}
                    </a>
                  ) : (
                    n.body
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
