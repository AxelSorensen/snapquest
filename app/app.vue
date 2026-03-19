<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick, watch } from "vue";
import {
  Camera,
  MapPin,
  List,
  ChevronLeft,
  Info,
  Trophy,
  Plus,
  CameraIcon,
  Navigation,
  Star,
  RefreshCw,
  Search,
  Check,
  X,
  Compass,
} from "lucide-vue-next";
import { GoogleMap, Circle, Marker } from "vue3-google-map";
import { useLocalStorage, useGeolocation } from "@vueuse/core";

const config = useRuntimeConfig();
const googleMapsApiKey = config.public.googleMapsApiKey;

type View = "home" | "create" | "match" | "result" | "map" | "details";
const currentView = ref<View>("home");

const defaultHunts = [
  {
    id: "1",
    image:
      "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800",
    location: "Golden Gate Park",
    position: { lat: 37.7694, lng: -122.4862 },
    difficulty: 3,
    solves: 124,
    tips: [
      "Line up the bench in the foreground",
      "Use the tall cypress tree as a vertical anchor",
    ],
  },
  {
    id: "2",
    image:
      "https://images.unsplash.com/photo-1493397212122-2b85def82820?auto=format&fit=crop&q=80&w=800",
    location: "Modern Museum",
    position: { lat: 37.7857, lng: -122.4011 },
    difficulty: 5,
    solves: 42,
    tips: [
      "Stand exactly 10 feet from the glass",
      "Ensure the architectural lines are perfectly parallel",
    ],
  },
  {
    id: "3",
    image:
      "https://images.unsplash.com/photo-1449156059431-789995fd169b?auto=format&fit=crop&q=80&w=800",
    location: "Old Library",
    position: { lat: 37.7801, lng: -122.4632 },
    difficulty: 2,
    solves: 312,
    tips: [
      "Center the clock tower",
      "Wait for the shadows to align with the columns",
    ],
  },
];

const customHunts = useLocalStorage<any[]>("lenshunt_custom_hunts", []);
const hunts = computed(() => [...customHunts.value, ...defaultHunts]);

const totalXp = useLocalStorage("lenshunt_total_xp", 0);
const explorerLevel = computed(() => Math.floor(totalXp.value / 500) + 1);
const xpToNextLevel = computed(() => 500 - (totalXp.value % 500));

const activeHunt = ref<any>(null);
const onionOpacity = ref(0.4);
const isLocating = ref(false);

const lastAttempt = reactive({
  image: "",
  score: 0,
  explanation: "",
  loading: false,
});

const createStep = ref<"setup" | "capture">("setup");
const newHuntData = ref({
  image: "",
  difficulty: 3,
  radius: 180,
  locationName: "",
  tips: [] as { id: string; text: string }[],
});

const { coords } = useGeolocation();
const userPosition = computed(() => {
  if (coords.value.latitude !== Infinity) {
    return { lat: coords.value.latitude, lng: coords.value.longitude };
  }
  return null;
});

const mapCenter = ref({ lat: 37.7749, lng: -122.4194 });
const mapRef = ref<any>(null);

function triggerHaptic(pattern: number | number[] = 10) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

function startMatch(hunt: any) {
  activeHunt.value = {
    ...hunt,
    difficulty: hunt.difficulty || 3,
    solves: hunt.solves || Math.floor(Math.random() * 100),
    tips: hunt.tips || [
      "Match the horizontal horizon line",
      "Look for distinct landmarks",
    ],
  };
  currentView.value = "details";
}

async function handleCapture(imageData: string) {
  triggerHaptic(20);
  if (currentView.value === "create") {
    newHuntData.value.image = imageData;
    createStep.value = "setup"; // Return to setup screen
    return;
  }

  lastAttempt.image = imageData;
  lastAttempt.loading = true;
  currentView.value = "result";

  try {
    const data = await $fetch("/api/compare", {
      method: "POST",
      body: {
        target: activeHunt.value?.image,
        attempt: imageData,
      },
    });

    if (data) {
      lastAttempt.score = (data as any).score;
      lastAttempt.explanation = (data as any).explanation;
      const earnedXp = Math.round((data as any).score);
      totalXp.value += earnedXp;
      triggerHaptic([30, 50, 30]);
    }
  } catch (e) {
    console.error("API Error:", e);
    lastAttempt.score = 0;
    lastAttempt.explanation = "Vision API Error: Check console for details.";
  } finally {
    lastAttempt.loading = false;
  }
}

function finalizeCreateHunt() {
  isLocating.value = true;
  const position = userPosition.value || { lat: 37.7749, lng: -122.4194 };
  const userTips =
    newHuntData.value.tips.length > 0
      ? newHuntData.value.tips.map((t) => t.text)
      : ["Identify the primary structural lines", "Check for foreground alignment"];

  const newHunt = {
    id: Date.now().toString(),
    image: newHuntData.value.image,
    location:
      newHuntData.value.locationName || "Mission #" + (hunts.value.length + 1),
    position: position,
    difficulty: newHuntData.value.difficulty,
    radius: newHuntData.value.radius,
    solves: 0,
    tips: userTips,
  };
  customHunts.value.unshift(newHunt);
  isLocating.value = false;
  currentView.value = "home";
  createStep.value = "setup"; // Reset for next time
  newHuntData.value.tips = []; // Reset tips
}

const mapStyles = [
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#dae3f0" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f7f5f2" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#ebe9e4" }],
  },
];

onMounted(() => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      mapCenter.value = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    });
  }
});

const centerMap = () => {
  if (userPosition.value && mapRef.value?.map) {
    mapRef.value.map.setCenter(userPosition.value);
    mapRef.value.map.setZoom(17);
  }
};
</script>

<template>
  <div
    class="h-svh w-screen relative overflow-hidden bg-stone-50 flex flex-col font-sans"
  >
    <!-- UI Overlay: Top Bar -->
    <div
      class="absolute top-0 left-0 right-0 p-4 z-20 pointer-events-none flex flex-col space-y-3"
    >
      <div class="flex justify-between items-start">
        <div
          class="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl shadow-orange-900/5 p-3 pointer-events-auto border border-stone-200/50 text-left transition-transform active:scale-95 cursor-pointer"
          @click="currentView = 'home'"
        >
          <div class="flex items-center gap-2">
            <div
              class="p-1.5 bg-orange-600 rounded-lg shadow-lg shadow-orange-500/20"
            >
              <Compass class="w-5 h-5 text-white" />
            </div>
            <h1 class="text-xl font-extrabold text-stone-900 tracking-tight">
              LensHunt<span class="text-orange-600">AI</span>
            </h1>
          </div>
          <div class="mt-2 ml-9 flex flex-col gap-1">
            <div class="flex items-center justify-between gap-4">
              <p
                class="text-[8px] uppercase tracking-[0.2em] text-stone-400 font-black"
              >
                Level {{ explorerLevel }} Explorer
              </p>
              <p
                class="text-[8px] font-bold text-orange-600 uppercase tracking-widest"
              >
                {{ xpToNextLevel }} XP to Rank Up
              </p>
            </div>
            <div class="w-full h-1 bg-stone-100 rounded-full overflow-hidden">
              <div
                class="h-full bg-orange-500 transition-all duration-1000"
                :style="{ width: `${(totalXp % 500) / 5}%` }"
              ></div>
            </div>
          </div>
        </div>

        <div class="flex flex-col space-y-2 pointer-events-auto">
          <button
            @click="currentView === 'map' ? centerMap() : (currentView = 'map')"
            class="bg-white p-3.5 rounded-2xl shadow-xl shadow-orange-900/5 text-orange-600 hover:bg-orange-50 transition-all hover:scale-105 active:scale-95 border border-stone-100"
            title="Map View"
          >
            <MapPin v-if="currentView !== 'map'" class="w-6 h-6" />
            <Navigation v-else class="w-6 h-6" />
          </button>
          <button
            @click="currentView = 'create'"
            class="bg-orange-600 p-3.5 rounded-2xl shadow-xl shadow-orange-600/20 text-white hover:bg-orange-700 transition-all hover:scale-105 active:scale-95"
            title="Create Hunt"
          >
            <Plus class="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 relative z-0">
      <ClientOnly>
        <GoogleMap
          ref="mapRef"
          v-if="googleMapsApiKey"
          :api-key="googleMapsApiKey"
          class="w-full h-full"
          :center="mapCenter"
          :zoom="13"
          :disable-default-ui="true"
          :styles="mapStyles"
        >
          <template v-for="hunt in hunts" :key="hunt.id">
            <Circle
              :options="{
                center: hunt.position,
                radius: hunt.radius || 180,
                fillColor: '#ea580c',
                fillOpacity: 0.12,
                strokeColor: '#ea580c',
                strokeOpacity: 0.5,
                strokeWeight: 2,
              }"
            />
            <Marker
              :options="{
                position: hunt.position,
                icon: {
                  path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
                  fillColor: '#ea580c',
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: '#ffffff',
                  scale: 1.3,
                  anchor: { x: 12, y: 22 },
                },
              }"
              @click="startMatch(hunt)"
            />
          </template>
          <Marker
            v-if="userPosition"
            :options="{
              position: userPosition,
              zIndex: 999,
              icon: {
                path: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0',
                fillColor: '#ea580c',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
                scale: 0.9,
                anchor: { x: 12, y: 12 },
              },
            }"
          />
        </GoogleMap>
      </ClientOnly>

      <div
        v-if="currentView === 'home' || currentView === 'map'"
        class="absolute inset-x-0 bottom-0 z-10 transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) pointer-events-none"
        :class="currentView === 'home' ? 'h-[72svh]' : 'h-[24svh]'"
      >
        <div
          class="h-full w-full bg-white rounded-t-[44px] shadow-[0_-12px_50px_rgba(43,26,10,0.12)] border-t border-stone-100 flex flex-col pointer-events-auto overflow-hidden"
        >
          <div
            class="w-full h-10 flex items-center justify-center cursor-pointer active:bg-stone-50 transition-colors"
            @click="currentView = currentView === 'home' ? 'map' : 'home'"
          >
            <div class="w-14 h-1.5 bg-stone-200 rounded-full"></div>
          </div>
          <div class="flex-1 overflow-y-auto no-scrollbar px-6 pb-24">
            <div class="flex items-center justify-between mb-8 pt-2">
              <div>
                <h2 class="text-3xl font-black text-stone-900 tracking-tight">
                  Active Hunts
                </h2>
                <p
                  class="text-[10px] uppercase tracking-[0.25em] text-orange-600 font-black"
                >
                  {{ hunts.length }} Spots waiting for you
                </p>
              </div>
              <div
                class="bg-orange-50 p-3.5 rounded-2xl shadow-inner border border-orange-100"
              >
                <Trophy class="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div class="grid gap-6">
              <div
                v-for="hunt in hunts"
                :key="hunt.id"
                @click="startMatch(hunt)"
                class="group bg-stone-50 rounded-[32px] overflow-hidden border border-stone-200/60 transition-all hover:translate-y-[-4px] active:scale-95 cursor-pointer shadow-sm hover:shadow-xl hover:shadow-orange-900/5"
              >
                <div class="relative aspect-[1.8/1]">
                  <img
                    :src="hunt.image"
                    :alt="hunt.location"
                    class="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500"
                  />
                  <div
                    class="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-stone-900/20 to-transparent"
                  ></div>
                  
                  <!-- Top Difficulty Badge -->
                  <div class="absolute top-4 left-4">
                    <div class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 rounded-full text-white font-black text-[9px] uppercase tracking-widest shadow-lg shadow-orange-900/20">
                      <Star class="w-3 h-3 fill-current" />
                      Level {{ hunt.difficulty }}
                    </div>
                  </div>

                  <div
                    class="absolute bottom-5 left-5 right-5 flex items-center justify-between"
                  >
                    <div class="flex items-center gap-3">
                      <div
                        class="p-2 bg-orange-600 rounded-xl shadow-lg shadow-orange-600/30"
                      >
                        <MapPin class="w-4 h-4 text-white" />
                      </div>
                      <span
                        class="text-white font-extrabold text-base tracking-tight"
                        >{{ hunt.location }}</span
                      >
                    </div>
                    <div
                      class="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center group-hover:bg-orange-600 group-hover:border-orange-500 transition-all"
                    >
                      <ChevronLeft class="w-5 h-5 text-white rotate-180" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Global Full-Screen Overlays -->
    <Transition name="slide-fade">
      <div
        v-if="currentView !== 'home' && currentView !== 'map'"
        class="fixed top-0 left-0 w-full h-svh z-[100] bg-stone-50 flex flex-col overflow-hidden"
      >
        <button
          @click="
            if (currentView === 'create' && createStep === 'capture') {
              createStep = 'setup';
            } else {
              currentView = 'home';
              createStep = 'setup';
            }
          "
          class="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-900 transition-all z-[110]"
        >
          <X class="w-8 h-8" />
        </button>

        <!-- Step 1: Hunt Details -->
        <div
          v-if="currentView === 'details'"
          class="flex-1 flex flex-col overflow-y-auto no-scrollbar pb-32"
        >
          <div class="relative w-full aspect-[4/5] shrink-0">
            <img :src="activeHunt?.image" class="w-full h-full object-cover" />
            <div
              class="absolute inset-0 bg-gradient-to-t from-stone-50 via-stone-50/20 to-transparent"
            ></div>
            <div class="absolute bottom-10 left-8 right-8">
              <div
                class="inline-flex items-center gap-2 px-3 py-1 bg-orange-600 rounded-full text-white font-black text-[10px] uppercase tracking-widest mb-3"
              >
                <Star class="w-3 h-3 fill-current" />
                Level {{ activeHunt?.difficulty }}
              </div>
              <h2 class="text-4xl font-black text-stone-900 tracking-tighter">
                {{ activeHunt?.location }}
              </h2>
            </div>
          </div>
          <div class="px-8 pt-8 space-y-10">
            <div class="flex items-center justify-between">
              <div class="space-y-1">
                <p
                  class="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-black"
                >
                  Community Solves
                </p>
                <div class="flex items-center gap-2">
                  <div class="flex -space-x-2">
                    <div
                      v-for="i in 3"
                      :key="i"
                      class="w-6 h-6 rounded-full border-2 border-white bg-stone-200"
                    ></div>
                  </div>
                  <p class="text-sm font-bold text-stone-600">
                    +{{ activeHunt?.solves }} matched
                  </p>
                </div>
              </div>
              <div class="text-right space-y-1">
                <p
                  class="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-black"
                >
                  Difficulty
                </p>
                <div class="flex gap-0.5">
                  <Star
                    v-for="i in 5"
                    :key="i"
                    class="w-4 h-4"
                    :class="
                      i <= (activeHunt?.difficulty || 0)
                        ? 'text-orange-500 fill-current'
                        : 'text-stone-200'
                    "
                  />
                </div>
              </div>
            </div>
            <div class="space-y-4">
              <h3
                class="text-sm font-black uppercase tracking-[0.1em] text-stone-900"
              >
                Mission Intelligence
              </h3>
              <div class="grid gap-3">
                <div
                  v-for="(tip, idx) in activeHunt?.tips"
                  :key="idx"
                  class="flex gap-4 p-4 bg-white rounded-3xl border border-stone-100 shadow-sm shadow-orange-900/5"
                >
                  <div
                    class="w-6 h-6 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-black text-[10px] shrink-0"
                  >
                    {{ idx + 1 }}
                  </div>
                  <p class="text-sm text-stone-600 font-medium leading-relaxed">
                    {{ tip }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div
            class="fixed bottom-0 inset-x-0 p-8 bg-gradient-to-t from-stone-50 via-stone-50 to-transparent z-20"
          >
            <button
              @click="currentView = 'match'"
              class="w-full bg-orange-600 py-6 rounded-[32px] font-black text-white shadow-2xl shadow-orange-600/40 active:scale-95 transition-all flex items-center justify-center gap-3 text-lg tracking-tight"
            >
              <CameraIcon class="w-6 h-6" /> Start Capture
            </button>
          </div>
        </div>

        <!-- Step 2: Minimalist Match View -->
        <div v-else-if="currentView === 'match'" class="flex-1 flex flex-col bg-stone-50 overflow-hidden touch-none">
          <div class="flex-1 relative flex flex-col h-full overflow-hidden">
            <CameraInput :overlay-image="activeHunt?.image" :onion-opacity="onionOpacity" @capture="handleCapture">
              <template #controls>
                <div class="w-full flex items-center gap-4 px-2">
                  <span class="text-[9px] font-black text-stone-400 uppercase tracking-widest whitespace-nowrap">Onion</span>
                  <div class="relative flex-1 h-1 flex items-center">
                    <input type="range" min="0" max="1" step="0.1" v-model.number="onionOpacity" class="w-full accent-orange-500 h-0.5 bg-stone-300 rounded-full appearance-none cursor-pointer relative z-10" />
                  </div>
                  <span class="text-[10px] font-black text-orange-600 tabular-nums w-8 text-right">{{ Math.round(onionOpacity * 100) }}%</span>
                </div>
              </template>
            </CameraInput>
          </div>
        </div>


        <!-- Result View -->
        <div
          v-else-if="currentView === 'result'"
          class="flex-1 flex flex-col items-center bg-stone-50 overflow-y-auto no-scrollbar pb-20"
        >
          <div class="w-full flex gap-1 bg-stone-200 h-64 shrink-0 shadow-lg">
            <div class="flex-1 relative overflow-hidden">
              <img
                :src="activeHunt?.image"
                class="w-full h-full object-cover"
              />
              <div
                class="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md px-2 py-1 rounded text-[8px] text-white font-black uppercase tracking-widest"
              >
                Target
              </div>
            </div>
            <div class="flex-1 relative overflow-hidden">
              <img
                :src="lastAttempt.image"
                class="w-full h-full object-cover"
              />
              <div
                class="absolute bottom-3 left-3 bg-orange-600 px-2 py-1 rounded text-[8px] text-white font-black uppercase tracking-widest"
              >
                Your Shot
              </div>
            </div>
          </div>
          <div class="px-8 pt-10 w-full max-w-sm flex flex-col items-center">
            <ScoreDisplay
              :score="lastAttempt.score"
              :explanation="lastAttempt.explanation"
              :loading="lastAttempt.loading"
            />
            <div v-if="!lastAttempt.loading" class="w-full space-y-4 mt-10">
              <button
                @click="currentView = 'match'"
                class="w-full bg-orange-600 py-5 rounded-[24px] font-black text-white shadow-2xl shadow-orange-600/30 active:scale-95 transition-all flex items-center justify-center gap-3 text-lg"
              >
                <RefreshCw class="w-6 h-6" /> Try Again
              </button>
              <button
                @click="currentView = 'home'"
                class="w-full bg-white border border-stone-200 py-5 rounded-[24px] font-black text-stone-600 hover:bg-stone-50 active:scale-95 transition-all text-lg"
              >
                Back to Explorer
              </button>
            </div>
          </div>
        </div>

        <!-- Create View -->
        <div
          v-else-if="currentView === 'create'"
          class="flex-1 flex flex-col bg-stone-50 overflow-hidden"
        >
          <div
            v-if="isLocating"
            class="absolute inset-0 z-[120] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center space-y-4"
          >
            <div
              class="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"
            ></div>
            <p
              class="text-orange-600 font-black uppercase tracking-widest text-xs"
            >
              Locating Mission...
            </p>
          </div>

          <!-- Step 1: Mission Setup -->
          <template v-if="createStep === 'setup'">
            <ChallengeSetup 
              v-model="newHuntData" 
              @capture="createStep = 'capture'"
              @save="finalizeCreateHunt" 
            />
          </template>

          <!-- Step 2: Full Screen Capture -->
          <template v-else-if="createStep === 'capture'">
            <div class="flex-1 flex flex-col bg-stone-50 overflow-hidden touch-none relative">
              <CameraInput @capture="handleCapture" :minimal="true" />
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");

html,
body {
  height: 100%;
  overflow: hidden;
  margin: 0;
  padding: 0;
  background-color: #f5f5f4;
}

body {
  font-family: "Plus Jakarta Sans", sans-serif;
  overflow: hidden;
  overscroll-behavior: none;
  position: fixed;
  width: 100%;
  height: 100svh;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.animate-in {
  animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes slide-up {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
.slide-fade-enter-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-fade-leave-active {
  transition: all 0.4s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from {
  transform: translateY(40px);
  opacity: 0;
}
.slide-fade-leave-to {
  transform: translateY(-40px);
  opacity: 0;
}
.pop-enter-active {
  animation: pop-in 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes pop-in {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  100% {
    transform: scale(1.1);
    opacity: 1;
  }
}
</style>
