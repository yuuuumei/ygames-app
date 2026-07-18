import { useState } from "react";
import { Profile } from "./useSocial";
import ProfileShowcase from "./ProfileShowcase";
import ProfileCustomize from "./ProfileCustomize";

type User = { display_name: string; username: string; avatar_url: string | null };

/** Mon profil : vitrine par défaut, avec un mode personnalisation. */
export default function ProfileScreen({
  user,
  profile,
  onSet,
  onClose,
  onOpenAdmin,
  onLogout,
}: {
  user: User;
  profile: Profile;
  onSet: (slot: string, value: string) => Promise<string | null>;
  onClose: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}) {
  const [mode, setMode] = useState<"showcase" | "customize">("showcase");

  if (mode === "customize") {
    return (
      <ProfileCustomize
        user={user}
        profile={profile}
        onSet={onSet}
        onBack={() => setMode("showcase")}
      />
    );
  }

  return (
    <ProfileShowcase
      profile={profile}
      isMe
      onClose={onClose}
      onCustomize={() => setMode("customize")}
      onOpenAdmin={profile.is_admin ? onOpenAdmin : undefined}
      onLogout={onLogout}
    />
  );
}
