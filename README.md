# reasonsmith

Audit-grade explanations for symbolic and neurosymbolic decisions.

A decision that affects a person carries a legal duty to give reasons. This turns that duty into
something a machine can produce and check: given a decision, the symbolic artifact behind it, and
the duty that applies, `reasonsmith` emits the minimal evidence record that duty requires — and says
plainly which required fields it could not produce. A record that is incomplete is reported as
incomplete, never quietly shortened.

Where the system reasons over proofs it goes further. Exact inference enumerates every reason, so
the reasons an approximate engine actually used can be compared against the complete set. Reasons
that were dropped are named, not estimated — which is the part post-hoc explanation methods cannot
do, because they have no ground truth to compare against.

Status: early. Nothing here is a compliance guarantee, and none of it is legal advice.

## Where the duties come from

The duty-to-artifact mapping is Table 7 of *Symbols and Neurons: A Review of Symbolic XAI in Deep
Learning* (Stan, Sciavicco & Napoletano, JAIR 2026), a review of 273 primary studies that ties
symbolic artifacts to duties under the EU AI Act, GDPR, ECOA/Reg B, FDA GMLP and NIST AI RMF, and
specifies the minimal records each duty needs. That review says what to retain; this produces it.

## Licence

MIT.
