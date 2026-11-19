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

`legacy-{flight,thirst}.json` are frozen plates from previous versions, not a planner. Flight and thirst controls still exercise signed, previously authored layouts with live CPU alignment, MP4 and repeat export. No local title or template generator is shipped.

## Full-stage whale film (1.4+)

`python tests/prepare-qa-speech.py --whale` generates seven QA-only recordings from `whale.json` under the same DFKI terms above. `npm run test:whale` starts from approved narration, validates every scene, invokes the normal one-click job, requires real CPU Whisper and decodes the final video. For each shot, compare actual pixels against an independent render of its exact title and drawing, then individually hide the title and each layer, and freeze each layer at frame 0. `frames/`, `drawings/`, `layers.json`, MP4/SRT/JSON and the attribution report are uploaded. A local `--allow-estimate` rehearsal is **not** the Windows acoustic result.

The art source is explicit. CI uses the repository secret `OPENROUTER_API_KEY` (free router) when available. Alternatively configure `GEMINI_API_KEY` **and** the repository variable `QA_FREE_GEMINI_TEXT_MODEL` only for a project whose free use is authorized. Never put keys in the repo or logs. Otherwise `vector-whale/` supplies seven original LLM-agent-authored example responses through the isolated test transport: not a live API result. They do not ship in Setup and the app has no fixture switch. A configured service failure fails the test rather than substituting images. `--require-live` or the manual workflow input `require_live` also fails for missing credentials. Voice transport always uses attributed QA speech, independently of art source.
