# indiana_filing

**Indiana Court Form Helper** is a step-by-step web tool for self-represented Indiana litigants. People pick their situation and answer one question at a time. Each answer fills its spot on an official Indiana court form. At the end, a summary shows the completed form and flags anything missing or incomplete, and people fix it by changing their own answers.

The tool explains what each question means but never suggests what to write. It does not give legal advice and does not file anything with the court.

At the end, people can preview the filled official form and download it as a PDF: all forms together to print, or each form on its own to e-file (Indiana's E-Filing User Guide says each document is filed under its own filing code). People who e-file can sign with "/s/" and their name, which the guide allows; people who file on paper get blank signature lines to sign by hand.

Below the download, "What to do next" lists the steps for that situation and filing method: deadline, signing, filing online or at the courthouse, fees, sending copies, court dates and free help. Every statement names and links its official Indiana source (Indiana Legal Help, the Indiana E-Filing User Guide, the Small Claims Manual).

MVP prototype, Team 5, AI for Impact (Northeastern University, Fall 2026), built for the Indiana Supreme Court Office of Judicial Administration.

## Situations

| Situation | Official forms it fills |
|---|---|
| I got eviction papers | Asks what the main paper is called (Notice of Claim or Complaint) and whether the person can make their court date, explains what official sources say about that kind of case, and lets the person choose: the Appearance, the Appearance and Answer, or the continuance forms |
| I'm being sued and need to respond to the complaint | Appearance by Self-Represented Person in Civil Case (CCA-GF-1225-6003) and Answer (CCA-GF-0626-6008) |
| I'm being sued and want to tell the court I'm representing myself | Appearance by Self-Represented Person in Civil Case (CCA-GF-1225-6003) |
| I'm starting a case and can't afford the filing fee | Appearance by Unrepresented Person (CCA-GF-0420-3012), Verified Motion for Fee Waiver (CCA-GF-0420-3006) and Order on Fee Waiver (CCA-GF-0420-3007) |
| I need to ask the court to move my hearing date | Appearance by Self-Represented Person in Civil Case (CCA-GF-1219-3000), Verified Motion for Continuance (CCA-GF-1219-3002) and the Order on Verified Motion for Continuance for the judge |

All forms are approved by the Coalition for Court Access and published on [IndianaLegalHelp.org](https://indianalegalhelp.org). See [forms/README.md](forms/README.md) for sources and form numbers.

## Try it

Open `form-builder-mvp.html` in a browser, or run a local server:

```bash
node scripts/serve.mjs
```

Then go to http://localhost:5190/. If that port is busy, pass another one, for example `node scripts/serve.mjs 5191`.

## Privacy

Nothing anyone types is saved or sent anywhere. Answers stay in the open browser tab, and the PDF is filled in the browser.

## How the PDF is made

The official PDFs in `forms/` are packed into one script per packet in `forms/data/` (run `node scripts/build-form-data.mjs` after replacing one), and the app loads only the packet the person needs. The app fills them with [pdf-lib](https://pdf-lib.js.org) 1.17.1 and shows the preview with [PDF.js](https://mozilla.github.io/pdf.js/) 3.11.174. Both, and the PDF.js worker, load from cdnjs with integrity checks, so the first PDF needs an internet connection. If only the preview fails to load, the downloads still work.

Answers that are longer than the lines on the official form (Answer items 3 to 6, and the reason on the Verified Motion for Continuance) continue on a page added right after that form, titled "Attachment to" the form, and the form's last line says "(continued on attached page)." The summary points this out. Characters the forms' standard font can't print are printed as the closest plain letter (for example "Ł" as "L") or "?", and the summary points those out too.

The official forms print some text, and have answer lines, in the top inch of the page, where the E-Filing User Guide asks filers to leave space. That is the official layout, so the tool doesn't move anything.
