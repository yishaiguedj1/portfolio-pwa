package io.github.yishaiguedj1.snowball.ph2

/**
 * difflib.SequenceMatcher(a, b, autojunk=False) — get_matching_blocks, אחד לאחד (בלי junk). בשימוש כשמספר הפריטים
 * מהמודל שונה ממספר המילים (QAlign.mapItems), ובהתאמת ההגהה. מחזיר (i, j, אורך) לכל בלוק שווה, בלי הבלוק המסיים.
 */
object Diff {
    fun <T> equalBlocks(a: List<T>, b: List<T>): List<Triple<Int, Int, Int>> {
        val b2j = HashMap<T, MutableList<Int>>()
        for ((j, x) in b.withIndex()) b2j.getOrPut(x) { ArrayList() }.add(j)
        val queue = ArrayDeque<IntArray>()
        queue.add(intArrayOf(0, a.size, 0, b.size))
        val blocks = ArrayList<Triple<Int, Int, Int>>()
        while (queue.isNotEmpty()) {
            val (alo, ahi, blo, bhi) = queue.removeLast().let { listOf(it[0], it[1], it[2], it[3]) }
            val (i, j, k) = longest(a, b2j, alo, ahi, blo, bhi)
            if (k > 0) {
                blocks.add(Triple(i, j, k))
                if (alo < i && blo < j) queue.add(intArrayOf(alo, i, blo, j))
                if (i + k < ahi && j + k < bhi) queue.add(intArrayOf(i + k, ahi, j + k, bhi))
            }
        }
        blocks.sortWith(compareBy({ it.first }, { it.second }))
        // איחוד בלוקים סמוכים (כמו בסוף get_matching_blocks)
        val out = ArrayList<Triple<Int, Int, Int>>()
        var i1 = 0; var j1 = 0; var k1 = 0
        for ((i2, j2, k2) in blocks) {
            if (i1 + k1 == i2 && j1 + k1 == j2) k1 += k2
            else { if (k1 > 0) out.add(Triple(i1, j1, k1)); i1 = i2; j1 = j2; k1 = k2 }
        }
        if (k1 > 0) out.add(Triple(i1, j1, k1))
        return out
    }

    /** find_longest_match בלי junk: הארוך ביותר, ומבין השווים — המוקדם ביותר ב־a, ואז ב־b */
    private fun <T> longest(a: List<T>, b2j: Map<T, List<Int>>, alo: Int, ahi: Int, blo: Int, bhi: Int): Triple<Int, Int, Int> {
        var besti = alo; var bestj = blo; var bestsize = 0
        var j2len = HashMap<Int, Int>()
        for (i in alo until ahi) {
            val newj2len = HashMap<Int, Int>()
            for (j in b2j[a[i]] ?: emptyList()) {
                if (j < blo) continue
                if (j >= bhi) break
                val k = (j2len[j - 1] ?: 0) + 1
                newj2len[j] = k
                if (k > bestsize) { besti = i - k + 1; bestj = j - k + 1; bestsize = k }
            }
            j2len = newj2len
        }
        return Triple(besti, bestj, bestsize)
    }
}
