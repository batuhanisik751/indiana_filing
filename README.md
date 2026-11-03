# indiana_filing

**Indiana Court Form Helper** is a step-by-step web tool for self-represented Indiana litigants. People pick their situation and answer one question at a time. Each answer fills its spot on an official Indiana court form. At the end, a summary shows the completed form and flags anything missing or incomplete, and people fix it by changing their own answers.

The tool explains what each question means but never suggests what to write. It does not give legal advice and does not file anything with the court.

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

Nothing anyone types is saved or sent anywhere. Answers stay in the open browser tab.
