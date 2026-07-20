"""Catégorie « Langue étrangère » : une phrase se lance, on devine la langue.

Type audio. UNE seule phrase par langue, et chaque phrase est unique (jamais
la même traduite dans deux langues). Les MP3 sont générés via edge-tts
(tools/gen_languages.py) → server/media/languages/<slug>.mp3.
Réponse = la langue en français (l'auto-correction suggère, l'hôte tranche).
"""

# slug | nom FR (réponse) | alternatives | voix edge-tts | phrase unique
LANGUAGES = [
    ("allemand", "Allemand", ["Deutsch", "German"], "de-DE-SeraphinaMultilingualNeural",
     "Der Zug fährt in fünf Minuten ab."),
    ("espagnol", "Espagnol", ["Español", "Spanish"], "es-ES-XimenaNeural",
     "Me encanta bailar salsa los sábados."),
    ("italien", "Italien", ["Italiano", "Italian"], "it-IT-GiuseppeMultilingualNeural",
     "La pizza margherita è la mia preferita."),
    ("anglais", "Anglais", ["English"], "en-US-AvaNeural",
     "My brother works in a big hospital."),
    ("portugais", "Portugais", ["Português", "Brésilien", "Portuguese"], "pt-BR-ThalitaMultilingualNeural",
     "Vou à praia todos os domingos."),
    ("neerlandais", "Néerlandais", ["Nederlands", "Dutch", "Hollandais"], "nl-NL-ColetteNeural",
     "Ik fiets elke dag naar mijn werk."),
    ("suedois", "Suédois", ["Svenska", "Swedish"], "sv-SE-MattiasNeural",
     "På vintern gillar jag att åka skidor."),
    ("norvegien", "Norvégien", ["Norsk", "Norwegian"], "nb-NO-FinnNeural",
     "Fjellene i Norge er veldig vakre."),
    ("danois", "Danois", ["Dansk", "Danish"], "da-DK-ChristelNeural",
     "Jeg drikker altid te om morgenen."),
    ("finnois", "Finnois", ["Suomi", "Finnish", "Finlandais"], "fi-FI-HarriNeural",
     "Kesällä yöt ovat hyvin valoisia."),
    ("islandais", "Islandais", ["Íslenska", "Icelandic"], "is-IS-GudrunNeural",
     "Mér finnst gaman að synda í sjónum."),
    ("polonais", "Polonais", ["Polski", "Polish"], "pl-PL-MarekNeural",
     "Mój pies uwielbia biegać po parku."),
    ("tcheque", "Tchèque", ["Čeština", "Czech"], "cs-CZ-AntoninNeural",
     "Zítra půjdeme do kina."),
    ("hongrois", "Hongrois", ["Magyar", "Hungarian"], "hu-HU-NoemiNeural",
     "A gyerekek a kertben játszanak."),
    ("roumain", "Roumain", ["Română", "Romanian"], "ro-RO-AlinaNeural",
     "Îmi place să ascult muzică seara."),
    ("russe", "Russe", ["Русский", "Russian"], "ru-RU-DmitryNeural",
     "Зимой в Сибири очень холодно."),
    ("ukrainien", "Ukrainien", ["Українська", "Ukrainian"], "uk-UA-OstapNeural",
     "Я люблю читати книжки ввечері."),
    ("grec", "Grec", ["Ελληνικά", "Greek", "Grecque"], "el-GR-NestorasNeural",
     "Μου αρέσει πολύ ο ελληνικός καφές."),
    ("turc", "Turc", ["Türkçe", "Turkish", "Turque"], "tr-TR-EmelNeural",
     "Kedim bütün gün uyuyor."),
    ("croate", "Croate", ["Hrvatski", "Croatian"], "hr-HR-GabrijelaNeural",
     "Moja sestra svira gitaru."),
    ("bulgare", "Bulgare", ["Български", "Bulgarian"], "bg-BG-BorislavNeural",
     "Обичам да пия студена вода."),
    ("catalan", "Catalan", ["Català", "Catalan"], "ca-ES-EnricNeural",
     "M'agrada molt el pa amb tomàquet."),
    ("japonais", "Japonais", ["日本語", "Japanese"], "ja-JP-KeitaNeural",
     "この本はとても面白いです。"),
    ("chinois", "Chinois", ["中文", "Chinese", "Mandarin"], "zh-CN-XiaoxiaoNeural",
     "我每天早上跑步。"),
    ("coreen", "Coréen", ["한국어", "Korean"], "ko-KR-HyunsuMultilingualNeural",
     "저는 매운 음식을 좋아해요."),
    ("thai", "Thaï", ["ไทย", "Thai", "Thaïlandais"], "th-TH-NiwatNeural",
     "วันนี้อากาศร้อนมาก"),
    ("vietnamien", "Vietnamien", ["Tiếng Việt", "Vietnamese"], "vi-VN-HoaiMyNeural",
     "Tôi thích ăn phở vào buổi sáng."),
    ("hindi", "Hindi", ["हिन्दी", "Indien"], "hi-IN-MadhurNeural",
     "मुझे क्रिकेट खेलना बहुत पसंद है।"),
    ("indonesien", "Indonésien", ["Bahasa Indonesia", "Indonesian"], "id-ID-ArdiNeural",
     "Saya suka makan nasi goreng."),
    ("arabe", "Arabe", ["العربية", "Arabic"], "ar-EG-SalmaNeural",
     "القاهرة مدينة كبيرة وجميلة."),
    ("hebreu", "Hébreu", ["עברית", "Hebrew", "Hebreu"], "he-IL-AvriNeural",
     "בירושלים יש הרבה מקומות קדושים."),
    ("persan", "Persan", ["فارسی", "Farsi", "Perse", "Iranien"], "fa-IR-DilaraNeural",
     "این غذا خیلی خوشمزه است."),
    ("swahili", "Swahili", ["Kiswahili"], "sw-KE-RafikiNeural",
     "Simba anaishi katika savana."),
    ("afrikaans", "Afrikaans", ["Sud-africain"], "af-ZA-AdriNeural",
     "Ek hou daarvan om in die berge te stap."),
    ("gallois", "Gallois", ["Cymraeg", "Welsh"], "cy-GB-AledNeural",
     "Dw i'n hoffi canu yn y gawod."),
    ("irlandais", "Irlandais", ["Gaeilge", "Irish", "Gaélique"], "ga-IE-ColmNeural",
     "Tá an aimsir go breá inniu."),
]


def language_questions() -> list[dict]:
    return [
        {
            "category": "Langue étrangère",
            "question": "Quelle langue est parlée ?",
            "answer": name,
            "type": "audio", "auto": 1,
            "alt_answers": alts,
            "media": {"kind": "audio", "url": f"/media/languages/{slug}.mp3"},
        }
        for (slug, name, alts, _voice, _phrase) in LANGUAGES
    ]


LANGUAGE_QUESTIONS = language_questions()
