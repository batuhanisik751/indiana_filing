# indiana_filing

**Indiana Court Form Helper** is a step-by-step web tool for self-represented Indiana litigants. People pick their situation and answer one question at a time. Each answer fills its spot on an official Indiana court form. At the end, a summary shows the completed form and flags anything missing or incomplete, and people fix it by changing their own answers.

The tool explains what each question means but never suggests what to write. It does not give legal advice and does not file anything with the court.

Every question also has an "I'm not sure" button: the question is left blank, remembered, and flagged on the summary (with where to look for that kind of answer) until it's answered. On the summary, every answer has an Edit link; an edit can be saved or cancelled, and any new questions the change opens are asked before going back.

A "Get help" button at the top of every screen opens a short list of free help, which the footer repeats: the Indiana Legal Help Desk (housing legal navigators, with its hours), Indiana Legal Help's directory of free and low-cost legal help, Indiana Free Legal Answers, what court staff can help with, and the Indiana courts' Self-Service Legal Center.

At the end, people can preview the filled official form and download it as a PDF: all forms together to print, or each form on its own to e-file (Indiana's E-Filing User Guide says appearance documents go under the Appearance filing code, other documents under a separate code, and a proposed order under the "Proposed Order" code). People who e-file can sign with "/s/" and their name, which the guide allows; people who file on paper get blank signature lines to sign by hand.

Below the download, "What to do next" lists the steps for that situation and filing method: deadline, signing, filing online or at the courthouse, fees, sending copies, court dates and free help. Every statement names and links its official Indiana source (Indiana Legal Help, the Indiana E-Filing User Guide, the Small Claims Manual).

MVP prototype, Team 5, AI for Impact (Northeastern University, Fall 2026), built for the Indiana Supreme Court Office of Judicial Administration.

## Situations

| Situation | Official forms it fills |
|---|---|
| I'm not sure which one fits | Matches each choice to the papers the person has, and points to free legal help, court staff and mycase.in.gov |
| I got eviction papers | Asks what the main paper is called (Notice of Claim or Complaint) and whether the person can make their court date, explains what official sources say about that kind of case, and lets the person choose: the Appearance, the Appearance and Answer, or the continuance forms |
| I'm being sued and need to respond to the complaint | Appearance by Self-Represented Person in Civil Case (CCA-GF-1225-6003) and Answer (CCA-GF-0626-6008) |
| I'm being sued and want to tell the court I'm representing myself | Appearance by Self-Represented Person in Civil Case (CCA-GF-1225-6003) |
| I'm starting a case and can't afford the filing fee | Appearance by Unrepresented Person (CCA-GF-0420-3012), Verified Motion for Fee Waiver (CCA-GF-0420-3006) and Order on Fee Waiver (CCA-GF-0420-3007) |
| I need to ask the court to move my hearing date | Appearance by Self-Represented Person in Civil Case (CCA-GF-1219-3000), Verified Motion for Continuance (CCA-GF-1219-3002) and the Order on Verified Motion for Continuance for the judge |

All forms are approved by the Coalition for Court Access and published on [IndianaLegalHelp.org](https://indianalegalhelp.org). See [forms/README.md](forms/README.md) for sources and form numbers.

## Blank official forms

The blank forms the tool fills are in [`forms/`](forms/), unchanged from Indiana Legal Help's copies, with their instructions:

| Packet | Forms inside | Download | Official source |
|---|---|---|---|
| Answer | Appearance (CCA-GF-1225-6003), Answer (CCA-GF-0626-6008) | [PDF](https://github.com/batuhanisik751/indiana_filing/raw/main/forms/answer-packet-CCA-GF-1225-6003-CCA-GF-0626-6008.pdf) | [Indiana Legal Help: Answer](https://indianalegalhelp.org/legal-topic/answer/) |
| Fee waiver | Appearance (CCA-GF-0420-3012), Verified Motion for Fee Waiver (CCA-GF-0420-3006), Order on Fee Waiver (CCA-GF-0420-3007) | [PDF](https://github.com/batuhanisik751/indiana_filing/raw/main/forms/fee-waiver-packet-CCA-GF-0420-3012-3006-3007.pdf) | [Indiana Legal Help: How to File Forms with the Court in Person](https://indianalegalhelp.org/how-to-file-forms-with-the-court-in-person/) |
| Continuance | Appearance (CCA-GF-1219-3000), Verified Motion for Continuance (CCA-GF-1219-3002), Order on Verified Motion for Continuance | [PDF](https://github.com/batuhanisik751/indiana_filing/raw/main/forms/continuance-packet-CCA-GF-1219-3000-3002.pdf) | [Indiana Legal Help: How to Ask for a New Court Date](https://indianalegalhelp.org/how-to-ask-for-a-new-court-date/) |

These copies were downloaded on November 2, 2026. Indiana Legal Help may post newer versions, so check the official source before filing.

## Try it

Open `form-builder-mvp.html` in a browser, or run a local server:

```bash
node scripts/serve.mjs
```

Then go to http://localhost:5190/. If that port is busy, pass another one, for example `node scripts/serve.mjs 5191`.

## Privacy

Nothing anyone types is sent anywhere, and the PDF is filled in the browser. The page uses the device's own fonts, so opening it contacts no other site; the PDF tools load from cdnjs only when the summary first builds the form.

Saving is off unless the person turns it on, because many people use a shared or public computer, like a library or courthouse kiosk. "Turn on saving," at the top of every screen, and a checkbox on the first screen turn it on. When it's on, answers are saved only in the person's own browser, so a refresh or a closed tab doesn't erase them, and the first screen offers to continue where they left off. Turning it off asks first, because it deletes what's saved. With saving off, the browser warns before a page with answers is closed or refreshed.

"Clear my data," also at the top of every screen, erases every answer on the page, in any other open tab, and the saved copy, and turns saving back off, so the next person on a shared computer starts with it off. "Delete saved answers" and "Start over" erase this page's answers and the saved copy. With saving off, nothing is kept: a saved copy found when the page opens (for example one saved before saving became opt-in) is deleted. Only answers to questions that are shown are saved, so a hidden answer (like a home address after choosing the Address Confidentiality Program) is never kept. If saved answers aren't changed for 30 days, they are deleted the next time the page is opened. The top of the page says whether answers are being saved, including when the browser blocks saving or the form is open in two tabs.

## How the PDF is made

The official PDFs in `forms/` are packed into one script per packet in `forms/data/` (run `node scripts/build-form-data.mjs` after replacing one), and the app loads only the packet the person needs. The app fills them with [pdf-lib](https://pdf-lib.js.org) 1.17.1 and shows the preview with [PDF.js](https://mozilla.github.io/pdf.js/) 3.11.174. Both, and the PDF.js worker, load from cdnjs with integrity checks, so the first PDF needs an internet connection. If only the preview fails to load, the downloads still work.

Answers that are longer than the lines on the official form (Answer items 3 to 6, and the reason on the Verified Motion for Continuance) continue on a page added right after that form, titled "Attachment to" the form, and the form's last line says "(continued on attached page)." The summary points this out. Characters the forms' standard font can't print are printed as the closest plain letter (for example "Ł" as "L") or "?", and the summary points those out too. Long names and other text that must be printed smaller than 7.5 points to fit a box on the official form (for example, a long company name in the caption) are pointed out as well, so people can check them in the preview.

The official forms print some text, and have answer lines, in the top inch of the page, where the E-Filing User Guide asks filers to leave space. That is the official layout, so the tool doesn't move anything.
