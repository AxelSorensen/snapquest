<script setup lang="ts">
import { ref } from "vue";
import {
  MapPin,
  Star,
  ChevronLeft,
  Plus,
  Trash2,
  GripVertical,
  Camera,
  Check,
  RefreshCw,
} from "lucide-vue-next";

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["update:modelValue", "capture", "save"]);

const newTip = ref("");
const dragIndex = ref<number | null>(null);

function addTip() {
  if (newTip.value.trim()) {
    const tipObject = {
      id: Math.random().toString(36).substr(2, 9),
      text: newTip.value.trim(),
    };
    const updatedTips = [...props.modelValue.tips, tipObject];
    emit("update:modelValue", { ...props.modelValue, tips: updatedTips });
    newTip.value = "";
  }
}

function removeTip(index: number) {
  const updatedTips = props.modelValue.tips.filter(
    (_: any, i: number) => i !== index,
  );
  emit("update:modelValue", { ...props.modelValue, tips: updatedTips });
}

// Stable Drag and Drop Logic
function onDragStart(index: number) {
  dragIndex.value = index;
}

function onDragOver(e: DragEvent, index: number) {
  if (dragIndex.value === null || dragIndex.value === index) return;

  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const offset = e.clientY - rect.top;

  const isAfterMidpoint = offset > rect.height / 2;

  if (
    (dragIndex.value < index && isAfterMidpoint) ||
    (dragIndex.value > index && !isAfterMidpoint)
  ) {
    const updatedTips = [...props.modelValue.tips];
    const itemToMove = updatedTips.splice(dragIndex.value, 1)[0];
    updatedTips.splice(index, 0, itemToMove);

    dragIndex.value = index;
    emit("update:modelValue", { ...props.modelValue, tips: updatedTips });
  }
}

function onDragEnd() {
  dragIndex.value = null;
}

function updateDifficulty(val: number) {
  emit("update:modelValue", { ...props.modelValue, difficulty: val });
}

function updateName(val: string) {
  emit("update:modelValue", { ...props.modelValue, locationName: val });
}
</script>

<template>
  <div class="flex-1 flex flex-col p-8 pt-24 overflow-y-auto no-scrollbar">
    <div class="text-center space-y-2 mb-8 shrink-0">
      <h2 class="text-3xl font-black text-stone-900 tracking-tight italic">
        Challenge Others
      </h2>
      <p
        class="text-stone-400 font-black text-[10px] uppercase tracking-[0.2em]"
      >
        Create a new mission
      </p>
    </div>

    <div class="space-y-10 pb-32">
      <!-- Image Capture Section -->
      <div class="space-y-4">
        <h3
          class="text-sm font-black uppercase tracking-[0.1em] text-stone-900"
        >
          Mission Photo
        </h3>
        <div
          v-if="modelValue.image"
          class="relative aspect-video rounded-[32px] overflow-hidden border-4 border-white shadow-xl shadow-orange-900/5 group"
        >
          <img :src="modelValue.image" class="w-full h-full object-cover" />
          <div
            class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <button
              @click="$emit('capture')"
              class="bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl font-black text-orange-600 flex items-center gap-2 shadow-xl active:scale-95 transition-all"
            >
              <RefreshCw class="w-5 h-5" /> Retake Shot
            </button>
          </div>
          <button
            @click="$emit('capture')"
            class="absolute bottom-4 right-4 bg-orange-600 p-3 rounded-xl text-white shadow-lg active:scale-90 transition-all md:hidden"
          >
            <Camera class="w-5 h-5" />
          </button>
        </div>
        <button
          v-else
          @click="$emit('capture')"
          class="w-full aspect-video rounded-[32px] border-2 border-dashed border-stone-200 bg-stone-50 flex flex-col items-center justify-center gap-3 text-stone-400 hover:border-orange-200 hover:bg-orange-50/30 transition-all active:scale-[0.98]"
        >
          <div class="p-4 bg-white rounded-2xl shadow-sm">
            <Camera class="w-8 h-8 text-orange-600" />
          </div>
          <span class="text-xs font-black uppercase tracking-widest"
            >Take Mission Photo</span
          >
        </button>
      </div>

      <!-- Difficulty Level -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3
            class="text-sm font-black uppercase tracking-[0.1em] text-stone-900"
          >
            Difficulty Level
          </h3>
          <span class="text-xs font-bold text-orange-600 uppercase"
            >Level {{ modelValue.difficulty }}</span
          >
        </div>
        <div
          class="flex justify-between bg-white p-5 rounded-[28px] border border-stone-100 shadow-sm"
        >
          <button
            v-for="i in 5"
            :key="i"
            @click="updateDifficulty(i)"
            class="p-2 transition-all"
            :class="
              i <= modelValue.difficulty
                ? 'text-orange-500 scale-110'
                : 'text-stone-200'
            "
          >
            <Star
              class="w-8 h-8"
              :class="{ 'fill-current': i <= modelValue.difficulty }"
            />
          </button>
        </div>
      </div>

      <!-- Mission Name -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3
            class="text-sm font-black uppercase tracking-[0.1em] text-stone-900"
          >
            Mission Name <span class="text-stone-400 ml-1">(Optional)</span>
          </h3>
        </div>
        <input
          :value="modelValue.locationName"
          @input="updateName(($event.target as HTMLInputElement).value)"
          type="text"
          class="w-full bg-white px-6 py-5 rounded-[28px] border border-stone-100 shadow-sm text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          placeholder="e.g. The Secret Fountain"
        />
      </div>

      <!-- Mission Tips (Draggable List) -->
      <div class="space-y-4">
        <h3
          class="text-sm font-black uppercase tracking-[0.1em] text-stone-900"
        >
          Mission Hints <span class="text-stone-400 ml-1">(Optional)</span>
        </h3>

        <!-- Add Tip Input -->
        <div class="relative">
          <input
            v-model="newTip"
            @keyup.enter="addTip"
            type="text"
            class="w-full bg-white px-6 py-5 pr-16 rounded-[28px] border border-stone-100 shadow-sm text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            placeholder="Add a hint..."
          />
          <button
            @click="addTip"
            :class="[
              'absolute right-3 top-3 bottom-3 w-12 bg-orange-600 text-white rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg shadow-orange-600/20',
              newTip.trim()
                ? 'opacity-100 scale-100 active:scale-95'
                : 'opacity-20 grayscale scale-95 pointer-events-none',
            ]"
          >
            <Plus class="w-6 h-6" />
          </button>
        </div>

        <!-- Draggable Tips List -->
        <div class="space-y-3 pt-2 relative">
          <TransitionGroup name="list" tag="div" class="space-y-3">
            <div
              v-for="(tip, index) in modelValue.tips"
              :key="tip.id"
              draggable="true"
              @dragstart="onDragStart(index)"
              @dragover.prevent="onDragOver($event, index)"
              @dragend="onDragEnd"
              class="flex items-center gap-3 p-4 bg-white rounded-3xl border border-stone-100 shadow-sm transition-all duration-300 cursor-default"
              :class="{
                'opacity-40 scale-95 border-orange-200': dragIndex === index,
              }"
            >
              <!-- Drag Handle & Number -->
              <div
                class="flex items-center gap-2 pr-2 border-r border-stone-100"
              >
                <GripVertical
                  class="w-4 h-4 text-stone-300 cursor-grab active:cursor-grabbing"
                />
                <div
                  class="w-6 h-6 rounded-full bg-orange-50 flex items-center justify-center text-[10px] font-black text-orange-600"
                >
                  {{ index + 1 }}
                </div>
              </div>

              <p class="flex-1 text-sm font-bold text-stone-600">
                {{ tip.text }}
              </p>

              <!-- Remove Button -->
              <button
                @click="removeTip(index)"
                class="p-2 text-stone-300 hover:text-rose-500 transition-all active:scale-90"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </div>

    <div
      class="fixed bottom-0 inset-x-0 p-8 bg-gradient-to-t from-stone-50 via-stone-50 to-transparent z-20"
    >
      <button
        @click="$emit('save')"
        :disabled="!modelValue.image"
        :class="[
          'w-full py-6 rounded-[32px] font-black text-white transition-all duration-300 flex items-center justify-center gap-3 text-lg tracking-tight',
          modelValue.image
            ? 'bg-orange-600 shadow-2xl shadow-orange-600/40 active:scale-95'
            : 'bg-stone-300 cursor-not-allowed opacity-50 shadow-none',
        ]"
      >
        <Check class="w-6 h-6" /> Publish Mission
      </button>
    </div>
  </div>
</template>

<style scoped>
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}

.list-leave-active {
  position: absolute;
  width: 100%;
}
</style>
