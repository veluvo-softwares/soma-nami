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
