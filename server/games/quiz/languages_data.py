"""Catégorie « Langue étrangère » : une phrase se lance, on devine la langue.

Type audio (réutilise le lecteur existant). Les MP3 sont générés via edge-tts
(voix neuronales Microsoft) par tools/gen_languages.py, puis bundlés dans
server/media/languages/. Réponse = la langue en français (l'auto-correction
suggère, l'hôte tranche).
"""

# slug, nom FR (réponse), alternatives acceptées, voix edge-tts, 4 phrases.
LANGUAGES = [
    {"slug": "allemand", "answer": "Allemand", "alts": ["Deutsch", "German"],
     "voice": "de-DE-KatjaNeural", "phrases": [
        "Guten Morgen, wie geht es dir heute?",
        "Ich hätte gerne einen Kaffee, bitte.",
        "Heute ist das Wetter wirklich schön.",
        "Wo ist der nächste Bahnhof?"]},
    {"slug": "espagnol", "answer": "Espagnol", "alts": ["Español", "Spanish", "Castillan"],
     "voice": "es-ES-ElviraNeural", "phrases": [
        "Buenos días, ¿cómo estás hoy?",
        "Quería un café, por favor.",
        "Hoy hace muy buen tiempo.",
        "¿Dónde está la estación más cercana?"]},
    {"slug": "italien", "answer": "Italien", "alts": ["Italiano", "Italian"],
     "voice": "it-IT-ElsaNeural", "phrases": [
        "Buongiorno, come stai oggi?",
        "Vorrei un caffè, per favore.",
        "Oggi il tempo è bellissimo.",
        "Dov'è la stazione più vicina?"]},
    {"slug": "anglais", "answer": "Anglais", "alts": ["English", "Anglaise"],
     "voice": "en-US-AriaNeural", "phrases": [
        "Good morning, how are you today?",
        "I'd like a coffee, please.",
        "The weather is really nice today.",
        "Where is the nearest train station?"]},
    {"slug": "portugais", "answer": "Portugais", "alts": ["Português", "Portuguese", "Brésilien"],
     "voice": "pt-BR-FranciscaNeural", "phrases": [
        "Bom dia, como está hoje?",
        "Queria um café, por favor.",
        "Hoje está um tempo muito bom.",
        "Onde fica a estação mais próxima?"]},
    {"slug": "neerlandais", "answer": "Néerlandais", "alts": ["Nederlands", "Dutch", "Hollandais"],
     "voice": "nl-NL-ColetteNeural", "phrases": [
        "Goedemorgen, hoe gaat het vandaag met je?",
        "Ik wil graag een koffie, alstublieft.",
        "Het weer is vandaag echt mooi.",
        "Waar is het dichtstbijzijnde station?"]},
    {"slug": "suedois", "answer": "Suédois", "alts": ["Svenska", "Swedish"],
     "voice": "sv-SE-SofieNeural", "phrases": [
        "God morgon, hur mår du idag?",
        "Jag skulle vilja ha en kaffe, tack.",
        "Vädret är verkligen fint idag.",
        "Var ligger närmaste station?"]},
    {"slug": "polonais", "answer": "Polonais", "alts": ["Polski", "Polish"],
     "voice": "pl-PL-ZofiaNeural", "phrases": [
        "Dzień dobry, jak się dzisiaj masz?",
        "Poproszę kawę.",
        "Dzisiaj jest naprawdę ładna pogoda.",
        "Gdzie jest najbliższy dworzec?"]},
    {"slug": "russe", "answer": "Russe", "alts": ["Русский", "Russian"],
     "voice": "ru-RU-SvetlanaNeural", "phrases": [
        "Доброе утро, как у тебя дела сегодня?",
        "Я бы хотел кофе, пожалуйста.",
        "Сегодня очень хорошая погода.",
        "Где находится ближайший вокзал?"]},
    {"slug": "grec", "answer": "Grec", "alts": ["Ελληνικά", "Greek", "Grecque"],
     "voice": "el-GR-AthinaNeural", "phrases": [
        "Καλημέρα, πώς είσαι σήμερα;",
        "Θα ήθελα έναν καφέ, παρακαλώ.",
        "Σήμερα ο καιρός είναι πολύ ωραίος.",
        "Πού είναι ο πλησιέστερος σταθμός;"]},
    {"slug": "turc", "answer": "Turc", "alts": ["Türkçe", "Turkish", "Turque"],
     "voice": "tr-TR-EmelNeural", "phrases": [
        "Günaydın, bugün nasılsın?",
        "Bir kahve istiyorum, lütfen.",
        "Bugün hava gerçekten çok güzel.",
        "En yakın istasyon nerede?"]},
    {"slug": "japonais", "answer": "Japonais", "alts": ["日本語", "Japanese"],
     "voice": "ja-JP-NanamiNeural", "phrases": [
        "おはようございます、今日は元気ですか？",
        "コーヒーを一杯ください。",
        "今日はとても天気がいいですね。",
        "一番近い駅はどこですか？"]},
    {"slug": "chinois", "answer": "Chinois", "alts": ["中文", "Chinese", "Mandarin", "Chinois mandarin"],
     "voice": "zh-CN-XiaoxiaoNeural", "phrases": [
        "早上好，你今天怎么样？",
        "我想要一杯咖啡，谢谢。",
        "今天天气非常好。",
        "最近的火车站在哪里？"]},
    {"slug": "coreen", "answer": "Coréen", "alts": ["한국어", "Korean"],
     "voice": "ko-KR-SunHiNeural", "phrases": [
        "좋은 아침이에요, 오늘 어떻게 지내세요?",
        "커피 한 잔 주세요.",
        "오늘 날씨가 정말 좋아요.",
        "가장 가까운 역이 어디예요?"]},
    {"slug": "arabe", "answer": "Arabe", "alts": ["العربية", "Arabic"],
     "voice": "ar-EG-SalmaNeural", "phrases": [
        "صباح الخير، كيف حالك اليوم؟",
        "أريد قهوة من فضلك.",
        "الطقس جميل جدًا اليوم.",
        "أين أقرب محطة؟"]},
    {"slug": "hindi", "answer": "Hindi", "alts": ["हिन्दी", "Indien"],
     "voice": "hi-IN-SwaraNeural", "phrases": [
        "सुप्रभात, आज आप कैसे हैं?",
        "मुझे एक कॉफ़ी चाहिए।",
        "आज मौसम बहुत अच्छा है।",
        "सबसे नज़दीकी स्टेशन कहाँ है?"]},
]


def language_questions() -> list[dict]:
    out = []
    for lang in LANGUAGES:
        for i, _phrase in enumerate(lang["phrases"], 1):
            out.append({
                "category": "Langue étrangère",
                "question": "Quelle langue est parlée ?",
                "answer": lang["answer"],
                "type": "audio", "auto": 1,
                "alt_answers": lang["alts"],
                "media": {"kind": "audio", "url": f"/media/languages/{lang['slug']}_{i}.mp3"},
            })
    return out


LANGUAGE_QUESTIONS = language_questions()
