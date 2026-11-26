# Local rendering controls, not production narration

These two original, tiny Turkish QA signals were synthesized with eSpeak NG 1.52 (Turkish voice). The JSON start times are the synthesizer's actual word events; the final cue ends before its trailing silence. They intentionally exercise playback without a secret, network, GPU or model download. The paired stills are the app's editorial covers. Nothing from this directory is shipped as a Gemini result or installed in a user project.

`test:render` explicitly supplies these **external reference timings** to the compositor. It does not test or substitute for Whisper, forced alignment, Gemini image, or Gemini TTS. Production first attempts acoustic alignment; if unavailable it labels an explicitly estimated sentence track derived from the approved text and measured audio duration. `fallback-control` tests this path separately; it does not count as passing the acoustic test.

`still-a.png` and `still-b.png` are original 90 × 160 registration patterns. The static composition test compares rendered frames to the decoded source pixels, the crossfade midpoint to the blend of the two plates, and the outgoing last picture to the incoming first one. The patterns are not installed in user projects.

## Optional real ASR / forced-alignment control

Short robotic eSpeak recordings are not reliable recognition benchmarks for Turkish Whisper base. The acoustic test does **not** lower the transcript-match threshold or inject reference words. It fetches the upstream [Turkish DFKI medium public sample and its transcript](https://github.com/rhasspy/piper-samples/tree/ce0c9e6f1cafaaf3fcb696a2c36d1b61d2b6ba08/samples/tr/tr_TR/dfki/medium), pins the commit and verifies the recording SHA-256. Credit: Rhasspy/Piper; DFKI OT / MaryTTS speech data. The [model card](https://github.com/rhasspy/piper-samples/blob/ce0c9e6f1cafaaf3fcb696a2c36d1b61d2b6ba08/samples/tr/tr_TR/dfki/medium/MODEL_CARD) identifies the dataset as [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). This noncommercial QA/reference use and its derivatives retain attribution and those restrictions. The recording is not bundled in the app, installer, or user project templates. The derivative QA artifact includes a source/attribution report.

The test uses the real production preflight, ASR, alignment, compositor and mixer on this 12-second sample. A second audio input adds 800 ms of silence to the same speech. Its measured word starts must shift accordingly (median absolute shift error below 200 ms). This is a synchronization regression test, not a claim of independently annotated absolute word accuracy or of Gemini narration quality.

## 1.1.1 thirst documentary — one-click narrated output

`thirst.json` is the original approved Turkish test script. No timestamps are supplied. The Windows acoustic job uses `tests/prepare-qa-speech.py` with `sherpa-onnx==1.12.29` to synthesize matching test recordings with the [Piper DFKI OT Turkish voice](https://github.com/rhasspy/piper-samples/blob/ce0c9e6f1cafaaf3fcb696a2c36d1b61d2b6ba08/samples/tr/tr_TR/dfki/medium/MODEL_CARD), distributed via the pinned-digest Sherpa-ONNX release. DFKI OT / MaryTTS speech data, **CC BY-NC-SA 4.0**. These are noncommercial QA derivatives with attribution in `report.json`. No voice model, dataset or QA audio is included in Setup.

With that QA Python environment, the project’s CPU alignment environment installed under `out/acoustic-control/` (see the `--whisper --setup-python` control), and the app built: `python tests/prepare-qa-speech.py` then `npm run test:thirst`. The test intercepts the Gemini TTS HTTP response with these WAV bytes; it never contacts a paid service. Starting without any voice/alignment assets, ONE normal production job must produce six voiced scenes, actual Whisper word times and a decoded 1080×1920 MP4. A second job must reuse every asset. The ZIP has the MP4, SRT, subtitle JSON and verification/attribution report. This is not a live Gemini voice-quality test.

For an explicit local fallback-only control (no Whisper installation), place six corresponding QA WAVs `0.wav`–`5.wav` and their `source.json` under `out/thirst-speech/`, then run `npm run test:thirst -- --allow-estimate`. Estimated sentence cues are identified as such and do **not** pass the Windows acoustic acceptance test.

## Archived flight and thirst boards

`legacy-{flight,thirst}.json` are frozen plates from previous versions, not a planner. Flight and thirst controls still exercise signed, previously authored layouts with live CPU alignment, MP4 and repeat export. These archived controls do not invoke the current local science-template planner.

## Archive whale board

`vector-whale/` is an original, seven-scene layered-v1 archive regression. The 1.6 renderer reads the signed geometry and verifies the title and constituent layers in a static frame, without synthetic zoom. No live drawing service is used. `test:whale` still requires real CPU alignment.

## Fixed-camera ant documentary (1.7.4)

`ant.json` supplies the original QA narration. `tests/template-test-data.ts` replays **template IDs, titles and bounded parameters**, not SVG, at the text transport; production instantiates its own authored science-template library. The archived `ant-motion/subject.svg` and `tests/ant-motion-art.ts` geometry remain solely for legacy regression tests. No QA speech or fixture response is shipped as a live provider result. The same signature verification, Remotion renderer, FFmpeg mixer and Whisper pipeline are used in the control and the app.

After building, run `python tests/prepare-qa-speech.py --ant` in the Windows QA speech environment described above, then `npm run test:ant` with the CPU aligner installed under `out/acoustic-control/`. The ant speech uses the attributed DFKI/Piper model above (**CC BY-NC-SA 4.0**), not live Gemini TTS. The output in `out/ant-motion-control/` contains the MP4, SRT, word JSON, decoded PNGs, five signed local scene SVGs, and the pixel/attribution report. A local `--allow-estimate` rehearsal is not accepted by Windows CI.

The decoded film checks two intrinsic, stationary artwork landmarks in each scene throughout the non-transition frames, and independently freezes multiple ants, flows and focus elements for pixel comparisons. It also checks nonrepeating signed template IDs, cached export reuse and a directed single-scene redraw that preserves voice and timing. The earlier raster ant film and its provenance remain in the [1.5 validation record](../../docs/VALIDATION.md).
