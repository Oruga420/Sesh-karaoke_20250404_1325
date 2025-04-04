// Database of popular songs with synced lyrics

// Export songs collection
exports.songs = [
  // The Weeknd - Blinding Lights
  {
    title: "Blinding Lights",
    artist: "The Weeknd",
    isPopular: true,
    lyrics: {
      text: "Yeah\nI've been tryna call\nI've been on my own for long enough\nMaybe you can show me how to love, maybe\nI'm going through withdrawals\nYou don't even have to do too much\nYou can turn me on with just a touch, baby\nI look around and\nSin City's cold and empty (oh)\nNo one's around to judge me (oh)\nI can't see clearly when you're gone\nI said, ooh, I'm blinded by the lights\nNo, I can't sleep until I feel your touch\nI said, ooh, I'm drowning in the night\nOh, when I'm like this, you're the one I trust",
      synced: [
        { time: 13.4, words: ["Yeah"] },
        { time: 27.0, words: ["I've", "been", "tryna", "call"] },
        { time: 29.8, words: ["I've", "been", "on", "my", "own", "for", "long", "enough"] },
        { time: 32.6, words: ["Maybe", "you", "can", "show", "me", "how", "to", "love,", "maybe"] },
        { time: 38.2, words: ["I'm", "going", "through", "withdrawals"] },
        { time: 41.1, words: ["You", "don't", "even", "have", "to", "do", "too", "much"] },
        { time: 43.9, words: ["You", "can", "turn", "me", "on", "with", "just", "a", "touch,", "baby"] },
        { time: 49.4, words: ["I", "look", "around", "and"] },
        { time: 50.7, words: ["Sin", "City's", "cold", "and", "empty", "(oh)"] },
        { time: 53.5, words: ["No", "one's", "around", "to", "judge", "me", "(oh)"] },
        { time: 56.3, words: ["I", "can't", "see", "clearly", "when", "you're", "gone"] },
        { time: 60.8, words: ["I", "said,", "ooh,", "I'm", "blinded", "by", "the", "lights"] },
        { time: 66.6, words: ["No,", "I", "can't", "sleep", "until", "I", "feel", "your", "touch"] },
        { time: 71.8, words: ["I", "said,", "ooh,", "I'm", "drowning", "in", "the", "night"] },
        { time: 77.9, words: ["Oh,", "when", "I'm", "like", "this,", "you're", "the", "one", "I", "trust"] }
      ],
      source: 'popular-songs-database'
    }
  },
  
  // Dua Lipa - Levitating
  {
    title: "Levitating",
    artist: "Dua Lipa",
    isPopular: true,
    lyrics: {
      text: "If you wanna run away with me, I know a galaxy\nAnd I can take you for a ride\nI had a premonition that we fell into a rhythm\nWhere the music don't stop for life\nGlitter in the sky, glitter in my eyes\nShining just the way I like\nIf you feeling like you need a little bit of company\nYou met me at the perfect time\n\nYou want me, I want you, baby\nMy sugarboo, I'm levitating\nThe Milky Way, we're renegading\nYeah, yeah, yeah, yeah, yeah\n\nI got you, moonlight, you're my starlight\nI need you all night, come on, dance with me\nI'm levitating\nYou, moonlight, you're my starlight\nI need you all night, come on, dance with me\nI'm levitating",
      synced: [
        { time: 11.5, words: ["If", "you", "wanna", "run", "away", "with", "me,", "I", "know", "a", "galaxy"] },
        { time: 15.3, words: ["And", "I", "can", "take", "you", "for", "a", "ride"] },
        { time: 18.9, words: ["I", "had", "a", "premonition", "that", "we", "fell", "into", "a", "rhythm"] },
        { time: 22.8, words: ["Where", "the", "music", "don't", "stop", "for", "life"] },
        { time: 26.2, words: ["Glitter", "in", "the", "sky,", "glitter", "in", "my", "eyes"] },
        { time: 30.0, words: ["Shining", "just", "the", "way", "I", "like"] },
        { time: 33.8, words: ["If", "you", "feeling", "like", "you", "need", "a", "little", "bit", "of", "company"] },
        { time: 37.5, words: ["You", "met", "me", "at", "the", "perfect", "time"] },
        { time: 41.2, words: ["You", "want", "me,", "I", "want", "you,", "baby"] },
        { time: 45.0, words: ["My", "sugarboo,", "I'm", "levitating"] },
        { time: 48.7, words: ["The", "Milky", "Way,", "we're", "renegading"] },
        { time: 52.5, words: ["Yeah,", "yeah,", "yeah,", "yeah,", "yeah"] },
        { time: 56.1, words: ["I", "got", "you,", "moonlight,", "you're", "my", "starlight"] },
        { time: 60.0, words: ["I", "need", "you", "all", "night,", "come", "on,", "dance", "with", "me"] },
        { time: 63.8, words: ["I'm", "levitating"] },
        { time: 67.4, words: ["You,", "moonlight,", "you're", "my", "starlight"] },
        { time: 71.2, words: ["I", "need", "you", "all", "night,", "come", "on,", "dance", "with", "me"] },
        { time: 75.0, words: ["I'm", "levitating"] }
      ],
      source: 'popular-songs-database'
    }
  },
  
  // Bad Bunny - Tití Me Preguntó
  {
    title: "Tití Me Preguntó",
    artist: "Bad Bunny",
    isPopular: true,
    lyrics: {
      text: "Tití me preguntó si tengo muchas novia' (¿Qué?)\nHoy tengo a una, mañana otra (Otra)\nMe las paso cambiando como ropa (Wuh)\nY siempre ando con una chichona\nQue me la chupa y hasta el fondo la sopa (Sopa)\nY en la pista la topa (¿Qué?)\nCasi to'a mis exes me odian (Me odian)\nHay una que ni me nombra, pero la tengo bloqueá\nPa' que no vea que estoy activo 24/7\nY siempre que yo publico ella comenta na'\nLa baby está on fire, dice que yo soy su man\nY yo le digo: 'Bebé, ¿y ese anillo pa' cuándo?' (Wuh)\nPero por ahora es solo de amistad (De amistad)\nSiempre activa en mi IG, pendiente a to', haciendo stalk (Wuh)",
      synced: [
        { time: 16.3, words: ["Tití", "me", "preguntó", "si", "tengo", "muchas", "novia'", "(¿Qué?)"] },
        { time: 20.1, words: ["Hoy", "tengo", "a", "una,", "mañana", "otra", "(Otra)"] },
        { time: 22.0, words: ["Me", "las", "paso", "cambiando", "como", "ropa", "(Wuh)"] },
        { time: 24.1, words: ["Y", "siempre", "ando", "con", "una", "chichona"] },
        { time: 26.0, words: ["Que", "me", "la", "chupa", "y", "hasta", "el", "fondo", "la", "sopa", "(Sopa)"] },
        { time: 28.4, words: ["Y", "en", "la", "pista", "la", "topa", "(¿Qué?)"] },
        { time: 30.0, words: ["Casi", "to'a", "mis", "exes", "me", "odian", "(Me", "odian)"] },
        { time: 32.1, words: ["Hay", "una", "que", "ni", "me", "nombra,", "pero", "la", "tengo", "bloqueá"] },
        { time: 36.0, words: ["Pa'", "que", "no", "vea", "que", "estoy", "activo", "24/7"] },
        { time: 38.1, words: ["Y", "siempre", "que", "yo", "publico", "ella", "comenta", "na'"] },
        { time: 40.0, words: ["La", "baby", "está", "on", "fire,", "dice", "que", "yo", "soy", "su", "man"] },
        { time: 42.7, words: ["Y", "yo", "le", "digo:", "'Bebé,", "¿y", "ese", "anillo", "pa'", "cuándo?'", "(Wuh)"] },
        { time: 44.3, words: ["Pero", "por", "ahora", "es", "solo", "de", "amistad", "(De", "amistad)"] },
        { time: 47.1, words: ["Siempre", "activa", "en", "mi", "IG,", "pendiente", "a", "to',", "haciendo", "stalk", "(Wuh)"] }
      ],
      source: 'popular-songs-database'
    }
  },
  
  // Taylor Swift - Anti-Hero
  {
    title: "Anti-Hero",
    artist: "Taylor Swift",
    isPopular: true,
    lyrics: {
      text: "I have this thing where I get older, but just never wiser\nMidnights become my afternoons\nWhen my depression works the graveyard shift, all of the people\nI've ghosted stand there in the room\n\nI should not be left to my own devices\nThey come with prices and vices\nI end up in crisis\n(Tale as old as time)\nI wake up screaming from dreaming\nOne day, I'll watch as you're leaving\n'Cause you got tired of my scheming\n(For the last time)\n\nIt's me, hi\nI'm the problem, it's me\nAt tea time, everybody agrees\nI'll stare directly at the sun, but never in the mirror\nIt must be exhausting always rooting for the anti-hero",
      synced: [
        { time: 10.1, words: ["I", "have", "this", "thing", "where", "I", "get", "older,", "but", "just", "never", "wiser"] },
        { time: 15.6, words: ["Midnights", "become", "my", "afternoons"] },
        { time: 19.8, words: ["When", "my", "depression", "works", "the", "graveyard", "shift,", "all", "of", "the", "people"] },
        { time: 25.2, words: ["I've", "ghosted", "stand", "there", "in", "the", "room"] },
        { time: 30.5, words: ["I", "should", "not", "be", "left", "to", "my", "own", "devices"] },
        { time: 35.8, words: ["They", "come", "with", "prices", "and", "vices"] },
        { time: 38.4, words: ["I", "end", "up", "in", "crisis"] },
        { time: 40.1, words: ["(Tale", "as", "old", "as", "time)"] },
        { time: 43.2, words: ["I", "wake", "up", "screaming", "from", "dreaming"] },
        { time: 45.9, words: ["One", "day,", "I'll", "watch", "as", "you're", "leaving"] },
        { time: 48.5, words: ["'Cause", "you", "got", "tired", "of", "my", "scheming"] },
        { time: 51.2, words: ["(For", "the", "last", "time)"] },
        { time: 55.9, words: ["It's", "me,", "hi"] },
        { time: 58.6, words: ["I'm", "the", "problem,", "it's", "me"] },
        { time: 61.2, words: ["At", "tea", "time,", "everybody", "agrees"] },
        { time: 66.5, words: ["I'll", "stare", "directly", "at", "the", "sun,", "but", "never", "in", "the", "mirror"] },
        { time: 72.0, words: ["It", "must", "be", "exhausting", "always", "rooting", "for", "the", "anti-hero"] }
      ],
      source: 'popular-songs-database'
    }
  },
  
  // Billie Eilish - bad guy
  {
    title: "bad guy",
    artist: "Billie Eilish",
    isPopular: true,
    lyrics: {
      text: "White shirt now red, my bloody nose\nSleeping, you're on your tippy toes\nCreeping around like no one knows\nThink you're so criminal\nBruises on both my knees for you\nDon't say thank you or please\nI do what I want when I'm wanting to\nMy soul? So cynical\n\nSo you're a tough guy\nLike it really rough guy\nJust can't get enough guy\nChest always so puffed guy\nI'm that bad type\nMake your mama sad type\nMake your girlfriend mad tight\nMight seduce your dad type\nI'm the bad guy, duh",
      synced: [
        { time: 12.1, words: ["White", "shirt", "now", "red,", "my", "bloody", "nose"] },
        { time: 14.9, words: ["Sleeping,", "you're", "on", "your", "tippy", "toes"] },
        { time: 17.8, words: ["Creeping", "around", "like", "no", "one", "knows"] },
        { time: 20.7, words: ["Think", "you're", "so", "criminal"] },
        { time: 23.6, words: ["Bruises", "on", "both", "my", "knees", "for", "you"] },
        { time: 26.4, words: ["Don't", "say", "thank", "you", "or", "please"] },
        { time: 29.3, words: ["I", "do", "what", "I", "want", "when", "I'm", "wanting", "to"] },
        { time: 32.2, words: ["My", "soul?", "So", "cynical"] },
        { time: 35.1, words: ["So", "you're", "a", "tough", "guy"] },
        { time: 37.9, words: ["Like", "it", "really", "rough", "guy"] },
        { time: 40.8, words: ["Just", "can't", "get", "enough", "guy"] },
        { time: 43.7, words: ["Chest", "always", "so", "puffed", "guy"] },
        { time: 46.6, words: ["I'm", "that", "bad", "type"] },
        { time: 49.4, words: ["Make", "your", "mama", "sad", "type"] },
        { time: 52.3, words: ["Make", "your", "girlfriend", "mad", "tight"] },
        { time: 55.2, words: ["Might", "seduce", "your", "dad", "type"] },
        { time: 58.1, words: ["I'm", "the", "bad", "guy,", "duh"] }
      ],
      source: 'popular-songs-database'
    }
  },
  
  // Harry Styles - As It Was
  {
    title: "As It Was",
    artist: "Harry Styles",
    isPopular: true,
    lyrics: {
      text: "Holdin' me back\nGravity's holdin' me back\nI want you to hold out the palm of your hand\nWhy don't we leave it at that?\nNothin' to say\nWhen everything gets in the way\nSeems you cannot be replaced\nAnd I'm the one who will stay, oh-oh-oh\n\nIn this world, it's just us\nYou know it's not the same as it was\nIn this world, it's just us\nYou know it's not the same as it was\nAs it was, as it was\nYou know it's not the same",
      synced: [
        { time: 21.1, words: ["Holdin'", "me", "back"] },
        { time: 22.7, words: ["Gravity's", "holdin'", "me", "back"] },
        { time: 26.2, words: ["I", "want", "you", "to", "hold", "out", "the", "palm", "of", "your", "hand"] },
        { time: 30.8, words: ["Why", "don't", "we", "leave", "it", "at", "that?"] },
        { time: 34.4, words: ["Nothin'", "to", "say"] },
        { time: 36.0, words: ["When", "everything", "gets", "in", "the", "way"] },
        { time: 39.5, words: ["Seems", "you", "cannot", "be", "replaced"] },
        { time: 43.0, words: ["And", "I'm", "the", "one", "who", "will", "stay,", "oh-oh-oh"] },
        { time: 47.6, words: ["In", "this", "world,", "it's", "just", "us"] },
        { time: 51.1, words: ["You", "know", "it's", "not", "the", "same", "as", "it", "was"] },
        { time: 55.7, words: ["In", "this", "world,", "it's", "just", "us"] },
        { time: 59.2, words: ["You", "know", "it's", "not", "the", "same", "as", "it", "was"] },
        { time: 63.8, words: ["As", "it", "was,", "as", "it", "was"] },
        { time: 67.3, words: ["You", "know", "it's", "not", "the", "same"] }
      ],
      source: 'popular-songs-database'
    }
  }
];