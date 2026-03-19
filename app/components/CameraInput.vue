<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useUserMedia } from "@vueuse/core";
import { RefreshCw, Check, Camera } from "lucide-vue-next";

const emit = defineEmits(["capture"]);
const props = defineProps({
  overlayImage: String,
  label: { type: String, default: "Take a photo" },
  onionOpacity: { type: Number, default: 0.4 },
  minimal: { type: Boolean, default: false },
});

const video = ref<HTMLVideoElement>();
const canvas = ref<HTMLCanvasElement>();
const capturedImage = ref<string | null>(null);

const { stream: userMediaStream, start } = useUserMedia({
  constraints: {
    video: {
      facingMode: "environment",
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  },
});

onMounted(async () => {
  if (!userMediaStream.value) {
    await start();
  }
});

// Robustly link stream to video element whenever either changes
watch([video, userMediaStream], ([newVideo, newStream]) => {
  if (newVideo && newStream) {
    newVideo.srcObject = newStream;
  }
}, { immediate: true });


function capture() {
  if (!video.value || !canvas.value) return;
  const ctx = canvas.value.getContext("2d");
  if (!ctx) return;

  canvas.value.width = video.value.videoWidth;
  canvas.value.height = video.value.videoHeight;
  ctx.drawImage(video.value, 0, 0);

  const dataUrl = canvas.value.toDataURL("image/jpeg", 0.85);
  capturedImage.value = dataUrl;
}

function retake() {
  capturedImage.value = null;
}

function confirm() {
  emit("capture", capturedImage.value);
  capturedImage.value = null;
}
</script>

<template>
  <div class="flex-1 flex flex-col bg-stone-50 overflow-hidden">
    <!-- HEADER AREA -->
    <div
      class="h-32 flex items-end justify-center pb-6 px-10"
      :class="{ 'h-16': minimal }"
    ></div>

    <!-- MAIN COMPOSITION FRAME -->
    <div class="relative flex-1 flex items-center justify-center px-6">
      <div
        class="relative w-full aspect-[3/4] max-h-full rounded-[32px] overflow-hidden bg-white border border-stone-200 shadow-xl"
      >
        <!-- Camera / Image Layer -->
        <div class="absolute inset-0 z-0">
          <video
            v-if="!capturedImage"
            ref="video"
            autoplay
            playsinline
            class="w-full h-full object-cover"
          />
          <img
            v-else
            :src="capturedImage"
            class="w-full h-full object-cover animate-in fade-in duration-300"
            alt="Captured"
          />
        </div>

        <!-- Ghost Overlay (Only inside the frame) -->
        <div
          v-if="overlayImage && !capturedImage"
          class="absolute inset-0 pointer-events-none transition-opacity duration-300 z-10"
          :style="{ opacity: onionOpacity }"
        >
          <img :src="overlayImage" class="w-full h-full object-cover" />
        </div>

        <!-- Corner Accents (Inside the frame) -->
        <div
          v-if="!capturedImage && !minimal"
          class="absolute inset-0 pointer-events-none z-20"
        >
          <div
            class="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-orange-500/80 rounded-tl-xl"
          ></div>
          <div
            class="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-orange-500/80 rounded-tr-xl"
          ></div>
          <div
            class="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-orange-500/80 rounded-bl-xl"
          ></div>
          <div
            class="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-orange-500/80 rounded-br-xl"
          ></div>
        </div>
      </div>
    </div>

    <!-- FOOTER AREA -->
    <div class="h-64 flex flex-col items-center justify-between pt-2 pb-6 px-10">
      <div class="w-full max-w-sm">
        <slot name="controls"></slot>
      </div>
      <div class="w-full max-w-sm flex items-center justify-center">
        <template v-if="!capturedImage">
          <button
            @click="capture"
            class="w-20 h-20 rounded-full bg-stone-50 border-4 border-white shadow-xl p-1.5 active:scale-90 transition-all shadow-orange-900/10 flex items-center justify-center"
          >
            <div
              class="w-full h-full rounded-full bg-white border border-stone-100 shadow-inner flex items-center justify-center"
            >
              <div class="w-11 h-11 rounded-full bg-orange-600 shadow-md shadow-orange-600/30 ring-2 ring-orange-600/5"></div>
            </div>
          </button>
        </template>

        <template v-else>
          <div class="flex items-center gap-4 w-full">
            <button
              @click="retake"
              class="flex-1 h-16 rounded-3xl bg-white border border-stone-200 text-stone-600 font-black uppercase tracking-[0.2em] text-[11px] active:scale-95 transition-all shadow-sm"
            >
              Retake
            </button>
            <button
              @click="confirm"
              class="flex-1 h-16 rounded-3xl bg-orange-600 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-orange-900/20 active:scale-95 transition-all"
            >
              Submit Shot
            </button>
          </div>
        </template>
      </div>
    </div>

    <canvas ref="canvas" class="hidden"></canvas>
  </div>
</template>
