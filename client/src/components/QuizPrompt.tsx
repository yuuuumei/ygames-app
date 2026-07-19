import { QuizMedia } from "../useSocial";
import { SERVER_URL } from "../server";

/** Résout une URL média : absolue → telle quelle ; relative (/media/…) → serveur. */
function resolveUrl(url?: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return SERVER_URL.replace(/\/$/, "") + url;
}

/** Affiche le média d'une question (image, son, ou grille de rébus).
 *  Rien si la question est purement textuelle. `size` module l'échelle. */
export default function QuizPrompt({
  media,
  size = "normal",
}: {
  media: QuizMedia;
  size?: "normal" | "small";
}) {
  if (!media) return null;

  if (media.kind === "image" && media.url) {
    return (
      <div className={"qp-media qp-image " + size}>
        <img src={resolveUrl(media.url)} alt="" draggable={false} />
      </div>
    );
  }

  if (media.kind === "images" && media.urls?.length) {
    return (
      <div className={"qp-media qp-rebus " + size}>
        {media.urls.slice(0, 4).map((u, i) => (
          <div key={i} className="qp-rebus-cell">
            <img src={resolveUrl(u)} alt="" draggable={false} />
          </div>
        ))}
      </div>
    );
  }

  if (media.kind === "audio" && media.url) {
    return (
      <div className={"qp-media qp-audio " + size}>
        <span className="qp-audio-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
          </svg>
        </span>
        <audio controls src={resolveUrl(media.url)} />
      </div>
    );
  }

  return null;
}
