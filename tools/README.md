# Phone tools — frontend handoff

- `/tools/`: directory linking all three tools; linked from the shared footer only.
- `/tools/carrier-check/`: carrier checker UI.
- `/tools/phone-type-check/`: mobile, landline, and VoIP checker UI.
- `/tools/phone-number-validation/`: number format and numbering-plan validation UI.
- `/css/tools.css`: shared tools styling; existing site header/footer are reused.
- `/js/carrier-check.js`: carrier controller and `lookupCarrier(number)` boundary.
- `/js/phone-check.js`: shared type/validation controller and `lookupPhone(number)` boundary, selected by the form’s `data-tool` attribute.

No dependencies or build step. The three tools call the SecondFactor Lookup API from the
browser and store nothing.

## Live lookups

`js/sf-lookup.js` is the shared adapter, loaded before each tool's controller. It calls

    GET https://api.secondfactor.ai/v2/PhoneNumbers/{E164}?Fields=line_type_intelligence
    X-API-Key: <demo key>

and maps the response to the UI models the renderers already use:

- `SFLookup.phoneType(number)` — `line_type_intelligence.type` becomes the line type
  (mobile, landline, VoIP, toll-free, …); an invalid number renders as "Not a valid number"
  with the API's reason; a valid number with no known type returns `null` (the
  "phone type unavailable" state).
- `SFLookup.validate(number)` — `valid` / `validation_errors` become "Valid format" /
  "Invalid format" plus a readable reason (TOO_SHORT, NOT_A_NUMBER, …).
- `SFLookup.carrier(number)` — `line_type_intelligence.carrier_name`, or `null` when the
  API has no carrier for the number (the "carrier information unavailable" state).

Country names come from `Intl.DisplayNames` (falling back to the ISO code). A 429 from the
API shows a "too many lookups" message; any other failure shows the generic lookup-failed
message, which never implies the number is invalid.

### The API key

The key in `js/sf-lookup.js` belongs to a demo account that can only run lookups. It is
stored base64-encoded in pieces so it is not greppable as plain text, but a browser has to
send it, so anyone can read it from DevTools or the network tab. Treat it as public: keep
that account read-only, prepaid and rate-limited, and rotate the key from
https://app.secondfactor.ai/dashboard/keys if it is abused. Real credentials belong on a
server.

### CORS

The API answers browser requests only from origins on its allowlist (currently
`https://app.secondfactor.ai`). `https://secondfactor.ai` must be added on the API side
before the tools work on the live site; until then, and on local previews, every lookup
ends in the "we couldn't complete the lookup" state.

## Example numbers

The example buttons use numbers the live API answers with real data:

| Tool | Input | Result |
| --- | --- | --- |
| Phone type | `+9779841234567` | Mobile, Nepal Telecom |
| Phone type | `+61280000000` | Landline, Australia |
| Phone type | `+18004444444` | Toll-free, United States |
| Carrier | `+4915112345678` / `+33612345678` / `+919876543210` | T-Mobile / SFR / Airtel |
| Validation | `+9779841234567`, `+4915112345678` | Valid format |
| Validation | `+1415555012` | Invalid format (too short) |

The result shown before the first lookup is the first example's real answer, hard-coded in
the page and in the controller's `initial` / `INITIAL` object; keep the two in sync.

## Manual verification

Serve the repository root with `python3 -m http.server 8080`.

1. Open `/tools/`, then the carrier checker; confirm all three cards open the correct tool.
2. Submit an empty input; check the inline error and input focus.
3. Try all three example buttons, including a formatted number entered manually.
4. Try a US number such as `+14155550123`: the API returns no carrier or type for it, so the
   tools must show the unavailable state, never an invented carrier.
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
