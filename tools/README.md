# Phone tools — frontend handoff

- `/tools/`: directory linking all three tools; linked from the shared footer only.
- `/tools/carrier-check/`: carrier checker UI.
- `/tools/phone-type-check/`: mobile, landline, and VoIP checker UI.
- `/tools/phone-number-validation/`: number format and numbering-plan validation UI.
- `/css/tools.css`: shared tools styling; existing site header/footer are reused.
- `/js/carrier-check.js`: carrier controller and `lookupCarrier(number)` boundary.
- `/js/phone-check.js`: shared type/validation controller and `lookupPhone(number)` boundary, selected by the form’s `data-tool` attribute.

No dependencies, build step, network requests, or number storage.

## Sample data

The UI uses finished product copy. The following number-to-carrier pairings are temporary fictional fixtures for frontend development; the backend is not connected:

| Input | Carrier | Country |
| --- | --- | --- |
| `+14155550123` | AT&T | United States |
| `+447700900123` | Vodafone | United Kingdom |
| `+16045550123` | TELUS | Canada |

Spaces, parentheses, dots and hyphens are stripped before sample matching. Input checks only enforce a leading `+`, a nonzero first digit, and 7–15 total digits in this frontend. This is not numbering-plan validation, an active-line check, or evidence of ownership. Numbers outside the fixture set get a carrier-information-unavailable message, never an invented carrier.

## Backend integration

Replace `lookupCarrier(number)` with an adapter to an agreed server endpoint. It currently resolves a fixture or `null` after a 600 ms simulated delay. This repository does not define a carrier lookup endpoint: the existing public OTP documentation describes `lookup` as an empty compatibility field.

The current renderer accepts this UI model (not a finalized API contract):

```json
{
  "number": "+1 415 555 0123",
  "carrier": "AT&T",
  "country": "United States",
  "countryCode": "US",
  "callingCode": "+1"
}
```

Keep provider credentials on the server. Agree how the provider represents unavailable or unknown carrier data, ported numbers, unsupported destinations, request failures and rate limits. Map those cases to explicit user-facing messages; a lookup failure must not imply the number is invalid. The current `null` handling shows carrier information unavailable; map the server’s actual not-found/unavailable responses to the appropriate state. Display provider strings as text, as the renderer currently does.

The UI already includes example, editing, loading, result, format-error, unavailable, and exception states. A request counter prevents stale responses from replacing a more recent edit or submission. Copy failures are announced without falsely reporting success. The form supports Enter submission and accessible field errors and status announcements.

Before launch, replace the fixture lookup, initial fixture result and simulated delay with the live integration. The page labels, messages and clipboard text already use finished product copy. Add any live lookup policy copy based on the actual implementation. Change the four pages from `noindex, follow` to the site's standard robots metadata and add all four canonical URLs to `sitemap.xml`.

## Manual verification

Serve the repository root with `python3 -m http.server 8080`.

1. Open `/tools/`, then the carrier checker; confirm all three cards open the correct tool.
2. Submit an empty input; check the inline error and input focus.
3. Try all three sample buttons, including a formatted number entered manually.
4. Try a plausible unsampled number; it must show carrier information unavailable, not a carrier.
5. Submit a sample, then edit or submit another sample during loading; only the latest state should remain.
6. Copy a result and confirm it includes the displayed number and carrier; deny clipboard access to check the fallback.
7. Check mobile layout, keyboard submission, FAQ expansion and the shared mobile menu.

## FAQ references

The public FAQs explain carrier lookup, number portability, line type, and the
limits of carrier data. The backend integration must provide the data described by the tool.
Factual copy was checked against:

- [Twilio Line Type Intelligence](https://www.twilio.com/docs/lookup/v2-api/line-type-intelligence): carrier names, line types, and missing carrier data.
- [Twilio Line Status](https://www.twilio.com/docs/lookup/v2-api/line-status): activity and reachability are separate checks.
- [Google libphonenumber FAQ](https://github.com/google/libphonenumber/blob/master/FAQ.md): portability, original-carrier metadata, and the distinction between validation and reachability.


## Phone type and validation handoff

`js/phone-check.js` keeps independent fixture maps for the two new tools. Replace
`lookupPhone(number)` with an adapter that chooses the appropriate server endpoint
using `form.dataset.tool`. The endpoint names and provider are still to be agreed.
Do not replace these fixtures with prefix guessing or treat the input regex as validation.

Phone type fixture responses:

| Input | Line type | Carrier |
| --- | --- | --- |
| `+14155550123` | Mobile | AT&T |
| `+14155550124` | Landline | AT&T |
| `+14155550125` | VoIP | Twilio |

Type renderer fields: `value` (display label), `number`, `country`, `carrier`,
`callingCode`. These pairings are fictional, like the carrier fixtures.

Validation fixture responses:

| Input | Result | Reason |
| --- | --- | --- |
| `+14155550123` | Valid format | Matches numbering plan |
| `+447700900123` | Valid format | Matches numbering plan |
| `+1415555012` | Invalid format | Too short for United States |

Validation renderer fields: `value`, `valid` (boolean), `number`, `country`,
`international`, `reason`. The invalid fixture exercises a negative outcome,
including a textual reason and red result styling. It passes the input sanity
check but fails the fixture's numbering-plan check. Real validation must come
from the eventual integration; these responses do not prove assignment or activity.

An unknown input returns `null` and shows an unavailable message, which is
separate from an invalid result. The result note and clipboard output explain
that neither a line type nor a valid format establishes activity or ownership.
Exercise all examples, pending-request edits, copy denial, malformed input,
and unknown numbers on each tool before integration.

Additional validation FAQ source:
[Twilio Formatting and Validation](https://www.twilio.com/docs/lookup/v2-api/formatting-validation).
