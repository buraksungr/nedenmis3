# Local rendering controls, not production narration

These two original, tiny Turkish QA signals were synthesized with eSpeak NG 1.52 (Turkish voice). The JSON start times are the synthesizer's actual word events; the final cue ends before its trailing silence. They intentionally exercise playback without a secret, network, GPU or model download. The paired stills are the app's editorial covers. Nothing from this directory is shipped as a Gemini result or installed in a user project.

`test:render` explicitly supplies these **external reference timings** to the compositor. It does not test or substitute for Whisper, forced alignment, Gemini image, or Gemini TTS. The normal production path requires verified alignment from real audio.
