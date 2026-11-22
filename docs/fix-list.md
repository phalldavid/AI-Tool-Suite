# Fix list (drs-fixes/1)

An inspection of renders writes one `fixes.json`. Load it in the app with **Fix queue** (History tab or Edit tab).

Per picture: `image` (file name), optional `imageId` (record id from the picture's embedded history), `verdict`
(`pass`, `conditional`, `fail`), `summary`, and `findings`.

Per finding: `id`, `category`, `severity` (`blocker`, `major`, `minor`, `note`), `title`, `what`, optional `expected`,
optional `box` = `[x, y, width, height]` as fractions of the picture, `status`, and `fix`:

| `fix.size` | Meaning | `fix.method` |
| --- | --- | --- |
| 0 | Accept as is | `accept` |
| 1 | Hand fix in Photopea | `hand` |
| 2 | Spot edit of one area | `spot-edit` (needs `box` and `prompt`) |
| 3 | Whole-picture relight | `relight` (`light`, default `night`) |
| 4 | Re-render with the original prompt corrected | `re-render` (`patch.add`, `patch.replace`) |
| 5 | Fix the model or camera first | `source` |

The app runs `spot-edit` and `relight` itself, after you see the prompt and cost in the usual review step.
`re-render` copies the original prompt with the correction applied. Statuses (`open`, `applied`, `accepted`,
`recheck`, `closed`, `wontfix`) are kept in the browser and can be saved back to a file for re-inspection.
