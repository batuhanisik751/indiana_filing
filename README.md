# indiana_filing

**Indiana Court Form Helper** is a step-by-step web tool for self-represented Indiana litigants. People pick their situation and answer one question at a time. Each answer fills its spot on an official Indiana court form. At the end, a summary shows the completed form and flags anything missing or incomplete, and people fix it by changing their own answers.

The tool explains what each question means but never suggests what to write. It does not give legal advice and does not file anything with the court.

At the end, people can preview the filled official form and download it as a PDF: all forms together to print, or each form on its own to e-file (Indiana's E-Filing User Guide says each document is filed under its own filing code). People who e-file can sign with "/s/" and their name, which the guide allows; people who file on paper get blank signature lines to sign by hand.

MVP prototype, Team 5, AI for Impact (Northeastern University, Fall 2026), built for the Indiana Supreme Court Office of Judicial Administration.

## Situations

| Situation | Official forms it fills |
|---|---|
| I'm being sued and need to respond to the complaint | Appearance by Self-Represented Person in Civil Case (CCA-GF-1225-6003) and Answer (CCA-GF-0626-6008) |
| I'm being sued and want to tell the court I'm representing myself | Appearance by Self-Represented Person in Civil Case (CCA-GF-1225-6003) |
| I'm starting a case and can't afford the filing fee | Appearance by Unrepresented Person (CCA-GF-0420-3012), Verified Motion for Fee Waiver (CCA-GF-0420-3006) and Order on Fee Waiver (CCA-GF-0420-3007) |
| I need to move my hearing date | Points to Indiana Legal Help's official continuance form (a guided version is planned) |

All forms are approved by the Coalition for Court Access and published on [IndianaLegalHelp.org](https://indianalegalhelp.org). See [forms/README.md](forms/README.md) for sources and form numbers.

## Try it

Open `form-builder-mvp.html` in a browser, or run a local server:

```bash
node scripts/serve.mjs
```

Then go to http://localhost:5190/.

## Privacy

Nothing anyone types is saved or sent anywhere. Answers stay in the open browser tab, and the PDF is filled in the browser.

## How the PDF is made

The official PDFs in `forms/` are packed into `forms/form-data.js` (run `node scripts/build-form-data.mjs` after replacing one). The app fills them with [pdf-lib](https://pdf-lib.js.org) 1.17.1 and shows the preview with [PDF.js](https://mozilla.github.io/pdf.js/) 3.11.174. Both load from cdnjs with integrity hashes, so the first PDF needs an internet connection.
