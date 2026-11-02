package chat.vale.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ReceiptCollectorTest {
    @Test fun invalidAndUnknownNeighborCannotPreemptValidReceipt() {
        val collector = ReceiptCollector(listOf("a", "b")) { it == "authentic" }
        collector.respond("unknown", "authentic")
        collector.respond("a", "forged")
        collector.respond("a", "authentic") // duplicate response from a is ignored
        collector.respond("b", "authentic")
        assertEquals("authentic", collector.await(1))
    }
    @Test fun allNegativeResponsesFinishWithoutTimeout() {
        val collector = ReceiptCollector(listOf("a", "b")) { true }
        collector.respond("a", null); collector.respond("b", null)
        assertNull(collector.await(1))
    }
}
