# Handwriting spike: two readers plus a dose grammar

Card t_883826d4, 26 Oct 2026. Measurement only: no app code, no phone. Synthetic data only.

Question: can two independent readers plus a fixed dose grammar speak handwritten dose labels with zero wrong doses?

## Answer

**No-go on this evidence. Zero wrong doses, but not enough read, and reader B does not fit the phone.**

| Setup | Spoken | Spoken and WRONG | Not-sure |
|---|---|---|---|
| A + B (EasyOCR + LightOnOCR-2) | 6 of 24 (25%) | 0 | 18 |
| A + A-crop (EasyOCR on two crops) | 5 of 24 (21%) | 0 | 19 |
| A + A-bin (EasyOCR, original + binarised) | 2 of 24 (8%) | 0 | 22 |
| A + A-crop + A-bin (all three agree) | 2 of 24 (8%) | 0 | 22 |

Go criteria were 0 wrong **and** at least a third read. The safety half passes, the usefulness half fails (25% < 33%). Nothing here can be called a go until it is run on real handwriting, which needs Wesley's photos (see "What I need").

## What was run

All on the VPS, 24 images from `spike/make_images.py` (6 labels x 4 handwriting fonts), `spike/data/hand/`.

- **Reader A**: EasyOCR (`OCR_LATIN` + `OCR_CRAFT`), phone config: `canvasSize 1024`, `recognizerBatchSize 1`, `magRatio 1.5`. Re-run for this spike (`spike/ocr_reads.mjs`), because the C2 run in `out/ocr.json` used the default config. Readings differ a little between the two configs (for example `2 bd` on the Homemade Apple font was `2 &d` before and `2 ld` now), so reading noise is real.
- **Reader B**: LightOnOCR-2 (`OCR_0_6B_MULTIMODAL_Q4_K_M` + F16 mmproj), prompt "Transcribe all text in this image exactly as written." Reused from the C2 run (`spike/ocr_vlm.mjs`, same images, temp 0), hand subset saved in `spike/results/hand_reads_B_lightonocr.json`. Not re-run: it is deterministic at temp 0 and costs 3 hours of CPU.
- **Cheap second reader**: reader A again on two preprocessings (`spike/make_hand_variants.py`): `crop` (tight crop around the ink plus 25% margin, autocontrast) and `bin` (greyscale, autocontrast, sharpen, hard threshold, padded).
- **Dose grammar** (`spike/dose_grammar.mjs`, 4 test groups in `dose_grammar.test.mjs`, all passing):
  `[form] count [form] frequency [duration] [timing]`
  - count: 1, 2, 1/2 (a count is required; "tds" alone is never a dose)
  - form: tab, cap, ml (and plurals / long forms)
  - frequency: od, bd, tds, qid, nocte, mane, `x2`..`x4` (so `1x3`, `1 x 3`, `1×3`), `mara 2..4`
  - duration: `x N days`, `N/7`, `x N/7`
  - timing: `after food`
  - LaTeX and markdown wrapping from B (`$2 \text{ bd } x \ 7/7$`) is stripped. Nothing else is repaired: no I to 1, no l to 1. Any stray character or leftover word means not-sure.
- **Rule**: speak only if every reader parses and all canonical doses are identical (count, form, frequency, duration, timing). Otherwise not-sure.
- **Scoring**: the truth strings from `data/truth.json` go through the same parser; spoken is correct only if it equals the truth exactly.

Reproduce: `python3 make_hand_variants.py && ./run_hand_reads.sh && node eval_hand.mjs` (about an hour on 1 CPU), `node --test dose_grammar.test.mjs`. Raw reads: `spike/results/hand_reads_*.json`; all tables: `spike/results/hand_dose_eval.md`.

## Findings

1. **Zero wrong doses in every setup, including each reader alone.** That is a weaker result than it sounds: n = 24, four fonts, one clean synthetic style.
2. **The known failure was caught, but by the grammar, not by independence.** "Tab 1 tds" read as "Tab 4 tds" by A, with B reading "Tab 1 tds" (Indie Flower): A and B disagree, so not-sure. Good. But A, A-crop and A-bin all read "Tab 4 tds" too: **the same model on a different crop makes the same mistake**. That variant was only safe because 4 is not in the count list {1, 2, 1/2}. A misread such as "Tab 2 tds" for "Tab 1 tds" would have been spoken by the cheap variant. So the cheap variant is not an independent second reader and should not be shipped on this evidence.
3. **The dropped-count case is caught by the grammar.** "nocte" (count dropped, Shadows Into Light) and "bd x 7/7" are not-sure because a count is required, so a half-read label is never spoken as a full dose.
4. **Coverage is capped by A.** B alone parses 17 of 24 (and was right on all 17), but A reads few of those, so A + B speaks 6. By label: `1x3` 2 of 4, `2 bd` 2 of 4, `1x3 x 5 days` 0 of 4, `2 bd x 7/7` 0 of 4, `Tab 1 tds / after food` 0 of 4, `1 nocte` 2 of 4. **Anything with a duration or timing was never spoken.**
5. **B alone looks good here (17 spoken, 0 wrong) but is not safe to rely on.** It is one generative model with no cross-check; its misses were mostly visible as unparseable ("143", "2 led", "1 note"), but this set does not prove it never writes a fluent wrong dose. The two-reader rule exists exactly for that.

## Reader B on the phone

Numbers are from the VPS (1 thread); the phone figures use the C4 ratio (OCR 22 s on iPhone 12 vs about 78 s on the VPS, about 3.5x) and are **[A] assumptions**, not measurements.

| | VPS | iPhone 12 [A] |
|---|---|---|
| Time per image | 428 CPU-s mean on the 24 hand images (357 to 589) | about 2 min (428 / 3.5 = 122 s), on top of A's roughly 22 s |
| Model load | 148 s | not measured |
| Peak memory | 2.9 GB RSS (0.1 GB baseline) | above the roughly 2 GB iOS limit for a 4 GB phone [A] |

- **It does not fit with margin.** About 0.5 GB of the 2.9 GB is node and the worker runtime (C2 estimate for the OCR process), leaving roughly 2.4 GB for the model, mmproj and context [A]. That is still over 2 GB.
- **The `com.apple.developer.kernel.increased-memory-limit` entitlement may or may not cover it.** It raises the per-app limit, but Apple does not publish the value for a 4 GB iPhone 12, and I have not measured it. It would be at best a few hundred MB of headroom; a jetsam kill mid-label would be a bad failure for a blind user. I'd treat B as not fitting the iPhone 12 until a device run proves otherwise (`phys_footprint` on the phone).
- B would also have to run after A with A unloaded, so a label would take about 2.5 minutes of silence. That is a product problem on its own.

**Flag: B cannot be shipped on the iPhone 12 on this evidence.** A two-reader design that needs B is therefore blocked by memory and time before accuracy even matters.

## Recommendation

**No-go for now.** Keep handwriting as "not sure, ask the pharmacist".

- The safe half works: the grammar plus two readers gave 0 wrong, and the one real danger case (4 for 1) was stopped.
- The useful half doesn't: 25% read, nothing with duration or timing, and the only reader that adds coverage (B) can't run on the phone.
- The cheap variant fails the independence test (finding 2).

What could change it, in order of value:
1. Real handwriting photos through the same table (below). Fonts are a stand-in, and real photos may be better or much worse.
2. If real photos show A alone reads short labels like `1x3`, `2 bd`, `1 nocte` reliably, a narrow mode could speak only those with a "Check with the pharmacist" line, and leave durations and timing as not-sure. That is a smaller, honest feature, but it needs the real photos before anyone relies on it.
3. A smaller second reader that fits the phone, if one exists in QVAC. I haven't looked; this card didn't ask.

If Wesley decides it is a go after the real photos, the next card is the on-phone check and the narration from pre-generated Swahili clips: "Inaonekana inasema: ... Thibitisha na mfamasia."

## What I need

6 to 10 phone photos of real handwritten labels, taken as the app would (one at a time, normal light): `1x3`, `2 bd`, `Tab 1 tds`, `1 nocte`, `x5 days`, `2 bd x 7/7`. Wesley's own handwriting is fine. I will run the same table on them. Keep them out of the repo (I'll put the table in this doc, without the photos).

## Results tables

Generated by `node eval_hand.mjs`. "Result" is the dose that would be spoken, or not-sure.

### Totals (24 synthetic images)

| Reader setup | Spoken | Spoken and WRONG | Not-sure |
|---|---|---|---|
| A alone | 6 | 0 | 18 |
| B alone | 17 | 0 | 7 |
| A-crop alone | 6 | 0 | 18 |
| A-bin alone | 2 | 0 | 22 |
| A + B (EasyOCR + LightOnOCR-2) | 6 | 0 | 18 |
| A + A-crop (EasyOCR, two crops) | 5 | 0 | 19 |
| A + A-bin (EasyOCR, original + binarised) | 2 | 0 | 22 |
| A-crop + A-bin | 2 | 0 | 22 |
| A + A-crop + A-bin (all three agree) | 2 | 0 | 22 |

### Per image: A + B

| Image | Truth | A (EasyOCR) | B (LightOnOCR-2) | Result | Verdict |
|---|---|---|---|---|---|
| h1_1x3_homemadeapple | 1 x3 | "Ip3" | "143" | not-sure | not-sure |
| h1_1x3_indieflower | 1 x3 | "Ax3" | "1×3" | not-sure | not-sure |
| h1_1x3_reeniebeanie | 1 x3 | "1X3" | "1×3" | 1 x3 | correct |
| h1_1x3_shadowsintolight | 1 x3 | "1X3" | "1x3" | 1 x3 | correct |
| h2_2bd_homemadeapple | 2 bd | "2 ld" | "2 led" | not-sure | not-sure |
| h2_2bd_indieflower | 2 bd | "2 bd" | "2 bd" | 2 bd | correct |
| h2_2bd_reeniebeanie | 2 bd | "bd / 7" | "$z \\quad bd$" | not-sure | not-sure |
| h2_2bd_shadowsintolight | 2 bd | "2 bd" | "2 bd" | 2 bd | correct |
| h3_1x3_5days_homemadeapple | 1 x3 x 5d | "p 3 / Ks dayn" | "1 x 3  \nx 5 days" | not-sure | not-sure |
| h3_1x3_5days_indieflower | 1 x3 x 5d | "4 x 3 / x 5 days" | "1 x 3  \nx 5 days" | not-sure | not-sure |
| h3_1x3_5days_reeniebeanie | 1 x3 x 5d | "1  X  3 / X < Jads" | "1 x 3  \nx 5 days" | not-sure | not-sure |
| h3_1x3_5days_shadowsintolight | 1 x3 x 5d | "1 X 2 / X V days" | "1 x 3  \nx 5 days" | not-sure | not-sure |
| h4_2bd_7days_homemadeapple | 2 bd x 7/7 | "Bd + 7/7" | "2 bad p 7/7" | not-sure | not-sure |
| h4_2bd_7days_indieflower | 2 bd x 7/7 | "2 bd x +/+" | "2 bd × 7/7" | not-sure | not-sure |
| h4_2bd_7days_reeniebeanie | 2 bd x 7/7 | "bj x 7/7" | "$2 \\text{ bd } x \\ 7/7$" | not-sure | not-sure |
| h4_2bd_7days_shadowsintolight | 2 bd x 7/7 | "bd x 7/7" | "2 bd x 7/7" | not-sure | not-sure |
| h5_tds_homemadeapple | tab 1 tds after food | "Yal tda / aptet Yod" | "Jale / tds  \nafter food" | not-sure | not-sure |
| h5_tds_indieflower | tab 1 tds after food | "Tab 4 tds / after food" | "Tab 1 tds  \nafter food" | not-sure | not-sure |
| h5_tds_reeniebeanie | tab 1 tds after food | "Tab 1 #ds / after 4oo d" | "Tab 1 +ds  \nafter food" | not-sure | not-sure |
| h5_tds_shadowsintolight | tab 1 tds after food | "Tab td5 / after  fod" | "Tab 1 tds  \nafter food" | not-sure | not-sure |
| h6_nocte_homemadeapple | 1 nocte | "noete" | "1 note" | not-sure | not-sure |
| h6_nocte_indieflower | 1 nocte | "1 nocte" | "1 nocte" | 1 nocte | correct |
| h6_nocte_reeniebeanie | 1 nocte | "1 nocte" | "1 nocte" | 1 nocte | correct |
| h6_nocte_shadowsintolight | 1 nocte | "nodte" | "1 nocte" | not-sure | not-sure |

### Per image: A + A-crop (EasyOCR, two crops)

| Image | Truth | A | second reader | Result | Verdict |
|---|---|---|---|---|---|
| h1_1x3_homemadeapple | 1 x3 | "Ip3" | "113" | not-sure | not-sure |
| h1_1x3_indieflower | 1 x3 | "Ax3" | "x3" | not-sure | not-sure |
| h1_1x3_reeniebeanie | 1 x3 | "1X3" | "1X3" | 1 x3 | correct |
| h1_1x3_shadowsintolight | 1 x3 | "1X3" | "1X3" | 1 x3 | correct |
| h2_2bd_homemadeapple | 2 bd | "2 ld" | "2 ld" | not-sure | not-sure |
| h2_2bd_indieflower | 2 bd | "2 bd" | "2 bd" | 2 bd | correct |
| h2_2bd_reeniebeanie | 2 bd | "bd / 7" | "bd / 7" | not-sure | not-sure |
| h2_2bd_shadowsintolight | 2 bd | "2 bd" | "2 bd" | 2 bd | correct |
| h3_1x3_5days_homemadeapple | 1 x3 x 5d | "p 3 / Ks dayn" | "+ 3 / K s dayn" | not-sure | not-sure |
| h3_1x3_5days_indieflower | 1 x3 x 5d | "4 x 3 / x 5 days" | "1 x 3 / x 5 days" | not-sure | not-sure |
| h3_1x3_5days_reeniebeanie | 1 x3 x 5d | "1  X  3 / X < Jads" | "1  X  3 / X < Jads" | not-sure | not-sure |
| h3_1x3_5days_shadowsintolight | 1 x3 x 5d | "1 X 2 / X V days" | "1 X 2 / X V days" | not-sure | not-sure |
| h4_2bd_7days_homemadeapple | 2 bd x 7/7 | "Bd + 7/7" | "Ud + 77" | not-sure | not-sure |
| h4_2bd_7days_indieflower | 2 bd x 7/7 | "2 bd x +/+" | "2 bd x +/+" | not-sure | not-sure |
| h4_2bd_7days_reeniebeanie | 2 bd x 7/7 | "bj x 7/7" | "Va x ~7/7" | not-sure | not-sure |
| h4_2bd_7days_shadowsintolight | 2 bd x 7/7 | "bd x 7/7" | "bd x 7/7" | not-sure | not-sure |
| h5_tds_homemadeapple | tab 1 tds after food | "Yal tda / aptet Yod" | "Yal tda / aptet Rood" | not-sure | not-sure |
| h5_tds_indieflower | tab 1 tds after food | "Tab 4 tds / after food" | "Tab 4 tds / after food" | not-sure | not-sure |
| h5_tds_reeniebeanie | tab 1 tds after food | "Tab 1 #ds / after 4oo d" | "Tab 1 +ds / after 4o d" | not-sure | not-sure |
| h5_tds_shadowsintolight | tab 1 tds after food | "Tab td5 / after  fod" | "Tab td5 / after fod" | not-sure | not-sure |
| h6_nocte_homemadeapple | 1 nocte | "noete" | "noete" | not-sure | not-sure |
| h6_nocte_indieflower | 1 nocte | "1 nocte" | "1 nocte" | 1 nocte | correct |
| h6_nocte_reeniebeanie | 1 nocte | "1 nocte" | "nocte" | not-sure | not-sure |
| h6_nocte_shadowsintolight | 1 nocte | "nodte" | "nodte" | not-sure | not-sure |

### Per image: A + A-bin (EasyOCR, original + binarised)

| Image | Truth | A | second reader | Result | Verdict |
|---|---|---|---|---|---|
| h1_1x3_homemadeapple | 1 x3 | "Ip3" | "lp3" | not-sure | not-sure |
| h1_1x3_indieflower | 1 x3 | "Ax3" | "Ax3" | not-sure | not-sure |
| h1_1x3_reeniebeanie | 1 x3 | "1X3" | "1Y3" | not-sure | not-sure |
| h1_1x3_shadowsintolight | 1 x3 | "1X3" | "1X3" | 1 x3 | correct |
| h2_2bd_homemadeapple | 2 bd | "2 ld" | "2 ld" | not-sure | not-sure |
| h2_2bd_indieflower | 2 bd | "2 bd" | "2 bd" | 2 bd | correct |
| h2_2bd_reeniebeanie | 2 bd | "bd / 7" | "bd" | not-sure | not-sure |
| h2_2bd_shadowsintolight | 2 bd | "2 bd" | "bd" | not-sure | not-sure |
| h3_1x3_5days_homemadeapple | 1 x3 x 5d | "p 3 / Ks dayn" | "/ + 3 / K < dayn" | not-sure | not-sure |
| h3_1x3_5days_indieflower | 1 x3 x 5d | "4 x 3 / x 5 days" | "4 x 3 / x 5 days" | not-sure | not-sure |
| h3_1x3_5days_reeniebeanie | 1 x3 x 5d | "1  X  3 / X < Jads" | "1  X 3 / X < dads" | not-sure | not-sure |
| h3_1x3_5days_shadowsintolight | 1 x3 x 5d | "1 X 2 / X V days" | "X 2 / X V days" | not-sure | not-sure |
| h4_2bd_7days_homemadeapple | 2 bd x 7/7 | "Bd + 7/7" | " Ud +77" | not-sure | not-sure |
| h4_2bd_7days_indieflower | 2 bd x 7/7 | "2 bd x +/+" | "2 bd x +/+" | not-sure | not-sure |
| h4_2bd_7days_reeniebeanie | 2 bd x 7/7 | "bj x 7/7" | "bj x 7/7" | not-sure | not-sure |
| h4_2bd_7days_shadowsintolight | 2 bd x 7/7 | "bd x 7/7" | "bd x 7/7" | not-sure | not-sure |
| h5_tds_homemadeapple | tab 1 tds after food | "Yal tda / aptet Yod" | "Jal / tda / antet Rood" | not-sure | not-sure |
| h5_tds_indieflower | tab 1 tds after food | "Tab 4 tds / after food" | "Tab 4 tds / after food" | not-sure | not-sure |
| h5_tds_reeniebeanie | tab 1 tds after food | "Tab 1 #ds / after 4oo d" | "Tab 1 +ds / after 4oo d" | not-sure | not-sure |
| h5_tds_shadowsintolight | tab 1 tds after food | "Tab td5 / after  fod" | "Tab td5 / after  {od" | not-sure | not-sure |
| h6_nocte_homemadeapple | 1 nocte | "noete" | "noete" | not-sure | not-sure |
| h6_nocte_indieflower | 1 nocte | "1 nocte" | "nocte" | not-sure | not-sure |
| h6_nocte_reeniebeanie | 1 nocte | "1 nocte" | "nocte" | not-sure | not-sure |
| h6_nocte_shadowsintolight | 1 nocte | "nodte" | "nocte" | not-sure | not-sure |

### Per image: A + A-crop + A-bin (all three agree)

| Image | Truth | A | second reader | Result | Verdict |
|---|---|---|---|---|---|
| h1_1x3_homemadeapple | 1 x3 | "Ip3" | "113" ; "lp3" | not-sure | not-sure |
| h1_1x3_indieflower | 1 x3 | "Ax3" | "x3" ; "Ax3" | not-sure | not-sure |
| h1_1x3_reeniebeanie | 1 x3 | "1X3" | "1X3" ; "1Y3" | not-sure | not-sure |
| h1_1x3_shadowsintolight | 1 x3 | "1X3" | "1X3" ; "1X3" | 1 x3 | correct |
| h2_2bd_homemadeapple | 2 bd | "2 ld" | "2 ld" ; "2 ld" | not-sure | not-sure |
| h2_2bd_indieflower | 2 bd | "2 bd" | "2 bd" ; "2 bd" | 2 bd | correct |
| h2_2bd_reeniebeanie | 2 bd | "bd / 7" | "bd / 7" ; "bd" | not-sure | not-sure |
| h2_2bd_shadowsintolight | 2 bd | "2 bd" | "2 bd" ; "bd" | not-sure | not-sure |
| h3_1x3_5days_homemadeapple | 1 x3 x 5d | "p 3 / Ks dayn" | "+ 3 / K s dayn" ; "/ + 3 / K < dayn" | not-sure | not-sure |
| h3_1x3_5days_indieflower | 1 x3 x 5d | "4 x 3 / x 5 days" | "1 x 3 / x 5 days" ; "4 x 3 / x 5 days" | not-sure | not-sure |
| h3_1x3_5days_reeniebeanie | 1 x3 x 5d | "1  X  3 / X < Jads" | "1  X  3 / X < Jads" ; "1  X 3 / X < dads" | not-sure | not-sure |
| h3_1x3_5days_shadowsintolight | 1 x3 x 5d | "1 X 2 / X V days" | "1 X 2 / X V days" ; "X 2 / X V days" | not-sure | not-sure |
| h4_2bd_7days_homemadeapple | 2 bd x 7/7 | "Bd + 7/7" | "Ud + 77" ; " Ud +77" | not-sure | not-sure |
| h4_2bd_7days_indieflower | 2 bd x 7/7 | "2 bd x +/+" | "2 bd x +/+" ; "2 bd x +/+" | not-sure | not-sure |
| h4_2bd_7days_reeniebeanie | 2 bd x 7/7 | "bj x 7/7" | "Va x ~7/7" ; "bj x 7/7" | not-sure | not-sure |
| h4_2bd_7days_shadowsintolight | 2 bd x 7/7 | "bd x 7/7" | "bd x 7/7" ; "bd x 7/7" | not-sure | not-sure |
| h5_tds_homemadeapple | tab 1 tds after food | "Yal tda / aptet Yod" | "Yal tda / aptet Rood" ; "Jal / tda / antet Rood" | not-sure | not-sure |
| h5_tds_indieflower | tab 1 tds after food | "Tab 4 tds / after food" | "Tab 4 tds / after food" ; "Tab 4 tds / after food" | not-sure | not-sure |
| h5_tds_reeniebeanie | tab 1 tds after food | "Tab 1 #ds / after 4oo d" | "Tab 1 +ds / after 4o d" ; "Tab 1 +ds / after 4oo d" | not-sure | not-sure |
| h5_tds_shadowsintolight | tab 1 tds after food | "Tab td5 / after  fod" | "Tab td5 / after fod" ; "Tab td5 / after  {od" | not-sure | not-sure |
| h6_nocte_homemadeapple | 1 nocte | "noete" | "noete" ; "noete" | not-sure | not-sure |
| h6_nocte_indieflower | 1 nocte | "1 nocte" | "1 nocte" ; "nocte" | not-sure | not-sure |
| h6_nocte_reeniebeanie | 1 nocte | "1 nocte" | "nocte" ; "nocte" | not-sure | not-sure |
| h6_nocte_shadowsintolight | 1 nocte | "nodte" | "nodte" ; "nocte" | not-sure | not-sure |

### Single readers, what each would have done on its own

| Image | Truth | A alone | B alone | A-crop alone | A-bin alone |
|---|---|---|---|---|---|
| h1_1x3_homemadeapple | 1 x3 | not-sure | not-sure | not-sure | not-sure |
| h1_1x3_indieflower | 1 x3 | not-sure | 1 x3 (correct) | not-sure | not-sure |
| h1_1x3_reeniebeanie | 1 x3 | 1 x3 (correct) | 1 x3 (correct) | 1 x3 (correct) | not-sure |
| h1_1x3_shadowsintolight | 1 x3 | 1 x3 (correct) | 1 x3 (correct) | 1 x3 (correct) | 1 x3 (correct) |
| h2_2bd_homemadeapple | 2 bd | not-sure | not-sure | not-sure | not-sure |
| h2_2bd_indieflower | 2 bd | 2 bd (correct) | 2 bd (correct) | 2 bd (correct) | 2 bd (correct) |
| h2_2bd_reeniebeanie | 2 bd | not-sure | not-sure | not-sure | not-sure |
| h2_2bd_shadowsintolight | 2 bd | 2 bd (correct) | 2 bd (correct) | 2 bd (correct) | not-sure |
| h3_1x3_5days_homemadeapple | 1 x3 x 5d | not-sure | 1 x3 x 5d (correct) | not-sure | not-sure |
| h3_1x3_5days_indieflower | 1 x3 x 5d | not-sure | 1 x3 x 5d (correct) | 1 x3 x 5d (correct) | not-sure |
| h3_1x3_5days_reeniebeanie | 1 x3 x 5d | not-sure | 1 x3 x 5d (correct) | not-sure | not-sure |
| h3_1x3_5days_shadowsintolight | 1 x3 x 5d | not-sure | 1 x3 x 5d (correct) | not-sure | not-sure |
| h4_2bd_7days_homemadeapple | 2 bd x 7/7 | not-sure | not-sure | not-sure | not-sure |
| h4_2bd_7days_indieflower | 2 bd x 7/7 | not-sure | 2 bd x 7/7 (correct) | not-sure | not-sure |
| h4_2bd_7days_reeniebeanie | 2 bd x 7/7 | not-sure | 2 bd x 7/7 (correct) | not-sure | not-sure |
| h4_2bd_7days_shadowsintolight | 2 bd x 7/7 | not-sure | 2 bd x 7/7 (correct) | not-sure | not-sure |
| h5_tds_homemadeapple | tab 1 tds after food | not-sure | not-sure | not-sure | not-sure |
| h5_tds_indieflower | tab 1 tds after food | not-sure | tab 1 tds after food (correct) | not-sure | not-sure |
| h5_tds_reeniebeanie | tab 1 tds after food | not-sure | not-sure | not-sure | not-sure |
| h5_tds_shadowsintolight | tab 1 tds after food | not-sure | tab 1 tds after food (correct) | not-sure | not-sure |
| h6_nocte_homemadeapple | 1 nocte | not-sure | not-sure | not-sure | not-sure |
| h6_nocte_indieflower | 1 nocte | 1 nocte (correct) | 1 nocte (correct) | 1 nocte (correct) | not-sure |
| h6_nocte_reeniebeanie | 1 nocte | 1 nocte (correct) | 1 nocte (correct) | not-sure | not-sure |
| h6_nocte_shadowsintolight | 1 nocte | not-sure | 1 nocte (correct) | not-sure | not-sure |
