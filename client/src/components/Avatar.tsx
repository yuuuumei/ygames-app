/** Avatar Discord rond, avec fallback initiale sur dégradé. */

type Props = {
  url?: string | null;
  name: string;
  size?: number;
  className?: string;
};

export default function Avatar({ url, name, size, className }: Props) {
  const style = size ? { width: size, height: size, fontSize: size * 0.4 } : undefined;
  if (url) {
    return <img className={`avatar ${className ?? ""}`} src={url} alt="" style={style} />;
  }
  return (
    <span className={`avatar-fallback ${className ?? ""}`} style={style}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
