# How well the checks do on a fixed test set

Item 18 on the MVP list. Made by `npm run quality` in `tests/` on 2026-11-26, at commit 29790cf.

The test set is in [cases.mjs](cases.mjs): 117 filled-in forms. 74 have one planted mistake each, the kind a careful reader would flag. 43 have only correct answers that look a little like mistakes, like a PO box, a phone number written with dots, or a nine-digit invoice number. Each case starts from the same sample answers, which get no flags on their own.

- **Caught:** a flag on the question with the mistake. For a mistake between two answers, like a paragraph in two lists, a flag on either one.
- **Missed:** no flag there.
- **False alarm:** a flag on a question whose answer is correct. A question the case itself brings up isn't counted unless the case answers it: an incomplete case number brings up the case type letters, and asking for them is right, but a flag on an expense description the case filled in is counted.

"Harder" cases are the same kinds of mistakes written in less usual ways.

## Mistakes caught

Overall: **74 of 74 caught (100%)**. The usual ways of writing them: 55 of 55. Harder ways: 19 of 19.

| Kind of check | Usual | Harder | All |
|---|---|---|---|
| Email | 6 of 6 | 4 of 4 | 10 of 10 (100%) |
| Phone | 5 of 5 | 2 of 2 | 7 of 7 (100%) |
| Address | 7 of 7 | 2 of 2 | 9 of 9 (100%) |
| Case number | 5 of 5 | 1 of 1 | 6 of 6 (100%) |
| Private information | 7 of 7 | 5 of 5 | 12 of 12 (100%) |
| Dates | 6 of 6 | – | 6 of 6 (100%) |
| Answer lists | 4 of 4 | 2 of 2 | 6 of 6 (100%) |
| Words that would print | 4 of 4 | 1 of 1 | 5 of 5 (100%) |
| Blank answers | 5 of 5 | – | 5 of 5 (100%) |
| Amounts | 4 of 4 | 1 of 1 | 5 of 5 (100%) |
| Your request | 2 of 2 | 1 of 1 | 3 of 3 (100%) |

Nothing missed.

## False alarms

**0 of 43 correct-answer cases got a flag they shouldn't (0%).**

None.

No case with a planted mistake got a flag on another, correct answer.

## What these numbers don't say

- **Who wrote the cases.** The same team wrote the checks, so the cases may lean toward what the checks were built for. Mistakes from real filings would likely be caught less often.
- **Cases written by someone else.** On 2026-11-18 an independent tester wrote 42 cases without seeing these (27 mistakes, 15 correct answers): the checks caught 25 of the 27 and falsely flagged 1 of the 15 (2, counting a box the case itself filled in, which this set didn't count then). The tester's targeted attempts found more, fixed as BT41 to BT47; six of those are now in this set, so this set is no longer held out from them.
- **What's left out.** The checks on the made PDF aren't counted here: an answer too long for its box, and characters the form's font can't print. They're tested in `features/17-download-pdf.test.mjs`.
- **What no check can know.** Whether an address or phone number is real, or whether an answer is right for the case. Those aren't in the set.
- **How the test uses this.** `quality.test.mjs` fails if a mistake caught here is missed later, or a correct answer gets a new flag. It also fails when a change makes the numbers better, so this report can be made again to match.
