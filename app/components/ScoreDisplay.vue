<script setup lang="ts">
import { computed } from 'vue'
import { Trophy, Star, AlertTriangle } from 'lucide-vue-next'

const props = defineProps({
  score: { type: Number, required: true },
  explanation: { type: String, default: '' },
  loading: Boolean
})

const colorClass = computed(() => {
  if (props.score >= 80) return 'text-orange-600'
  if (props.score >= 50) return 'text-amber-500'
  return 'text-rose-500'
})

const bgClass = computed(() => {
  if (props.score >= 80) return 'bg-orange-50'
  if (props.score >= 50) return 'bg-amber-50'
  return 'bg-rose-50'
})

const message = computed(() => {
  if (props.score >= 90) return 'Perfect Match!'
  if (props.score >= 80) return 'Excellent Eye!'
  if (props.score >= 50) return 'Getting Close!'
  return 'Keep Hunting!'
})
</script>

<template>
  <div class="w-full max-w-sm flex flex-col items-center gap-8 py-12 px-6 rounded-[44px] bg-white border border-stone-100 shadow-2xl shadow-orange-900/5 animate-in fade-in zoom-in duration-500">
    <div v-if="loading" class="flex flex-col items-center gap-6 py-10">
      <div class="relative">
        <div class="w-24 h-24 border-[6px] border-orange-100 rounded-full"></div>
        <div class="absolute inset-0 w-24 h-24 border-[6px] border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <div class="text-center space-y-2">
        <p class="text-orange-600 font-black uppercase tracking-[0.2em] text-[10px]">Analyzing Perspective</p>
        <p class="text-stone-400 text-[11px] font-bold">Gemini 2.0 Flash comparing landmarks...</p>
      </div>
    </div>

    <template v-else>
      <div class="relative flex items-center justify-center">
        <!-- Circular Progress -->
        <svg class="w-56 h-56 transform -rotate-90">
          <circle
            cx="112"
            cy="112"
            r="100"
            fill="none"
            stroke="currentColor"
            stroke-width="14"
            class="text-stone-50"
          />
          <circle
            cx="112"
            cy="112"
            r="100"
            fill="none"
            stroke="currentColor"
            stroke-width="14"
            :stroke-dasharray="2 * Math.PI * 100"
            :stroke-dashoffset="2 * Math.PI * 100 * (1 - score / 100)"
            class="transition-all duration-1000 ease-out"
            :class="colorClass"
            stroke-linecap="round"
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-6xl font-black text-stone-900 tabular-nums tracking-tighter">{{ score }}%</span>
          <span class="text-[10px] uppercase tracking-[0.25em] text-stone-400 font-black mt-1">Accuracy</span>
        </div>
      </div>

      <div class="text-center space-y-5">
        <div class="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl shadow-sm" :class="bgClass">
          <Trophy v-if="score >= 80" class="w-5 h-5 text-orange-600" />
          <Star v-else-if="score >= 50" class="w-5 h-5 text-amber-600" />
          <AlertTriangle v-else class="w-5 h-5 text-rose-600" />
          <span class="text-xs font-black uppercase tracking-wider" :class="colorClass">{{ message }}</span>
        </div>
        
        <div class="relative px-2">
          <div class="absolute -top-5 -left-1 text-7xl text-stone-100 font-serif leading-none opacity-50">“</div>
          <p class="text-stone-600 leading-relaxed text-[15px] font-medium italic relative z-10">
            {{ explanation }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

