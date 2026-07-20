"""Génère les MP3 de la catégorie « Langue étrangère » via edge-tts.

Usage (depuis server/) :  python tools/gen_languages.py
Produit server/media/languages/<slug>.mp3 (une phrase par langue).
Vide d'abord le dossier des anciens .mp3.
"""
import asyncio
import glob
import os
import sys

sys.path.insert(0, ".")
import edge_tts  # noqa: E402
from games.quiz.languages_data import LANGUAGES  # noqa: E402

DEST = os.path.join(os.path.dirname(__file__), "..", "media", "languages")


async def main():
    os.makedirs(DEST, exist_ok=True)
    for old in glob.glob(os.path.join(DEST, "*.mp3")):
        os.remove(old)
    total = 0
    for slug, _name, _alts, voice, phrase in LANGUAGES:
        path = os.path.join(DEST, f"{slug}.mp3")
        try:
            await edge_tts.Communicate(phrase, voice).save(path)
            total += 1
            print(f"OK  {slug}.mp3  ({voice})")
        except Exception as e:  # noqa: BLE001
            print(f"ERR {slug}  {voice}  -> {e}")
    print(f"--- {total} fichiers générés dans {os.path.abspath(DEST)}")


if __name__ == "__main__":
    asyncio.run(main())
