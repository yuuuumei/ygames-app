"""Génère les MP3 de la catégorie « Langue étrangère » via edge-tts.

Usage (depuis server/) :  python tools/gen_languages.py
Produit server/media/languages/<slug>_<i>.mp3 pour chaque phrase.
"""
import asyncio
import os
import sys

sys.path.insert(0, ".")
import edge_tts  # noqa: E402
from games.quiz.languages_data import LANGUAGES  # noqa: E402

DEST = os.path.join(os.path.dirname(__file__), "..", "media", "languages")


async def main():
    os.makedirs(DEST, exist_ok=True)
    total = 0
    for lang in LANGUAGES:
        for i, phrase in enumerate(lang["phrases"], 1):
            path = os.path.join(DEST, f"{lang['slug']}_{i}.mp3")
            try:
                await edge_tts.Communicate(phrase, lang["voice"]).save(path)
                total += 1
                print(f"OK  {lang['slug']}_{i}.mp3  ({lang['voice']})")
            except Exception as e:  # noqa: BLE001
                print(f"ERR {lang['slug']}_{i}  {lang['voice']}  -> {e}")
    print(f"--- {total} fichiers générés dans {os.path.abspath(DEST)}")


if __name__ == "__main__":
    asyncio.run(main())
