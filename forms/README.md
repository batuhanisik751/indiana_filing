# Official forms

These are the official Indiana court forms the tool fills in. They are approved by the Coalition for Court Access and published on [IndianaLegalHelp.org](https://indianalegalhelp.org). They are stored here unchanged. The tool fills them in, in the user's browser: it fills the forms' fields and, where a form's answer boxes don't line up with its printed lines, writes the answer on the printed lines instead.

| File | Forms inside (form number) | Pages the tool uses | Source |
|---|---|---|---|
| `answer-packet-CCA-GF-1225-6003-CCA-GF-0626-6008.pdf` | Appearance by Self-Represented Person in Civil Case (CCA-GF-1225-6003); Answer (CCA-GF-0626-6008) | 5–6 (Appearance), 7–8 (Answer). Pages 1–4 are instructions and are not included in the filled PDF. | [Answer-20260801.pdf](https://indianalegalhelp.org/wp-content/uploads/2026/08/Answer-20260801.pdf), linked from [Indiana Legal Help: Answer](https://indianalegalhelp.org/legal-topic/answer/) |
| `fee-waiver-packet-CCA-GF-0420-3012-3006-3007.pdf` | Appearance by Unrepresented Person (CCA-GF-0420-3012); Verified Motion for Fee Waiver (CCA-GF-0420-3006); Order on Fee Waiver (CCA-GF-0420-3007) | All 5 | [GeneralFeeWaiver0420_FILLABLE-4.21.23.pdf](https://indianalegalhelp.org/wp-content/uploads/2023/08/GeneralFeeWaiver0420_FILLABLE-4.21.23.pdf), linked from [Indiana Legal Help: How to File Forms with the Court in Person](https://indianalegalhelp.org/how-to-file-forms-with-the-court-in-person/) |
| `continuance-packet-CCA-GF-1219-3000-3002.pdf` | Appearance by Self-Represented Person in Civil Case (CCA-GF-1219-3000); Verified Motion for Continuance (CCA-GF-1219-3002); Order on Verified Motion for Continuance | 4–5 (Appearance), 6–7 (Verified Motion), 8–9 (Order). Pages 1–3 are instructions and are not included in the filled PDF. | [Continuance-Motion-202409.pdf](https://indianalegalhelp.org/wp-content/uploads/2024/12/Continuance-Motion-202409.pdf), linked from [Indiana Legal Help: How to Ask for a New Court Date](https://indianalegalhelp.org/how-to-ask-for-a-new-court-date/) |

Downloaded November 2, 2026.

## Why "appearance only" uses the Appearance from the Answer packet

Indiana Legal Help offers two Appearance forms for people without a lawyer. The general one (CCA-GF-0221-3000, "Appearance by Unrepresented Party") says "I am filing this case on my own behalf," which fits someone starting a case. The one in the Answer packet (CCA-GF-1225-6003, "Appearance by Self-Represented Person in Civil Case") is newer and is written for a defendant: its caption reads Plaintiff v. Defendant and its Certificate of Service is addressed to the plaintiff or the plaintiff's attorney. The tool's "appearance only" situation is for people being sued, so it uses CCA-GF-1225-6003.

## Updating a form

When Indiana Legal Help publishes a new version:

1. Replace the PDF here (keep the file name, or update `FILES` in `scripts/build-form-data.mjs` and `file` in the app).
2. Check that the field names haven't changed. The app's `OFFICIAL` section lists every field name it fills.
3. Run `node scripts/build-form-data.mjs` from the repo root to regenerate the files in `forms/data/`.
