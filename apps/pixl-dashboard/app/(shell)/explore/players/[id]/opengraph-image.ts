// Link-preview card for /explore/players/<id>: public profile fields only
// (lib/og/cards.ts).
import { OG_SIZE, playerCard, pngResponse } from "@/lib/og/cards";

export const alt = "A Pixl builder's profile";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return pngResponse(await playerCard(id));
}
