package io.github.yishaiguedj1.snowball.ph2

import org.json.JSONObject
import java.text.Normalizer

/**
 * 25/10/2026 (תרגום בטלפון, שלב 2): הטוקנייזר של Qwen2 (byte-level BPE) — כמו Qwen2Tokenizer של transformers, שהמעבד
 * של Qwen3-ForcedAligner משתמש בו בשרת (vt/align_onnx.py). NFC, פיצול לפי הטוקנים שנוספו (<|audio_pad|>, <timestamp>…),
 * הביטוי הרגולרי של Qwen2 לפני BPE, מיפוי בתים→תווים של GPT-2, ומיזוגים לפי הדירוג ב־merges.txt.
 * הבדיקה (QTokTest) משווה את ה־ids של כל קטע לאלה של השרת.
 */
class QTok(vocabJson: String, merges: String, addedTokens: Map<String, Int>) {
    private val vocab: Map<String, Int>
    private val ranks = HashMap<Pair<String, String>, Int>(200_000)
    private val added = addedTokens.entries.sortedByDescending { it.key.length }   // הארוך קודם (כמו trie)
    private val cache = HashMap<String, IntArray>()

    init {
        val o = JSONObject(vocabJson)
        val m = HashMap<String, Int>(o.length() * 2)
        for (k in o.keys()) m[k] = o.getInt(k)
        vocab = m
        var r = 0
        for (line in merges.lineSequence()) {
            if (line.startsWith("#version") || line.isBlank()) continue
            val i = line.indexOf(' ')
            if (i <= 0) continue
            ranks[line.substring(0, i) to line.substring(i + 1)] = r++
        }
    }

    fun id(token: String): Int = addedTokens(token) ?: vocab[token] ?: error("token $token")
    private fun addedTokens(t: String): Int? = added.firstOrNull { it.key == t }?.value

    fun encode(text: String): IntArray {
        val out = ArrayList<Int>()
        val s = Normalizer.normalize(text, Normalizer.Form.NFC)
        var i = 0; var start = 0
        while (i < s.length) {
            val hit = added.firstOrNull { s.startsWith(it.key, i) }
            if (hit != null) {
                if (i > start) plain(s.substring(start, i), out)
                out.add(hit.value)
                i += hit.key.length; start = i
            } else i++
        }
        if (start < s.length) plain(s.substring(start), out)
        return out.toIntArray()
    }

    private fun plain(s: String, out: MutableList<Int>) {
        val m = PRE.matcher(s)
        while (m.find()) {
            val piece = m.group()
            val ids = cache.getOrPut(piece) { bpe(piece) }
            for (x in ids) out.add(x)
        }
    }

    private fun bpe(piece: String): IntArray {
        val bytes = piece.toByteArray(Charsets.UTF_8)
        var word = bytes.map { B2U[it.toInt() and 0xff].toString() }.toMutableList()
        while (word.size > 1) {
            var best = -1; var bestRank = Int.MAX_VALUE
            for (k in 0 until word.size - 1) {
                val r = ranks[word[k] to word[k + 1]] ?: continue
                if (r < bestRank) { bestRank = r; best = k }
            }
            if (best < 0) break
            val a = word[best]; val b = word[best + 1]
            val nw = ArrayList<String>(word.size)
            var k = 0
            while (k < word.size) {
                if (k < word.size - 1 && word[k] == a && word[k + 1] == b) { nw.add(a + b); k += 2 } else { nw.add(word[k]); k++ }
            }
            word = nw
        }
        return IntArray(word.size) { vocab[word[it]] ?: error("bpe ${word[it]}") }
    }

    companion object {
        /** Qwen2Tokenizer.PRETOKENIZE_REGEX */
        val PRE: java.util.regex.Pattern = java.util.regex.Pattern.compile(
            "(?i:'s|'t|'re|'ve|'m|'ll|'d)|[^\\r\\n\\p{L}\\p{N}]?\\p{L}+|\\p{N}| ?[^\\s\\p{L}\\p{N}]+[\\r\\n]*|\\s*[\\r\\n]+|\\s+(?!\\S)|\\s+",
            java.util.regex.Pattern.UNICODE_CHARACTER_CLASS)

        /** bytes_to_unicode של GPT-2 */
        val B2U: CharArray = run {
            val bs = ArrayList<Int>()
            bs += ('!'.code..'~'.code); bs += ('¡'.code..'¬'.code); bs += ('®'.code..'ÿ'.code)
            val cs = bs.toMutableList()
            var n = 0
            for (b in 0 until 256) if (b !in bs) { bs.add(b); cs.add(256 + n); n++ }
            val m = CharArray(256)
            for (i in bs.indices) m[bs[i]] = cs[i].toChar()
            m
        }

        /** הטוקנים שנוספו מ־tokenizer_config.json (added_tokens_decoder) */
        fun addedFrom(tokenizerConfig: String): Map<String, Int> {
            val a = JSONObject(tokenizerConfig).getJSONObject("added_tokens_decoder")
            val m = HashMap<String, Int>()
            for (k in a.keys()) m[a.getJSONObject(k).getString("content")] = k.toInt()
            return m
        }
    }
}
