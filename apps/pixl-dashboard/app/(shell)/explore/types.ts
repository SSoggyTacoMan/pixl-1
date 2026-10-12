// Response shapes of apps/server/src/routes/explore.ts and upvotes.ts.

export interface Owner {
  id?: string;
  display_name?: string;
  avatar_url?: string | null;
}

export interface ExploreProject {
  id: number;
  user_id?: string;
  name: string;
  status?: string;
  level?: number | null;
  image_url?: string | null;
  created_at?: string;
  shipped_at?: string | null;
  hackatime_seconds?: number | null;
  is_peak?: boolean;
  owner_name?: string;
  owner?: Owner | null;
  upvotes?: number;
  has_upvoted?: boolean;
}

export interface DirectoryPlayer {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  created_at?: string;
  project_count?: number;
}

export interface BoardRow {
  rank: number;
  display_name: string;
  value: number;
  pixels?: number;
  you?: boolean;
}

export interface PixelBoard {
  players?: { rank: number; display_name: string; pixels: number; you?: boolean }[];
  yourRank?: number;
  yourPixels?: number;
  sprint?: {
    name: string;
    ends_at: string;
    players?: { rank: number; display_name: string; pixels: number; you?: boolean }[];
    your_pixels?: number;
  } | null;
}

export interface ValueBoard {
  players?: BoardRow[];
  yourRank?: number;
  yourValue?: number;
}

export interface Collectible {
  id?: number | string;
  name?: string;
  description?: string | null;
  image_url?: string | null;
  unlocked_at?: string;
}

export interface PlayerProfile {
  player: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
    created_at?: string;
    pixels?: number;
    xp_hours?: number;
    re?: number;
    level?: number;
  };
  projects?: ExploreProject[];
  collectibles?: Collectible[];
}
