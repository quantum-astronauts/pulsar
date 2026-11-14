# Pulsar: Crew Health Monitor

NASA Space Apps 2026 · Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*
Team Quantam Astronauts (Sydney) — Shah & Kai, Macquarie University

Pulsar is an offline-first PWA that closes the loop the brief asks for:
**collect → evaluate → act → hand over.**

| Step | What Pulsar does |
|---|---|
| Collect | 2-minute daily check-in covering every indicator the brief names (**blood pressure, heart rate, blood glucose, body temperature, sleep, mood**) plus exercise, resistance sessions, food eaten, body mass, stress, social contact and symptoms, and a 1–3 min reaction-time test (short PVT) |
| Evaluate | Learns each astronaut's **own** normal and flags drift with an EWMA control chart (λ 0.35, baseline = previous 10–45 days, readings flagged by the drift detector excluded from that indicator's baseline, minimum meaningful effect per metric). Plus clinical lines: fever on the first reading ≥ 38.0 °C; blood pressure ≥ 140 systolic or 90 diastolic (Act ≥ 160 or 100, severe ≥ 180 or 120 with its own emergency checklist) or systolic < 90 (either number alone saves and can flag; green needs both from one measurement, and a one-number entry never hides an earlier high reading); fingerstick glucose < 70 (swallow-safety checklist, < 54 Act) or ≥ 126 as a review prompt, held as *Awaiting recheck* until a normal recheck (same day from the alert, or a later check-in); resting HR ≥ 90 as a review prompt; < 5 h sleep on 3 of 4 nights, symptom streaks, cold-sore reactivation, missed resistance sessions |
| Act | Every flag explains itself in plain language and comes with an offline checklist. Ticks are tracked |
| Hand over | When comms return: a compact, prioritised packet (open items, resolved episodes, trends, adherence, symptom log, notes, mission setting) **signed with ECDSA P-256**; Mission Control verifies it in-app. Tamper demo included |

Five health areas informed by NASA's spaceflight hazards: **bone & muscle, cardiovascular, immune, nutrition & metabolism, behavioral health.**

### How it answers the brief

| Brief asks for | In Pulsar |
|---|---|
| Gather health indicators, any input | Check-in with steppers, scales and chips; reaction test by click, tap or Space |
| Evaluate and act on health status | Personal-baseline drift detector + clinical lines → Nominal / Watch / Act, each with a checklist |
| Human figure with clickable body parts | **Body map** on the Overview: brain, heart, lymph nodes, stomach and skeleton light up by status; tap one for what it does, what space does to it, your readings and prevention |
| Prompt measurements as part of the routine | **Mission routine** card: what is done, due or overdue today (temperature daily, BP every 2nd day, reaction test every 3rd, SLAMMD mass and fasting glucose weekly) |
| Gamification | Check-in streak and a weekly score for measurements taken |
| Dynamic charts | Trends tab: EWMA line against your ±2 SD personal band, events overlaid |
| Colour coding | Green / amber / red for Nominal / Watch / Act, grey for *No data* and *Learning* |
| Don't assume astronauts know everything | **Guide** tab: how to take each measurement in flight (e.g. SLAMMD uses F = ma because scales fail in free fall), why it matters, when to act, and red flags that mean calling the flight surgeon now |
| Different environments | ISS, Moon, Mars transit or Mars surface: gravity, signal delay and ground contact change the guidance and go into the handover |

### Award fit
- **Best Use of Science:** NASA HRP hazards → body systems → indicators; detector validated against known injected events; personal baselines handle the in-flight rise in resting core body temperature measured on ISS crew (Stahn et al. 2017) that a fixed 37.5 °C line would misread.
- **Best Mission Concept:** fully offline, works through a Mars conjunction blackout, store-and-forward signed handover for 3–22 min signal delay.
- **Best Use of Technology:** WebCrypto (AES-256-GCM, ECDSA P-256 with a ground key registry), installable PWA, zero dependencies.

**Security:** data stays on-device (IndexedDB), optionally sealed with AES-256-GCM using a PBKDF2-SHA-256 (310k) key from a crew passphrase. The signing key is non-extractable. Mission Control only trusts keys in its registry: the crew exports a public key file from the Privacy tab before flight, ground imports it under *Trusted crew keys*, and a packet's embedded key is never trusted on its own.

**Honest status:** an area only shows *Nominal* when every indicator it depends on has a reading today and a personal baseline. Otherwise it shows *No data* or *Learning*. The check-in copies nothing over automatically; *Same as last* is an explicit confirmation. Ticked action steps stay attached to an alert for as long as it stays open.

**Validation (synthetic data only):** a seeded 180-day synthetic mission with four injected events (infection MD48–54, sleep shift MD82–92, treadmill outage MD115–130, isolation MD150–172). Rerun after the final edits (14 Nov 2026): on the demo mission (seed 7) it catches **4/4** events, a mean of **1.0 day** after each starts, with 1 false-alarm episode (0.19 per 30 days). Across 50 further synthetic missions (seeds 701–750) it catches **100 %** of events (mean delay: infection 0.2 d, sleep shift 0.7 d, treadmill 0.2 d, isolation 3.3 d) at **0.36 false alarms per 30 days**. These figures describe synthetic data only, not real crew performance. Re-run it live on the Validation tab.

Decision support only. Not a medical device and does not diagnose.

## Quick start

Open `index.html` in Chrome, Edge or Firefox. It is self-contained (code and photos built in), so it works even opened straight from the zip. Only offline install needs a web host, as below.

## Run

```bash
./build.sh                      # app.html + core.js + img/ -> self-contained index.html
python3 -m http.server 8000     # then open http://localhost:8000
```
Deploy the folder to any static host over HTTPS (e.g. GitHub Pages) to make it installable and offline. `#status`, `#trends`, `#validation`, `#handover` deep-link to tabs.

Files: `core.js` (generator, detector, rules, scoring, handover — pure JS, Node-testable), `app.html` (UI, storage, crypto), `sw.js`, `manifest.webmanifest`, `icon.svg`.

## Use of AI (Super Intelligence) tools

- **Anthropic Claude (Claude Code)** wrote the code in `core.js` and `app.html`: interface and styling, drift detector, rule logic, synthetic mission generator, validation harness, WebCrypto signing and encryption, and the headless-browser scripts that recorded the demo. It also drafted this README and the project page text. The team chose the challenge and the ideas (personal-baseline drift detection, act-and-handover loop, signed and encrypted data, the risk panels, the reaction test, synthetic validation), directed every change, and reviewed and tested the result. Code files carry this disclosure in a header comment and an `ai-assistance` meta tag.
- **CrewRelay** (the blackout clip at the start of the demo video) was built with ChatGPT's help. Its lunar backdrop was made with OpenAI image generation and is labelled "AI-generated" on screen in the video.
- No AI-generated images are used in Pulsar itself. The Earth photos are real NASA imagery.

## Data, sources and credits

All mission data in Pulsar is **synthetic**: a seeded 180-day mission with four injected events. No real astronaut data is used. Validation results describe performance on that synthetic data only.

**NASA and space agency resources**
- NASA Human Research Program, five hazards of human spaceflight: https://www.nasa.gov/hrp/hazards
- NASA Reaction Self Test (ISS psychomotor vigilance self-test), NASA Technical Reports Server 20090029851: https://ntrs.nasa.gov/citations/20090029851
- NASA ISS Human Research Facility mass measurement (SLAMMD)
- NASA ASCEND paper on communication delays and blackouts for crewed Mars missions, NTRS 20220013418: https://ntrs.nasa.gov/citations/20220013418
- NASA, Artemis II Flight Day 6: Lunar Flyby Updates (6 April 2026), the planned blackout behind the Moon that the CrewRelay opening of the demo is based on: https://www.nasa.gov/blogs/missions/2026/04/06/artemis-ii-flight-day-6-lunar-flyby-updates/
- Canadian Space Agency, "What happens to bones in space?": https://www.asc-csa.gc.ca/eng/astronauts/space-medicine/bones.asp

**Published research**
- Stahn A. C. et al. (2017). Increased core body temperature in astronauts during long-duration space missions. *Scientific Reports* 7, 16180. doi:10.1038/s41598-017-15560-w
- Barger L. K. et al. (2014). Prevalence of sleep deficiency and use of hypnotic drugs in astronauts before, during, and after spaceflight. *Lancet Neurology* 13, 904–912.

**Clinical lines** follow widely used adult cut-offs: American Heart Association blood pressure categories (140 systolic or 90 diastolic, and 180 or 120 as severe) and American Diabetes Association glucose levels (under 70 and under 54 mg/dL; 126 mg/dL fasting as a prompt to recheck, not a diagnosis). Pulsar is decision support only, not a medical device.

**Assets**
- Earth photographs: NASA, ISS027-E-012224 and ISS030-E-055569 (NASA imagery; no NASA logos or insignia are used).
- Fonts: Archivo and Inter, via Google Fonts, SIL Open Font License 1.1.
- Interface icons: line icons adapted from Lucide (ISC licence).
- CrewRelay clip: Inter font (SIL OFL 1.1, bundled); lunar backdrop AI-generated (OpenAI).

## 3-minute demo script
1. **Overview** opens on mission day 51: the infection. Tap the body map (heart, lymph nodes, stomach) and show the plain-language flags and the mission routine card.
2. Drag the **replay** slider through the mission. Jump to the treadmill outage, then isolation.
3. **Trends**: the shaded band is *your* normal; the dots are where drift crossed the control limit.
4. **Reaction test**: run the 1-minute version live.
5. **Validation**: 4/4 caught. Click *Test 50 missions*.
6. **Handover**: sign a packet, send it to the Mission Control panel (valid), then *Tamper with one value* (rejected).
7. **Guide**: switch the setting to *Mars transit* and show how to measure body mass without scales, then the red flags.
8. **Privacy**: encrypt the log with a passphrase and show the lock screen.

## Next steps (if time)
Wearable import (HR/sleep), an "accept as new normal" control for permanent shifts, medication log tied to trends, CUSUM alongside EWMA.
