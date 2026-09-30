import { prisma } from "@/lib/prisma";

// Mirrors the platform-wide list in squadino's src/lib/moderation.ts (the club app reads the same
// platform_banned_words table). The built-in list only seeds an empty table or covers a missing one.
export const DEFAULT_BANNED_WORDS: string[] = [
  "🖕", "2 girls 1 cup", "2g1c", "acrotomophilia", "alabama hot pocket", "alaskan pipeline", "anal", "anilingus",
  "anus", "apeshit", "arsehole", "ass", "asshole", "assmunch", "auto erotic", "autoerotic",
  "babeland", "baby batter", "baby juice", "ball gag", "ball gravy", "ball kicking", "ball licking", "ball sack",
  "ball sucking", "bangbros", "bangbus", "bareback", "barely legal", "barenaked", "bastard", "bastardo",
  "bastinado", "bbw", "bdsm", "beaner", "beaners", "beastiality", "beaver cleaver", "beaver lips",
  "bestiality", "big black", "big breasts", "big knockers", "big tits", "bimbos", "birdlock", "bitch",
  "bitches", "black cock", "blonde action", "blonde on blonde action", "blow job", "blow your load", "blowjob", "blue waffle",
  "blumpkin", "bollocks", "bondage", "boner", "boob", "boobs", "booty call", "brown showers",
  "brunette action", "bukkake", "bulldyke", "bullet vibe", "bullshit", "bung hole", "bunghole", "busty",
  "buttcheeks", "butthole", "camel toe", "camgirl", "camslut", "camwhore", "carpet muncher", "carpetmuncher",
  "chink", "chocolate rosebuds", "cialis", "circlejerk", "cleveland steamer", "clit", "clitoris", "clover clamps",
  "clusterfuck", "cock", "cocks", "coon", "coons", "coprolagnia", "coprophilia", "cornhole",
  "creampie", "cum", "cumming", "cumshot", "cumshots", "cunnilingus", "cunt", "darkie",
  "date rape", "daterape", "deep throat", "deepthroat", "dendrophilia", "dick", "dickhead", "dildo",
  "dingleberries", "dingleberry", "dirty pillows", "dirty sanchez", "dog style", "doggie style", "doggiestyle", "doggy style",
  "doggystyle", "dolcett", "domination", "dominatrix", "dommes", "donkey punch", "double dong", "double penetration",
  "dp action", "dry hump", "dvda", "dyke", "eat my ass", "ecchi", "ejaculation", "erotic",
  "erotism", "escort", "eunuch", "fag", "faggot", "fecal", "felch", "fellatio",
  "feltch", "female squirting", "femdom", "figging", "fingerbang", "fingering", "fisting", "foot fetish",
  "footjob", "frotting", "fuck", "fuck buttons", "fuckin", "fucking", "fucktards", "fudge packer",
  "fudgepacker", "futanari", "g-spot", "gang bang", "gangbang", "genitals", "giant cock", "girl on",
  "girl on top", "girls gone wild", "go die", "goatcx", "goatse", "god damn", "gokkun", "golden shower",
  "goo girl", "goodpoop", "goregasm", "grope", "group sex", "guro", "hand job", "handjob",
  "hard core", "hardcore", "hentai", "homoerotic", "honkey", "hooker", "horny", "hot carl",
  "hot chick", "how to kill", "how to murder", "huge fat", "humping", "incest", "intercourse", "jack off",
  "jail bait", "jailbait", "jelly donut", "jerk off", "jigaboo", "jiggaboo", "jiggerboo", "jizz",
  "juggs", "kike", "kill yourself", "kinbaku", "kinkster", "kinky", "knobbing", "kys",
  "leather restraint", "leather straight jacket", "lemon party", "livesex", "lolita", "lovemaking", "make me come", "male squirting",
  "masturbate", "masturbating", "masturbation", "menage a trois", "milf", "missionary position", "mong", "motherfucker",
  "mound of venus", "mr hands", "muff diver", "muffdiving", "nambla", "nawashi", "negro", "neonazi",
  "nig nog", "nigga", "nigger", "nimphomania", "nipple", "nipples", "nsfw", "nsfw images",
  "nude", "nudity", "nutten", "nympho", "nymphomania", "octopussy", "omorashi", "one cup two girls",
  "one guy one jar", "orgasm", "orgy", "paedophile", "paki", "panties", "panty", "pedobear",
  "pedophile", "pegging", "penis", "phone sex", "piece of shit", "pikey", "piss pig", "pissing",
  "pisspig", "playboy", "pleasure chest", "pole smoker", "ponyplay", "poof", "poon", "poontang",
  "poop chute", "poopchute", "porn", "porno", "pornography", "prick", "prince albert piercing", "pthc",
  "pubes", "punany", "pussy", "queaf", "queef", "quim", "raghead", "raging boner",
  "rape", "raping", "rapist", "rectum", "retard", "reverse cowgirl", "rimjob", "rimming",
  "rosy palm", "rosy palm and her 5 sisters", "rusty trombone", "s&m", "sadism", "santorum", "scat", "schlong",
  "scissoring", "semen", "sexcam", "sexo", "sexuality", "sexually", "shaved beaver", "shaved pussy",
  "shemale", "shibari", "shit", "shitblimp", "shitty", "shota", "shrimping", "skeet",
  "slanteye", "slut", "smut", "snatch", "snowballing", "sodomize", "sodomy", "spastic",
  "spic", "splooge", "splooge moose", "spooge", "spread legs", "spunk", "strap on", "strapon",
  "strappado", "strip club", "style doggy", "suck", "sucks", "suicide girls", "sultry women", "swastika",
  "swinger", "tainted love", "taste my", "tea bagging", "threesome", "throating", "thumbzilla", "tied up",
  "tight white", "tit", "tits", "titties", "titty", "tongue in a", "topless", "tosser",
  "towelhead", "tranny", "tribadism", "tub girl", "tubgirl", "tushy", "twat", "twink",
  "twinkie", "two girls one cup", "undressing", "upskirt", "urethra play", "urophilia", "vagina", "venus mound",
  "viagra", "vibrator", "violet wand", "vorarephilia", "voyeur", "voyeurweb", "voyuer", "vulva",
  "wank", "wanker", "wet dream", "wetback", "white power", "whore", "worldsex", "wrapping men",
  "wrinkled starfish", "xx", "xxx", "yaoi", "yellow showers", "yiffy", "zoophilia",
];

/**
 * The platform-wide restricted words. An empty table is filled with
 * DEFAULT_BANNED_WORDS first (a fresh migration, or a `db push` database);
 * if the table can't be read at all (its migration hasn't run yet), the
 * built-in list is used so clubs stay protected.
 */
export async function listPlatformWords(): Promise<{ id: string; word: string }[]> {
  try {
    let rows = await prisma.platformBannedWord.findMany({ select: { id: true, word: true }, orderBy: { word: "asc" } });
    if (rows.length === 0) {
      await prisma.platformBannedWord.createMany({ data: DEFAULT_BANNED_WORDS.map((word) => ({ word })), skipDuplicates: true });
      rows = await prisma.platformBannedWord.findMany({ select: { id: true, word: true }, orderBy: { word: "asc" } });
    }
    return rows;
  } catch (e) {
    console.error("Couldn't read the platform restricted-words list — using the built-in list.", e);
    return DEFAULT_BANNED_WORDS.map((word) => ({ id: "", word }));
  }
}
