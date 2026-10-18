# Human to-do list

Tasks that need a person at the machine. An agent cannot do these: they involve the native sharing picker, physical keys, your judgement of what is on screen, or consent to flashing content. The work an agent can do on its own is in [PC_TODO.md](PC_TODO.md).

Updated October 17, 2026, after the red-team retest of build `flash-review-0.4.5-20261017`. The retest report is kept locally in `redteam-0.4.5-2026-10-17/REPORT.md` and is not published.

## Before you start

- Do the agent's P2 repairs first (PC_TODO, section 1). Several runs below are only worth doing on the repaired build.
- Hard-reload the analyzer (Shift + Reload) after every update.
- For every run, write down the browser and version, OS, display, DPR, zoom, window state, and who chose the shared tab.
- Keep all five downloads from every run unchanged.

## Safety

- Several fixtures flash above the general and red flash thresholds. Run them on screen only if you are comfortable doing so, and decide each time.
- Every flashing run below is marked **(flashes)**. If you don't want to watch it, give the agent a headless run instead.

## 1. Decisions

- [ ] **Settling and static pages (RT-04).** *The agent chose a default in 0.5.0: static pages are analyzed as "unconfirmed" geometry, which never counts as meeting the minimum. Confirm or change it.* Since 0.4.4, a calibrated capture of a page that does not repaint often never applies the calibration. Decide which behaviour you want:
  - keep it as is and document it,
  - lock the geometry after a timeout, or
  - tell the reviewer to make the page repaint.
- [ ] **Area bound wording (RT-02).** *The agent chose both in 0.5.0: the sentence is removed, and low-contrast cells are added to the bound. Confirm or change it.* When low-contrast regions vanish in the downscale, the reported "upper bound" can fall below the true area. Decide whether to:
  - remove the "does not exceed the reference limit" sentence, or
  - change the documented exception from "thinner than one cell" to "regions that produce no lit cell".
- [ ] **Independent review.** The red-team pass was run by the same AI model family that wrote the repairs. Decide whether a person, or a different tool, should spot-check its findings before the gate is closed.

## 2. Check whether a background analyzer tab captures anything

This is the most important manual check, because it could affect every capture. **Headless evidence (0.5.0 audit, RT2-09): the same-window layout captured 0 frames.** From 0.5.1 the report says how long the analyzer was hidden, and the instructions say to use separate windows. Please confirm in a normal browser window.

- [ ] In normal Chrome, open the analyzer and the static target as **two tabs in the same window**.
- [ ] Start a capture, choose the target in the picker, and switch to the target tab for 10 seconds.
- [ ] Switch back and check whether the report says "No frames were analyzed".
- [ ] Repeat with the analyzer and the target in **separate windows**, side by side.
- [ ] Record the results, and tell the agent whether the instructions saying "separate tab/window" need to change.

## 3. Native retests on macOS, operated by you

Use the native sharing picker. Do not use the auto-select flag.

- [ ] **NF-02:** calibrate with the CSS size shown before sharing. Confirm that all five downloads say the calibration was rejected, and that none says "not supplied".
- [ ] **NF-04:** run five calibrated captures with the safe moving-bar video (`fixtures/video/`, controls hidden). Note how many are accepted.
- [ ] **NF-04 with a static page:** repeat with the static gray target, and record whether the calibration is ever applied.
- [ ] Fullscreen with your own hands:
  - [ ] Ctrl + Cmd + F
  - [ ] the green window button
  - [ ] Record the CSS viewport the target reports while sharing.
- [ ] Watch the shared tab during the share and note anything the automation could not see, such as the infobar, the menu bar or the notch.
- [ ] **(flashes)** Headful captures of the 4 Hz example and the small-zone video, so the real display frame rate is recorded.

## 4. Windows

All Windows rows so far were recorded on 0.4.2.

- [ ] Rerun NF-02, NF-03, NF-04, NF-06 and NF-08 on the current build.
- [ ] The static presentation matrix, including **real F11**:
  - default
  - maximized
  - F11
  - content fullscreen
  - small layout
- [ ] The seven playback stop paths on the image-sequence page:
  - duration cap
  - Stop
  - Escape
  - tab switch
  - resize
  - repeated Start
  - navigate away and Back
- [ ] Video capture of the safe moving bar in each presentation, plus **(flashes)** the flashing fixtures, if you agree to watch them.

## 5. Device coverage

- [ ] Browser zoom other than 100%: 80%, 125% and 200%.
- [ ] An external monitor, and a different DPR.
- [ ] Microsoft Edge, if you can install it.
- [ ] Player fullscreen with native video controls (the ~0.25 s capture stall on macOS).

## 6. New in 0.5.0: try it yourself

- [ ] Open `file-analysis.html` and analyze one of your own videos or GIFs. Nothing is shown while it runs. Check that the result looks plausible, and note anything confusing.
- [ ] Work through `motion-review.html` on one real page with reduced motion on and off, and check whether the checklist fits how you review.
- [ ] Decide whether the SC 2.3.2 strict screen (no area or brightness exception, 0.10 change floor) matches your interpretation of the criterion.

## 7. Hand back to the agent

- [ ] Give the agent the folder of downloads and your notes for each run. It will validate them and update the docs.
