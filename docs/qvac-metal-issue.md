# Draft upstream issue: QVAC on iOS compiles Metal shaders on device, and iOS kills the compiler

Status: **draft for Wesley, not filed.** Target: https://github.com/tetherto/qvac/issues. Synthetic test data only; no app code or logs beyond what's below.

---

**Title:** iOS: Metal backend never comes up on iPhone 12 — embedded shader source is compiled at launch (21 libraries in parallel) and iOS kills MTLCompilerService; please support a precompiled `.metallib`

**Packages:** `@qvac/sdk` 0.22.0, `@qvac/fabric-ios` 0.22.0 (qvac-fabric `v11018.2.0-5e3c38c4b6`; also checked 0.23.1, `v11259.0.1`), `@qvac/ocr-ggml` 0.29.1, `@qvac/tts-ggml-ios` 0.13.0. Expo SDK 54, React Native 0.81.

**Device:** iPhone 12 (A14, 4 GB), iOS 26.6.1, built with Xcode 27.0, Debug and Release.

### What happens

On every app launch, as soon as ggml sets up the Metal device, Apple's `MTLCompilerService` grows to 466–506 MB and iOS kills it for going over its 100 MB high-water mark:

```
memorystatus: killing_highwater_process MTLCompilerService ...
```

This repeats four times, then Metal gives up for the session. With no working Metal device we can't try `backendDevice: 'metal'` for OCR (the README's ≈4.5× for CRAFT is the speed-up we're after), so OCR (EasyOCR pipeline, `canvasSize 1024`, `recognizerBatchSize 1`) stays on the CPU at ~49–51 s per 828×1280 photo, ~296 % CPU. That's too slow for a reading app. Seen on three separate launches.

### Why (from the shipped binary)

`qvac__fabric-ios.bare` (ios-arm64) is built with `GGML_METAL_EMBED_LIBRARY`: the shader *source* for 21 libraries (`mul_mv`, `mul_mm`, `fa`, `conv`, …) sits in the `__DATA,__ggml_metallib` section. `ggml_metal_library_init` logs `using embedded metal library` and calls `ggml_metal_library_compile_all`, which, as in upstream ggml's `ggml-metal-device.m`, queues one `newLibraryWithSource:` per library with `dispatch_group_async` on a global queue, so they all compile at once in `MTLCompilerService`. In the embedded build there is no code path that looks for a precompiled `default.metallib` (the binary has no `metallib` / `pathForResource` strings), so an app can't ship one to avoid the on-device compile.

### What would fix it (any one)

1. Ship a precompiled `default.metallib` (built with `xcrun metal` for iOS) in `@qvac/fabric-ios` and load it with `newLibraryWithURL:` / `newLibraryWithData:`, falling back to source only if it's missing. Upstream ggml's non-embedded path already does this (`ggml_metal_find_metallib`).
2. Or look for `<name>.metallib` in the app bundle first even in the embedded build, so apps can add it as a resource.
3. At least on iOS, compile the libraries one at a time (serial queue), and/or only the libraries a model's graph needs (OCR needs conv/pool/unary/binbcast/mul_mm, not `fa` or `ssm`), so a single compile stays under the compiler service's limit.

### Workaround we use

`setenv("GGML_METAL_DEVICES", "0", 1)` in the app delegate before any QVAC code runs, so ggml registers no Metal device and nothing is compiled; everything runs on the CPU, as it did anyway.

### Repro

1. Expo app with `@qvac/sdk` 0.22.0 and its Expo plugin; load `OCR_LATIN` + `OCR_CRAFT` (or any ggml model).
2. Run on an iPhone 12 from Xcode, capture `idevicesyslog`.
3. Look for `killing_highwater_process MTLCompilerService` shortly after launch, and `ocr.getBackendInfo()` / `backendIsGpu` reporting CPU.
