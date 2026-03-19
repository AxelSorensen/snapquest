<script setup lang="ts">
import { computed } from 'vue'
import { Trophy, Star, AlertTriangle } from 'lucide-vue-next'

const props = defineProps({
  score: { type: Number, required: true },
  explanation: { type: String, default: '' },
  loading: Boolean,
  isSuccess: Boolean,
  starsEarned: { type: Number, default: 0 },
  xpEarned: { type: Number, default: 0 }
})

const colorClass = computed(() => {
  if (props.isSuccess) return 'text-green-600'
  if (props.score >= 75) return 'text-orange-600'
  if (props.score >= 50) return 'text-amber-500'
  return 'text-rose-500'
})

const bgClass = computed(() => {
  if (props.isSuccess) return 'bg-green-50'
  if (props.score >= 75) return 'bg-orange-50'
  if (props.score >= 50) return 'bg-amber-50'
  return 'bg-rose-50'
})

const message = computed(() => {
  if (props.isSuccess) return 'Congrats you did it!'
  if (props.score >= 90) return 'Almost Perfect!'
  if (props.score >= 75) return 'Great Eye!'
  if (props.score >= 50) return 'Getting Close!'
  return 'Keep Hunting!'
})
</script>

<template>
  <div class="w-full max-w-sm flex flex-col items-center gap-4 py-6 px-6 rounded-[32px] bg-white border border-stone-100 shadow-xl shadow-orange-900/5 animate-in fade-in zoom-in duration-300">
    <div v-if="loading" class="flex flex-col items-center gap-4 py-6">
      <div class="relative">
        <div class="w-16 h-16 border-[4px] border-orange-100 rounded-full"></div>
        <div class="absolute inset-0 w-16 h-16 border-[4px] border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <div class="text-center space-y-1">
        <p class="text-orange-600 font-black uppercase tracking-[0.2em] text-[8px]">Analyzing</p>
        <p class="text-stone-400 text-[10px] font-bold">Comparing landmarks...</p>
      </div>
    </div>

    <template v-else>
      <div class="relative flex items-center justify-center">
        <!-- Circular Progress -->
        <svg class="w-40 h-40 transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="currentColor"
            stroke-width="10"
            class="text-stone-50"
          />
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="currentColor"
            stroke-width="10"
            :stroke-dasharray="2 * Math.PI * 70"
            :stroke-dashoffset="2 * Math.PI * 70 * (1 - score / 100)"
            class="transition-all duration-1000 ease-out"
            :class="colorClass"
            stroke-linecap="round"
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-4xl font-black text-stone-900 tabular-nums tracking-tighter">{{ score }}%</span>
          <span class="text-[8px] uppercase tracking-[0.2em] text-stone-400 font-black">Match</span>
        </div>
      </div>

      <div class="text-center space-y-3 w-full">
        <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl shadow-sm mx-auto" :class="bgClass">
          <Trophy v-if="isSuccess" class="w-4 h-4 text-green-600" />
          <Star v-else-if="score >= 50" class="w-4 h-4 text-amber-600" />
          <AlertTriangle v-else class="w-4 h-4 text-rose-600" />
          <span class="text-[10px] font-black uppercase tracking-wider" :class="colorClass">{{ message }}</span>
        </div>

        <!-- Success Rewards -->
        <div v-if="isSuccess" class="flex flex-col items-center gap-3 py-2 animate-in fade-in slide-in-from-bottom-2 duration-400 delay-200 fill-mode-both">
          <div class="flex gap-1.5">
            <Star 
              v-for="i in 3" 
              :key="i" 
              class="w-8 h-8 transition-all duration-300"
              :class="[
                i <= starsEarned ? 'text-amber-400 fill-current scale-110' : 'text-stone-100',
                { 'delay-[200ms]': i === 1, 'delay-[300ms]': i === 2, 'delay-[400ms]': i === 3 }
              ]"
            />
          </div>
          <div class="px-4 py-1 bg-stone-900 rounded-full shadow-lg">
            <p class="text-[10px] font-black text-white uppercase tracking-[0.2em]">+{{ xpEarned }} XP</p>
          </div>
        </div>

        <div class="relative px-2">
          <p class="text-stone-600 leading-relaxed text-[13px] font-medium italic relative z-10">
            {{ explanation }}
          </p>
        </div>
      </div>
    </template>
  </div>

</template>

