import { useEffect, useRef } from "preact/hooks";
import type { BarcodeFormat } from "@/models/index.ts";
import { detectFormat } from "@/utils/barcode.ts";
import { IconButton } from "@/components/md3/IconButton.tsx";

// Minimal shape of the native BarcodeDetector API (not in Deno's DOM lib).
interface DetectedBarcode {
  rawValue: string;
  format: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?(): Promise<string[]>;
}

/** Native BarcodeDetector format names → our supported symbologies. */
const DETECTED_FORMAT: Record<string, BarcodeFormat> = {
  ean_13: "ean13",
  ean_8: "ean8",
  upc_a: "upca",
  code_128: "code128",
  qr_code: "qrcode",
};

/** The native format names we ask the detector to look for. */
const REQUESTED_FORMATS = Object.keys(DETECTED_FORMAT);

/** True when the browser can scan barcodes from the camera (Android/Chrome). */
export function scannerSupported(): boolean {
  return typeof globalThis !== "undefined" &&
    "BarcodeDetector" in globalThis &&
    !!navigator?.mediaDevices?.getUserMedia;
}

interface ScannerOverlayProps {
  onDetect: (value: string, format: BarcodeFormat) => void;
  onClose: () => void;
  onError: (message: string) => void;
}

/**
 * Full-screen camera scanner. Streams the rear camera and polls the native
 * BarcodeDetector until a code is found, then hands the value + mapped format
 * back. Only mounted when {@link scannerSupported} is true; any camera or
 * permission error surfaces via `onError` and closes.
 */
export function ScannerOverlay(
  { onDetect, onClose, onError }: ScannerOverlayProps,
) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let done = false;

    const Ctor = (globalThis as unknown as {
      BarcodeDetector?: BarcodeDetectorCtor;
    }).BarcodeDetector;

    const stop = () => {
      done = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };

    const finish = (value: string, format: BarcodeFormat) => {
      if (done) return;
      stop();
      onDetect(value, format);
    };

    const start = async () => {
      if (!Ctor) {
        onError("Scanning isn't available on this device.");
        onClose();
        return;
      }
      try {
        // Diagnostic: probe supported formats before opening camera.
        try {
          const fmt = await (Ctor as unknown as {
            getSupportedFormats?: () => Promise<string[]>;
          })
            .getSupportedFormats?.();
          if (fmt) console.debug("[scan] supported formats", fmt);
        } catch {
          // ignore — not all browsers expose this
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        console.debug(
          "[scan] getUserMedia ok, tracks",
          stream.getTracks().length,
        );
        // The overlay may have been closed while the permission prompt was
        // open — `stop()` ran before `stream` existed, so release it now
        // rather than leaving the camera on.
        const video = videoRef.current;
        if (done || !video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;

        // Wait until the video has decodable frame data before we try to
        // detect anything — without this `detect()` returns [] / throws
        // because there is no image yet, and the silent retry masks the
        // problem from both the user and the console.
        if (video.readyState < 2) {
          await new Promise<void>((resolve) => {
            const done = () => {
              video.removeEventListener("loadedmetadata", done);
              video.removeEventListener("loadeddata", done);
              resolve();
            };
            video.addEventListener("loadedmetadata", done, { once: true });
            video.addEventListener("loadeddata", done, { once: true });
          });
        }
        await video.play();
        console.debug(
          "[scan] video ready",
          `readyState=${video.readyState}`,
          `videoWidth=${video.videoWidth}x${video.videoHeight}`,
        );

        // Prefer an explicitly-formatted detector so every symbology we
        // support is actually enabled. Some Chrome builds default to an
        // empty set when constructed bare (no `formats`), which makes
        // `detect()` return [] forever even with a perfect frame.
        let detector: BarcodeDetectorLike;
        try {
          detector = new Ctor({ formats: REQUESTED_FORMATS });
          console.debug("[scan] detector created with", REQUESTED_FORMATS);
        } catch (err) {
          console.debug(
            "[scan] detector with formats failed, falling back to bare",
            err,
          );
          detector = new Ctor();
        }
        // Poll a few times a second — plenty for scanning, far lighter than
        // running the detector on every animation frame.
        let failures = 0;
        const scan = async () => {
          if (done) return;
          // Guard against polling a video that still has no frame.
          if (video.readyState < 2 || video.videoWidth === 0) {
            console.debug(
              "[scan] video not ready, retry",
              `readyState=${video.readyState}`,
              `w=${video.videoWidth}`,
            );
            timer = setTimeout(scan, 200);
            return;
          }
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0) {
              console.debug("[scan] detected", codes[0]);
              const { rawValue, format } = codes[0];
              finish(
                rawValue,
                DETECTED_FORMAT[format] ?? detectFormat(rawValue),
              );
              return;
            }
          } catch (err) {
            failures++;
            // Log the first few transient failures; continuous failures
            // after this point indicate a real problem (e.g. video not
            // ready or detector misconfigured) that we previously hid.
            if (failures <= 3) console.debug("[scan] detect failed", err);
          }
          timer = setTimeout(scan, 200);
        };
        scan();
      } catch (_err) {
        console.debug("[scan] start failed", _err);
        onError("Couldn't access the camera. Check the permission and retry.");
        stop();
        onClose();
      }
    };

    start();
    return stop;
  }, []);

  return (
    <div class="fixed inset-0 z-[400] bg-black flex flex-col">
      <div
        class="flex items-center justify-between px-4 pt-3"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <span class="md-title-medium text-white">Scan a barcode</span>
        <IconButton
          name="x"
          aria-label="Close scanner"
          onClick={onClose}
          class="text-white"
        />
      </div>
      <div class="relative flex-1 min-h-0">
        <video
          ref={videoRef}
          playsInline
          muted
          class="absolute inset-0 w-full h-full object-cover"
        />
        {/* Aiming frame */}
        <div class="absolute inset-0 grid place-items-center pointer-events-none">
          <div
            class="border-2 border-white/80 rounded-[var(--md-shape-lg)]"
            style={{ width: "70%", maxWidth: 320, aspectRatio: "1.6 / 1" }}
          />
        </div>
      </div>
      <div class="px-6 py-6 text-center">
        <span class="md-body-medium text-white/80">
          Point the camera at the loyalty card's barcode.
        </span>
      </div>
    </div>
  );
}
