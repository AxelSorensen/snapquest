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
  User,
} from "lucide-vue-next";
import {
  GoogleMap,
  Circle,
  Marker,
  MarkerCluster,
  CustomMarker,
} from "vue3-google-map";
import { useLocalStorage, useGeolocation } from "@vueuse/core";

const config = useRuntimeConfig();
const googleMapsApiKey = config.public.googleMapsApiKey;

type View =
  | "home"
  | "create"
  | "match"
  | "result"
  | "map"
  | "details"
  | "profile";
const currentView = ref<View>("home");

// Bottom Sheet Snap Logic
type SnapState = "peek" | "expanded" | "full";
const currentSnapState = ref<SnapState>("expanded");
const isDraggingSheet = ref(false);
const dragY = ref(0);
const startTouchY = ref(0);
const startSheetY = ref(0);
const startTime = ref(0);
const snapDuration = ref(300);

const getSnapPx = (state: SnapState) => {
  if (typeof window === "undefined") return 0;
  const h = window.innerHeight;
  switch (state) {
    case "full":
      return 0;
    case "expanded":
      return h * 0.45;
    case "peek":
      return h * 0.85;
    default:
      return h * 0.85;
  }
};

const onDragStart = (e: MouseEvent | TouchEvent) => {
  isDraggingSheet.value = true;
  startTime.value = Date.now();
  const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
  startTouchY.value = clientY;

  // Calculate current Y based on state
  startSheetY.value = getSnapPx(currentSnapState.value);
  dragY.value = startSheetY.value;

  window.addEventListener("touchmove", onDragMove, { passive: false });
  window.addEventListener("touchend", onDragEnd);
  window.addEventListener("mousemove", onDragMove);
  window.addEventListener("mouseup", onDragEnd);
};

const onDragMove = (e: TouchEvent | MouseEvent) => {
  if (!isDraggingSheet.value) return;
  const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
  const delta = clientY - startTouchY.value;
  let newY = startSheetY.value + delta;

  // Rubber-banding / Resistance at edges
  const fullPx = getSnapPx("full");
  const peekPx = getSnapPx("peek");

  if (newY < fullPx) {
    newY = fullPx + (newY - fullPx) * 0.15;
  } else if (newY > peekPx) {
    newY = peekPx + (newY - peekPx) * 0.15;
  }

  // Final constrain for absolute safety
  const h = typeof window !== "undefined" ? window.innerHeight : 0;
  if (newY < -50) newY = -50;
  if (newY > h + 50) newY = h + 50;

  dragY.value = newY;
  if ("touches" in e) {
    if (e.cancelable) e.preventDefault();
  }
};

const onDragEnd = (e: TouchEvent | MouseEvent) => {
  if (!isDraggingSheet.value) return;
  isDraggingSheet.value = false;

  const duration = Date.now() - startTime.value;
  const clientY =
    "changedTouches" in e
      ? (e as TouchEvent).changedTouches[0].clientY
      : (e as MouseEvent).clientY;
  const deltaY = clientY - startTouchY.value;
  const velocity = deltaY / duration; // px/ms

  const currentY = dragY.value;
  let targetState = currentSnapState.value;

  // If flicked with enough velocity, jump to next/prev state
  if (Math.abs(velocity) > 0.5) {
    if (velocity < 0) {
      // Swiping UP
      if (currentSnapState.value === "peek") targetState = "expanded";
      else if (currentSnapState.value === "expanded") targetState = "full";
      else targetState = "full";
    } else {
      // Swiping DOWN
      if (currentSnapState.value === "full") targetState = "expanded";
      else if (currentSnapState.value === "expanded") targetState = "peek";
      else targetState = "peek";
    }
  } else {
    // Normal distance-based snapping
    const distances = [
      { state: "full", dist: Math.abs(currentY - getSnapPx("full")) },
      { state: "expanded", dist: Math.abs(currentY - getSnapPx("expanded")) },
      { state: "peek", dist: Math.abs(currentY - getSnapPx("peek")) },
    ];
    distances.sort((a, b) => a.dist - b.dist);
    targetState = distances[0].state as SnapState;
  }

  // Calculate a natural-feeling duration based on velocity or distance
  const targetY = getSnapPx(targetState);
  const distance = Math.abs(currentY - targetY);
  const calculatedDuration = Math.max(
    250,
    Math.min(600, distance / Math.abs(velocity || 0.4)),
  );
  snapDuration.value = calculatedDuration;

  currentSnapState.value = targetState;
  if (targetState === "peek") {
    currentView.value = "map";
  } else {
    currentView.value = "home";
  }

  window.removeEventListener("touchmove", onDragMove);
  window.removeEventListener("touchend", onDragEnd);
  window.removeEventListener("mousemove", onDragMove);
  window.removeEventListener("mouseup", onDragEnd);
};

const handleSheetClick = () => {
  if (isDraggingSheet.value) return;
  // Toggle between Peek and Expanded on click
  if (currentSnapState.value === "peek") {
    currentSnapState.value = "expanded";
  } else {
    currentSnapState.value = "peek";
  }
  snapDuration.value = 300;

  if (currentSnapState.value === "peek") {
    currentView.value = "map";
  } else {
    currentView.value = "home";
  }
};

const displayTranslateY = computed(() => {
  if (isDraggingSheet.value) {
    return dragY.value;
  }
  return getSnapPx(currentSnapState.value);
});

const isFull = computed(() => currentSnapState.value === "full");

watch(currentView, (newView) => {
  if (newView === "home" && currentSnapState.value === "peek") {
    currentSnapState.value = "expanded";
    snapDuration.value = 300;
  }
  if (newView === "map" && currentSnapState.value !== "peek") {
    currentSnapState.value = "peek";
    snapDuration.value = 300;
  }
});

const customHunts = useLocalStorage<any[]>("lenshunt_custom_hunts", []);
const completedHunts = useLocalStorage<string[]>(
  "lenshunt_completed_hunts",
  [],
);
const allHunts = computed(() => {
  const all = [...customHunts.value].filter((h) => h && h.id && h.position);
  const uniqueHunts: any[] = [];
  const seenIds = new Set();
  const seenPositions = new Set();

  for (const h of all) {
    const posKey = `${h.position.lat.toFixed(6)},${h.position.lng.toFixed(6)}`;
    if (!seenIds.has(h.id) && !seenPositions.has(posKey)) {
      seenIds.add(h.id);
      seenPositions.add(posKey);
      uniqueHunts.push(h);
    }
  }
  return uniqueHunts;
});

const hunts = computed(() => {
  return allHunts.value.filter((h) => !completedHunts.value.includes(h.id));
});

const totalXp = useLocalStorage("lenshunt_total_xp", 0);
const totalStars = useLocalStorage("lenshunt_total_stars", 0);
const explorerLevel = computed(() => Math.floor(totalXp.value / 500) + 1);
const explorerRank = computed(() => {
  const lvl = explorerLevel.value;
  if (lvl >= 50) return "Legendary Scout";
  if (lvl >= 20) return "Master Hunter";
  if (lvl >= 10) return "Elite Tracker";
  if (lvl >= 5) return "Veteran Explorer";
  if (lvl >= 2) return "Pro Scout";
  return "Rookie Explorer";
});
const xpToNextLevel = computed(() => 500 - (totalXp.value % 500));

const activeHunt = ref<any>(null);
const detailsSubView = ref<"details" | "location" | "photo">("details");
const revealedHintsCount = ref(0);
const currentHintCost = computed(() => getHintCost(revealedHintsCount.value));

function getHintCost(idx: number) {
  // Base cost decreases with level (max 40% discount at level 20+)
  const baseBase = 50;
  const levelDiscount = Math.min(0.4, (explorerLevel.value - 1) * 0.02);
  const baseCost = Math.round(baseBase * (1 - levelDiscount));
  return baseCost * Math.pow(2, idx);
}
const profileSubView = ref<"completed" | "posted">("completed");
const onionOpacity = ref(0.4);
const isLocating = ref(false);

watch(activeHunt, () => {
  revealedHintsCount.value = 0;
});

function revealHint() {
  if (revealedHintsCount.value < (activeHunt.value?.tips?.length || 0)) {
    const cost = currentHintCost.value;
    totalXp.value = Math.max(0, totalXp.value - cost);
    revealedHintsCount.value++;
    triggerHaptic(10);
  }
}

function getDistance(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
) {
  const R = 6371e3; // Earth radius in meters
  const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
  const dLng = (p2.lng - p1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * (Math.PI / 180)) *
      Math.cos(p2.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const openGlobalMap = () => {
  activeHunt.value = null;
  currentView.value = "map";
};

const viewHuntOnMap = () => {
  detailsSubView.value = "location";
  currentView.value = "details";
};

const lastAttempt = reactive({
  image: "",
  score: 0,
  explanation: "",
  loading: false,
  distance: null as number | null,
  isSuccess: false,
  starsEarned: 0,
  xpEarned: 0,
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

const mapCenter = ref({ lat: 55.7042, lng: 12.5771 });
const mapZoom = ref(13);
const mapRef = ref<any>(null);
const isMapReady = ref(false);

const clusterOptions = computed(() => {
  if (
    typeof window === "undefined" ||
    !(window as any).google ||
    !(window as any).google.maps
  )
    return null;

  return {
    renderer: {
      render: ({ count, position }: any) => {
        const google = (window as any).google;
        return new google.maps.Marker({
          position,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#ea580c",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 18,
            anchor: new google.maps.Point(0, 0),
            labelOrigin: new google.maps.Point(0, 0),
          },
          label: {
            text: String(count),
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: "900",
            fontFamily: "Inter, sans-serif",
          },
          zIndex: 99999 + count,
        });
      },
    },
  };
});

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
    tips: hunt.tips,
  };
  detailsSubView.value = "details";
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
  lastAttempt.isSuccess = false;
  lastAttempt.distance = null;
  currentView.value = "result";

  // Calculate distance
  if (userPosition.value && activeHunt.value) {
    lastAttempt.distance = getDistance(
      userPosition.value,
      activeHunt.value.position,
    );
  }

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

      // Success criteria: > 75% match AND (distance <= 30m OR GPS unavailable)
      const withinDistance =
        lastAttempt.distance === null || lastAttempt.distance <= 50;

      if (lastAttempt.score >= 75 && withinDistance) {
        lastAttempt.isSuccess = true;

        // Calculate stars (1-3)
        if (lastAttempt.score >= 95) lastAttempt.starsEarned = 3;
        else if (lastAttempt.score >= 85) lastAttempt.starsEarned = 2;
        else lastAttempt.starsEarned = 1;

        // Calculate XP: Base score + bonus for precision
        const bonusXp = Math.round(Math.max(0, (lastAttempt.score - 75) * 5));
        lastAttempt.xpEarned = Math.round(lastAttempt.score + bonusXp);

        if (
          activeHunt.value &&
          !completedHunts.value.includes(activeHunt.value.id)
        ) {
          completedHunts.value.push(activeHunt.value.id);
          totalStars.value += lastAttempt.starsEarned;
        }
      } else {
        lastAttempt.isSuccess = false;
        lastAttempt.starsEarned = 0;
        lastAttempt.xpEarned = Math.round(lastAttempt.score / 2); // Consolation XP
      }

      totalXp.value += lastAttempt.xpEarned;
      triggerHaptic(lastAttempt.isSuccess ? [30, 50, 30] : 10);
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
      : null;

  const newHunt = {
    id: Date.now().toString(),
    image: newHuntData.value.image,
    location:
      newHuntData.value.locationName || "Quest #" + (hunts.value.length + 1),
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
    const map = mapRef.value.map;
    const projection = map.getProjection();
    if (!projection) {
      map.setCenter(userPosition.value);
      map.setZoom(17);
      return;
    }

    // Calculate vertical offset to center user in the visible area above the drawer
    // peek: covers 15% (85% translate), expanded: covers 55% (45% translate), full: covers 100% (0% translate)
    let drawerHeightRatio = 0.15; // default for peek
    if (currentSnapState.value === "expanded") drawerHeightRatio = 0.55;
    if (currentSnapState.value === "full") drawerHeightRatio = 0.8; // Don't cover completely or we can't see the user

    const visibleHeightRatio = 1 - drawerHeightRatio;

    // We want the user to be at (visibleHeightRatio / 2) from the top
    // Standard center is 0.5. Offset = 0.5 - (visibleHeightRatio / 2)
    const offsetRatio = 0.5 - visibleHeightRatio / 2;

    map.setCenter(userPosition.value);
    map.setZoom(17);

    // Slight delay to allow zoom to finish before panning for offset
    setTimeout(() => {
      map.panBy(0, Math.round(window.innerHeight * offsetRatio));
    }, 100);
  } else {
    currentView.value = "map";
  }
};
</script>

<template>
  <div
    class="h-svh w-screen relative overflow-hidden bg-stone-50 flex flex-col font-sans"
  >
    <!-- UI Overlay: Top Bar -->
    <div
      class="absolute top-0 left-0 right-0 p-4 z-[1] pointer-events-none flex flex-col space-y-3"
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
              SnapQuest
            </h1>
          </div>
          <div class="mt-2 flex flex-col gap-1">
            <div class="flex items-center justify-between gap-4">
              <p
                class="text-[8px] uppercase tracking-[0.2em] text-stone-400 font-black"
              >
                Level {{ explorerLevel }} • {{ explorerRank }}
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
            @click="centerMap"
            class="bg-white p-3.5 rounded-2xl shadow-xl shadow-orange-900/5 text-orange-600 hover:bg-orange-50 transition-all hover:scale-105 active:scale-95 border border-stone-100"
            title="Center on Me"
          >
            <Navigation class="w-6 h-6" />
          </button>

          <button
            @click="currentView = 'profile'"
            class="bg-white p-3.5 rounded-2xl shadow-xl shadow-orange-900/5 text-orange-600 hover:bg-orange-50 transition-all hover:scale-105 active:scale-95 border border-stone-100"
            title="My Profile"
          >
            <User class="w-6 h-6" />
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
    <div class="flex-1 relative">
      <ClientOnly>
        <GoogleMap
          ref="mapRef"
          v-if="googleMapsApiKey"
          :api-key="googleMapsApiKey"
          class="w-full h-full"
          :center="mapCenter"
          v-model:zoom="mapZoom"
          :disable-default-ui="true"
          :styles="mapStyles"
          @idle="isMapReady = true"
        >
          <!-- Individual Quest Circles (Stay visible as radius indicators) -->
          <template v-for="hunt in hunts" :key="'circle-' + hunt.id">
            <Circle
              v-if="
                currentView === 'map' ||
                (activeHunt?.id === hunt.id && currentView === 'details')
              "
              :options="{
                center: hunt.position,
                radius: hunt.radius || 180,
                fillColor: '#ea580c',
                fillOpacity: activeHunt?.id === hunt.id ? 0.25 : 0.12,
                strokeColor: '#ea580c',
                strokeOpacity: 0.4,
                strokeWeight: 1.5,
              }"
            />
          </template>

          <!-- Marker Clustering for Quests -->
          <MarkerCluster v-if="isMapReady" :options="clusterOptions || {}">
            <CustomMarker
              v-for="hunt in hunts"
              :key="'marker-' + hunt.id"
              :options="{
                position: hunt.position,
                anchorPoint: 'CENTER',
              }"
              @click="startMatch(hunt)"
            >
              <div class="w-0 h-0 opacity-0"></div>
            </CustomMarker>
          </MarkerCluster>

          <CustomMarker
            v-if="userPosition"
            :options="{
              position: userPosition,
              anchorPoint: 'CENTER',
              zIndex: 10,
            }"
          >
            <div class="relative w-6 h-6 flex items-center justify-center">
              <div
                class="absolute inset-0 bg-orange-600/30 rounded-full animate-ping"
              ></div>
              <div
                class="relative w-4 h-4 bg-orange-600 rounded-full border-2 border-white shadow-lg"
              ></div>
            </div>
          </CustomMarker>
        </GoogleMap>
      </ClientOnly>

      <div
        v-if="currentView === 'home' || currentView === 'map'"
        class="fixed inset-x-0 bottom-0 h-svh z-[200] pointer-events-none will-change-transform"
        :style="{ 
          transform: `translateY(${displayTranslateY}px) translateZ(0)`,
          transition: isDraggingSheet ? 'none' : `transform ${snapDuration}ms cubic-bezier(0.16, 1, 0.3, 1)`
        }"
      >
        <div
          class="h-full w-full bg-white shadow-[0_-12px_50px_rgba(43,26,10,0.12)] border-t border-stone-100 flex flex-col pointer-events-auto overflow-hidden"
          :class="[
            isFull ? 'rounded-t-0' : 'rounded-t-[44px]',
            { 'transition-all duration-300': !isDraggingSheet }
          ]"
        >
          <!-- Home List Header / Drag Handle -->
          <div
            @mousedown="onDragStart"
            @touchstart="onDragStart"
            @click="handleSheetClick"
            class="w-full h-14 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-stone-50 transition-colors shrink-0 touch-none relative"
          >
            <Transition name="pop" mode="out-in">
              <div v-if="isFull" key="chevron" class="text-stone-400">
                <ChevronLeft class="w-6 h-6 -rotate-90" />
              </div>
              <div v-else key="bar" class="w-14 h-1.5 bg-stone-200 rounded-full"></div>
            </Transition>
          </div>
          <div
            class="flex-1 no-scrollbar px-6 pb-24"
            :class="isFull ? 'overflow-y-auto' : 'overflow-y-hidden'"
          >
            <div class="flex items-center justify-between mb-8 pt-2">
              <div>
                <h2 class="text-3xl font-black text-stone-900 tracking-tight">
                  Nearby Quests
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
            <div v-if="hunts.length > 0" class="grid gap-6">
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
                    <div
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 rounded-full text-white font-black text-[9px] uppercase tracking-widest shadow-lg shadow-orange-900/20"
                    >
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

            <!-- Empty State -->
            <div
              v-else
              class="flex flex-col items-center justify-center py-16 px-4 text-center space-y-8 animate-in fade-in zoom-in-95 duration-300"
            >
              <div
                class="w-24 h-24 bg-stone-50 rounded-[40px] flex items-center justify-center border border-stone-100 shadow-inner"
              >
                <Search class="w-10 h-10 text-stone-300" />
              </div>

              <div class="space-y-2">
                <h3 class="text-xl font-black text-stone-900">
                  No Quests Found
                </h3>
                <p class="text-sm text-stone-500 font-medium max-w-[240px]">
                  There are currently no quests in this area. Why not be the
                  first to create one?
                </p>
              </div>

              <button
                @click="currentView = 'create'"
                class="bg-orange-600 text-white px-8 py-4 rounded-3xl font-black text-sm uppercase tracking-widest shadow-lg shadow-orange-600/30 hover:bg-orange-700 active:scale-95 transition-all flex items-center gap-3"
              >
                <Plus class="w-5 h-5" />
                Create New Quest
              </button>
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
          class="absolute top-4 right-4 p-2 text-white mix-blend-difference transition-all z-[110]"
        >
          <X class="w-8 h-8" />
        </button>

        <!-- Step 1: Hunt Details -->
        <div
          v-if="currentView === 'details'"
          class="flex-1 flex flex-col overflow-y-auto no-scrollbar pb-32"
        >
          <div class="relative w-full h-[35svh] shrink-0">
            <img :src="activeHunt?.image" class="w-full h-full object-cover" />
            <div
              class="absolute inset-0 bg-gradient-to-t from-stone-50 from-0% via-stone-50/95 via-10% to-transparent"
            ></div>
          </div>
          <div class="px-8 pt-6 space-y-10">
            <div>
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

            <!-- View Toggle -->
            <div class="flex bg-stone-100 p-1 rounded-2xl w-fit mx-auto mb-2">
              <button
                @click="detailsSubView = 'details'"
                :class="[
                  'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                  detailsSubView === 'details'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-400 hover:text-stone-600',
                ]"
              >
                Details
              </button>
              <button
                @click="detailsSubView = 'location'"
                :class="[
                  'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                  detailsSubView === 'location'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-400 hover:text-stone-600',
                ]"
              >
                Location
              </button>
              <button
                @click="detailsSubView = 'photo'"
                :class="[
                  'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                  detailsSubView === 'photo'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-400 hover:text-stone-600',
                ]"
              >
                Photo
              </button>
            </div>

            <template v-if="detailsSubView === 'details'">
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
                  Quest Hints
                </h3>

                <div v-if="activeHunt?.tips?.length > 0" class="grid gap-3">
                  <div
                    v-for="(tip, idx) in activeHunt?.tips"
                    :key="idx"
                    class="relative group transition-all duration-300"
                  >
                    <!-- Revealed Hint -->
                    <div
                      v-if="idx < revealedHintsCount"
                      class="flex gap-4 p-4 bg-white rounded-3xl border border-stone-100 shadow-sm shadow-orange-900/5 animate-in fade-in zoom-in-95 duration-300 ease-out"
                    >
                      <div
                        class="w-6 h-6 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-black text-[10px] shrink-0"
                      >
                        {{ idx + 1 }}
                      </div>
                      <p
                        class="text-sm text-stone-600 font-medium leading-relaxed"
                      >
                        {{ tip }}
                      </p>
                    </div>

                    <!-- Next to Reveal -->
                    <button
                      v-else-if="idx === revealedHintsCount"
                      @click="revealHint"
                      class="w-full flex items-center justify-between gap-4 p-4 bg-orange-50/30 rounded-3xl border-2 border-dashed border-orange-200 hover:border-orange-400 hover:bg-orange-50/50 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 group"
                    >
                      <div class="flex items-center gap-4">
                        <div
                          class="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600"
                        >
                          <Search class="w-3.5 h-3.5" />
                        </div>
                        <span class="text-sm font-bold text-orange-800"
                          >Show Hint {{ idx + 1 }}</span
                        >
                      </div>
                      <span class="text-[10px] font-black text-orange-600"
                        >-{{ getHintCost(idx) }} XP</span
                      >
                    </button>

                    <!-- Locked Hint -->
                    <div
                      v-else
                      class="flex items-center justify-between gap-4 p-4 bg-stone-50 rounded-3xl border border-stone-100 opacity-50 grayscale"
                    >
                      <div class="flex items-center gap-4">
                        <div
                          class="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-stone-400"
                        >
                          <X class="w-3 h-3" />
                        </div>
                        <span class="text-sm font-bold text-stone-400"
                          >Locked Hint</span
                        >
                      </div>
                      <span class="text-[10px] font-black text-stone-400"
                        >-{{ getHintCost(idx) }} XP</span
                      >
                    </div>
                  </div>
                </div>
                <div
                  v-else
                  class="p-4 border-2 border-dashed border-stone-100 rounded-[32px] flex flex-col items-center justify-center gap-3 text-center"
                >
                  <div
                    class="w-12 h-12 rounded-2xl bg-stone-50 flex items-center justify-center text-stone-300"
                  >
                    <Info class="w-6 h-6" />
                  </div>
                  <p class="text-xs font-bold text-stone-400">
                    No hints for this quest
                  </p>
                </div>
              </div>
            </template>

            <template v-else-if="detailsSubView === 'location'">
              <div class="space-y-6">
                <h3
                  class="text-sm font-black uppercase tracking-[0.1em] text-stone-900"
                >
                  Search Radius
                </h3>
                <div
                  class="relative aspect-square rounded-[32px] overflow-hidden border-4 border-white shadow-xl shadow-orange-900/5 bg-stone-100"
                >
                  <ClientOnly>
                    <GoogleMap
                      v-if="googleMapsApiKey"
                      :api-key="googleMapsApiKey"
                      class="w-full h-full"
                      :center="activeHunt?.position"
                      :zoom="16"
                      :disable-default-ui="true"
                      :styles="mapStyles"
                    >
                      <Circle
                        :options="{
                          center: activeHunt?.position,
                          radius: activeHunt?.radius || 180,
                          fillColor: '#ea580c',
                          fillOpacity: 0.12,
                          strokeColor: '#ea580c',
                          strokeOpacity: 0.5,
                          strokeWeight: 2,
                        }"
                      />
                      <CustomMarker
                        v-if="userPosition"
                        :options="{
                          position: userPosition,
                          anchorPoint: 'CENTER',
                          zIndex: 1,
                        }"
                      >
                        <div
                          class="relative w-6 h-6 flex items-center justify-center"
                        >
                          <div
                            class="absolute inset-0 bg-orange-600/30 rounded-full animate-ping"
                          ></div>
                          <div
                            class="relative w-4 h-4 bg-orange-600 rounded-full border-2 border-white shadow-lg"
                          ></div>
                        </div>
                      </CustomMarker>
                    </GoogleMap>
                  </ClientOnly>
                </div>
              </div>
            </template>

            <template v-else-if="detailsSubView === 'photo'">
              <div class="space-y-6">
                <h3
                  class="text-sm font-black uppercase tracking-[0.1em] text-stone-900"
                >
                  Target Visual
                </h3>
                <div
                  class="relative aspect-square rounded-[32px] overflow-hidden border-4 border-white shadow-xl shadow-orange-900/5"
                >
                  <img
                    :src="activeHunt?.image"
                    class="w-full h-full object-cover"
                  />
                </div>
                <p
                  class="text-[10px] font-black text-stone-400 text-center uppercase tracking-[0.2em]"
                >
                  Study the details to match the shot
                </p>
              </div>
            </template>
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

        <!-- Profile View -->
        <div
          v-else-if="currentView === 'profile'"
          class="flex-1 flex flex-col overflow-y-auto no-scrollbar p-8 pt-24 pb-32"
        >
          <!-- User Stats Card -->
          <div
            class="bg-white rounded-[40px] p-8 border border-stone-100 shadow-xl shadow-orange-900/5 text-center space-y-8 mb-10 shrink-0 relative overflow-hidden"
          >
            <div class="absolute top-0 right-0 p-6 opacity-[0.03]">
              <Trophy class="w-32 h-32 text-orange-600" />
            </div>

            <div class="relative space-y-4">
              <div class="relative w-28 h-28 mx-auto">
                <div
                  class="absolute inset-0 bg-orange-600 rounded-full animate-pulse opacity-10"
                ></div>
                <div
                  class="relative w-28 h-28 bg-stone-900 rounded-full border-4 border-white shadow-2xl flex items-center justify-center text-white text-4xl font-black italic tracking-tighter"
                >
                  {{ explorerLevel }}
                </div>
                <div
                  class="absolute -bottom-2 -right-2 bg-orange-600 text-white px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg border-2 border-white"
                >
                  Rank
                </div>
              </div>
              <div class="space-y-1">
                <h2 class="text-2xl font-black text-stone-900 tracking-tight">
                  {{ explorerRank }}
                </h2>
                <p
                  class="text-stone-400 font-black text-[10px] uppercase tracking-[0.25em]"
                >
                  Global Contributor
                </p>
              </div>
            </div>

            <!-- XP Progress -->
            <div class="space-y-3">
              <div class="flex justify-between items-end px-1">
                <p
                  class="text-[10px] font-black text-stone-400 uppercase tracking-widest"
                >
                  Level Progress
                </p>
                <p
                  class="text-[10px] font-black text-orange-600 uppercase tracking-widest"
                >
                  {{ totalXp % 500 }} / 500 XP
                </p>
              </div>
              <div
                class="w-full h-3 bg-stone-100 rounded-full overflow-hidden border border-stone-50 shadow-inner p-0.5"
              >
                <div
                  class="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-1000 shadow-sm"
                  :style="{ width: `${(totalXp % 500) / 5}%` }"
                ></div>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div
                class="bg-orange-50/50 rounded-3xl p-4 border border-orange-100/50"
              >
                <p
                  class="text-[8px] font-black text-orange-600/60 uppercase tracking-widest mb-1"
                >
                  Quests
                </p>
                <p class="text-xl font-black text-stone-900 tracking-tighter">
                  {{ completedHunts.length }}
                </p>
              </div>
              <div
                class="bg-amber-50/50 rounded-3xl p-4 border border-amber-100/50"
              >
                <p
                  class="text-[8px] font-black text-amber-600/60 uppercase tracking-widest mb-1"
                >
                  Stars
                </p>
                <div class="flex items-center justify-center gap-1">
                  <Star class="w-3 h-3 text-amber-500 fill-current" />
                  <p class="text-xl font-black text-stone-900 tracking-tighter">
                    {{ totalStars }}
                  </p>
                </div>
              </div>
              <div class="bg-stone-50 rounded-3xl p-4 border border-stone-100">
                <p
                  class="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1"
                >
                  Total XP
                </p>
                <p class="text-xl font-black text-stone-900 tracking-tighter">
                  {{ totalXp }}
                </p>
              </div>
            </div>
          </div>

          <!-- Profile Tabs Toggle -->
          <div class="flex bg-stone-100 p-1 rounded-2xl w-full mb-10 shrink-0">
            <button
              @click="profileSubView = 'completed'"
              :class="[
                'flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                profileSubView === 'completed'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-400 hover:text-stone-600',
              ]"
            >
              Completed
            </button>
            <button
              @click="profileSubView = 'posted'"
              :class="[
                'flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                profileSubView === 'posted'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-400 hover:text-stone-600',
              ]"
            >
              Contributions
            </button>
          </div>

          <!-- Hall of Fame (Completed) -->
          <template v-if="profileSubView === 'completed'">
            <div class="space-y-6">
              <h3
                class="text-sm font-black uppercase tracking-[0.1em] text-stone-900 px-2 flex items-center justify-between"
              >
                Hall of Fame
                <span class="text-[10px] text-stone-400 normal-case"
                  >{{ completedHunts.length }} matched</span
                >
              </h3>

              <div v-if="completedHunts.length > 0" class="grid gap-4">
                <div
                  v-for="hunt in allHunts.filter((h) =>
                    completedHunts.includes(h.id),
                  )"
                  :key="'completed-' + hunt.id"
                  @click="startMatch(hunt)"
                  class="group relative h-32 rounded-[28px] overflow-hidden shadow-sm border border-stone-100 cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <img :src="hunt.image" class="w-full h-full object-cover" />
                  <div
                    class="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-transparent to-transparent"
                  ></div>
                  <div
                    class="absolute bottom-4 left-5 right-5 flex items-center justify-between"
                  >
                    <div>
                      <p class="text-white font-black text-base tracking-tight">
                        {{ hunt.location }}
                      </p>
                      <div class="flex items-center gap-1.5 mt-0.5">
                        <Check class="w-2.5 h-2.5 text-green-400" />
                        <span
                          class="text-[8px] font-bold text-white/80 uppercase tracking-widest"
                          >Verified Match</span
                        >
                      </div>
                    </div>
                    <div
                      class="bg-green-500/20 backdrop-blur-md p-1.5 rounded-lg border border-white/20"
                    >
                      <Trophy class="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="p-10 bg-stone-50 rounded-[32px] border-2 border-dashed border-stone-200 text-center"
              >
                <p
                  class="text-[10px] font-black text-stone-400 uppercase tracking-widest"
                >
                  No successful matches yet
                </p>
              </div>
            </div>
          </template>

          <!-- My Posted Quests (Contributions) -->
          <template v-else-if="profileSubView === 'posted'">
            <div class="space-y-6">
              <h3
                class="text-sm font-black uppercase tracking-[0.1em] text-stone-900 px-2 flex items-center justify-between"
              >
                Your Contributions
                <span class="text-[10px] text-stone-400 normal-case"
                  >{{ customHunts.length }} posted</span
                >
              </h3>

              <div v-if="customHunts.length > 0" class="grid gap-4">
                <div
                  v-for="hunt in customHunts"
                  :key="'posted-' + hunt.id"
                  @click="startMatch(hunt)"
                  class="group bg-white rounded-[28px] overflow-hidden border border-stone-100 shadow-sm flex cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div class="w-20 h-20 shrink-0 overflow-hidden">
                    <img :src="hunt.image" class="w-full h-full object-cover" />
                  </div>
                  <div class="flex-1 p-4 flex flex-col justify-center">
                    <p class="font-black text-stone-900 text-sm tracking-tight">
                      {{ hunt.location }}
                    </p>
                    <p
                      class="text-[9px] font-bold text-stone-400 uppercase tracking-widest mt-1"
                    >
                      Level {{ hunt.difficulty }} Quest
                    </p>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="p-10 bg-stone-50 rounded-[32px] border-2 border-dashed border-stone-200 text-center"
              >
                <p
                  class="text-[10px] font-black text-stone-400 uppercase tracking-widest"
                >
                  No Quests Posted Yet
                </p>
              </div>
            </div>
          </template>
        </div>

        <!-- Step 2: Minimalist Match View -->
        <div
          v-else-if="currentView === 'match'"
          class="flex-1 flex flex-col bg-stone-50 overflow-hidden touch-none"
        >
          <div class="flex-1 relative flex flex-col h-full overflow-hidden">
            <CameraInput
              :overlay-image="activeHunt?.image"
              :onion-opacity="onionOpacity"
              @capture="handleCapture"
            >
              <template #controls>
                <div class="w-full flex items-center gap-4 px-2">
                  <span
                    class="text-[9px] font-black text-stone-400 uppercase tracking-widest whitespace-nowrap"
                    >Onion</span
                  >
                  <div class="relative flex-1 h-1 flex items-center">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      v-model.number="onionOpacity"
                      class="w-full accent-orange-500 h-0.5 bg-stone-300 rounded-full appearance-none cursor-pointer relative z-10"
                    />
                  </div>
                  <span
                    class="text-[10px] font-black text-orange-600 tabular-nums w-8 text-right"
                    >{{ Math.round(onionOpacity * 100) }}%</span
                  >
                </div>
              </template>
            </CameraInput>
          </div>
        </div>

        <!-- Result View -->
        <div
          v-else-if="currentView === 'result'"
          class="flex-1 flex flex-col bg-stone-50 overflow-hidden"
        >
          <!-- Scrollable Content -->
          <div class="flex-1 overflow-y-auto no-scrollbar pb-48">
            <!-- Comparison Header -->
            <div
              class="w-full flex gap-0.5 bg-stone-200 aspect-[2.5/1] shrink-0 shadow-lg relative z-10"
            >
              <div class="flex-1 relative overflow-hidden">
                <img
                  :src="activeHunt?.image"
                  class="w-full h-full object-cover"
                />
                <div
                  class="absolute bottom-2 left-2 bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-[4px] text-[7px] text-white font-black uppercase tracking-widest"
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
                  class="absolute bottom-2 left-2 bg-orange-600 px-1.5 py-0.5 rounded-[4px] text-[7px] text-white font-black uppercase tracking-widest"
                >
                  Your Shot
                </div>
              </div>
            </div>

            <!-- Score Container -->
            <div class="px-6 pt-6 flex flex-col items-center">
              <ScoreDisplay
                :score="lastAttempt.score"
                :explanation="lastAttempt.explanation"
                :loading="lastAttempt.loading"
                :is-success="lastAttempt.isSuccess"
                :stars-earned="lastAttempt.starsEarned"
                :xp-earned="lastAttempt.xpEarned"
              />
            </div>
          </div>

          <!-- Fixed Action Buttons -->
          <div
            v-if="!lastAttempt.loading"
            class="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-stone-50 via-stone-50 to-transparent z-20 space-y-3"
          >
            <button
              @click="currentView = lastAttempt.isSuccess ? 'home' : 'match'"
              :class="[
                'w-full py-5 rounded-[28px] font-black text-white shadow-2xl transition-all flex items-center justify-center gap-3 text-lg active:scale-95',
                lastAttempt.isSuccess
                  ? 'bg-green-600 shadow-green-600/30'
                  : 'bg-orange-600 shadow-orange-600/30',
              ]"
            >
              <template v-if="lastAttempt.isSuccess">
                <Check class="w-6 h-6" /> Quest Complete
              </template>
              <template v-else>
                <RefreshCw class="w-6 h-6" /> Retake Image
              </template>
            </button>
            <button
              @click="currentView = 'home'"
              class="w-full bg-white border border-stone-200 py-5 rounded-[28px] font-black text-stone-600 hover:bg-stone-50 active:scale-95 transition-all text-lg"
            >
              Back to Explorer
            </button>
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
              Locating Quest...
            </p>
          </div>

          <!-- Step 1: Quest Setup -->
          <template v-if="createStep === 'setup'">
            <ChallengeSetup
              v-model="newHuntData"
              @capture="createStep = 'capture'"
              @save="finalizeCreateHunt"
            />
          </template>

          <!-- Step 2: Full Screen Capture -->
          <template v-else-if="createStep === 'capture'">
            <div
              class="flex-1 flex flex-col bg-stone-50 overflow-hidden touch-none relative"
            >
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
  animation: slide-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
.fade-in {
  animation: fade-in 0.3s ease-out forwards;
}
.zoom-in {
  animation: zoom-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
.zoom-in-95 {
  animation: zoom-in-95 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
.slide-in-from-bottom-2 {
  animation: slide-in-from-bottom-2 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)
    forwards;
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes zoom-in {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
@keyframes zoom-in-95 {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
@keyframes slide-in-from-bottom-2 {
  from {
    transform: translateY(16px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
@keyframes slide-up {
  from {
    transform: translateY(40px) scale(0.96);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}
.slide-fade-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.slide-fade-leave-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 1, 1);
}
.slide-fade-enter-from {
  transform: translateY(60px) scale(0.95);
  opacity: 0;
}
.slide-fade-leave-to {
  transform: translateY(20px) scale(0.98);
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
